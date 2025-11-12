import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Books uploaded by users
  books: defineTable({
    title: v.string(),
    author: v.string(),
    // Reference to uploaded PDF file in Convex storage (optional for now)
    uploadedFileId: v.optional(v.id("_storage")),
    // Status: "pending", "processing", "ready", "error"
    status: v.string(),
  }),

  // Individual lessons extracted from books
  lessons: defineTable({
    bookId: v.id("books"),
    chapterNumber: v.number(),
    lessonNumber: v.number(),
    title: v.string(),
    content: v.string(),
    // Optional exercise text (can be null if lesson has no exercise)
    exercise: v.optional(v.string()),
  }).index("by_book", ["bookId"]),

  // User progress tracking for lesson completion
  userProgress: defineTable({
    // For Phase 1, we'll use a single user. In later phases, this can be a proper userId
    userId: v.optional(v.string()),
    lessonId: v.id("lessons"),
    completedAt: v.number(),
    // Optional user response to exercise
    exerciseResponse: v.optional(v.string()),
  }).index("by_lesson", ["lessonId"]),
});
