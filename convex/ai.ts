"use node";

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { internal } from "./_generated/api";

// Zod schema for structured lesson extraction
const LessonSchema = z.object({
  chapterNumber: z.number().describe("Chapter number this lesson belongs to"),
  lessonNumber: z.number().describe("Lesson number within the chapter"),
  title: z.string().describe("Clear, descriptive title for the lesson"),
  content: z
    .string()
    .describe(
      "2-3 paragraphs of key content from the book, suitable for 10-15 minute daily reading"
    ),
  exercise: z
    .string()
    .optional()
    .describe(
      "Exercise prompt (reflective question or action item) - only include if appropriate for this lesson"
    ),
});

const LessonBatchSchema = z.object({
  lessons: z.array(LessonSchema).describe("Array of lessons extracted from the book"),
  hasMore: z
    .boolean()
    .describe("True if there are more lessons remaining in the book"),
  estimatedTotalLessons: z
    .number()
    .optional()
    .describe("Estimated total number of lessons in the entire book"),
});

/**
 * Step 1: Upload PDF to Google File Search store
 * This creates a persistent store that can be queried with AI
 */
export const createFileSearchStore = internalAction({
  args: { bookId: v.id("books") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    try {
      // Update status to "uploading"
      await ctx.runMutation(internal.books.updateBookStatus, {
        bookId: args.bookId,
        status: "uploading",
      });

      // Get book details
      const book = await ctx.runQuery(internal.books.getBookInternal, {
        bookId: args.bookId,
      });

      if (!book || !book.uploadedFileId) {
        throw new Error("Book or PDF file not found");
      }

      // Fetch PDF from Convex storage
      const pdfBlob = await ctx.storage.get(book.uploadedFileId);
      if (!pdfBlob) {
        throw new Error("PDF file not found in storage");
      }

      // Initialize Google Gen AI client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
      });

      // Create File Search store
      console.log(`Creating File Search store for book: ${book.title}`);
      const storeResponse = await ai.fileSearchStores.create({
        config: {
          displayName: `${book.title} - ${book.author}`,
        },
      });

      const storeName = storeResponse.name;
      if (!storeName) {
        throw new Error("Failed to create File Search store");
      }
      console.log(`File Search store created: ${storeName}`);

      // Upload PDF to the store
      console.log(`Uploading PDF to File Search store...`);
      let operation = await ai.fileSearchStores.uploadToFileSearchStore({
        file: pdfBlob,
        fileSearchStoreName: storeName,
        config: {
          displayName: `${book.title}.pdf`,
          mimeType: "application/pdf",
        },
      });

      console.log(`PDF upload initiated`);

      // Wait for indexing to complete (poll the operation)
      let attempts = 0;
      const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute max

      while (!operation.done && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        operation = await ai.operations.get({ operation });

        attempts++;
      }

      if (!operation.done) {
        throw new Error("PDF indexing timed out");
      }

      console.log(`PDF indexing complete`);

      // Save store name and update status
      await ctx.runMutation(internal.books.updateBookWithStore, {
        bookId: args.bookId,
        fileSearchStoreName: storeName,
        status: "processing",
      });

      // Start lesson generation
      await ctx.scheduler.runAfter(
        0,
        internal.ai.generateLessonsForBook,
        {
          bookId: args.bookId,
          batchNumber: 0,
        }
      );

      return null;
    } catch (error) {
      console.error("Error creating File Search store:", error);
      await ctx.runMutation(internal.books.updateBookStatus, {
        bookId: args.bookId,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return null;
    }
  },
});

/**
 * Step 2: Generate lessons from the File Search store using AI
 * Processes in batches to respect rate limits and save partial results
 */
export const generateLessonsForBook = internalAction({
  args: {
    bookId: v.id("books"),
    batchNumber: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    try {
      // Get book details
      const book = await ctx.runQuery(internal.books.getBookInternal, {
        bookId: args.bookId,
      });

      if (!book || !book.fileSearchStoreName) {
        throw new Error("Book or File Search store not found");
      }

      // Get existing lesson count
      const existingLessons = await ctx.runQuery(internal.lessons.getLessonCountInternal, {
        bookId: args.bookId,
      });

      console.log(
        `Generating lesson batch ${args.batchNumber} for: ${book.title} (${existingLessons} lessons so far)`
      );

      // Initialize Google Gen AI client
      const ai = new GoogleGenAI({
        apiKey: apiKey,
      });

      const prompt = `You are an expert at creating daily learning lessons from books.

Analyze the book "${book.title}" by ${book.author} and extract structured lessons suitable for daily reading.

Guidelines:
- Each lesson should take 10-15 minutes to read
- Follow the book's natural chapter structure
- Create clear, descriptive titles
- Extract 2-3 paragraphs of key content per lesson
- Include exercises ONLY when appropriate:
  * Reflective questions for theoretical content
  * Action items for practical content
  * Skip exercises for narrative sections
- Maintain the book's original voice and examples

${existingLessons > 0 ? `You have already generated ${existingLessons} lessons. Continue from where you left off.` : "This is the first batch. Start from the beginning of the book."}

Extract the next 5-10 lessons. Return hasMore=true if there are more lessons to extract after this batch.`;

      // Generate lessons using Google GenAI with File Search and structured output
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: zodToJsonSchema(LessonBatchSchema),
          tools: [
            {
              fileSearch: {
                fileSearchStoreNames: [book.fileSearchStoreName],
              },
            },
          ],
        },
      });

      const resultText = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!resultText) {
        throw new Error("No response from AI");
      }

      const parsedResult = JSON.parse(resultText);
      const { lessons, hasMore, estimatedTotalLessons } = LessonBatchSchema.parse(parsedResult);

      console.log(
        `Generated ${lessons.length} lessons. hasMore=${hasMore}, estimated total=${estimatedTotalLessons}`
      );

      // Save lessons to database
      if (lessons.length > 0) {
        await ctx.runMutation(internal.lessons.saveLessonsBatch, {
          bookId: args.bookId,
          lessons: lessons.map((lesson) => ({
            chapterNumber: lesson.chapterNumber,
            lessonNumber: lesson.lessonNumber,
            title: lesson.title,
            content: lesson.content,
            exercise: lesson.exercise,
          })),
        });
      }

      // If more lessons remain, schedule next batch
      if (hasMore && lessons.length > 0) {
        console.log(`Scheduling next batch: ${args.batchNumber + 1}`);
        await ctx.scheduler.runAfter(
          2000, // 2 second delay between batches
          internal.ai.generateLessonsForBook,
          {
            bookId: args.bookId,
            batchNumber: args.batchNumber + 1,
          }
        );
      } else {
        // All lessons generated - mark as ready
        console.log(`Lesson generation complete for: ${book.title}`);
        await ctx.runMutation(internal.books.updateBookStatus, {
          bookId: args.bookId,
          status: "ready",
        });
      }

      return null;
    } catch (error) {
      console.error("Error generating lessons:", error);

      // Check if it's a rate limit error
      if (
        error instanceof Error &&
        error.message.includes("429")
      ) {
        // Retry with exponential backoff
        const delayMs = Math.min(Math.pow(2, args.batchNumber) * 1000, 30000); // Max 30s
        console.log(`Rate limited. Retrying in ${delayMs}ms...`);
        await ctx.scheduler.runAfter(
          delayMs,
          internal.ai.generateLessonsForBook,
          {
            bookId: args.bookId,
            batchNumber: args.batchNumber,
          }
        );
      } else {
        // Other errors - mark as error but keep partial results
        await ctx.runMutation(internal.books.updateBookStatus, {
          bookId: args.bookId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return null;
    }
  },
});
