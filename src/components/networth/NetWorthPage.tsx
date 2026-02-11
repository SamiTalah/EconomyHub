import { useEffect, useState } from 'react';
import { Landmark, Plus, Edit2, Trash2, Camera } from 'lucide-react';
import { db } from '../../db/database';
import { formatSEK, formatPercent, plColor } from '../../utils/formatters';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import type { Asset, Liability, AssetType, LiabilityType, NetWorthSnapshot, Holding, HoldingLot } from '../../types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const ASSET_TYPES: { value: AssetType; label: string; icon: string }[] = [
  { value: 'cash', label: 'Bankkonto / Kontanter', icon: '💵' },
  { value: 'property', label: 'Fastighet', icon: '🏠' },
  { value: 'vehicle', label: 'Fordon', icon: '🚗' },
  { value: 'other', label: 'Övrigt', icon: '💎' },
];

const LIABILITY_TYPES: { value: LiabilityType; label: string; icon: string }[] = [
  { value: 'mortgage', label: 'Bolån', icon: '🏠' },
  { value: 'car_loan', label: 'Billån', icon: '🚗' },
  { value: 'student_loan', label: 'Studielån (CSN)', icon: '🎓' },
  { value: 'credit_card', label: 'Kreditkort', icon: '💳' },
  { value: 'other', label: 'Övrigt lån', icon: '📄' },
];

export default function NetWorthPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [investmentTotal, setInvestmentTotal] = useState(0);
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [liabilityModalOpen, setLiabilityModalOpen] = useState(false);
  const [editAsset, setEditAsset] = useState<Partial<Asset>>({});
  const [editLiability, setEditLiability] = useState<Partial<Liability>>({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const a = await db.assets.toArray();
    const l = await db.liabilities.toArray();
    const s = await db.netWorthSnapshots.orderBy('date').toArray();
    setAssets(a);
    setLiabilities(l);
    setSnapshots(s);

    // Calculate investment total
    const holdings = await db.holdings.toArray();
    const lots = await db.holdingLots.toArray();
    let total = 0;
    for (const h of holdings) {
      const hLots = lots.filter(l => l.holdingId === h.id);
      total += hLots.reduce((s, l) => s + l.units, 0) * h.currentPrice;
    }
    setInvestmentTotal(total);
  }

  async function saveAsset() {
    if (!editAsset.name || !editAsset.type) return;
    const asset = { ...editAsset, lastUpdated: new Date().toISOString().split('T')[0] };
    if (editAsset.id) {
      await db.assets.update(editAsset.id, asset as Asset);
    } else {
      await db.assets.add(asset as Asset);
    }
    setAssetModalOpen(false);
    setEditAsset({});
    loadData();
  }

  async function deleteAsset(id: number) {
    await db.assets.delete(id);
    loadData();
  }

  async function saveLiability() {
    if (!editLiability.name || !editLiability.type) return;
    if (editLiability.id) {
      await db.liabilities.update(editLiability.id, editLiability as Liability);
    } else {
      await db.liabilities.add(editLiability as Liability);
    }
    setLiabilityModalOpen(false);
    setEditLiability({});
    loadData();
  }

  async function deleteLiability(id: number) {
    await db.liabilities.delete(id);
    loadData();
  }

  async function takeSnapshot() {
    const totalAssetValue = assets.reduce((s, a) => s + a.value, 0) + investmentTotal;
    const totalLiabilityValue = liabilities.reduce((s, l) => s + l.amount, 0);
    await db.netWorthSnapshots.add({
      date: new Date().toISOString().split('T')[0],
      totalAssets: totalAssetValue,
      totalLiabilities: totalLiabilityValue,
      netWorth: totalAssetValue - totalLiabilityValue,
    });
    loadData();
  }

  const totalAssetValue = assets.reduce((s, a) => s + a.value, 0) + investmentTotal;
  const totalLiabilityValue = liabilities.reduce((s, l) => s + l.amount, 0);
  const netWorth = totalAssetValue - totalLiabilityValue;
  const debtToAssetRatio = totalAssetValue > 0 ? (totalLiabilityValue / totalAssetValue) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Förmögenhet</h1>
          <p className="text-sm text-surface-500 mt-0.5">Tillgångar, skulder och nettovärde</p>
        </div>
        <button onClick={takeSnapshot} className="btn-secondary text-sm">
          <Camera size={16} /> Ta ögonblicksbild
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card sm:col-span-2">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Nettovärde</p>
          <p className={`text-2xl font-bold ${plColor(netWorth)}`}>{formatSEK(netWorth)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Tillgångar</p>
          <p className="text-lg font-bold text-success">{formatSEK(totalAssetValue)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Skulder</p>
          <p className="text-lg font-bold text-danger">{formatSEK(totalLiabilityValue)}</p>
          <p className="text-xs text-surface-400 mt-0.5">Skuld/tillgång: {debtToAssetRatio.toFixed(1)}%</p>
        </div>
      </div>

      {/* Net worth trend */}
      {snapshots.length > 1 && (
        <div className="card">
          <h2 className="text-sm font-semibold text-surface-800 mb-4">Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={snapshots}>
              <defs>
                <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4c6ef5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4c6ef5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#868e96' }} />
              <YAxis tick={{ fontSize: 11, fill: '#868e96' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatSEK(v)} contentStyle={{ borderRadius: '12px', border: '1px solid #e9ecef', fontSize: '13px' }} />
              <Area type="monotone" dataKey="netWorth" stroke="#4c6ef5" strokeWidth={2} fill="url(#nwGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Tillgångar</h2>
            <button onClick={() => { setEditAsset({}); setAssetModalOpen(true); }} className="btn-primary text-xs py-1.5">
              <Plus size={14} /> Lägg till
            </button>
          </div>

          {/* Investment portfolio (auto-calculated) */}
          {investmentTotal > 0 && (
            <div className="flex items-center justify-between py-3 px-3 rounded-xl bg-brand-50 border border-brand-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📈</span>
                <div>
                  <p className="text-sm font-medium text-surface-800">Investeringsportfölj</p>
                  <p className="text-xs text-surface-500">Auto-beräknad från innehav</p>
                </div>
              </div>
              <span className="text-sm font-bold text-surface-900">{formatSEK(investmentTotal)}</span>
            </div>
          )}

          <div className="space-y-2">
            {assets.map(a => {
              const typeInfo = ASSET_TYPES.find(t => t.value === a.type);
              return (
                <div key={a.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-50 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{typeInfo?.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-surface-800">{a.name}</p>
                      <p className="text-xs text-surface-400">{typeInfo?.label}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-surface-900">{formatSEK(a.value)}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditAsset(a); setAssetModalOpen(true); }}
                        className="p-1 text-surface-400 hover:text-surface-600 rounded"><Edit2 size={13} /></button>
                      <button onClick={() => deleteAsset(a.id!)}
                        className="p-1 text-surface-400 hover:text-danger rounded"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {assets.length === 0 && investmentTotal === 0 && (
              <p className="text-sm text-surface-400 text-center py-6">Inga tillgångar tillagda</p>
            )}
          </div>
        </div>

        {/* Liabilities */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-surface-800">Skulder</h2>
            <button onClick={() => { setEditLiability({}); setLiabilityModalOpen(true); }} className="btn-primary text-xs py-1.5">
              <Plus size={14} /> Lägg till
            </button>
          </div>
          <div className="space-y-2">
            {liabilities.map(l => {
              const typeInfo = LIABILITY_TYPES.find(t => t.value === l.type);
              return (
                <div key={l.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-surface-50 transition-colors group">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{typeInfo?.icon}</span>
                    <div>
                      <p className="text-sm font-medium text-surface-800">{l.name}</p>
                      <p className="text-xs text-surface-400">{typeInfo?.label} · {l.interestRate}% ränta</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-sm font-bold text-danger">{formatSEK(l.amount)}</span>
                      {l.monthlyPayment > 0 && (
                        <p className="text-xs text-surface-400">{formatSEK(l.monthlyPayment)}/mån</p>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditLiability(l); setLiabilityModalOpen(true); }}
                        className="p-1 text-surface-400 hover:text-surface-600 rounded"><Edit2 size={13} /></button>
                      <button onClick={() => deleteLiability(l.id!)}
                        className="p-1 text-surface-400 hover:text-danger rounded"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
            {liabilities.length === 0 && (
              <p className="text-sm text-surface-400 text-center py-6">Inga skulder tillagda</p>
            )}
          </div>
        </div>
      </div>

      {/* Asset Modal */}
      <Modal open={assetModalOpen} onClose={() => { setAssetModalOpen(false); setEditAsset({}); }}
        title={editAsset.id ? 'Redigera tillgång' : 'Lägg till tillgång'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Namn</label>
            <input className="input" placeholder="T.ex. Lägenhet Södermalm" value={editAsset.name || ''}
              onChange={e => setEditAsset({ ...editAsset, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Typ</label>
            <select className="select" value={editAsset.type || ''}
              onChange={e => setEditAsset({ ...editAsset, type: e.target.value as AssetType })}>
              <option value="">Välj typ...</option>
              {ASSET_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Värde (SEK)</label>
            <input type="number" className="input" value={editAsset.value || ''}
              onChange={e => setEditAsset({ ...editAsset, value: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setAssetModalOpen(false); setEditAsset({}); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveAsset} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>

      {/* Liability Modal */}
      <Modal open={liabilityModalOpen} onClose={() => { setLiabilityModalOpen(false); setEditLiability({}); }}
        title={editLiability.id ? 'Redigera skuld' : 'Lägg till skuld'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Namn</label>
            <input className="input" placeholder="T.ex. Bolån SBAB" value={editLiability.name || ''}
              onChange={e => setEditLiability({ ...editLiability, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Typ</label>
            <select className="select" value={editLiability.type || ''}
              onChange={e => setEditLiability({ ...editLiability, type: e.target.value as LiabilityType })}>
              <option value="">Välj typ...</option>
              {LIABILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Skuld (SEK)</label>
              <input type="number" className="input" value={editLiability.amount || ''}
                onChange={e => setEditLiability({ ...editLiability, amount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Ränta (%)</label>
              <input type="number" step="0.01" className="input" value={editLiability.interestRate || ''}
                onChange={e => setEditLiability({ ...editLiability, interestRate: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Månadskostnad (SEK)</label>
            <input type="number" className="input" value={editLiability.monthlyPayment || ''}
              onChange={e => setEditLiability({ ...editLiability, monthlyPayment: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setLiabilityModalOpen(false); setEditLiability({}); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveLiability} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
