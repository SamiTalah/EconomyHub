import { db } from '../db/database';
import type { CategoryRule } from '../types';

let cachedRules: CategoryRule[] | null = null;

export async function loadRules(): Promise<CategoryRule[]> {
  if (!cachedRules) {
    cachedRules = await db.categoryRules.toArray();
  }
  return cachedRules;
}

export function invalidateRuleCache() {
  cachedRules = null;
}

export async function categorizeTransaction(description: string): Promise<number | null> {
  const rules = await loadRules();
  const upper = description.toUpperCase();

  for (const rule of rules) {
    if (upper.includes(rule.keyword.toUpperCase())) {
      return rule.categoryId;
    }
  }

  return null; // Uncategorized
}

export async function categorizeTransactions(
  descriptions: string[]
): Promise<(number | null)[]> {
  const rules = await loadRules();

  return descriptions.map(desc => {
    const upper = desc.toUpperCase();
    for (const rule of rules) {
      if (upper.includes(rule.keyword.toUpperCase())) {
        return rule.categoryId;
      }
    }
    return null;
  });
}
