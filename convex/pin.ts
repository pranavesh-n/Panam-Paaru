import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Fast SHA-256 hasher using standard Web Crypto API
 */
async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + ":" + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Returns whether PIN lock is enabled and current auto-lock settings.
 * Does NOT expose salt or hash.
 */
export const getPinStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const security = await ctx.db
      .query("userSecurity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return {
      pinEnabled: security?.pinEnabled ?? false,
      autoLockTimeoutMs: security?.autoLockTimeoutMs ?? 300000,
      failedAttempts: security?.failedAttempts ?? 0,
      isLockedOut: (security?.failedAttempts ?? 0) >= 5,
    };
  },
});

/**
 * Sets or updates the 6-Digit PIN
 */
export const setPin = mutation({
  args: {
    pin: v.string(),
    autoLockTimeoutMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    if (!/^\d{6}$/.test(args.pin)) {
      throw new Error("PIN must be exactly 6 numeric digits");
    }

    const salt = generateSalt();
    const hash = await hashPin(args.pin, salt);

    const existing = await ctx.db
      .query("userSecurity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        pinEnabled: true,
        pinHash: hash,
        pinSalt: salt,
        autoLockTimeoutMs: args.autoLockTimeoutMs ?? existing.autoLockTimeoutMs,
        failedAttempts: 0,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("userSecurity", {
        userId,
        pinEnabled: true,
        pinHash: hash,
        pinSalt: salt,
        autoLockTimeoutMs: args.autoLockTimeoutMs ?? 300000,
        failedAttempts: 0,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

/**
 * Verifies the entered 6-Digit PIN
 */
export const verifyPin = mutation({
  args: {
    pin: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const security = await ctx.db
      .query("userSecurity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!security || !security.pinEnabled) {
      return { success: true, message: "PIN lock not enabled" };
    }

    // Check lockout
    if (security.failedAttempts >= 5) {
      const lockCooldown = 60000; // 1 min cooldown after 5 failed attempts
      if (
        security.lastFailedAttemptAt &&
        Date.now() - security.lastFailedAttemptAt < lockCooldown
      ) {
        const remainingSec = Math.ceil(
          (lockCooldown - (Date.now() - security.lastFailedAttemptAt)) / 1000
        );
        return {
          success: false,
          locked: true,
          message: `Too many failed attempts. Try again in ${remainingSec} seconds.`,
        };
      }
    }

    const testHash = await hashPin(args.pin, security.pinSalt);
    if (testHash === security.pinHash) {
      // Reset failed attempts on success
      await ctx.db.patch(security._id, {
        failedAttempts: 0,
        updatedAt: Date.now(),
      });
      return { success: true };
    } else {
      const newFailed = (security.failedAttempts || 0) + 1;
      await ctx.db.patch(security._id, {
        failedAttempts: newFailed,
        lastFailedAttemptAt: Date.now(),
        updatedAt: Date.now(),
      });
      return {
        success: false,
        remainingAttempts: Math.max(0, 5 - newFailed),
        message: `Incorrect PIN. ${Math.max(0, 5 - newFailed)} attempts left.`,
      };
    }
  },
});

/**
 * Disables PIN Lock after validating current PIN
 */
export const disablePin = mutation({
  args: {
    currentPin: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const security = await ctx.db
      .query("userSecurity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (!security || !security.pinEnabled) {
      return { success: true };
    }

    const testHash = await hashPin(args.currentPin, security.pinSalt);
    if (testHash !== security.pinHash) {
      throw new Error("Incorrect current PIN");
    }

    await ctx.db.patch(security._id, {
      pinEnabled: false,
      failedAttempts: 0,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Updates the auto-lock timeout duration
 */
export const setAutoLockTimeout = mutation({
  args: {
    autoLockTimeoutMs: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const security = await ctx.db
      .query("userSecurity")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (security) {
      await ctx.db.patch(security._id, {
        autoLockTimeoutMs: args.autoLockTimeoutMs,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});
