import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Search, Filter, Tag, AlertCircle, CheckCircle2, FileSpreadsheet, X } from 'lucide-react';
import { db } from '../../db/database';
import { useAppStore } from '../../stores/appStore';
import { parseCSV, transactionHash, type CSVParseResult, type ParsedTransaction } from '../../utils/csvParser';
import { categorizeTransactions } from '../../utils/categorizer';
import { formatSEK, getMonthRange } from '../../utils/formatters';
import MonthPicker from '../ui/MonthPicker';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import type { Category, Transaction } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type Tab = 'all' | 'uncategorized';

export default function SpendingPage() {
  const { selectedMonth, setSelectedMonth } = useAppStore();
  const [tab, setTab] = useState<Tab>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<CSVParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTxIds, setSelectedTxIds] = useState<Set<number>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState<number | null>(null);
  const [reCatModalOpen, setReCatModalOpen] = useState(false);
  const [reCatTx, setReCatTx] = useState<Transaction | null>(null);
  const [reCatCategoryId, setReCatCategoryId] = useState<number | null>(null);
  const [createRuleForRecat, setCreateRuleForRecat] = useState(true);

  const catMap = new Map<number, Category>(categories.map(c => [c.id!, c]));
  const uncategorizedCat = categories.find(c => c.name === 'Okategoriserad');
  const uncategorizedId = uncategorizedCat?.id ?? null;

  useEffect(() => {
    loadData();
  }, [selectedMonth, tab]);

  async function loadData() {
    const cats = await db.categories.toArray();
    setCategories(cats);

    const { start, end } = getMonthRange(selectedMonth);
    let txs = await db.transactions.where('date').between(start, end, true, true).toArray();
    txs.sort((a, b) => b.date.localeCompare(a.date) || b.id! - a.id!);
    setTransactions(txs);
  }

  // ─── CSV Import ─────────────────────────────────────────────────
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const result = parseCSV(text);
      setImportResult(result);
      setImportDone(false);
      setImportModalOpen(true);

      // Check for duplicates
      const existingHashes = new Set(
        (await db.transactions.toArray()).map(t => t.hash)
      );
      const dupes = result.transactions.filter(t => existingHashes.has(transactionHash(t)));
      setDuplicateCount(dupes.length);
    };
    reader.readAsText(file, 'UTF-8');
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmImport() {
    if (!importResult) return;
    setImporting(true);

    const existingHashes = new Set(
      (await db.transactions.toArray()).map(t => t.hash)
    );

    const newTxs = importResult.transactions.filter(
      t => !existingHashes.has(transactionHash(t))
    );

    // Categorize
    const categoryIds = await categorizeTransactions(newTxs.map(t => t.description));

    const batch = Date.now().toString();
    const toInsert: Transaction[] = newTxs.map((t, i) => ({
      date: t.date,
      description: t.description,
      amount: t.amount,
      balance: t.balance,
      categoryId: categoryIds[i],
      bankFormat: importResult.bankFormat,
      importBatch: batch,
      isManual: false,
      hash: transactionHash(t),
    }));

    await db.transactions.bulkAdd(toInsert);
    setImporting(false);
    setImportDone(true);
    loadData();
  }

  // ─── Re-categorize ─────────────────────────────────────────────
  async function saveCategoryChange() {
    if (!reCatTx || reCatCategoryId === null) return;
    await db.transactions.update(reCatTx.id!, { categoryId: reCatCategoryId });

    if (createRuleForRecat && reCatTx.description) {
      const keyword = reCatTx.description.split(' ').slice(0, 2).join(' ').toUpperCase();
      const existingRule = await db.categoryRules.where('keyword').equals(keyword).first();
      if (!existingRule) {
        await db.categoryRules.add({
          keyword,
          categoryId: reCatCategoryId,
          isAutoCreated: true,
        });
      }
    }

    setReCatModalOpen(false);
    setReCatTx(null);
    loadData();
  }

  async function bulkCategorize() {
    if (bulkCategoryId === null || selectedTxIds.size === 0) return;
    const ids = Array.from(selectedTxIds);
    await Promise.all(ids.map(id => db.transactions.update(id, { categoryId: bulkCategoryId })));
    setSelectedTxIds(new Set());
    setBulkCategoryId(null);
    loadData();
  }

  // ─── Filtering ──────────────────────────────────────────────────
  const filtered = transactions.filter(t => {
    if (tab === 'uncategorized' && t.categoryId !== null && t.categoryId !== uncategorizedId) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!t.description.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // ─── Category spending breakdown ───────────────────────────────
  const expenses = transactions.filter(t => t.amount < 0);
  const catSpend = new Map<number, number>();
  expenses.forEach(t => {
    const cid = t.categoryId ?? -1;
    catSpend.set(cid, (catSpend.get(cid) || 0) + Math.abs(t.amount));
  });
  const chartData = [...catSpend.entries()]
    .map(([cid, amount]) => {
      const cat = catMap.get(cid);
      return { name: cat?.name || 'Okategoriserad', amount, color: cat?.color || '#ced4da' };
    })
    .sort((a, b) => b.amount - a.amount);

  const totalExpenses = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const uncategorizedCount = transactions.filter(t => t.categoryId === null || t.categoryId === uncategorizedId).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Utgifter</h1>
          <p className="text-sm text-surface-500 mt-0.5">Importera, kategorisera och analysera</p>
        </div>
        <div className="flex items-center gap-3">
          <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          <label className="btn-primary cursor-pointer">
            <Upload size={16} />
            Importera CSV
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Inkomst</p>
          <p className="text-lg font-bold amount-positive">{formatSEK(totalIncome)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Utgifter</p>
          <p className="text-lg font-bold amount-negative">{formatSEK(totalExpenses)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Netto</p>
          <p className={`text-lg font-bold ${totalIncome - totalExpenses >= 0 ? 'amount-positive' : 'amount-negative'}`}>
            {formatSEK(totalIncome - totalExpenses)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Category chart */}
        {chartData.length > 0 && (
          <div className="card lg:col-span-1">
            <h2 className="text-sm font-semibold text-surface-800 mb-3">Fördelning</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={chartData} dataKey="amount" nameKey="name" cx="50%" cy="50%"
                  innerRadius={40} outerRadius={80} paddingAngle={2} stroke="none">
                  {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatSEK(v)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e9ecef', fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-3">
              {chartData.slice(0, 6).map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="text-surface-600">{c.name}</span>
                  </div>
                  <span className="font-medium text-surface-700">{formatSEK(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction list */}
        <div className={`card ${chartData.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {/* Tabs and search */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
              <button
                onClick={() => setTab('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'all' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
              >
                Alla ({transactions.length})
              </button>
              <button
                onClick={() => setTab('uncategorized')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === 'uncategorized' ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
              >
                Okategoriserade ({uncategorizedCount})
              </button>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
              <input
                type="text"
                placeholder="Sök transaktioner..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input pl-8 py-2 text-xs"
              />
            </div>
          </div>

          {/* Bulk actions */}
          {selectedTxIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 mb-3 bg-brand-50 rounded-xl border border-brand-100">
              <span className="text-xs font-medium text-brand-700">{selectedTxIds.size} valda</span>
              <select
                className="select text-xs py-1.5"
                value={bulkCategoryId ?? ''}
                onChange={e => setBulkCategoryId(Number(e.target.value) || null)}
              >
                <option value="">Välj kategori...</option>
                {categories.filter(c => c.name !== 'Okategoriserad').map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
              <button onClick={bulkCategorize} className="btn-primary text-xs py-1.5" disabled={!bulkCategoryId}>
                Kategorisera
              </button>
              <button onClick={() => setSelectedTxIds(new Set())} className="text-xs text-surface-500 hover:text-surface-700">
                Avmarkera
              </button>
            </div>
          )}

          {/* Transactions */}
          {filtered.length > 0 ? (
            <div className="space-y-0.5">
              {filtered.map(t => {
                const cat = t.categoryId ? catMap.get(t.categoryId) : null;
                const isUncat = !t.categoryId || t.categoryId === uncategorizedId;
                const isSelected = selectedTxIds.has(t.id!);

                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors cursor-pointer
                      ${isSelected ? 'bg-brand-50' : 'hover:bg-surface-50'}
                      ${isUncat ? 'border-l-2 border-amber-400' : ''}
                    `}
                    onClick={() => {
                      if (tab === 'uncategorized' || isUncat) {
                        const newSet = new Set(selectedTxIds);
                        if (isSelected) newSet.delete(t.id!);
                        else newSet.add(t.id!);
                        setSelectedTxIds(newSet);
                      }
                    }}
                  >
                    {(tab === 'uncategorized' || isUncat) && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        readOnly
                        className="rounded border-surface-300 text-brand-600 shrink-0"
                      />
                    )}
                    <span className="text-base shrink-0">{cat?.icon || '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{t.description}</p>
                      <p className="text-xs text-surface-400">{t.date}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setReCatTx(t); setReCatCategoryId(t.categoryId); setReCatModalOpen(true); }}
                      className="shrink-0 px-2 py-1 text-xs rounded-lg bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-700 transition-colors"
                    >
                      {cat?.name || 'Kategorisera'}
                    </button>
                    <span className={`text-sm font-mono font-medium shrink-0 ${t.amount >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                      {t.amount >= 0 ? '+' : ''}{formatSEK(t.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<FileSpreadsheet size={24} />}
              title="Inga transaktioner"
              description="Importera en CSV-fil från din bank för att komma igång."
              action={
                <label className="btn-primary cursor-pointer">
                  <Upload size={16} /> Importera CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
                </label>
              }
            />
          )}
        </div>
      </div>

      {/* ─── Import Modal ──────────────────────────────────────────── */}
      <Modal open={importModalOpen} onClose={() => { setImportModalOpen(false); setImportResult(null); setImportDone(false); }} title="Importera transaktioner" width="max-w-xl">
        {importResult && !importDone && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-surface-50 rounded-xl">
              <FileSpreadsheet size={20} className="text-brand-600" />
              <div>
                <p className="text-sm font-medium">Bankformat: {importResult.bankFormat}</p>
                <p className="text-xs text-surface-500">
                  {importResult.transactions.length} transaktioner hittade
                  {importResult.skippedRows > 0 && ` · ${importResult.skippedRows} rader överhoppade`}
                </p>
              </div>
            </div>

            {duplicateCount > 0 && (
              <div className="flex items-center gap-2 p-3 bg-amber-50 text-amber-700 rounded-xl text-sm">
                <AlertCircle size={16} />
                {duplicateCount} redan importerade transaktioner kommer att hoppas över.
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="p-3 bg-red-50 text-danger rounded-xl text-xs">
                {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            {/* Preview */}
            <div className="max-h-64 overflow-y-auto border border-surface-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-surface-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">Datum</th>
                    <th className="text-left px-3 py-2 font-medium text-surface-500">Beskrivning</th>
                    <th className="text-right px-3 py-2 font-medium text-surface-500">Belopp</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.transactions.slice(0, 20).map((t, i) => (
                    <tr key={i} className="border-t border-surface-100">
                      <td className="px-3 py-2 text-surface-600">{t.date}</td>
                      <td className="px-3 py-2 text-surface-800 truncate max-w-[200px]">{t.description}</td>
                      <td className={`px-3 py-2 text-right font-mono ${t.amount >= 0 ? 'text-success' : 'text-danger'}`}>
                        {formatSEK(t.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importResult.transactions.length > 20 && (
                <p className="text-xs text-surface-400 text-center py-2">
                  ... och {importResult.transactions.length - 20} till
                </p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => { setImportModalOpen(false); setImportResult(null); }} className="btn-secondary">
                Avbryt
              </button>
              <button onClick={confirmImport} disabled={importing} className="btn-primary">
                {importing ? 'Importerar...' : `Importera ${importResult.transactions.length - duplicateCount} transaktioner`}
              </button>
            </div>
          </div>
        )}

        {importDone && (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="mx-auto text-success mb-3" />
            <h3 className="text-lg font-semibold text-surface-900 mb-1">Import klar!</h3>
            <p className="text-sm text-surface-500 mb-4">
              Transaktionerna har importerats och kategoriserats.
            </p>
            <button onClick={() => { setImportModalOpen(false); setImportResult(null); setImportDone(false); }} className="btn-primary">
              Stäng
            </button>
          </div>
        )}
      </Modal>

      {/* ─── Re-categorize Modal ───────────────────────────────────── */}
      <Modal open={reCatModalOpen} onClose={() => { setReCatModalOpen(false); setReCatTx(null); }} title="Kategorisera transaktion">
        {reCatTx && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-50 rounded-xl">
              <p className="text-sm font-medium text-surface-800">{reCatTx.description}</p>
              <p className="text-xs text-surface-500">{reCatTx.date} · {formatSEK(reCatTx.amount)}</p>
            </div>

            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Kategori</label>
              <select
                className="select"
                value={reCatCategoryId ?? ''}
                onChange={e => setReCatCategoryId(Number(e.target.value) || null)}
              >
                <option value="">Välj kategori...</option>
                {categories.filter(c => c.name !== 'Okategoriserad').map(c => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm text-surface-600 cursor-pointer">
              <input
                type="checkbox"
                checked={createRuleForRecat}
                onChange={e => setCreateRuleForRecat(e.target.checked)}
                className="rounded border-surface-300 text-brand-600"
              />
              Skapa regel för framtida transaktioner
            </label>

            <div className="flex justify-end gap-3">
              <button onClick={() => { setReCatModalOpen(false); setReCatTx(null); }} className="btn-secondary">
                Avbryt
              </button>
              <button onClick={saveCategoryChange} className="btn-primary" disabled={!reCatCategoryId}>
                Spara
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
