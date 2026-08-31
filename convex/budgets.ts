import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getActiveBudgetPeriod, RecurrenceFrequency } from "./engine/recurrence";

export const listWithProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const budgets = await ctx.db
      .query("budgets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (budgets.length === 0) return [];

    // Fetch all user expense transactions to compute period spend
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user_type", (q) => q.eq("userId", userId).eq("type", "expense"))
      .collect();

    const now = new Date();

    return budgets.map((budget) => {
      const activePeriod = getActiveBudgetPeriod(
        budget.startDate,
        budget.recurrence as RecurrenceFrequency,
        now
      );

      // Sum expenses for this budget category strictly within the active period
      const matchingTxs = transactions.filter((tx) => {
        if (tx.category !== budget.category) return false;
        return tx.date >= activePeriod.startDate && tx.date <= activePeriod.endDate;
      });

      const spentAmount = matchingTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const remainingAmount = Math.max(0, budget.amount - spentAmount);
      const progressPercent = budget.amount > 0 ? Math.round((spentAmount / budget.amount) * 100) : 0;
      const isOverBudget = spentAmount > budget.amount;
      const threshold = budget.alertThreshold ?? 80;
      const isWarning = progressPercent >= threshold && !isOverBudget;

      return {
        ...budget,
        activePeriod,
        spentAmount,
        remainingAmount,
        progressPercent,
        isOverBudget,
        isWarning,
        transactionCount: matchingTxs.length,
      };
    });
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    category: v.string(),
    recurrence: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly")
    ),
    startDate: v.string(),
    alertThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (args.amount <= 0) {
      throw new Error("Budget amount must be greater than 0");
    }

    return await ctx.db.insert("budgets", {
      userId,
      name: args.name.trim(),
      amount: args.amount,
      category: args.category,
      recurrence: args.recurrence,
      startDate: args.startDate,
      alertThreshold: args.alertThreshold ?? 80,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("budgets"),
    name: v.string(),
    amount: v.number(),
    category: v.string(),
    recurrence: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly")
    ),
    startDate: v.string(),
    alertThreshold: v.optional(v.number()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const budget = await ctx.db.get(args.id);
    if (!budget || budget.userId !== userId) {
      throw new Error("Budget not found or unauthorized");
    }

    await ctx.db.patch(args.id, {
      name: args.name.trim(),
      amount: args.amount,
      category: args.category,
      recurrence: args.recurrence,
      startDate: args.startDate,
      alertThreshold: args.alertThreshold ?? 80,
      isActive: args.isActive,
    });

    return { success: true };
  },
});

export const remove = mutation({
  args: {
    id: v.id("budgets"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const budget = await ctx.db.get(args.id);
    if (!budget || budget.userId !== userId) {
      throw new Error("Budget not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
