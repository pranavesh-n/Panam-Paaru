export type TransactionType = 'income' | 'expense';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Transaction {
  _id: string;
  userId?: string;
  title: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  notes?: string;
  budgetId?: string;
  createdAt: number;
}

export interface Budget {
  _id: string;
  userId?: string;
  name: string;
  amount: number;
  category: string;
  recurrence: RecurrenceType;
  startDate: string;
  alertThreshold?: number;
  isActive: boolean;
  activePeriod?: {
    startDate: string;
    endDate: string;
    nextOccurrenceDate: string;
    periodIndex: number;
  };
  spentAmount?: number;
  remainingAmount?: number;
  progressPercent?: number;
  isOverBudget?: boolean;
  isWarning?: boolean;
  transactionCount?: number;
}

export interface Category {
  _id?: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string;
  isCustom?: boolean;
}

export interface UserProfile {
  _id: string;
  name?: string;
  email?: string;
  image?: string;
  settings?: {
    currency: string;
    currencySymbol: string;
    monthStartDay: number;
    budgetRollover: boolean;
  };
  hasPin?: boolean;
  autoLockTimeoutMs?: number;
}

export interface PinStatus {
  pinEnabled: boolean;
  autoLockTimeoutMs: number;
  failedAttempts: number;
  isLockedOut: boolean;
}

export interface FinancialStats {
  totalIncome: number;
  totalExpense: number;
  totalBalance: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  savingsRate: number;
  transactionCount: number;
}

export interface SpendingAnalytics {
  categoryBreakdown: {
    name: string;
    total: number;
    count: number;
    color: string;
    percentage: number;
  }[];
  monthlyTrends: {
    monthKey: string;
    monthLabel: string;
    income: number;
    expense: number;
    net: number;
  }[];
  dailyAverageExpense: number;
  highestExpenseCategory: {
    name: string;
    total: number;
    count: number;
    color: string;
    percentage: number;
  } | null;
  totalExpensesThisMonth: number;
  totalIncomeThisMonth: number;
}
