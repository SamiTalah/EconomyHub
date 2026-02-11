import Dexie, { type Table } from 'dexie';
import type {
  Transaction, Category, CategoryRule, InvestmentAccount,
  Holding, HoldingLot, Asset, Liability, NetWorthSnapshot,
  Budget, SavingsGoal,
} from '../types';

export class EkonomiDB extends Dexie {
  transactions!: Table<Transaction>;
  categories!: Table<Category>;
  categoryRules!: Table<CategoryRule>;
  investmentAccounts!: Table<InvestmentAccount>;
  holdings!: Table<Holding>;
  holdingLots!: Table<HoldingLot>;
  assets!: Table<Asset>;
  liabilities!: Table<Liability>;
  netWorthSnapshots!: Table<NetWorthSnapshot>;
  budgets!: Table<Budget>;
  savingsGoals!: Table<SavingsGoal>;

  constructor() {
    super('ekonomihubben');

    this.version(1).stores({
      transactions: '++id, date, categoryId, bankFormat, importBatch, hash',
      categories: '++id, name, type',
      categoryRules: '++id, keyword, categoryId',
      investmentAccounts: '++id, name, type',
      holdings: '++id, accountId, ticker',
      holdingLots: '++id, holdingId',
      assets: '++id, type',
      liabilities: '++id, type',
      netWorthSnapshots: '++id, date',
      budgets: '++id, categoryId, month',
      savingsGoals: '++id',
    });
  }
}

export const db = new EkonomiDB();

// ─── Default categories ─────────────────────────────────────────────

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Boende',             type: 'predefined', icon: '🏠', color: '#4c6ef5' },
  { name: 'Dagligvaror',        type: 'predefined', icon: '🛒', color: '#40c057' },
  { name: 'Restaurang & Café',  type: 'predefined', icon: '🍽️', color: '#ff922b' },
  { name: 'Transport',          type: 'predefined', icon: '🚗', color: '#845ef7' },
  { name: 'Prenumerationer',    type: 'predefined', icon: '📱', color: '#339af0' },
  { name: 'Shopping',           type: 'predefined', icon: '🛍️', color: '#f06595' },
  { name: 'Hälsa & Träning',   type: 'predefined', icon: '💪', color: '#20c997' },
  { name: 'Nöje',              type: 'predefined', icon: '🎬', color: '#be4bdb' },
  { name: 'Resor',             type: 'predefined', icon: '✈️', color: '#15aabf' },
  { name: 'Försäkring',        type: 'predefined', icon: '🛡️', color: '#868e96' },
  { name: 'Räkningar',         type: 'predefined', icon: '📄', color: '#495057' },
  { name: 'Lön',               type: 'predefined', icon: '💰', color: '#2b8a3e' },
  { name: 'Övrig inkomst',     type: 'predefined', icon: '💵', color: '#5c940d' },
  { name: 'Överföring',        type: 'predefined', icon: '🔄', color: '#adb5bd' },
  { name: 'Sparande',          type: 'predefined', icon: '🏦', color: '#1864ab' },
  { name: 'Investering',       type: 'predefined', icon: '📈', color: '#364fc7' },
  { name: 'Okategoriserad',    type: 'predefined', icon: '❓', color: '#ced4da' },
];

// ─── Default categorization rules ───────────────────────────────────

const DEFAULT_RULES: { keyword: string; categoryName: string }[] = [
  // Groceries
  { keyword: 'ICA', categoryName: 'Dagligvaror' },
  { keyword: 'COOP', categoryName: 'Dagligvaror' },
  { keyword: 'HEMKÖP', categoryName: 'Dagligvaror' },
  { keyword: 'WILLYS', categoryName: 'Dagligvaror' },
  { keyword: 'LIDL', categoryName: 'Dagligvaror' },
  { keyword: 'CITY GROSS', categoryName: 'Dagligvaror' },
  { keyword: 'MATHEM', categoryName: 'Dagligvaror' },
  // Restaurants
  { keyword: 'RESTAURANG', categoryName: 'Restaurang & Café' },
  { keyword: 'CAFÉ', categoryName: 'Restaurang & Café' },
  { keyword: 'COFFEE', categoryName: 'Restaurang & Café' },
  { keyword: 'STARBUCKS', categoryName: 'Restaurang & Café' },
  { keyword: 'ESPRESSO', categoryName: 'Restaurang & Café' },
  { keyword: 'MCDONALDS', categoryName: 'Restaurang & Café' },
  { keyword: 'MAX HAMBURGARE', categoryName: 'Restaurang & Café' },
  { keyword: 'FOODORA', categoryName: 'Restaurang & Café' },
  { keyword: 'UBER EATS', categoryName: 'Restaurang & Café' },
  { keyword: 'WOLT', categoryName: 'Restaurang & Café' },
  // Transport
  { keyword: 'SL', categoryName: 'Transport' },
  { keyword: 'CIRCLE K', categoryName: 'Transport' },
  { keyword: 'OKQ8', categoryName: 'Transport' },
  { keyword: 'PREEM', categoryName: 'Transport' },
  { keyword: 'SHELL', categoryName: 'Transport' },
  { keyword: 'UBER', categoryName: 'Transport' },
  { keyword: 'BOLT', categoryName: 'Transport' },
  { keyword: 'TAXI', categoryName: 'Transport' },
  // Subscriptions
  { keyword: 'SPOTIFY', categoryName: 'Prenumerationer' },
  { keyword: 'NETFLIX', categoryName: 'Prenumerationer' },
  { keyword: 'HBO', categoryName: 'Prenumerationer' },
  { keyword: 'DISNEY', categoryName: 'Prenumerationer' },
  { keyword: 'APPLE.COM', categoryName: 'Prenumerationer' },
  { keyword: 'GOOGLE', categoryName: 'Prenumerationer' },
  { keyword: 'YOUTUBE', categoryName: 'Prenumerationer' },
  // Shopping
  { keyword: 'H&M', categoryName: 'Shopping' },
  { keyword: 'ZARA', categoryName: 'Shopping' },
  { keyword: 'AMAZON', categoryName: 'Shopping' },
  { keyword: 'ZALANDO', categoryName: 'Shopping' },
  { keyword: 'IKEA', categoryName: 'Shopping' },
  { keyword: 'CLAS OHLSON', categoryName: 'Shopping' },
  // Health
  { keyword: 'APOTEK', categoryName: 'Hälsa & Träning' },
  { keyword: 'GYM', categoryName: 'Hälsa & Träning' },
  { keyword: 'SATS', categoryName: 'Hälsa & Träning' },
  { keyword: 'FITNESS', categoryName: 'Hälsa & Träning' },
  // Income
  { keyword: 'LÖN', categoryName: 'Lön' },
  { keyword: 'LOEN', categoryName: 'Lön' },
  { keyword: 'SALARY', categoryName: 'Lön' },
  // Savings / Transfers
  { keyword: 'SWISH', categoryName: 'Överföring' },
];

export async function seedDatabase() {
  const categoryCount = await db.categories.count();
  if (categoryCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES as Category[]);
    // Now create rules pointing to correct category IDs
    const allCats = await db.categories.toArray();
    const catMap = new Map(allCats.map(c => [c.name, c.id!]));
    const rules: Omit<CategoryRule, 'id'>[] = DEFAULT_RULES
      .filter(r => catMap.has(r.categoryName))
      .map(r => ({
        keyword: r.keyword,
        categoryId: catMap.get(r.categoryName)!,
        isAutoCreated: false,
      }));
    await db.categoryRules.bulkAdd(rules as CategoryRule[]);
  }
}
