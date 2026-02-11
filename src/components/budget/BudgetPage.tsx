import { useEffect, useState } from 'react';
import { PiggyBank, Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../stores/appStore';
import { formatSEK, getMonthRange, getCurrentMonth } from '../../utils/formatters';
import MonthPicker from '../ui/MonthPicker';
import EmptyState from '../ui/EmptyState';
import type { Category, Budget, Transaction } from '../../types';

interface BudgetRow {
  budget: Budget;
  category: Category;
  spent: number;
  remaining: number;
  percent: number;
}

export default function BudgetPage() {
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [budgetRows, setBudgetRows] = useState<BudgetRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [addMode, setAddMode] = useState(false);
  const [newCatId, setNewCatId] = useState<number | null>(null);
  const [newAmount, setNewAmount] = useState('');

  useEffect(() => { loadData(); }, [selectedMonth]);

  async function loadData() {
    const cats = await db.categories.toArray();
    setCategories(cats);

    const budgets = await db.budgets.where('month').equals(selectedMonth).toArray();
    const { start, end } = getMonthRange(selectedMonth);
    const txs = await db.transactions.where('date').between(start, end, true, true).toArray();

    const catSpend = new Map<number, number>();
    txs.filter(t => t.amount < 0).forEach(t => {
      if (t.categoryId) catSpend.set(t.categoryId, (catSpend.get(t.categoryId) || 0) + Math.abs(t.amount));
    });

    const catMap = new Map(cats.map(c => [c.id!, c]));
    const rows: BudgetRow[] = budgets.map(b => {
      const cat = catMap.get(b.categoryId);
      const spent = catSpend.get(b.categoryId) || 0;
      const remaining = b.monthlyAmount - spent;
      const percent = b.monthlyAmount > 0 ? (spent / b.monthlyAmount) * 100 : 0;
      return { budget: b, category: cat!, spent, remaining, percent };
    }).filter(r => r.category);

    rows.sort((a, b) => b.percent - a.percent);
    setBudgetRows(rows);
  }

  async function saveBudgetEdit(budgetId: number) {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) return;
    await db.budgets.update(budgetId, { monthlyAmount: amount });
    setEditingId(null);
    loadData();
  }

  async function addBudget() {
    if (!newCatId || !newAmount) return;
    const amount = parseFloat(newAmount);
    if (isNaN(amount) || amount <= 0) return;

    // Check if budget already exists for this category+month
    const existing = await db.budgets
      .where({ categoryId: newCatId, month: selectedMonth })
      .first();
    if (existing) {
      await db.budgets.update(existing.id!, { monthlyAmount: amount });
    } else {
      await db.budgets.add({ categoryId: newCatId, monthlyAmount: amount, month: selectedMonth });
    }
    setAddMode(false);
    setNewCatId(null);
    setNewAmount('');
    loadData();
  }

  async function deleteBudget(id: number) {
    await db.budgets.delete(id);
    loadData();
  }

  async function copyFromPreviousMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prevBudgets = await db.budgets.where('month').equals(prevMonth).toArray();
    if (prevBudgets.length === 0) return;

    for (const b of prevBudgets) {
      const existing = await db.budgets.where({ categoryId: b.categoryId, month: selectedMonth }).first();
      if (!existing) {
        await db.budgets.add({ categoryId: b.categoryId, monthlyAmount: b.monthlyAmount, month: selectedMonth });
      }
    }
    loadData();
  }

  const totalBudget = budgetRows.reduce((s, r) => s + r.budget.monthlyAmount, 0);
  const totalSpent = budgetRows.reduce((s, r) => s + r.spent, 0);
  const budgetedCatIds = new Set(budgetRows.map(r => r.budget.categoryId));
  const availableCategories = categories.filter(c =>
    !budgetedCatIds.has(c.id!) && c.name !== 'Okategoriserad' && c.name !== 'Lön' && c.name !== 'Övrig inkomst'
  );

  function barColor(percent: number): string {
    if (percent <= 70) return 'bg-success';
    if (percent <= 90) return 'bg-amber-500';
    return 'bg-danger';
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Budget</h1>
          <p className="text-sm text-surface-500 mt-0.5">Sätt mål och följ upp dina utgifter</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Total budget</p>
          <p className="text-lg font-bold text-surface-900">{formatSEK(totalBudget)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Spenderat</p>
          <p className="text-lg font-bold amount-negative">{formatSEK(totalSpent)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Kvar</p>
          <p className={`text-lg font-bold ${totalBudget - totalSpent >= 0 ? 'amount-positive' : 'amount-negative'}`}>
            {formatSEK(totalBudget - totalSpent)}
          </p>
        </div>
      </div>

      {/* Budget rows */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-surface-800">Budgetposter</h2>
          <div className="flex gap-2">
            <button onClick={copyFromPreviousMonth} className="btn-secondary text-xs py-1.5">
              Kopiera från förra månaden
            </button>
            <button onClick={() => setAddMode(true)} className="btn-primary text-xs py-1.5">
              <Plus size={14} /> Lägg till
            </button>
          </div>
        </div>

        {addMode && (
          <div className="flex items-center gap-3 p-3 mb-4 bg-brand-50 rounded-xl border border-brand-100">
            <select
              className="select text-sm flex-1"
              value={newCatId ?? ''}
              onChange={e => setNewCatId(Number(e.target.value) || null)}
            >
              <option value="">Välj kategori...</option>
              {availableCategories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Belopp (SEK)"
              className="input w-36"
              value={newAmount}
              onChange={e => setNewAmount(e.target.value)}
            />
            <button onClick={addBudget} className="btn-primary text-xs py-2"><Save size={14} /></button>
            <button onClick={() => { setAddMode(false); setNewCatId(null); setNewAmount(''); }} className="btn-secondary text-xs py-2"><X size={14} /></button>
          </div>
        )}

        {budgetRows.length > 0 ? (
          <div className="space-y-3">
            {budgetRows.map(row => (
              <div key={row.budget.id} className="p-3 rounded-xl bg-surface-50 border border-surface-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{row.category.icon}</span>
                    <span className="text-sm font-medium text-surface-800">{row.category.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingId === row.budget.id ? (
                      <>
                        <input
                          type="number"
                          className="input w-28 text-xs"
                          value={editAmount}
                          onChange={e => setEditAmount(e.target.value)}
                          autoFocus
                        />
                        <button onClick={() => saveBudgetEdit(row.budget.id!)} className="p-1 text-success hover:bg-green-100 rounded"><Save size={14} /></button>
                        <button onClick={() => setEditingId(null)} className="p-1 text-surface-400 hover:bg-surface-200 rounded"><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm font-medium text-surface-700">
                          {formatSEK(row.spent)} / {formatSEK(row.budget.monthlyAmount)}
                        </span>
                        <button onClick={() => { setEditingId(row.budget.id!); setEditAmount(String(row.budget.monthlyAmount)); }}
                          className="p-1 text-surface-400 hover:text-surface-600 hover:bg-surface-200 rounded transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteBudget(row.budget.id!)}
                          className="p-1 text-surface-400 hover:text-danger hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-full bg-surface-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${barColor(row.percent)}`}
                    style={{ width: `${Math.min(row.percent, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-surface-400">{row.percent.toFixed(0)}% använt</span>
                  <span className={`text-xs font-medium ${row.remaining >= 0 ? 'text-success' : 'text-danger'}`}>
                    {row.remaining >= 0 ? `${formatSEK(row.remaining)} kvar` : `${formatSEK(Math.abs(row.remaining))} över budget`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<PiggyBank size={24} />}
            title="Ingen budget satt"
            description="Lägg till budgetposter per kategori för att börja följa upp dina utgifter."
            action={<button onClick={() => setAddMode(true)} className="btn-primary"><Plus size={16} /> Lägg till budgetpost</button>}
          />
        )}
      </div>
    </div>
  );
}
