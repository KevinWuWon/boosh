import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Get all books ordered by creation time (newest first)
 */
export const list = query({
  args: {},
  returns: v.array(
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
    })
  ),
  handler: async (ctx) => {
    const books = await ctx.db
      .query("books")
      .order("desc")
      .collect();
    return books;
  },
});

/**
 * Get a single book by ID
 */
export const get = query({
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
    const book = await ctx.db.get(args.bookId);
    return book;
  },
});

/**
 * Create a new book and trigger AI processing if PDF is provided
 */
export const create = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    uploadedFileId: v.optional(v.id("_storage")),
  },
  returns: v.id("books"),
  handler: async (ctx, args) => {
    // Create book with pending status
    const bookId = await ctx.db.insert("books", {
      title: args.title,
      author: args.author,
      uploadedFileId: args.uploadedFileId,
      status: args.uploadedFileId ? "pending" : "ready",
    });

    // If PDF was uploaded, schedule AI processing
    if (args.uploadedFileId) {
      await ctx.scheduler.runAfter(0, internal.ai.createFileSearchStore, {
        bookId,
      });
    }

    return bookId;
  },
});

/**
 * Generate an upload URL for PDF files
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Get processing status for a book including lesson count
 */
export const getProcessingStatus = query({
  args: { bookId: v.id("books") },
  returns: v.union(
    v.object({
      status: v.string(),
      lessonsGenerated: v.number(),
      processingError: v.optional(v.string()),
      processedAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      return null;
    }

    // Count lessons generated so far
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();

    return {
      status: book.status,
      lessonsGenerated: lessons.length,
      processingError: book.processingError,
      processedAt: book.processedAt,
    };
  },
});

/**
 * Regenerate lessons for an existing book
 * Useful for retrying failed processing or regenerating lessons
 */
export const regenerateLessons = mutation({
  args: { bookId: v.id("books") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.bookId);
    if (!book) {
      throw new Error("Book not found");
    }

    if (!book.fileSearchStoreName) {
      throw new Error("Book must be uploaded first - no File Search store found");
    }

    // Clear existing lessons
    const existingLessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();

    for (const lesson of existingLessons) {
      await ctx.db.delete(lesson._id);
    }

    // Reset book status and clear errors
    await ctx.db.patch(args.bookId, {
      status: "processing",
      processingError: undefined,
      processedAt: undefined,
    });

    // Trigger lesson generation from batch 0
    await ctx.scheduler.runAfter(0, internal.ai.generateLessonsForBook, {
      bookId: args.bookId,
      batchNumber: 0,
    });

    return null;
  },
});

/**
 * Internal query: Get book details (used by AI actions)
 */
export const getBookInternal = internalQuery({
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
 * Internal mutation: Update book status (used by AI actions)
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
 * Internal mutation: Update book with File Search store name (used by AI actions)
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
