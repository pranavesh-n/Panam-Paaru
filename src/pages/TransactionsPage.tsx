import React, { useState } from 'react';
import { Transaction, Category, UserProfile } from '../types';
import { TransactionTable } from '../components/transactions/TransactionTable';
import { StatementModal } from '../components/transactions/StatementModal';
import { NeoButton } from '../components/ui/NeoButton';
import { Plus, ReceiptText, ArrowLeftRight } from 'lucide-react';

interface TransactionsPageProps {
  transactions: Transaction[];
  categories: Category[];
  user: UserProfile | null;
  onOpenAddModal: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (id: string) => void;
  currencySymbol?: string;
}

export const TransactionsPage: React.FC<TransactionsPageProps> = ({
  transactions,
  categories,
  user,
  onOpenAddModal,
  onEdit,
  onDelete,
  currencySymbol = '₹',
}) => {
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-150">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#00F0FF] p-4 sm:p-6 border-[3px] border-[#121212] shadow-neo">
        <div>
          <span className="text-[10px] font-mono font-black uppercase tracking-widest bg-[#121212] text-[#00F0FF] px-2 py-0.5 inline-block mb-1">
            TRANSACTIONS LEDGER
          </span>
          <h2 className="text-2xl sm:text-3xl font-black uppercase text-[#121212] tracking-tight">
            ALL TRANSACTIONS
          </h2>
          <p className="text-xs font-bold text-neutral-900 mt-0.5">
            Total {transactions.length} recorded transaction{transactions.length === 1 ? '' : 's'}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Download Official Statement Button */}
          <NeoButton
            variant="outline"
            size="md"
            onClick={() => setIsStatementModalOpen(true)}
            className="flex items-center gap-1.5 bg-white"
          >
            <ReceiptText size={16} strokeWidth={2.5} />
            <span>Account Statement</span>
          </NeoButton>

          {/* New Transaction Button */}
          <NeoButton
            variant="dark"
            size="md"
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} strokeWidth={3} className="text-[#05DF72]" />
            <span>New Transaction</span>
          </NeoButton>
        </div>
      </div>

      {/* Transaction Table with Search, Filter & CSV Export */}
      <TransactionTable
        transactions={transactions}
        categories={categories}
        onEdit={onEdit}
        onDelete={onDelete}
        onOpenStatement={() => setIsStatementModalOpen(true)}
        currencySymbol={currencySymbol}
      />

      {/* Official Account Statement Modal (Print / PDF / CSV with Running Balance) */}
      <StatementModal
        isOpen={isStatementModalOpen}
        onClose={() => setIsStatementModalOpen(false)}
        transactions={transactions}
        user={user}
        currencySymbol={currencySymbol}
      />

    </div>
  );
};
