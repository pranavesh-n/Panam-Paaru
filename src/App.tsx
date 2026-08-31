import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useConvexAuth } from '@convex-dev/auth/react';
import { api } from '../convex/_generated/api';
import {
  Transaction,
  Budget,
  Category,
  FinancialStats,
  SpendingAnalytics,
  UserProfile,
  TransactionType,
  RecurrenceType,
} from './types';

// Contexts
import { PinLockProvider, usePinLock } from './context/PinLockContext';
import { PrivacyProvider, usePrivacy } from './context/PrivacyContext';

// Layout & Components
import { Header } from './components/layout/Header';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { AuthScreen } from './components/auth/AuthScreen';
import { PinLockScreen } from './components/pin/PinLockScreen';
import { PinSetupModal } from './components/pin/PinSetupModal';
import { TransactionFormModal } from './components/transactions/TransactionFormModal';
import { BudgetModal } from './components/budgets/BudgetModal';

// Pages
import { OverviewPage } from './pages/OverviewPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { BudgetsPage } from './pages/BudgetsPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsPage } from './pages/SettingsPage';

// Default categories
const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Food & Dining', type: 'expense', color: '#FFE600', icon: 'Utensils' },
  { name: 'Shopping & Retail', type: 'expense', color: '#FF4D8D', icon: 'ShoppingBag' },
  { name: 'Transport & Fuel', type: 'expense', color: '#00F0FF', icon: 'Car' },
  { name: 'Housing & Utilities', type: 'expense', color: '#9B51E0', icon: 'Home' },
  { name: 'Bills & Subscriptions', type: 'expense', color: '#FF8800', icon: 'Receipt' },
  { name: 'Health & Fitness', type: 'expense', color: '#05DF72', icon: 'HeartPulse' },
  { name: 'Entertainment', type: 'expense', color: '#FF4343', icon: 'Film' },
  { name: 'Salary & Wages', type: 'income', color: '#05DF72', icon: 'Briefcase' },
  { name: 'Freelance & Projects', type: 'income', color: '#2EE59D', icon: 'Laptop' },
  { name: 'Investments & Dividends', type: 'income', color: '#00F0FF', icon: 'TrendingUp' },
];

export function AppContent() {
  const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();
  const { isPinEnabled, lockNow, isLocked } = usePinLock();

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('overview');

  // Modals State
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [isPinSetupModalOpen, setIsPinSetupModalOpen] = useState(false);

  // Live Cloud Subscriptions
  const cloudUser = useQuery(api.users.currentUser);
  const cloudTransactions = useQuery(api.transactions.list, {});
  const cloudStats = useQuery(api.transactions.getStats);
  const cloudBudgets = useQuery(api.budgets.listWithProgress);
  const cloudCategories = useQuery(api.transactions.getCategories);
  const cloudAnalytics = useQuery(api.insights.getSpendingAnalytics);

  // Cloud Mutations
  const addTransactionMutation = useMutation(api.transactions.add);
  const updateTransactionMutation = useMutation(api.transactions.update);
  const removeTransactionMutation = useMutation(api.transactions.remove);
  const createBudgetMutation = useMutation(api.budgets.create);
  const updateBudgetMutation = useMutation(api.budgets.update);
  const removeBudgetMutation = useMutation(api.budgets.remove);
  const updateSettingsMutation = useMutation(api.users.updateSettings);
  const initializeUserDataMutation = useMutation(api.users.initializeUserData);

  // Auto-initialize categories & cloud preferences on login
  useEffect(() => {
    if (isAuthenticated) {
      initializeUserDataMutation().catch(() => {});
    }
  }, [isAuthenticated, initializeUserDataMutation]);

  // Global Keyboard Shortcuts (N = New Transaction, B = New Budget, L = Lock)
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input/textarea/select
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingTransaction(null);
        setIsTransactionModalOpen(true);
      } else if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setEditingBudget(null);
        setIsBudgetModalOpen(true);
      } else if (e.key === 'l' || e.key === 'L') {
        if (isPinEnabled) {
          e.preventDefault();
          lockNow();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthenticated, isLocked, isPinEnabled, lockNow]);

  // Clean, live user data only
  const transactions: Transaction[] = cloudTransactions ?? [];
  const budgets: Budget[] = cloudBudgets ?? [];
  const categories: Category[] = cloudCategories && cloudCategories.length > 0 ? cloudCategories : DEFAULT_CATEGORIES;
  const user: UserProfile | null = cloudUser ?? null;

  const currencySymbol = user?.settings?.currencySymbol || '₹';
  const currentCurrency = user?.settings?.currency || 'INR';

  const stats: FinancialStats = cloudStats ?? {
    totalIncome: 0,
    totalExpense: 0,
    totalBalance: 0,
    thisMonthIncome: 0,
    thisMonthExpense: 0,
    savingsRate: 0,
    transactionCount: 0,
  };

  const analytics: SpendingAnalytics = cloudAnalytics ?? {
    categoryBreakdown: [],
    monthlyTrends: [],
    dailyAverageExpense: 0,
    highestExpenseCategory: null,
    totalExpensesThisMonth: 0,
    totalIncomeThisMonth: 0,
  };

  // Transaction Handlers with Zero-Latency Optimistic Response
  const handleSaveTransaction = async (data: {
    title: string;
    amount: number;
    type: TransactionType;
    category: string;
    date: string;
    notes?: string;
  }) => {
    if (navigator.vibrate) navigator.vibrate(20);

    if (editingTransaction) {
      await updateTransactionMutation({
        id: editingTransaction._id as any,
        ...data,
      });
    } else {
      await addTransactionMutation(data);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    await removeTransactionMutation({ id: id as any });
  };

  // Budget Handlers
  const handleSaveBudget = async (data: {
    name: string;
    amount: number;
    category: string;
    recurrence: RecurrenceType;
    startDate: string;
    alertThreshold?: number;
  }) => {
    if (navigator.vibrate) navigator.vibrate(20);

    if (editingBudget) {
      await updateBudgetMutation({
        id: editingBudget._id as any,
        isActive: true,
        ...data,
      });
    } else {
      await createBudgetMutation(data);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    await removeBudgetMutation({ id: id as any });
  };

  const handleUpdateCurrency = async (curr: string, symbol: string) => {
    await updateSettingsMutation({
      currency: curr,
      currencySymbol: symbol,
      monthStartDay: 1,
      budgetRollover: false,
    });
  };

  // 1. Unauthenticated screen
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // 2. Strict PIN Lock Guard (Prevents ANY home page or financial data flash)
  if (isLocked) {
    return <PinLockScreen />;
  }

  return (
    <div className="min-h-screen bg-[#FFFDF5] text-[#121212] flex flex-col font-sans selection:bg-[#FFE600] selection:text-[#121212]">
      
      {/* Top Header with Eye Privacy Toggle */}
      <Header
        user={user}
        onOpenTransactionModal={() => {
          setEditingTransaction(null);
          setIsTransactionModalOpen(true);
        }}
        onOpenPinSetup={() => setIsPinSetupModalOpen(true)}
      />

      {/* Main Layout Container */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto pb-20 md:pb-8">
        
        {/* Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          stats={stats}
          currencySymbol={currencySymbol}
        />

        {/* Dynamic Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'overview' && (
            <OverviewPage
              stats={stats}
              transactions={transactions}
              budgets={budgets}
              categories={categories}
              onOpenAddModal={(type) => {
                setEditingTransaction(null);
                setIsTransactionModalOpen(true);
              }}
              onOpenBudgetModal={() => {
                setEditingBudget(null);
                setIsBudgetModalOpen(true);
              }}
              onNavigateToTab={setActiveTab}
              currencySymbol={currencySymbol}
              userName={user?.name}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsPage
              transactions={transactions}
              categories={categories}
              user={user}
              onOpenAddModal={() => {
                setEditingTransaction(null);
                setIsTransactionModalOpen(true);
              }}
              onEdit={(tx) => {
                setEditingTransaction(tx);
                setIsTransactionModalOpen(true);
              }}
              onDelete={handleDeleteTransaction}
              currencySymbol={currencySymbol}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetsPage
              budgets={budgets}
              categories={categories}
              onOpenBudgetModal={() => {
                setEditingBudget(null);
                setIsBudgetModalOpen(true);
              }}
              onEdit={(b) => {
                setEditingBudget(b);
                setIsBudgetModalOpen(true);
              }}
              onDelete={handleDeleteBudget}
              currencySymbol={currencySymbol}
            />
          )}

          {activeTab === 'insights' && (
            <InsightsPage
              analytics={analytics}
              currencySymbol={currencySymbol}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              user={user}
              onOpenPinSetup={(isChange) => setIsPinSetupModalOpen(true)}
              onUpdateCurrency={handleUpdateCurrency}
              currencySymbol={currencySymbol}
              currentCurrency={currentCurrency}
            />
          )}
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Dock */}
      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenAddModal={() => {
          setEditingTransaction(null);
          setIsTransactionModalOpen(true);
        }}
      />

      {/* Transaction Modal */}
      <TransactionFormModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setEditingTransaction(null);
        }}
        onSubmit={handleSaveTransaction}
        initialData={editingTransaction}
        categories={categories}
        currencySymbol={currencySymbol}
      />

      {/* Recurring Budget Modal */}
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => {
          setIsBudgetModalOpen(false);
          setEditingBudget(null);
        }}
        onSubmit={handleSaveBudget}
        initialData={editingBudget}
        categories={categories}
        currencySymbol={currencySymbol}
      />

      {/* 6-Digit PIN Setup & Management Modal */}
      <PinSetupModal
        isOpen={isPinSetupModalOpen}
        onClose={() => setIsPinSetupModalOpen(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <PrivacyProvider>
      <PinLockProvider>
        <AppContent />
      </PinLockProvider>
    </PrivacyProvider>
  );
}
