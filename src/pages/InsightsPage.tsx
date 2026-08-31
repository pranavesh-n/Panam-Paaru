import React from 'react';
import { SpendingAnalytics } from '../types';
import { PieChart, TrendingUp, TrendingDown, Flame, DollarSign, Calendar } from 'lucide-react';

interface InsightsPageProps {
  analytics: SpendingAnalytics | null;
  currencySymbol?: string;
}

export const InsightsPage: React.FC<InsightsPageProps> = ({
  analytics,
  currencySymbol = '₹',
}) => {
  const categoryBreakdown = analytics?.categoryBreakdown ?? [];
  const monthlyTrends = analytics?.monthlyTrends ?? [];
  const dailyAverage = analytics?.dailyAverageExpense ?? 0;
  const highestCategory = analytics?.highestExpenseCategory;

  // Max value for scaling trend bars
  const maxTrendAmount = Math.max(
    ...monthlyTrends.map((t) => Math.max(t.income, t.expense)),
    1000
  );

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-150">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#FF4D8D] p-4 sm:p-6 border-[3px] border-[#121212] shadow-neo text-white">
        <div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-[#121212] text-[#FF4D8D] px-2 py-0.5 inline-block mb-1">
            SPENDING INTELLIGENCE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
            INSIGHTS & CASH FLOW
          </h2>
          <p className="text-xs font-bold text-white/90 mt-0.5">
            Detailed spending distribution and cash flow trends.
          </p>
        </div>
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {/* Daily Burn Rate */}
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-neutral-500 block">
              AVG DAILY EXPENSE (THIS MONTH)
            </span>
            <span className="text-2xl font-mono font-black text-[#121212]">
              {currencySymbol}{dailyAverage.toLocaleString()}
            </span>
          </div>
          <div className="w-10 h-10 bg-[#FFE600] border-2 border-[#121212] flex items-center justify-center font-black">
            <Flame size={20} className="text-[#FF4343]" />
          </div>
        </div>

        {/* Top Spending Category */}
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase text-neutral-500 block">
              TOP EXPENSE CATEGORY
            </span>
            <span className="text-xl font-black uppercase text-[#121212] truncate block">
              {highestCategory ? highestCategory.name : 'None'}
            </span>
            {highestCategory && (
              <span className="text-xs font-mono font-bold text-[#FF4343]">
                {currencySymbol}{highestCategory.total.toLocaleString()} ({highestCategory.percentage}%)
              </span>
            )}
          </div>
          <div className="w-10 h-10 bg-[#00F0FF] border-2 border-[#121212] flex items-center justify-center font-black">
            <PieChart size={20} />
          </div>
        </div>

        {/* Net Monthly Cashflow */}
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div>
            <span className="text-[10px] font-black uppercase text-neutral-500 block">
              THIS MONTH NET CASH FLOW
            </span>
            <span
              className={`text-2xl font-mono font-black ${
                (analytics?.totalIncomeThisMonth ?? 0) >= (analytics?.totalExpensesThisMonth ?? 0)
                  ? 'text-[#05DF72]'
                  : 'text-[#FF4343]'
              }`}
            >
              {(analytics?.totalIncomeThisMonth ?? 0) >= (analytics?.totalExpensesThisMonth ?? 0) ? '+' : ''}
              {currencySymbol}
              {((analytics?.totalIncomeThisMonth ?? 0) - (analytics?.totalExpensesThisMonth ?? 0)).toLocaleString()}
            </span>
          </div>
          <div className="w-10 h-10 bg-[#05DF72] border-2 border-[#121212] flex items-center justify-center font-black">
            <TrendingUp size={20} />
          </div>
        </div>

      </div>

      {/* 6-Month Income vs Expense Trend Bar Chart */}
      <div className="bg-white border-[3px] border-[#121212] shadow-neo p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-[#121212] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#FFE600] border border-[#121212] flex items-center justify-center">
              <Calendar size={14} />
            </div>
            <h3 className="text-sm font-black uppercase text-[#121212] tracking-wider">
              6-Month Cash Flow Trend (Income vs Expense)
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-[#05DF72] border border-[#121212]" />
              <span>Income</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 bg-[#FF4343] border border-[#121212]" />
              <span>Expense</span>
            </div>
          </div>
        </div>

        {/* Bar Chart Visualization */}
        <div className="grid grid-cols-6 gap-2 sm:gap-4 h-64 pt-6 items-end border-b-2 border-[#121212] pb-2">
          {monthlyTrends.map((m) => {
            const incomeHeight = Math.max(4, Math.round((m.income / maxTrendAmount) * 100));
            const expenseHeight = Math.max(4, Math.round((m.expense / maxTrendAmount) * 100));

            return (
              <div key={m.monthKey} className="flex flex-col items-center h-full justify-end gap-2 group">
                <div className="flex items-end gap-1 sm:gap-2 w-full justify-center h-full">
                  {/* Income Bar */}
                  <div
                    title={`Income: ${currencySymbol}${m.income.toLocaleString()}`}
                    className="w-3.5 sm:w-6 bg-[#05DF72] border-2 border-[#121212] transition-all hover:bg-[#2EE59D] relative shadow-neo-sm"
                    style={{ height: `${incomeHeight}%` }}
                  />
                  {/* Expense Bar */}
                  <div
                    title={`Expense: ${currencySymbol}${m.expense.toLocaleString()}`}
                    className="w-3.5 sm:w-6 bg-[#FF4343] border-2 border-[#121212] transition-all hover:bg-[#FF5C5C] relative shadow-neo-sm"
                    style={{ height: `${expenseHeight}%` }}
                  />
                </div>
                <span className="text-[10px] sm:text-xs font-mono font-black uppercase text-neutral-700">
                  {m.monthLabel}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Breakdown (Current Month) */}
      <div className="bg-white border-[3px] border-[#121212] shadow-neo p-5 sm:p-6 flex flex-col gap-4">
        <div className="border-b-2 border-[#121212] pb-3">
          <h3 className="text-sm font-black uppercase text-[#121212] tracking-wider">
            Current Month Expense Breakdown by Category
          </h3>
        </div>

        {categoryBreakdown.length === 0 ? (
          <div className="py-8 text-center text-xs font-bold text-neutral-500">
            No expenses recorded for the current month.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {categoryBreakdown.map((cat) => (
              <div key={cat.name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs font-black uppercase">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 border border-[#121212]"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span>{cat.name}</span>
                    <span className="text-[10px] font-bold text-neutral-500">
                      ({cat.count} transaction{cat.count > 1 ? 's' : ''})
                    </span>
                  </div>
                  <div className="font-mono">
                    {currencySymbol}{cat.total.toLocaleString()} ({cat.percentage}%)
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-white border-2 border-[#121212] p-[1px] shadow-neo-sm">
                  <div
                    className="h-full border-r border-[#121212] transition-all duration-300"
                    style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
