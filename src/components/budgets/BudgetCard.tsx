import React from 'react';
import { Budget } from '../../types';
import { NeoProgress } from '../ui/NeoProgress';
import { NeoBadge } from '../ui/NeoBadge';
import { CalendarSync, AlertTriangle, CheckCircle2, Clock, Trash2, Edit } from 'lucide-react';

interface BudgetCardProps {
  budget: Budget;
  onEdit: (b: Budget) => void;
  onDelete: (id: string) => void;
  currencySymbol?: string;
}

export const BudgetCard: React.FC<BudgetCardProps> = ({
  budget,
  onEdit,
  onDelete,
  currencySymbol = '₹',
}) => {
  const spent = budget.spentAmount ?? 0;
  const total = budget.amount;
  const remaining = budget.remainingAmount ?? Math.max(0, total - spent);
  const percent = budget.progressPercent ?? Math.round((spent / total) * 100);
  const isOver = budget.isOverBudget ?? spent > total;
  const isWarning = budget.isWarning ?? (percent >= (budget.alertThreshold ?? 80) && !isOver);

  const recurrenceBadges: Record<string, { label: string; color: string }> = {
    daily: { label: 'DAILY', color: '#FFE600' },
    weekly: { label: 'WEEKLY', color: '#00F0FF' },
    monthly: { label: 'MONTHLY', color: '#05DF72' },
    quarterly: { label: 'QUARTERLY', color: '#FF4D8D' },
    yearly: { label: 'YEARLY', color: '#9B51E0' },
  };

  const badgeInfo = recurrenceBadges[budget.recurrence] || { label: budget.recurrence, color: '#FFE600' };

  return (
    <div className="bg-white border-[3px] border-[#121212] shadow-neo p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-neo-lg">
      
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="neo-badge text-[10px]"
              style={{ backgroundColor: badgeInfo.color }}
            >
              {badgeInfo.label}
            </span>
            <span className="text-[11px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 border border-neutral-300">
              {budget.category}
            </span>
          </div>
          <h4 className="text-base font-black uppercase text-[#121212] tracking-tight">
            {budget.name}
          </h4>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEdit(budget)}
            className="p-1.5 bg-white hover:bg-[#FFE600] border border-[#121212] shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            title="Edit Budget"
          >
            <Edit size={13} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete budget "${budget.name}"?`)) {
                onDelete(budget._id);
              }
            }}
            className="p-1.5 bg-white hover:bg-[#FF4343] hover:text-white border border-[#121212] shadow-neo-sm active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
            title="Delete Budget"
          >
            <Trash2 size={13} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Spend Numbers */}
      <div className="flex items-baseline justify-between pt-1">
        <div>
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            SPENT THIS CYCLE
          </span>
          <span
            className={`text-xl font-mono font-black ${
              isOver ? 'text-[#FF4343]' : 'text-[#121212]'
            }`}
          >
            {currencySymbol}{spent.toLocaleString()}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black uppercase text-neutral-500 block">
            LIMIT
          </span>
          <span className="text-base font-mono font-bold text-neutral-700">
            {currencySymbol}{total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex flex-col gap-1.5">
        <NeoProgress value={spent} max={total} />
        <div className="flex items-center justify-between text-[11px] font-bold">
          <span className={isOver ? 'text-[#FF4343] font-black' : isWarning ? 'text-[#FF8800] font-black' : 'text-neutral-600'}>
            {percent}% used
          </span>
          <span className="font-mono text-neutral-600">
            {isOver ? (
              <span className="text-[#FF4343] font-black">
                Over by {currencySymbol}{(spent - total).toLocaleString()}
              </span>
            ) : (
              <span>{currencySymbol}{remaining.toLocaleString()} left</span>
            )}
          </span>
        </div>
      </div>

      {/* Cycle Boundaries & Engine Info */}
      {budget.activePeriod && (
        <div className="pt-3 border-t-2 border-neutral-100 flex items-center justify-between text-[10px] font-mono font-bold text-neutral-600">
          <div className="flex items-center gap-1">
            <Clock size={12} className="text-neutral-500" />
            <span>
              {budget.activePeriod.startDate} → {budget.activePeriod.endDate}
            </span>
          </div>
          <div className="bg-neutral-100 px-1.5 py-0.5 border border-neutral-300">
            Next: {budget.activePeriod.nextOccurrenceDate}
          </div>
        </div>
      )}

      {/* Warning Pill if Near/Over Limit */}
      {isOver ? (
        <div className="bg-[#FF4343] text-white p-2 border-2 border-[#121212] shadow-neo-sm text-xs font-black flex items-center gap-1.5">
          <AlertTriangle size={15} strokeWidth={3} className="shrink-0" />
          <span>BUDGET EXCEEDED BY {currencySymbol}{(spent - total).toLocaleString()}</span>
        </div>
      ) : isWarning ? (
        <div className="bg-[#FFE600] text-[#121212] p-2 border-2 border-[#121212] shadow-neo-sm text-xs font-black flex items-center gap-1.5">
          <AlertTriangle size={15} strokeWidth={3} className="shrink-0" />
          <span>Approaching Limit ({percent}% used)</span>
        </div>
      ) : null}

    </div>
  );
};
