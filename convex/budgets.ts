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

      const effectiveTotalPool = (budget.currentLoadedAmount ?? budget.initialLoadedAmount) ?? budget.amount;
      const spentAmount = matchingTxs.reduce((sum, tx) => sum + tx.amount, 0);
      const remainingAmount = Math.max(0, effectiveTotalPool - spentAmount);
      const progressPercent = effectiveTotalPool > 0 ? Math.min(100, Math.round((spentAmount / effectiveTotalPool) * 100)) : 0;
      const remainingPercent = 100 - progressPercent;
      const isOverBudget = spentAmount > effectiveTotalPool;

      // Low balance warning triggers (Dual Thresholds: Percent OR Amount)
      const isLowAmount =
        budget.lowBalanceThresholdAmount !== undefined &&
        budget.lowBalanceThresholdAmount > 0 &&
        remainingAmount <= budget.lowBalanceThresholdAmount;

      const isLowPercent =
        budget.lowBalanceThresholdPercent !== undefined &&
        budget.lowBalanceThresholdPercent > 0 &&
        remainingPercent <= budget.lowBalanceThresholdPercent;

      const defaultWarning = progressPercent >= (budget.alertThreshold ?? 80);
      const isWarning = (isLowAmount || isLowPercent || defaultWarning) && !isOverBudget;

      return {
        ...budget,
        effectiveTotalPool,
        activePeriod,
        spentAmount,
        remainingAmount,
        progressPercent,
        remainingPercent,
        isOverBudget,
        isWarning,
        isLowAmount,
        isLowPercent,
        transactionCount: matchingTxs.length,
      };
    });
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    amount: v.number(),
    initialLoadedAmount: v.optional(v.number()),
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
    lowBalanceThresholdAmount: v.optional(v.number()),
    lowBalanceThresholdPercent: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (args.amount <= 0 && (!args.initialLoadedAmount || args.initialLoadedAmount <= 0)) {
      throw new Error("Budget limit or loaded amount must be greater than 0");
    }

    const initialLoaded = args.initialLoadedAmount ?? args.amount;

    return await ctx.db.insert("budgets", {
      userId,
      name: args.name.trim(),
      amount: args.amount,
      initialLoadedAmount: initialLoaded,
      currentLoadedAmount: initialLoaded,
      category: args.category,
      recurrence: args.recurrence,
      startDate: args.startDate,
      alertThreshold: args.alertThreshold ?? 80,
      lowBalanceThresholdAmount: args.lowBalanceThresholdAmount,
      lowBalanceThresholdPercent: args.lowBalanceThresholdPercent,
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
    initialLoadedAmount: v.optional(v.number()),
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
    lowBalanceThresholdAmount: v.optional(v.number()),
    lowBalanceThresholdPercent: v.optional(v.number()),
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
      initialLoadedAmount: args.initialLoadedAmount ?? budget.initialLoadedAmount,
      category: args.category,
      recurrence: args.recurrence,
      startDate: args.startDate,
      alertThreshold: args.alertThreshold ?? 80,
      lowBalanceThresholdAmount: args.lowBalanceThresholdAmount,
      lowBalanceThresholdPercent: args.lowBalanceThresholdPercent,
      isActive: args.isActive,
    });

    return { success: true };
  },
});

export const topUp = mutation({
  args: {
    id: v.id("budgets"),
    topUpAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (args.topUpAmount <= 0) {
      throw new Error("Top-up amount must be greater than 0");
    }

    const budget = await ctx.db.get(args.id);
    if (!budget || budget.userId !== userId) {
      throw new Error("Budget not found or unauthorized");
    }

    const currentTotal = (budget.currentLoadedAmount ?? budget.initialLoadedAmount) ?? budget.amount;
    const newTotal = currentTotal + args.topUpAmount;

    await ctx.db.patch(args.id, {
      currentLoadedAmount: newTotal,
    });

    return { success: true, newLoadedAmount: newTotal };
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
