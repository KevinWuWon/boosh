import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get progress statistics for a book
 */
export const getProgress = query({
  args: { bookId: v.id("books") },
  returns: v.object({
    totalLessons: v.number(),
    completedLessons: v.number(),
    percentComplete: v.number(),
  }),
  handler: async (ctx, args) => {
    // Get all lessons for this book
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();

    const totalLessons = lessons.length;

    if (totalLessons === 0) {
      return {
        totalLessons: 0,
        completedLessons: 0,
        percentComplete: 0,
      };
    }

    // Count completed lessons
    let completedLessons = 0;
    for (const lesson of lessons) {
      const progress = await ctx.db
        .query("userProgress")
        .withIndex("by_lesson", (q) => q.eq("lessonId", lesson._id))
        .first();

      if (progress) {
        completedLessons++;
      }
    }

    const percentComplete = Math.round((completedLessons / totalLessons) * 100);

    return {
      totalLessons,
      completedLessons,
      percentComplete,
    };
  },
});
