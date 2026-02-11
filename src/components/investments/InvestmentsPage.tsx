import { useEffect, useState } from 'react';
import { TrendingUp, Plus, Edit2, Trash2, Save, X, Building2, Briefcase } from 'lucide-react';
import { db } from '../../db/database';
import { formatSEK, formatPercent, formatNumber, plColor, plBg } from '../../utils/formatters';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import type { InvestmentAccount, Holding, HoldingLot, AccountType } from '../../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface HoldingWithMetrics extends Holding {
  lots: HoldingLot[];
  totalUnits: number;
  avgPrice: number;
  totalCost: number;
  currentValue: number;
  pl: number;
  plPercent: number;
  weight: number;
}

interface AccountWithHoldings {
  account: InvestmentAccount;
  holdings: HoldingWithMetrics[];
  totalValue: number;
  totalCost: number;
  pl: number;
  plPercent: number;
}

const ACCOUNT_TYPES: { value: AccountType; label: string; desc: string }[] = [
  { value: 'ISK', label: 'ISK', desc: 'Investeringssparkonto' },
  { value: 'AF', label: 'AF', desc: 'Aktie- & fonddepå' },
  { value: 'KF', label: 'KF', desc: 'Kapitalförsäkring' },
  { value: 'TJP', label: 'TJP', desc: 'Tjänstepension' },
];

const ASSET_CLASSES = [
  { value: 'stock', label: 'Aktie' },
  { value: 'fund', label: 'Fond' },
  { value: 'etf', label: 'ETF' },
  { value: 'bond', label: 'Obligation' },
  { value: 'other', label: 'Övrigt' },
] as const;

export default function InvestmentsPage() {
  const [accounts, setAccounts] = useState<AccountWithHoldings[]>([]);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [holdingModalOpen, setHoldingModalOpen] = useState(false);
  const [lotModalOpen, setLotModalOpen] = useState(false);
  const [priceModalOpen, setPriceModalOpen] = useState(false);
  const [editAccount, setEditAccount] = useState<Partial<InvestmentAccount>>({});
  const [editHolding, setEditHolding] = useState<Partial<Holding>>({});
  const [editLot, setEditLot] = useState<Partial<HoldingLot>>({});
  const [editPrice, setEditPrice] = useState<{ holdingId: number; price: string }>({ holdingId: 0, price: '' });
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const accts = await db.investmentAccounts.toArray();
    const allHoldings = await db.holdings.toArray();
    const allLots = await db.holdingLots.toArray();

    const accountsWithHoldings: AccountWithHoldings[] = accts.map(account => {
      const holdings = allHoldings
        .filter(h => h.accountId === account.id)
        .map(h => {
          const lots = allLots.filter(l => l.holdingId === h.id);
          const totalUnits = lots.reduce((s, l) => s + l.units, 0);
          const totalCost = lots.reduce((s, l) => s + l.units * l.purchasePrice, 0);
          const avgPrice = totalUnits > 0 ? totalCost / totalUnits : 0;
          const currentValue = totalUnits * h.currentPrice;
          const pl = currentValue - totalCost;
          const plPercent = totalCost > 0 ? (pl / totalCost) * 100 : 0;
          return { ...h, lots, totalUnits, avgPrice, totalCost, currentValue, pl, plPercent, weight: 0 };
        });

      const totalValue = holdings.reduce((s, h) => s + h.currentValue, 0);
      holdings.forEach(h => { h.weight = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0; });
      const totalCost = holdings.reduce((s, h) => s + h.totalCost, 0);
      const pl = totalValue - totalCost;
      const plPercent = totalCost > 0 ? (pl / totalCost) * 100 : 0;

      return { account, holdings, totalValue, totalCost, pl, plPercent };
    });

    setAccounts(accountsWithHoldings);
  }

  // ─── Account CRUD ───────────────────────────────────────────────
  async function saveAccount() {
    if (!editAccount.name || !editAccount.type) return;
    if (editAccount.id) {
      await db.investmentAccounts.update(editAccount.id, editAccount as InvestmentAccount);
    } else {
      await db.investmentAccounts.add(editAccount as InvestmentAccount);
    }
    setAccountModalOpen(false);
    setEditAccount({});
    loadData();
  }

  async function deleteAccount(id: number) {
    const holdings = await db.holdings.where('accountId').equals(id).toArray();
    for (const h of holdings) {
      await db.holdingLots.where('holdingId').equals(h.id!).delete();
    }
    await db.holdings.where('accountId').equals(id).delete();
    await db.investmentAccounts.delete(id);
    loadData();
  }

  // ─── Holding CRUD ──────────────────────────────────────────────
  async function saveHolding() {
    if (!editHolding.name || !editHolding.accountId) return;
    const holding = { ...editHolding, currentPrice: editHolding.currentPrice || 0, currentPriceDate: new Date().toISOString().split('T')[0] };
    if (editHolding.id) {
      await db.holdings.update(editHolding.id, holding as Holding);
    } else {
      await db.holdings.add(holding as Holding);
    }
    setHoldingModalOpen(false);
    setEditHolding({});
    loadData();
  }

  async function deleteHolding(id: number) {
    await db.holdingLots.where('holdingId').equals(id).delete();
    await db.holdings.delete(id);
    loadData();
  }

  // ─── Lot CRUD ──────────────────────────────────────────────────
  async function saveLot() {
    if (!editLot.holdingId || !editLot.units || !editLot.purchasePrice) return;
    const lot = { ...editLot, purchaseDate: editLot.purchaseDate || new Date().toISOString().split('T')[0] };
    if (editLot.id) {
      await db.holdingLots.update(editLot.id, lot as HoldingLot);
    } else {
      await db.holdingLots.add(lot as HoldingLot);
    }
    setLotModalOpen(false);
    setEditLot({});
    loadData();
  }

  async function deleteLot(id: number) {
    await db.holdingLots.delete(id);
    loadData();
  }

  // ─── Price update ──────────────────────────────────────────────
  async function savePrice() {
    const price = parseFloat(editPrice.price);
    if (isNaN(price) || !editPrice.holdingId) return;
    await db.holdings.update(editPrice.holdingId, { currentPrice: price, currentPriceDate: new Date().toISOString().split('T')[0] });
    setPriceModalOpen(false);
    loadData();
  }

  // ─── Portfolio totals ─────────────────────────────────────────
  const totalPortfolioValue = accounts.reduce((s, a) => s + a.totalValue, 0);
  const totalPortfolioCost = accounts.reduce((s, a) => s + a.totalCost, 0);
  const totalPL = totalPortfolioValue - totalPortfolioCost;
  const totalPLPercent = totalPortfolioCost > 0 ? (totalPL / totalPortfolioCost) * 100 : 0;

  // Allocation chart data
  const allocationData = accounts.flatMap(a =>
    a.holdings.map(h => ({ name: h.name, value: h.currentValue, color: h.assetClass === 'stock' ? '#4c6ef5' : h.assetClass === 'fund' ? '#40c057' : h.assetClass === 'etf' ? '#ff922b' : '#845ef7' }))
  ).filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Investeringar</h1>
          <p className="text-sm text-surface-500 mt-0.5">Portfölj, konton och innehav</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEditAccount({}); setAccountModalOpen(true); }} className="btn-secondary text-sm">
            <Building2 size={16} /> Nytt konto
          </button>
          {accounts.length > 0 && (
            <button onClick={() => { setEditHolding({ accountId: accounts[0]?.account.id }); setHoldingModalOpen(true); }} className="btn-primary text-sm">
              <Plus size={16} /> Lägg till innehav
            </button>
          )}
        </div>
      </div>

      {/* Portfolio summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Portföljvärde</p>
          <p className="text-xl font-bold text-surface-900">{formatSEK(totalPortfolioValue)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Investerat</p>
          <p className="text-lg font-bold text-surface-700">{formatSEK(totalPortfolioCost)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Avkastning</p>
          <p className={`text-lg font-bold ${plColor(totalPL)}`}>{formatSEK(totalPL, true)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-surface-500 uppercase tracking-wide mb-1">Avkastning %</p>
          <p className={`text-lg font-bold ${plColor(totalPLPercent)}`}>{formatPercent(totalPLPercent, true)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Allocation chart */}
        {allocationData.length > 0 && (
          <div className="card lg:col-span-1">
            <h2 className="text-sm font-semibold text-surface-800 mb-3">Allokering</h2>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={allocationData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={40} outerRadius={80} paddingAngle={2} stroke="none">
                  {allocationData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatSEK(v)}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e9ecef', fontSize: '13px' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-3">
              {allocationData.slice(0, 8).map((d, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-surface-600 truncate max-w-[100px]">{d.name}</span>
                  </div>
                  <span className="font-medium text-surface-700">{formatSEK(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accounts and holdings */}
        <div className={`space-y-4 ${allocationData.length > 0 ? 'lg:col-span-3' : 'lg:col-span-4'}`}>
          {accounts.length > 0 ? accounts.map(({ account, holdings, totalValue, totalCost, pl, plPercent }) => (
            <div key={account.id} className="card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                    <Briefcase size={18} className="text-brand-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-surface-900">{account.name}</h3>
                    <p className="text-xs text-surface-500">{ACCOUNT_TYPES.find(t => t.value === account.type)?.desc} · {account.broker}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-bold text-surface-900">{formatSEK(totalValue)}</p>
                    <p className={`text-xs font-medium ${plColor(pl)}`}>
                      {formatSEK(pl, true)} ({formatPercent(plPercent, true)})
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditAccount(account); setAccountModalOpen(true); }}
                      className="p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteAccount(account.id!)}
                      className="p-1.5 text-surface-400 hover:text-danger hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Holdings table */}
              {holdings.length > 0 ? (
                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-100">
                        <th className="text-left py-2 pr-4 text-xs font-medium text-surface-500">Namn</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-surface-500">Antal</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-surface-500">GAV</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-surface-500">Kurs</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-surface-500">Värde</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-surface-500">+/−</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-surface-500">%</th>
                        <th className="text-right py-2 px-3 text-xs font-medium text-surface-500">Andel</th>
                        <th className="text-right py-2 pl-3 text-xs font-medium text-surface-500"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {holdings.map(h => (
                        <tr key={h.id} className="border-b border-surface-50 hover:bg-surface-50 transition-colors">
                          <td className="py-2.5 pr-4">
                            <p className="font-medium text-surface-800">{h.name}</p>
                            <p className="text-xs text-surface-400">{h.ticker || h.assetClass}</p>
                          </td>
                          <td className="text-right py-2.5 px-3 font-mono text-surface-700">{formatNumber(h.totalUnits, 2)}</td>
                          <td className="text-right py-2.5 px-3 font-mono text-surface-600">{formatNumber(h.avgPrice, 2)}</td>
                          <td className="text-right py-2.5 px-3">
                            <button
                              onClick={() => { setEditPrice({ holdingId: h.id!, price: String(h.currentPrice) }); setPriceModalOpen(true); }}
                              className="font-mono text-surface-800 hover:text-brand-600 transition-colors"
                            >
                              {formatNumber(h.currentPrice, 2)}
                            </button>
                          </td>
                          <td className="text-right py-2.5 px-3 font-mono font-medium text-surface-900">{formatSEK(h.currentValue)}</td>
                          <td className={`text-right py-2.5 px-3 font-mono font-medium ${plColor(h.pl)}`}>{formatSEK(h.pl, true)}</td>
                          <td className="text-right py-2.5 px-3">
                            <span className={`badge ${plBg(h.plPercent)}`}>{formatPercent(h.plPercent, true)}</span>
                          </td>
                          <td className="text-right py-2.5 px-3 font-mono text-xs text-surface-500">{h.weight.toFixed(1)}%</td>
                          <td className="text-right py-2.5 pl-3">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => { setEditLot({ holdingId: h.id! }); setLotModalOpen(true); }}
                                className="p-1 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors"
                                title="Lägg till köp"
                              >
                                <Plus size={13} />
                              </button>
                              <button
                                onClick={() => { setEditHolding(h); setHoldingModalOpen(true); }}
                                className="p-1 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => deleteHolding(h.id!)}
                                className="p-1 text-surface-400 hover:text-danger hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-surface-400 text-center py-4">
                  Inga innehav ännu.{' '}
                  <button onClick={() => { setEditHolding({ accountId: account.id }); setHoldingModalOpen(true); }}
                    className="text-brand-600 hover:underline">Lägg till</button>
                </p>
              )}
            </div>
          )) : (
            <div className="card">
              <EmptyState
                icon={<TrendingUp size={24} />}
                title="Inga investeringskonton"
                description="Skapa ett konto (ISK, AF, etc.) och börja lägga till dina innehav."
                action={
                  <button onClick={() => { setEditAccount({}); setAccountModalOpen(true); }} className="btn-primary">
                    <Building2 size={16} /> Skapa konto
                  </button>
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* ─── Account Modal ─────────────────────────────────────────── */}
      <Modal open={accountModalOpen} onClose={() => { setAccountModalOpen(false); setEditAccount({}); }}
        title={editAccount.id ? 'Redigera konto' : 'Nytt investeringskonto'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Namn</label>
            <input className="input" placeholder="T.ex. Nordnet ISK" value={editAccount.name || ''}
              onChange={e => setEditAccount({ ...editAccount, name: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Kontotyp</label>
            <select className="select" value={editAccount.type || ''}
              onChange={e => setEditAccount({ ...editAccount, type: e.target.value as AccountType })}>
              <option value="">Välj typ...</option>
              {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Mäklare</label>
            <input className="input" placeholder="T.ex. Nordnet, Avanza" value={editAccount.broker || ''}
              onChange={e => setEditAccount({ ...editAccount, broker: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setAccountModalOpen(false); setEditAccount({}); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveAccount} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>

      {/* ─── Holding Modal ─────────────────────────────────────────── */}
      <Modal open={holdingModalOpen} onClose={() => { setHoldingModalOpen(false); setEditHolding({}); }}
        title={editHolding.id ? 'Redigera innehav' : 'Lägg till innehav'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Konto</label>
            <select className="select" value={editHolding.accountId || ''}
              onChange={e => setEditHolding({ ...editHolding, accountId: Number(e.target.value) })}>
              <option value="">Välj konto...</option>
              {accounts.map(a => <option key={a.account.id} value={a.account.id}>{a.account.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Namn</label>
            <input className="input" placeholder="T.ex. Investor B" value={editHolding.name || ''}
              onChange={e => setEditHolding({ ...editHolding, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Ticker</label>
              <input className="input" placeholder="T.ex. INVE-B.ST" value={editHolding.ticker || ''}
                onChange={e => setEditHolding({ ...editHolding, ticker: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Typ</label>
              <select className="select" value={editHolding.assetClass || 'stock'}
                onChange={e => setEditHolding({ ...editHolding, assetClass: e.target.value as any })}>
                {ASSET_CLASSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Nuvarande kurs</label>
            <input type="number" step="0.01" className="input" placeholder="0.00" value={editHolding.currentPrice || ''}
              onChange={e => setEditHolding({ ...editHolding, currentPrice: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setHoldingModalOpen(false); setEditHolding({}); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveHolding} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>

      {/* ─── Lot Modal (Add purchase) ──────────────────────────────── */}
      <Modal open={lotModalOpen} onClose={() => { setLotModalOpen(false); setEditLot({}); }} title="Lägg till köp">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Antal</label>
              <input type="number" step="0.001" className="input" value={editLot.units || ''}
                onChange={e => setEditLot({ ...editLot, units: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Köpkurs</label>
              <input type="number" step="0.01" className="input" value={editLot.purchasePrice || ''}
                onChange={e => setEditLot({ ...editLot, purchasePrice: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Köpdatum</label>
            <input type="date" className="input" value={editLot.purchaseDate || ''}
              onChange={e => setEditLot({ ...editLot, purchaseDate: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setLotModalOpen(false); setEditLot({}); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveLot} className="btn-primary">Lägg till</button>
          </div>
        </div>
      </Modal>

      {/* ─── Price Update Modal ────────────────────────────────────── */}
      <Modal open={priceModalOpen} onClose={() => setPriceModalOpen(false)} title="Uppdatera kurs">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Ny kurs</label>
            <input type="number" step="0.01" className="input" value={editPrice.price}
              onChange={e => setEditPrice({ ...editPrice, price: e.target.value })} autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setPriceModalOpen(false)} className="btn-secondary">Avbryt</button>
            <button onClick={savePrice} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
