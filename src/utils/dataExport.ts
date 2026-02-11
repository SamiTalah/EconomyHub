import { db } from '../db/database';

export async function exportAllData(): Promise<string> {
  const data = {
    version: 1,
    exportDate: new Date().toISOString(),
    transactions: await db.transactions.toArray(),
    categories: await db.categories.toArray(),
    categoryRules: await db.categoryRules.toArray(),
    investmentAccounts: await db.investmentAccounts.toArray(),
    holdings: await db.holdings.toArray(),
    holdingLots: await db.holdingLots.toArray(),
    assets: await db.assets.toArray(),
    liabilities: await db.liabilities.toArray(),
    netWorthSnapshots: await db.netWorthSnapshots.toArray(),
    budgets: await db.budgets.toArray(),
    savingsGoals: await db.savingsGoals.toArray(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importAllData(jsonString: string): Promise<{ success: boolean; error?: string }> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.version) {
      return { success: false, error: 'Invalid backup file format' };
    }

    // Clear all tables and import new data
    const tables = [
      db.transactions, db.categories, db.categoryRules,
      db.investmentAccounts, db.holdings, db.holdingLots,
      db.assets, db.liabilities, db.netWorthSnapshots,
      db.budgets, db.savingsGoals,
    ];

    await db.transaction('rw', tables, async () => {
      for (const table of tables) await table.clear();

      if (data.categories?.length) await db.categories.bulkAdd(data.categories);
      if (data.categoryRules?.length) await db.categoryRules.bulkAdd(data.categoryRules);
      if (data.transactions?.length) await db.transactions.bulkAdd(data.transactions);
      if (data.investmentAccounts?.length) await db.investmentAccounts.bulkAdd(data.investmentAccounts);
      if (data.holdings?.length) await db.holdings.bulkAdd(data.holdings);
      if (data.holdingLots?.length) await db.holdingLots.bulkAdd(data.holdingLots);
      if (data.assets?.length) await db.assets.bulkAdd(data.assets);
      if (data.liabilities?.length) await db.liabilities.bulkAdd(data.liabilities);
      if (data.netWorthSnapshots?.length) await db.netWorthSnapshots.bulkAdd(data.netWorthSnapshots);
      if (data.budgets?.length) await db.budgets.bulkAdd(data.budgets);
      if (data.savingsGoals?.length) await db.savingsGoals.bulkAdd(data.savingsGoals);
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Import failed' };
  }
}

export function downloadJSON(data: string, filename: string) {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
