// ─── Transactions & Spending ────────────────────────────────────────

export type CategoryType = 'predefined' | 'custom';

export interface Category {
  id?: number;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}

export interface CategoryRule {
  id?: number;
  keyword: string;
  categoryId: number;
  isAutoCreated: boolean;
}

export interface Transaction {
  id?: number;
  date: string;           // ISO date string YYYY-MM-DD
  description: string;
  amount: number;
  balance?: number;
  categoryId: number | null;
  bankFormat: string;
  importBatch: string;
  isManual: boolean;
  hash: string;           // for duplicate detection
}

// ─── Investments ────────────────────────────────────────────────────

export type AccountType = 'ISK' | 'AF' | 'KF' | 'TJP';

export interface InvestmentAccount {
  id?: number;
  name: string;
  type: AccountType;
  broker: string;
}

export interface Holding {
  id?: number;
  accountId: number;
  name: string;
  ticker: string;
  assetClass: 'stock' | 'fund' | 'etf' | 'bond' | 'other';
  currentPrice: number;
  currentPriceDate: string;
}

export interface HoldingLot {
  id?: number;
  holdingId: number;
  units: number;
  purchasePrice: number;
  purchaseDate: string;
}

// ─── Net Worth ──────────────────────────────────────────────────────

export type AssetType = 'cash' | 'property' | 'vehicle' | 'other';
export type LiabilityType = 'mortgage' | 'car_loan' | 'student_loan' | 'credit_card' | 'other';

export interface Asset {
  id?: number;
  name: string;
  type: AssetType;
  value: number;
  lastUpdated: string;
}

export interface Liability {
  id?: number;
  name: string;
  type: LiabilityType;
  amount: number;
  interestRate: number;
  monthlyPayment: number;
}

export interface NetWorthSnapshot {
  id?: number;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

// ─── Budget & Goals ─────────────────────────────────────────────────

export interface Budget {
  id?: number;
  categoryId: number;
  monthlyAmount: number;
  month: string;          // YYYY-MM
}

export interface SavingsGoal {
  id?: number;
  name: string;
  targetAmount: number;
  targetDate: string;
  currentAmount: number;
  icon: string;
  color: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

export interface MonthlySpending {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  total: number;
  count: number;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalPL: number;
  totalPLPercent: number;
}
