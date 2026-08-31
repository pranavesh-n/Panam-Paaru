import React, { useState, useEffect } from 'react';
import { NeoModal } from '../ui/NeoModal';
import { NeoButton } from '../ui/NeoButton';
import { NeoInput } from '../ui/NeoInput';
import { Budget, Category, RecurrenceType } from '../../types';
import { CalendarSync, Tag, AlertTriangle } from 'lucide-react';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    amount: number;
    category: string;
    recurrence: RecurrenceType;
    startDate: string;
    alertThreshold?: number;
  }) => Promise<void>;
  initialData?: Budget | null;
  categories: Category[];
  currencySymbol?: string;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  categories,
  currencySymbol = '₹',
}) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('monthly');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [alertThreshold, setAlertThreshold] = useState('80');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setAmount(String(initialData.amount));
      setCategory(initialData.category);
      setRecurrence(initialData.recurrence);
      setStartDate(initialData.startDate.slice(0, 10));
      setAlertThreshold(String(initialData.alertThreshold ?? 80));
    } else {
      setName('');
      setAmount('');
      setCategory(expenseCategories[0]?.name || 'Food & Dining');
      setRecurrence('monthly');
      setStartDate(new Date().toISOString().slice(0, 10));
      setAlertThreshold('80');
    }
    setError('');
  }, [initialData, isOpen, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    const numThreshold = parseInt(alertThreshold, 10);

    if (!name.trim()) {
      setError('Please provide a budget name');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive budget limit');
      return;
    }
    if (!category) {
      setError('Please select an expense category');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onSubmit({
        name: name.trim(),
        amount: numAmount,
        category,
        recurrence,
        startDate,
        alertThreshold: !isNaN(numThreshold) ? numThreshold : 80,
      });
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Failed to save recurring budget');
    }
  };

  const recurrenceOptions: { label: string; value: RecurrenceType; desc: string }[] = [
    { label: 'Monthly', value: 'monthly', desc: 'Renews every month (e.g. Jan 31 -> Feb 28 -> Mar 31)' },
    { label: 'Weekly', value: 'weekly', desc: 'Renews every 7 days from start date' },
    { label: 'Daily', value: 'daily', desc: 'Renews daily 24-hour cycle' },
    { label: 'Quarterly', value: 'quarterly', desc: 'Renews every 3 months' },
    { label: 'Yearly', value: 'yearly', desc: 'Renews every 12 months with leap-year handling' },
  ];

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'EDIT RECURRING BUDGET' : 'CREATE RECURRING BUDGET'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Budget Name */}
        <NeoInput
          label="Budget Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Monthly Dining Allowance, Daily Coffee"
          required
        />

        {/* Budget Limit Amount */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212]">
            Spending Limit ({currencySymbol}) *
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-lg font-mono font-black text-neutral-500 pointer-events-none">
              {currencySymbol}
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="5000.00"
              className="neo-input pl-9 pr-3.5 py-2.5 text-xl font-mono font-black text-[#121212]"
              required
            />
          </div>
        </div>

        {/* Category Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
            <Tag size={13} />
            Target Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="neo-input py-2.5 px-3 text-xs font-black uppercase bg-white cursor-pointer"
            required
          >
            {expenseCategories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Recurrence Cycle Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
            <CalendarSync size={13} />
            Recurrence Frequency *
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {recurrenceOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRecurrence(opt.value)}
                className={`p-2.5 text-xs font-black uppercase border-2 transition-all cursor-pointer text-center ${
                  recurrence === opt.value
                    ? 'bg-[#FFE600] text-[#121212] border-[#121212] shadow-neo-sm'
                    : 'bg-white text-neutral-700 border-neutral-300 hover:border-[#121212]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Anchor Start Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212]">
            Anchor Start Date *
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="neo-input py-2 px-3 text-xs font-mono font-bold bg-white cursor-pointer"
            required
          />
          <span className="text-[11px] font-medium text-neutral-500">
            Calendar engine preserves anchor day (e.g. 31st) across variable month lengths.
          </span>
        </div>

        {/* Alert Threshold % */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center justify-between">
            <span>Warning Alert Threshold</span>
            <span className="font-mono font-black">{alertThreshold}%</span>
          </label>
          <input
            type="range"
            min="50"
            max="100"
            step="5"
            value={alertThreshold}
            onChange={(e) => setAlertThreshold(e.target.value)}
            className="w-full accent-[#FF4343] cursor-pointer"
          />
        </div>

        {error && (
          <div className="bg-[#FF4343] text-white text-xs font-bold p-2.5 border-2 border-[#121212] shadow-neo-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2.5 pt-2">
          <NeoButton type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </NeoButton>
          <NeoButton type="submit" variant="secondary" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving...'
              : initialData
              ? 'Update Budget'
              : 'Create Recurring Budget'}
          </NeoButton>
        </div>
      </form>
    </NeoModal>
  );
};
