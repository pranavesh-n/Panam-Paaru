import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const DEFAULT_CATEGORIES = [
  // Expense
  { name: "Food & Dining", type: "expense" as const, color: "#FFE600", icon: "Utensils" },
  { name: "Shopping & Retail", type: "expense" as const, color: "#FF4D8D", icon: "ShoppingBag" },
  { name: "Transport & Fuel", type: "expense" as const, color: "#00F0FF", icon: "Car" },
  { name: "Housing & Utilities", type: "expense" as const, color: "#9B51E0", icon: "Home" },
  { name: "Bills & Subscriptions", type: "expense" as const, color: "#FF8800", icon: "Receipt" },
  { name: "Health & Fitness", type: "expense" as const, color: "#05DF72", icon: "HeartPulse" },
  { name: "Entertainment", type: "expense" as const, color: "#FF4343", icon: "Film" },
  { name: "Education", type: "expense" as const, color: "#0066FF", icon: "GraduationCap" },
  { name: "Other Expense", type: "expense" as const, color: "#A0A0A0", icon: "CircleEllipsis" },
  // Income
  { name: "Salary & Wages", type: "income" as const, color: "#05DF72", icon: "Briefcase" },
  { name: "Freelance & Projects", type: "income" as const, color: "#2EE59D", icon: "Laptop" },
  { name: "Investments & Dividends", type: "income" as const, color: "#00F0FF", icon: "TrendingUp" },
  { name: "Business Revenue", type: "income" as const, color: "#FFE600", icon: "Store" },
  { name: "Gifts & Grants", type: "income" as const, color: "#FF4D8D", icon: "Gift" },
  { name: "Other Income", type: "income" as const, color: "#9B51E0", icon: "Coins" },
];

/**
 * Gets the current authenticated user profile and initializes default categories/settings if new.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const security = await ctx.db
      .query("userSecurity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return {
      ...user,
      settings: settings || {
        currency: "INR",
        currencySymbol: "₹",
        monthStartDay: 1,
        budgetRollover: false,
      },
      hasPin: !!security?.pinEnabled,
      autoLockTimeoutMs: security?.autoLockTimeoutMs ?? 300000, // default 5 mins
    };
  },
});

/**
 * Ensures user preferences and default categories exist in Convex Cloud DB.
 */
export const initializeUserData = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Initialize user settings if not present
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!existingSettings) {
      await ctx.db.insert("userSettings", {
        userId,
        currency: "INR",
        currencySymbol: "₹",
        monthStartDay: 1,
        budgetRollover: false,
        updatedAt: Date.now(),
      });
    }

    // Initialize default categories if none exist
    const existingCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(1);

    if (existingCategories.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        await ctx.db.insert("categories", {
          userId,
          name: cat.name,
          type: cat.type,
          color: cat.color,
          icon: cat.icon,
          isCustom: false,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Updates user cloud preferences (currency, month start date)
 */
export const updateSettings = mutation({
  args: {
    currency: v.string(),
    currencySymbol: v.string(),
    monthStartDay: v.number(),
    budgetRollover: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        currency: args.currency,
        currencySymbol: args.currencySymbol,
        monthStartDay: args.monthStartDay,
        budgetRollover: args.budgetRollover,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        currency: args.currency,
        currencySymbol: args.currencySymbol,
        monthStartDay: args.monthStartDay,
        budgetRollover: args.budgetRollover,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
