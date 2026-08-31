import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getSpendingAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        categoryBreakdown: [],
        monthlyTrends: [],
        dailyAverageExpense: 0,
        highestExpenseCategory: null,
        totalExpensesThisMonth: 0,
        totalIncomeThisMonth: 0,
      };
    }

    const allTxs = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = new Date();
    const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // 1. Category Breakdown for current month
    const categoryTotals: Record<string, { total: number; count: number; color: string }> = {};
    let totalExpensesThisMonth = 0;
    let totalIncomeThisMonth = 0;

    // Fetch category metadata for colors
    const userCategories = await ctx.db
      .query("categories")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const categoryColorMap = new Map<string, string>();
    userCategories.forEach((c: any) => {
      if (c && c.name && c.color) {
        categoryColorMap.set(String(c.name), String(c.color));
      }
    });

    for (const tx of allTxs) {
      if (tx.date.startsWith(currentMonthPrefix)) {
        if (tx.type === "expense") {
          totalExpensesThisMonth += tx.amount;
          if (!categoryTotals[tx.category]) {
            categoryTotals[tx.category] = {
              total: 0,
              count: 0,
              color: categoryColorMap.get(tx.category) || "#FFE600",
            };
          }
          categoryTotals[tx.category].total += tx.amount;
          categoryTotals[tx.category].count += 1;
        } else {
          totalIncomeThisMonth += tx.amount;
        }
      }
    }

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        color: data.color,
        percentage:
          totalExpensesThisMonth > 0
            ? Math.round((data.total / totalExpensesThisMonth) * 100)
            : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // 2. Past 6 Months Monthly Trends
    const monthlyTrends: { monthLabel: string; monthKey: string; income: number; expense: number; net: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("default", { month: "short" });

      let inc = 0;
      let exp = 0;
      for (const tx of allTxs) {
        if (tx.date.startsWith(key)) {
          if (tx.type === "income") inc += tx.amount;
          else exp += tx.amount;
        }
      }

      monthlyTrends.push({
        monthKey: key,
        monthLabel: label,
        income: inc,
        expense: exp,
        net: inc - exp,
      });
    }

    // 3. Daily Average Expense for current month
    const daysInCurrentMonthPassed = Math.max(1, now.getDate());
    const dailyAverageExpense = Math.round(totalExpensesThisMonth / daysInCurrentMonthPassed);

    return {
      categoryBreakdown,
      monthlyTrends,
      dailyAverageExpense,
      highestExpenseCategory: categoryBreakdown[0] || null,
      totalExpensesThisMonth,
      totalIncomeThisMonth,
    };
  },
});
