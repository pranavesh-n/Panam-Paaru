import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Financial transactions (Income and Expenses)
  transactions: defineTable({
    userId: v.id("users"),
    title: v.string(),
    amount: v.number(), // Always stored as positive number (in standard currency units, e.g. 500.50)
    type: v.union(v.literal("income"), v.literal("expense")),
    category: v.string(),
    date: v.string(), // ISO date string (YYYY-MM-DD or full ISO)
    notes: v.optional(v.string()),
    budgetId: v.optional(v.id("budgets")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_type", ["userId", "type"])
    .index("by_user_category", ["userId", "category"]),

  // Calendar-Aware Recurring Budgets
  budgets: defineTable({
    userId: v.id("users"),
    name: v.string(),
    amount: v.number(), // Budget limit
    category: v.string(),
    recurrence: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly")
    ),
    startDate: v.string(), // Anchor ISO date string (e.g. 2026-01-31)
    alertThreshold: v.optional(v.number()), // percentage warning e.g. 80
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_category", ["userId", "category"]),

  // Custom and Default Categories
  categories: defineTable({
    userId: v.id("users"),
    name: v.string(),
    type: v.union(v.literal("income"), v.literal("expense")),
    color: v.string(),
    icon: v.string(),
    isCustom: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"]),

  // 6-Digit PIN Security Lock Cloud Storage (Zero local storage persistence)
  userSecurity: defineTable({
    userId: v.id("users"),
    pinEnabled: v.boolean(),
    pinHash: v.string(), // SHA-256 / PBKDF2 hash of 6-digit PIN with salt
    pinSalt: v.string(),
    autoLockTimeoutMs: v.number(), // e.g. 0 (immediate), 60000 (1 min), 300000 (5 mins), -1 (never)
    failedAttempts: v.number(),
    lastFailedAttemptAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // User Cloud Preferences (Currency, Month Start Day, etc.)
  userSettings: defineTable({
    userId: v.id("users"),
    currency: v.string(), // "INR", "USD", "EUR", "GBP"
    currencySymbol: v.string(), // "₹", "$", "€", "£"
    monthStartDay: v.number(), // 1 - 31
    budgetRollover: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),
});
