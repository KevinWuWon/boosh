"use node";

import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenerativeAI } from "@google/genai";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

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
      await ctx.runMutation(internal.ai.updateBookStatus, {
        bookId: args.bookId,
        status: "uploading",
      });

      // Get book details
      const book = await ctx.runQuery(internal.ai.getBook, {
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

      // Convert Blob to Buffer for Google SDK
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Initialize Google Generative AI client
      const ai = new GoogleGenerativeAI(apiKey);

      // Create File Search store
      console.log(`Creating File Search store for book: ${book.title}`);
      const storeResponse = await ai.fileSearchStores.create({
        config: {
          displayName: `${book.title} - ${book.author}`,
        },
      });

      const storeName = storeResponse.name;
      console.log(`File Search store created: ${storeName}`);

      // Upload PDF to the store
      console.log(`Uploading PDF to File Search store...`);
      const uploadResponse = await ai.fileSearchStores.uploadToFileSearchStore({
        file: buffer,
        fileSearchStoreName: storeName,
        config: {
          displayName: `${book.title}.pdf`,
          mimeType: "application/pdf",
        },
      });

      console.log(`PDF uploaded: ${uploadResponse.file?.name}`);

      // Wait for indexing to complete (poll the operation)
      const operationName = uploadResponse.name;
      let indexed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 attempts * 2 seconds = 1 minute max

      while (!indexed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const operation = await ai.fileSearchStores.getOperation({
          name: operationName,
        });

        if (operation.done) {
          indexed = true;
          console.log(`PDF indexing complete`);
        }
        attempts++;
      }

      if (!indexed) {
        throw new Error("PDF indexing timed out");
      }

      // Save store name and update status
      await ctx.runMutation(internal.ai.updateBookWithStore, {
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
      await ctx.runMutation(internal.ai.updateBookStatus, {
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
      const book = await ctx.runQuery(internal.ai.getBook, {
        bookId: args.bookId,
      });

      if (!book || !book.fileSearchStoreName) {
        throw new Error("Book or File Search store not found");
      }

      // Get existing lesson count
      const existingLessons = await ctx.runQuery(internal.ai.getLessonCount, {
        bookId: args.bookId,
      });

      console.log(
        `Generating lesson batch ${args.batchNumber} for: ${book.title} (${existingLessons} lessons so far)`
      );

      // Generate lessons using Vercel AI SDK with File Search
      const result = await generateObject({
        model: google("gemini-2.0-flash-exp", {
          useSearchGrounding: true,
        }),
        output: "object",
        schema: LessonBatchSchema,
        prompt: `You are an expert at creating daily learning lessons from books.

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

Extract the next 5-10 lessons. Return hasMore=true if there are more lessons to extract after this batch.`,
        tools: {
          fileSearch: google.tools.fileSearch({
            fileSearchStoreNames: [book.fileSearchStoreName],
          }),
        },
      });

      const { lessons, hasMore, estimatedTotalLessons } = result.object;

      console.log(
        `Generated ${lessons.length} lessons. hasMore=${hasMore}, estimated total=${estimatedTotalLessons}`
      );

      // Save lessons to database
      if (lessons.length > 0) {
        await ctx.runMutation(internal.ai.saveLessonsBatch, {
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
        await ctx.runMutation(internal.ai.updateBookStatus, {
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
        await ctx.runMutation(internal.ai.updateBookStatus, {
          bookId: args.bookId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return null;
    }
  },
});

/**
 * Internal mutation: Save a batch of lessons to the database
 */
export const saveLessonsBatch = internalMutation({
  args: {
    bookId: v.id("books"),
    lessons: v.array(
      v.object({
        chapterNumber: v.number(),
        lessonNumber: v.number(),
        title: v.string(),
        content: v.string(),
        exercise: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const lesson of args.lessons) {
      await ctx.db.insert("lessons", {
        bookId: args.bookId,
        chapterNumber: lesson.chapterNumber,
        lessonNumber: lesson.lessonNumber,
        title: lesson.title,
        content: lesson.content,
        exercise: lesson.exercise,
      });
    }
    return null;
  },
});

/**
 * Internal query: Get book details
 */
export const getBook = internalQuery({
  args: { bookId: v.id("books") },
  returns: v.union(
    v.object({
      _id: v.id("books"),
      _creationTime: v.number(),
      title: v.string(),
      author: v.string(),
      uploadedFileId: v.optional(v.id("_storage")),
      fileSearchStoreName: v.optional(v.string()),
      status: v.string(),
      processingError: v.optional(v.string()),
      processedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookId);
  },
});

/**
 * Internal query: Get lesson count for a book
 */
export const getLessonCount = internalQuery({
  args: { bookId: v.id("books") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    return lessons.length;
  },
});

/**
 * Internal mutation: Update book status
 */
export const updateBookStatus = internalMutation({
  args: {
    bookId: v.id("books"),
    status: v.string(),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: {
      status: string;
      processingError?: string;
      processedAt?: number;
    } = {
      status: args.status,
    };

    if (args.error) {
      updates.processingError = args.error;
    }

    if (args.status === "ready") {
      updates.processedAt = Date.now();
    }

    await ctx.db.patch(args.bookId, updates);
    return null;
  },
});

/**
 * Internal mutation: Update book with File Search store name
 */
export const updateBookWithStore = internalMutation({
  args: {
    bookId: v.id("books"),
    fileSearchStoreName: v.string(),
    status: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.bookId, {
      fileSearchStoreName: args.fileSearchStoreName,
      status: args.status,
    });
    return null;
  },
});
