import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    type: v.optional(v.union(v.literal("income"), v.literal("expense"))),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    let txQuery = ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    const all = await txQuery.order("desc").collect();

    // Filter in-memory for flexible combination of search, date range, type, category
    return all.filter((tx) => {
      if (args.type && tx.type !== args.type) return false;
      if (args.category && args.category !== "all" && tx.category !== args.category) return false;
      if (args.startDate && tx.date < args.startDate) return false;
      if (args.endDate && tx.date > args.endDate) return false;
      if (args.search) {
        const queryLower = args.search.toLowerCase();
        const matchesTitle = tx.title.toLowerCase().includes(queryLower);
        const matchesNotes = tx.notes?.toLowerCase().includes(queryLower);
        const matchesCategory = tx.category.toLowerCase().includes(queryLower);
        if (!matchesTitle && !matchesNotes && !matchesCategory) return false;
      }
      return true;
    }).slice(0, args.limit ?? 100);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalIncome: 0,
        totalExpense: 0,
        totalBalance: 0,
        thisMonthIncome: 0,
        thisMonthExpense: 0,
        savingsRate: 0,
        transactionCount: 0,
      };
    }

    const all = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let totalIncome = 0;
    let totalExpense = 0;
    let thisMonthIncome = 0;
    let thisMonthExpense = 0;

    for (const tx of all) {
      if (tx.type === "income") {
        totalIncome += tx.amount;
        if (tx.date.startsWith(currentMonthPrefix)) {
          thisMonthIncome += tx.amount;
        }
      } else {
        totalExpense += tx.amount;
        if (tx.date.startsWith(currentMonthPrefix)) {
          thisMonthExpense += tx.amount;
        }
      }
    }

    const totalBalance = totalIncome - totalExpense;
    const savingsRate =
      thisMonthIncome > 0
        ? Math.max(0, Math.round(((thisMonthIncome - thisMonthExpense) / thisMonthIncome) * 100))
        : 0;

    return {
      totalIncome,
      totalExpense,
      totalBalance,
      thisMonthIncome,
      thisMonthExpense,
      savingsRate,
      transactionCount: all.length,
    };
  },
});

export const add = mutation({
  args: {
    title: v.string(),
    amount: v.number(),
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    date: v.string(),
    notes: v.optional(v.string()),
    budgetId: v.optional(v.id("budgets")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (args.amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    return await ctx.db.insert("transactions", {
      userId,
      title: args.title.trim(),
      amount: Math.abs(args.amount),
      type: args.type,
      category: args.category,
      date: args.date,
      notes: args.notes?.trim(),
      budgetId: args.budgetId,
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("transactions"),
    title: v.string(),
    amount: v.number(),
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    date: v.string(),
    notes: v.optional(v.string()),
    budgetId: v.optional(v.id("budgets")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const tx = await ctx.db.get(args.id);
    if (!tx || tx.userId !== userId) {
      throw new Error("Transaction not found or unauthorized");
    }

    await ctx.db.patch(args.id, {
      title: args.title.trim(),
      amount: Math.abs(args.amount),
      type: args.type,
      category: args.category,
      date: args.date,
      notes: args.notes?.trim(),
      budgetId: args.budgetId,
    });

    return { success: true };
  },
});

export const remove = mutation({
  args: {
    id: v.id("transactions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const tx = await ctx.db.get(args.id);
    if (!tx || tx.userId !== userId) {
      throw new Error("Transaction not found or unauthorized");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const addCategory = mutation({
  args: {
    name: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    color: v.string(),
    icon: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    return await ctx.db.insert("categories", {
      userId,
      name: args.name.trim(),
      type: args.type,
      color: args.color,
      icon: args.icon,
      isCustom: true,
    });
  },
});
