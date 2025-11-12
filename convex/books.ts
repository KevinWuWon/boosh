import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

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
      status: v.string(),
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
      status: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.bookId);
    return book;
  },
});

/**
 * Create a new book
 */
export const create = mutation({
  args: {
    title: v.string(),
    author: v.string(),
    uploadedFileId: v.optional(v.id("_storage")),
  },
  returns: v.id("books"),
  handler: async (ctx, args) => {
    const bookId = await ctx.db.insert("books", {
      title: args.title,
      author: args.author,
      uploadedFileId: args.uploadedFileId,
      status: "ready", // For Phase 1, books are always ready
    });
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
