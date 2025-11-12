import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the next incomplete lesson for a book (sequential completion)
 */
export const getNextIncomplete = query({
  args: { bookId: v.id("books") },
  returns: v.union(
    v.object({
      _id: v.id("lessons"),
      _creationTime: v.number(),
      bookId: v.id("books"),
      chapterNumber: v.number(),
      lessonNumber: v.number(),
      title: v.string(),
      content: v.string(),
      exercise: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Get all lessons for this book, ordered by chapter and lesson number
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();

    // Sort by chapter and lesson number
    lessons.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }
      return a.lessonNumber - b.lessonNumber;
    });

    // Find the first lesson that hasn't been completed
    for (const lesson of lessons) {
      const progress = await ctx.db
        .query("userProgress")
        .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
        .first();

      if (!progress) {
        return lesson;
      }
    }

    // All lessons completed or no lessons exist
    return null;
  },
});

/**
 * Get all lessons for a book
 */
export const listByBook = query({
  args: { bookId: v.id("books") },
  returns: v.array(
    v.object({
      _id: v.id("lessons"),
      _creationTime: v.number(),
      bookId: v.id("books"),
      chapterNumber: v.number(),
      lessonNumber: v.number(),
      title: v.string(),
      content: v.string(),
      exercise: v.optional(v.string()),
      isCompleted: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();

    // Sort by chapter and lesson number
    lessons.sort((a, b) => {
      if (a.chapterNumber !== b.chapterNumber) {
        return a.chapterNumber - b.chapterNumber;
      }
      return a.lessonNumber - b.lessonNumber;
    });

    // Check completion status for each lesson
    const lessonsWithProgress = await Promise.all(
      lessons.map(async (lesson) => {
        const progress = await ctx.db
          .query("userProgress")
          .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
          .first();

        return {
          ...lesson,
          isCompleted: !!progress,
        };
      })
    );

    return lessonsWithProgress;
  },
});

/**
 * Get a specific lesson by ID
 */
export const get = query({
  args: { lessonId: v.id("lessons") },
  returns: v.union(
    v.object({
      _id: v.id("lessons"),
      _creationTime: v.number(),
      bookId: v.id("books"),
      chapterNumber: v.number(),
      lessonNumber: v.number(),
      title: v.string(),
      content: v.string(),
      exercise: v.optional(v.string()),
      isCompleted: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) {
      return null;
    }

    const progress = await ctx.db
      .query("userProgress")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .first();

    return {
      ...lesson,
      isCompleted: !!progress,
    };
  },
});

/**
 * Create a new lesson (for admin/manual entry)
 */
export const create = mutation({
  args: {
    bookId: v.id("books"),
    chapterNumber: v.number(),
    lessonNumber: v.number(),
    title: v.string(),
    content: v.string(),
    exercise: v.optional(v.string()),
  },
  returns: v.id("lessons"),
  handler: async (ctx, args) => {
    const lessonId = await ctx.db.insert("lessons", {
      bookId: args.bookId,
      chapterNumber: args.chapterNumber,
      lessonNumber: args.lessonNumber,
      title: args.title,
      content: args.content,
      exercise: args.exercise,
    });
    return lessonId;
  },
});

/**
 * Mark a lesson as complete
 */
export const markComplete = mutation({
  args: {
    lessonId: v.id("lessons"),
    exerciseResponse: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Check if already completed
    const existing = await ctx.db
      .query("userProgress")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .first();

    if (existing) {
      // Already completed, don't create duplicate
      return null;
    }

    await ctx.db.insert("userProgress", {
      lessonId: args.lessonId,
      completedAt: Date.now(),
      exerciseResponse: args.exerciseResponse,
    });

    return null;
  },
});

/**
 * Internal query: Get lesson count for a book (used by AI actions)
 */
export const getLessonCountInternal = internalQuery({
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
