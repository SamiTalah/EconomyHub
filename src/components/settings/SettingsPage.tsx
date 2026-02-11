import { useEffect, useState, useRef } from 'react';
import { Settings, Download, Upload, Trash2, Plus, Tag, List, X, Save, AlertTriangle } from 'lucide-react';
import { db, seedDatabase } from '../../db/database';
import { exportAllData, importAllData, downloadJSON } from '../../utils/dataExport';
import { invalidateRuleCache } from '../../utils/categorizer';
import Modal from '../ui/Modal';
import type { Category, CategoryRule } from '../../types';

type SettingsTab = 'categories' | 'rules' | 'data';

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>('categories');
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<(CategoryRule & { categoryName?: string })[]>([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editCat, setEditCat] = useState<Partial<Category>>({});
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<Partial<CategoryRule>>({});
  const [importStatus, setImportStatus] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const cats = await db.categories.toArray();
    setCategories(cats);

    const allRules = await db.categoryRules.toArray();
    const catMap = new Map(cats.map(c => [c.id!, c.name]));
    setRules(allRules.map(r => ({ ...r, categoryName: catMap.get(r.categoryId) || 'Okänd' })));
  }

  // ─── Categories ────────────────────────────────────────────────
  async function saveCategory() {
    if (!editCat.name) return;
    const cat = { ...editCat, type: editCat.type || 'custom', icon: editCat.icon || '📌', color: editCat.color || '#868e96' } as Category;
    if (editCat.id) {
      await db.categories.update(editCat.id, cat);
    } else {
      await db.categories.add(cat);
    }
    setCatModalOpen(false);
    setEditCat({});
    loadData();
  }

  async function deleteCategory(id: number) {
    // Set all transactions with this category to null
    const txs = await db.transactions.where('categoryId').equals(id).toArray();
    for (const t of txs) {
      await db.transactions.update(t.id!, { categoryId: null });
    }
    // Delete associated rules
    await db.categoryRules.where('categoryId').equals(id).delete();
    await db.categories.delete(id);
    loadData();
  }

  // ─── Rules ─────────────────────────────────────────────────────
  async function saveRule() {
    if (!editRule.keyword || !editRule.categoryId) return;
    const rule = { ...editRule, keyword: editRule.keyword.toUpperCase(), isAutoCreated: editRule.isAutoCreated ?? false } as CategoryRule;
    if (editRule.id) {
      await db.categoryRules.update(editRule.id, rule);
    } else {
      await db.categoryRules.add(rule);
    }
    invalidateRuleCache();
    setRuleModalOpen(false);
    setEditRule({});
    loadData();
  }

  async function deleteRule(id: number) {
    await db.categoryRules.delete(id);
    invalidateRuleCache();
    loadData();
  }

  // ─── Data management ──────────────────────────────────────────
  async function handleExport() {
    const data = await exportAllData();
    downloadJSON(data, `ekonomihubben_backup_${new Date().toISOString().split('T')[0]}.json`);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await importAllData(text);
    if (result.success) {
      setImportStatus('Import lyckades! Alla data har återställts.');
      invalidateRuleCache();
      loadData();
    } else {
      setImportStatus(`Import misslyckades: ${result.error}`);
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleReset() {
    if (!confirm('Är du säker? All data kommer att raderas permanent.')) return;
    await db.delete();
    await db.open();
    await seedDatabase();
    invalidateRuleCache();
    loadData();
    setImportStatus('All data har raderats. Standardkategorier har återskapats.');
  }

  const TABS: { key: SettingsTab; label: string; icon: typeof Tag }[] = [
    { key: 'categories', label: 'Kategorier', icon: Tag },
    { key: 'rules', label: 'Regler', icon: List },
    { key: 'data', label: 'Data & Backup', icon: Download },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">Inställningar</h1>
        <p className="text-sm text-surface-500 mt-0.5">Hantera kategorier, regler och data</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors
              ${tab === t.key ? 'bg-white text-surface-900 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Kategorier ({categories.length})</h2>
            <button onClick={() => { setEditCat({ type: 'custom' }); setCatModalOpen(true); }} className="btn-primary text-xs py-1.5">
              <Plus size={14} /> Ny kategori
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-50 group transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="text-lg">{c.icon}</span>
                  <span className="text-sm font-medium text-surface-800">{c.name}</span>
                  {c.type === 'custom' && <span className="badge bg-brand-50 text-brand-600">Anpassad</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditCat(c); setCatModalOpen(true); }}
                    className="p-1 text-surface-400 hover:text-surface-600 rounded"><Settings size={13} /></button>
                  {c.type === 'custom' && (
                    <button onClick={() => deleteCategory(c.id!)}
                      className="p-1 text-surface-400 hover:text-danger rounded"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules Tab */}
      {tab === 'rules' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Kategoriseringsregler ({rules.length})</h2>
            <button onClick={() => { setEditRule({}); setRuleModalOpen(true); }} className="btn-primary text-xs py-1.5">
              <Plus size={14} /> Ny regel
            </button>
          </div>
          <div className="space-y-1">
            {rules.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-surface-50 group transition-colors">
                <div className="flex items-center gap-3">
                  <code className="text-xs font-mono bg-surface-100 px-2 py-1 rounded-lg text-surface-700">{r.keyword}</code>
                  <span className="text-xs text-surface-400">→</span>
                  <span className="text-sm text-surface-700">{r.categoryName}</span>
                  {r.isAutoCreated && <span className="badge bg-amber-50 text-amber-600">Auto</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => { setEditRule(r); setRuleModalOpen(true); }}
                    className="p-1 text-surface-400 hover:text-surface-600 rounded"><Settings size={13} /></button>
                  <button onClick={() => deleteRule(r.id!)}
                    className="p-1 text-surface-400 hover:text-danger rounded"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Tab */}
      {tab === 'data' && (
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-surface-800 mb-3">Exportera data</h2>
            <p className="text-sm text-surface-500 mb-4">Ladda ner all din data som en JSON-fil. Använd detta som backup.</p>
            <button onClick={handleExport} className="btn-primary">
              <Download size={16} /> Exportera backup
            </button>
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold text-surface-800 mb-3">Importera data</h2>
            <p className="text-sm text-surface-500 mb-4">Återställ från en tidigare backup. OBS: detta ersätter all befintlig data.</p>
            <label className="btn-secondary cursor-pointer">
              <Upload size={16} /> Välj backup-fil
              <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
            </label>
          </div>
          <div className="card border-danger/20">
            <h2 className="text-sm font-semibold text-danger mb-3 flex items-center gap-2">
              <AlertTriangle size={16} /> Radera all data
            </h2>
            <p className="text-sm text-surface-500 mb-4">Tar bort all data permanent. Standardkategorier återskapas.</p>
            <button onClick={handleReset} className="btn-danger">
              <Trash2 size={16} /> Radera allt
            </button>
          </div>
          {importStatus && (
            <div className={`p-4 rounded-xl text-sm ${importStatus.includes('misslyckades') ? 'bg-red-50 text-danger' : 'bg-green-50 text-success'}`}>
              {importStatus}
            </div>
          )}
        </div>
      )}

      {/* Category Modal */}
      <Modal open={catModalOpen} onClose={() => { setCatModalOpen(false); setEditCat({}); }}
        title={editCat.id ? 'Redigera kategori' : 'Ny kategori'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Namn</label>
            <input className="input" value={editCat.name || ''}
              onChange={e => setEditCat({ ...editCat, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Ikon (emoji)</label>
              <input className="input" value={editCat.icon || ''}
                onChange={e => setEditCat({ ...editCat, icon: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Färg</label>
              <input type="color" className="w-full h-10 rounded-xl border border-surface-300 cursor-pointer"
                value={editCat.color || '#868e96'}
                onChange={e => setEditCat({ ...editCat, color: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setCatModalOpen(false); setEditCat({}); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveCategory} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>

      {/* Rule Modal */}
      <Modal open={ruleModalOpen} onClose={() => { setRuleModalOpen(false); setEditRule({}); }}
        title={editRule.id ? 'Redigera regel' : 'Ny regel'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Nyckelord (matchas mot transaktionsbeskrivning)</label>
            <input className="input" placeholder="T.ex. ICA, SPOTIFY, SL" value={editRule.keyword || ''}
              onChange={e => setEditRule({ ...editRule, keyword: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Kategori</label>
            <select className="select" value={editRule.categoryId || ''}
              onChange={e => setEditRule({ ...editRule, categoryId: Number(e.target.value) })}>
              <option value="">Välj kategori...</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setRuleModalOpen(false); setEditRule({}); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveRule} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
