import React from 'react';
import { Budget, Category } from '../types';
import { BudgetCard } from '../components/budgets/BudgetCard';
import { NeoButton } from '../components/ui/NeoButton';
import { CalendarSync, Plus, ShieldCheck, Sparkles } from 'lucide-react';

interface BudgetsPageProps {
  budgets: Budget[];
  categories: Category[];
  onOpenBudgetModal: () => void;
  onEdit: (b: Budget) => void;
  onDelete: (id: string) => void;
  currencySymbol?: string;
}

export const BudgetsPage: React.FC<BudgetsPageProps> = ({
  budgets,
  categories,
  onOpenBudgetModal,
  onEdit,
  onDelete,
  currencySymbol = '₹',
}) => {
  const totalAllocated = budgets.reduce((acc, b) => acc + b.amount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + (b.spentAmount ?? 0), 0);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-150">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#05DF72] p-4 sm:p-6 border-[3px] border-[#121212] shadow-neo">
        <div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-[#121212] text-[#05DF72] px-2 py-0.5 inline-block mb-1">
            RECURRING ENGINE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-[#121212] tracking-tight">
            CALENDAR-AWARE BUDGETS
          </h2>
          <p className="text-xs font-bold text-neutral-900 mt-0.5">
            Deterministic recurrence engine handling leap years and month-end clamping (28/29/30/31 days).
          </p>
        </div>

        <NeoButton
          variant="dark"
          size="md"
          onClick={onOpenBudgetModal}
          className="flex items-center gap-1.5 shrink-0"
        >
          <Plus size={16} strokeWidth={3} className="text-[#FFE600]" />
          <span>New Recurring Budget</span>
        </NeoButton>
      </div>

      {/* Engine Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            TOTAL ACTIVE CYCLES
          </span>
          <span className="text-2xl font-mono font-black text-[#121212]">
            {budgets.length}
          </span>
        </div>

        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            TOTAL ALLOCATED LIMIT
          </span>
          <span className="text-2xl font-mono font-black text-[#121212]">
            {currencySymbol}{totalAllocated.toLocaleString()}
          </span>
        </div>

        <div className="p-4 bg-white border-[3px] border-[#121212] shadow-neo">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            TOTAL SPENT IN ACTIVE CYCLES
          </span>
          <span className="text-2xl font-mono font-black text-[#FF4343]">
            {currencySymbol}{totalSpent.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Budget Grid */}
      {budgets.length === 0 ? (
        <div className="bg-white border-[3px] border-[#121212] shadow-neo p-12 text-center flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-[#FFE600] border-2 border-[#121212] shadow-neo flex items-center justify-center font-black">
            <CalendarSync size={28} />
          </div>
          <h3 className="text-lg font-black uppercase text-[#121212]">
            No Recurring Budgets Set Up
          </h3>
          <p className="text-xs font-semibold text-neutral-600 max-w-md">
            Create your first recurring budget cycle (Daily, Weekly, Monthly, Quarterly, or Yearly). Our backend automatically calculates live spend within the active period!
          </p>
          <NeoButton variant="secondary" size="md" onClick={onOpenBudgetModal} className="mt-2">
            Create Recurring Budget
          </NeoButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {budgets.map((b) => (
            <BudgetCard
              key={b._id}
              budget={b}
              onEdit={onEdit}
              onDelete={onDelete}
              currencySymbol={currencySymbol}
            />
          ))}
        </div>
      )}

    </div>
  );
};
