import React, { useState, useEffect } from 'react';
import { NeoModal } from '../ui/NeoModal';
import { NeoButton } from '../ui/NeoButton';
import { NeoInput } from '../ui/NeoInput';
import { Transaction, TransactionType, Category } from '../../types';
import { ArrowDownLeft, ArrowUpRight, Calendar, Tag, FileText } from 'lucide-react';

interface TransactionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    amount: number;
    type: TransactionType;
    category: string;
    date: string;
    notes?: string;
  }) => Promise<void>;
  initialData?: Transaction | null;
  categories: Category[];
  currencySymbol?: string;
}

export const TransactionFormModal: React.FC<TransactionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  categories,
  currencySymbol = '₹',
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setTitle(initialData.title);
      setAmount(String(initialData.amount));
      setCategory(initialData.category);
      setDate(initialData.date.slice(0, 10));
      setNotes(initialData.notes || '');
    } else {
      setType('expense');
      setTitle('');
      setAmount('');
      setCategory(categories.find((c) => c.type === 'expense')?.name || 'Food & Dining');
      setDate(new Date().toISOString().slice(0, 10));
      setNotes('');
    }
    setError('');
  }, [initialData, isOpen, categories]);

  const filteredCategories = categories.filter((c) => c.type === type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!title.trim()) {
      setError('Please provide a transaction title');
      return;
    }
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    if (!category) {
      setError('Please select a category');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await onSubmit({
        title: title.trim(),
        amount: numAmount,
        type,
        category,
        date,
        notes: notes.trim() || undefined,
      });
      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setError(err.message || 'Failed to save transaction');
    }
  };

  return (
    <NeoModal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'EDIT TRANSACTION' : 'ADD NEW TRANSACTION'}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Type Toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 border-2 border-[#121212]">
          <button
            type="button"
            onClick={() => {
              setType('expense');
              const firstExp = categories.find((c) => c.type === 'expense');
              if (firstExp) setCategory(firstExp.name);
            }}
            className={`py-2 px-3 text-xs font-black uppercase flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
              type === 'expense'
                ? 'bg-[#FF4343] text-white border-[#121212] shadow-neo-sm'
                : 'bg-transparent text-neutral-600 border-transparent hover:text-[#121212]'
            }`}
          >
            <ArrowUpRight size={16} strokeWidth={3} />
            Expense
          </button>

          <button
            type="button"
            onClick={() => {
              setType('income');
              const firstInc = categories.find((c) => c.type === 'income');
              if (firstInc) setCategory(firstInc.name);
            }}
            className={`py-2 px-3 text-xs font-black uppercase flex items-center justify-center gap-1.5 border-2 transition-all cursor-pointer ${
              type === 'income'
                ? 'bg-[#05DF72] text-[#121212] border-[#121212] shadow-neo-sm'
                : 'bg-transparent text-neutral-600 border-transparent hover:text-[#121212]'
            }`}
          >
            <ArrowDownLeft size={16} strokeWidth={3} />
            Income
          </button>
        </div>

        {/* Amount Input */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212]">
            Amount ({currencySymbol}) *
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
              placeholder="0.00"
              className="neo-input pl-9 pr-3.5 py-3 text-xl font-mono font-black text-[#121212]"
              required
              autoFocus
            />
          </div>
        </div>

        {/* Title Input */}
        <NeoInput
          label="Title / Description"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Grocery Shopping, Client Invoice"
          required
        />

        {/* Category Selector */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
            <Tag size={13} />
            Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="neo-input py-2.5 px-3 text-xs font-black uppercase bg-white cursor-pointer"
            required
          >
            {filteredCategories.map((cat) => (
              <option key={cat.name} value={cat.name}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
            <Calendar size={13} />
            Transaction Date *
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="neo-input py-2.5 px-3 text-xs font-mono font-bold bg-white cursor-pointer"
            required
          />
        </div>

        {/* Optional Notes */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-black uppercase tracking-wider text-[#121212] flex items-center gap-1">
            <FileText size={13} />
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional context..."
            rows={2}
            className="neo-input p-2.5 text-xs font-semibold resize-none"
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
          <NeoButton
            type="submit"
            variant={type === 'expense' ? 'danger' : 'secondary'}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Saving...'
              : initialData
              ? 'Update Transaction'
              : 'Save Transaction'}
          </NeoButton>
        </div>
      </form>
    </NeoModal>
  );
};
