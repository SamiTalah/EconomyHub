import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Receipt, Landmark, Target, ArrowRight, Upload } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../stores/appStore';
import { formatSEK, formatPercent, plColor, getMonthRange } from '../../utils/formatters';
import MonthPicker from '../ui/MonthPicker';
import type { Category, Transaction, Holding, HoldingLot, Asset, Liability, SavingsGoal } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface DashboardData {
  // Spending
  monthlyExpenses: number;
  monthlyIncome: number;
  savingsRate: number;
  topCategories: { name: string; amount: number; color: string; icon: string }[];
  recentTransactions: (Transaction & { categoryName?: string; categoryIcon?: string })[];
  uncategorizedCount: number;
  // Investments
  totalPortfolioValue: number;
  totalPortfolioCost: number;
  totalPL: number;
  totalPLPercent: number;
  // Net Worth
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  investmentAssets: number;
  // Goals
  goals: SavingsGoal[];
}

export default function Dashboard() {
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [selectedMonth]);

  async function loadDashboardData() {
    const { start, end } = getMonthRange(selectedMonth);
    const categories = await db.categories.toArray();
    const catMap = new Map<number, Category>(categories.map(c => [c.id!, c]));

    // Transactions for this month
    const transactions = await db.transactions
      .where('date')
      .between(start, end, true, true)
      .toArray();

    const expenses = transactions.filter(t => t.amount < 0);
    const income = transactions.filter(t => t.amount > 0);
    const monthlyExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
    const monthlyIncome = income.reduce((s, t) => s + t.amount, 0);
    const savingsRate = monthlyIncome > 0 ? ((monthlyIncome - monthlyExpenses) / monthlyIncome) * 100 : 0;

    // Top categories
    const catSpend = new Map<number, number>();
    expenses.forEach(t => {
      if (t.categoryId) {
        catSpend.set(t.categoryId, (catSpend.get(t.categoryId) || 0) + Math.abs(t.amount));
      }
    });
    const topCategories = [...catSpend.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([catId, amount]) => {
        const cat = catMap.get(catId);
        return { name: cat?.name || 'Okänd', amount, color: cat?.color || '#ccc', icon: cat?.icon || '❓' };
      });

    // Recent transactions
    const recent = transactions
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 8)
      .map(t => {
        const cat = t.categoryId ? catMap.get(t.categoryId) : null;
        return { ...t, categoryName: cat?.name, categoryIcon: cat?.icon };
      });

    // Uncategorized count
    const uncategorizedCount = await db.transactions.where('categoryId').equals(0).count()
      + (await db.transactions.filter(t => t.categoryId === null).count());

    // Investments
    const holdings = await db.holdings.toArray();
    const lots = await db.holdingLots.toArray();
    let totalPortfolioValue = 0;
    let totalPortfolioCost = 0;
    for (const h of holdings) {
      const holdingLots = lots.filter(l => l.holdingId === h.id);
      const totalUnits = holdingLots.reduce((s, l) => s + l.units, 0);
      totalPortfolioValue += totalUnits * h.currentPrice;
      totalPortfolioCost += holdingLots.reduce((s, l) => s + l.units * l.purchasePrice, 0);
    }
    const totalPL = totalPortfolioValue - totalPortfolioCost;
    const totalPLPercent = totalPortfolioCost > 0 ? (totalPL / totalPortfolioCost) * 100 : 0;

    // Net Worth
    const assets = await db.assets.toArray();
    const liabilities = await db.liabilities.toArray();
    const cashAssets = assets.filter(a => a.type === 'cash').reduce((s, a) => s + a.value, 0);
    const otherAssets = assets.filter(a => a.type !== 'cash').reduce((s, a) => s + a.value, 0);
    const totalAssets = cashAssets + otherAssets + totalPortfolioValue;
    const totalLiabilities = liabilities.reduce((s, l) => s + l.amount, 0);
    const netWorth = totalAssets - totalLiabilities;

    // Goals
    const goals = await db.savingsGoals.toArray();

    setData({
      monthlyExpenses, monthlyIncome, savingsRate, topCategories, recentTransactions: recent,
      uncategorizedCount, totalPortfolioValue, totalPortfolioCost, totalPL, totalPLPercent,
      totalAssets, totalLiabilities, netWorth, investmentAssets: totalPortfolioValue, goals,
    });
  }

  if (!data) return <div className="animate-pulse">Laddar...</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Dashboard</h1>
          <p className="text-sm text-surface-500 mt-0.5">Din ekonomiska översikt</p>
        </div>
        <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
      </div>

      {/* Top summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Worth */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
              <Landmark size={16} className="text-brand-600" />
            </div>
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">Förmögenhet</span>
          </div>
          <p className="text-xl font-bold text-surface-900">{formatSEK(data.netWorth)}</p>
          <p className="text-xs text-surface-400 mt-1">
            Tillgångar {formatSEK(data.totalAssets)} — Skulder {formatSEK(data.totalLiabilities)}
          </p>
        </div>

        {/* Monthly Spending */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <Receipt size={16} className="text-danger" />
            </div>
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">Utgifter</span>
          </div>
          <p className="text-xl font-bold text-surface-900">{formatSEK(data.monthlyExpenses)}</p>
          <p className="text-xs text-surface-400 mt-1">
            Inkomst {formatSEK(data.monthlyIncome)} — Sparkvot {data.savingsRate.toFixed(0)}%
          </p>
        </div>

        {/* Portfolio */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp size={16} className="text-success" />
            </div>
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">Portfölj</span>
          </div>
          <p className="text-xl font-bold text-surface-900">{formatSEK(data.totalPortfolioValue)}</p>
          <p className={`text-xs mt-1 font-medium ${plColor(data.totalPL)}`}>
            {data.totalPL >= 0 ? '+' : ''}{formatSEK(data.totalPL)} ({formatPercent(data.totalPLPercent, true)})
          </p>
        </div>

        {/* Savings Goals */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Target size={16} className="text-amber-600" />
            </div>
            <span className="text-xs font-medium text-surface-500 uppercase tracking-wide">Sparmål</span>
          </div>
          <p className="text-xl font-bold text-surface-900">{data.goals.length} aktiva</p>
          {data.goals.length > 0 && (
            <p className="text-xs text-surface-400 mt-1">
              Närmast: {data.goals[0]?.name}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending by category */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Utgifter per kategori</h2>
            <Link to="/spending" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
              Visa alla <ArrowRight size={12} />
            </Link>
          </div>
          {data.topCategories.length > 0 ? (
            <>
              <div className="flex justify-center mb-4">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={data.topCategories}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                      stroke="none"
                    >
                      {data.topCategories.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => formatSEK(value)}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e9ecef', fontSize: '13px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {data.topCategories.map((cat, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                      <span className="text-sm text-surface-700">{cat.icon} {cat.name}</span>
                    </div>
                    <span className="text-sm font-medium text-surface-800">{formatSEK(cat.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-surface-400 py-8 text-center">Inga utgifter denna månad</p>
          )}
        </div>

        {/* Recent transactions */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Senaste transaktioner</h2>
            <div className="flex items-center gap-3">
              {data.uncategorizedCount > 0 && (
                <Link to="/spending" className="badge bg-amber-100 text-amber-700">
                  {data.uncategorizedCount} okategoriserade
                </Link>
              )}
              <Link to="/spending" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
                Visa alla <ArrowRight size={12} />
              </Link>
            </div>
          </div>
          {data.recentTransactions.length > 0 ? (
            <div className="space-y-1">
              {data.recentTransactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2.5 px-2 rounded-lg hover:bg-surface-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg shrink-0">{t.categoryIcon || '❓'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{t.description}</p>
                      <p className="text-xs text-surface-400">{t.date} · {t.categoryName || 'Okategoriserad'}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-mono font-medium shrink-0 ml-4 ${t.amount >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                    {t.amount >= 0 ? '+' : ''}{formatSEK(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Upload size={24} className="mx-auto text-surface-300 mb-3" />
              <p className="text-sm text-surface-500 mb-3">Inga transaktioner ännu</p>
              <Link to="/spending" className="btn-primary text-sm">
                Importera CSV
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Savings goals */}
      {data.goals.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Sparmål</h2>
            <Link to="/goals" className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1">
              Hantera <ArrowRight size={12} />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.goals.map(goal => {
              const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              return (
                <div key={goal.id} className="p-4 rounded-xl bg-surface-50 border border-surface-100">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{goal.icon}</span>
                    <span className="text-sm font-medium text-surface-800">{goal.name}</span>
                  </div>
                  <div className="w-full bg-surface-200 rounded-full h-2 mb-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: goal.color || '#4c6ef5' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-surface-500">
                    <span>{formatSEK(goal.currentAmount)}</span>
                    <span>{formatSEK(goal.targetAmount)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
