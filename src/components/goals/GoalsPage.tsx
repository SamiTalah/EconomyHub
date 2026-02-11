import { useEffect, useState } from 'react';
import { Target, Plus, Edit2, Trash2 } from 'lucide-react';
import { db } from '../../db/database';
import { formatSEK } from '../../utils/formatters';
import Modal from '../ui/Modal';
import EmptyState from '../ui/EmptyState';
import type { SavingsGoal } from '../../types';

const GOAL_ICONS = ['🎯', '🏠', '✈️', '🚗', '🎓', '💍', '🏖️', '💰', '🛡️', '📱'];
const GOAL_COLORS = ['#4c6ef5', '#40c057', '#ff922b', '#845ef7', '#339af0', '#f06595', '#20c997', '#be4bdb', '#15aabf', '#e64980'];

export default function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Partial<SavingsGoal>>({ icon: '🎯', color: '#4c6ef5' });
  const [updateAmountId, setUpdateAmountId] = useState<number | null>(null);
  const [updateValue, setUpdateValue] = useState('');

  useEffect(() => { loadGoals(); }, []);

  async function loadGoals() {
    const g = await db.savingsGoals.toArray();
    setGoals(g);
  }

  async function saveGoal() {
    if (!editGoal.name || !editGoal.targetAmount) return;
    const goal = { ...editGoal, currentAmount: editGoal.currentAmount || 0 };
    if (editGoal.id) {
      await db.savingsGoals.update(editGoal.id, goal as SavingsGoal);
    } else {
      await db.savingsGoals.add(goal as SavingsGoal);
    }
    setModalOpen(false);
    setEditGoal({ icon: '🎯', color: '#4c6ef5' });
    loadGoals();
  }

  async function deleteGoal(id: number) {
    await db.savingsGoals.delete(id);
    loadGoals();
  }

  async function updateAmount(id: number) {
    const val = parseFloat(updateValue);
    if (isNaN(val)) return;
    await db.savingsGoals.update(id, { currentAmount: val });
    setUpdateAmountId(null);
    setUpdateValue('');
    loadGoals();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Sparmål</h1>
          <p className="text-sm text-surface-500 mt-0.5">Sätt mål och följ din framsteg</p>
        </div>
        <button onClick={() => { setEditGoal({ icon: '🎯', color: '#4c6ef5' }); setModalOpen(true); }} className="btn-primary text-sm">
          <Plus size={16} /> Nytt mål
        </button>
      </div>

      {goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map(goal => {
            const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
            const remaining = goal.targetAmount - goal.currentAmount;
            const daysLeft = goal.targetDate
              ? Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
              : null;

            return (
              <div key={goal.id} className="card-hover">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{goal.icon}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-surface-900">{goal.name}</h3>
                      {goal.targetDate && (
                        <p className="text-xs text-surface-400">
                          Mål: {goal.targetDate} {daysLeft !== null && `(${daysLeft} dagar kvar)`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditGoal(goal); setModalOpen(true); }}
                      className="p-1 text-surface-400 hover:text-surface-600 rounded"><Edit2 size={13} /></button>
                    <button onClick={() => deleteGoal(goal.id!)}
                      className="p-1 text-surface-400 hover:text-danger rounded"><Trash2 size={13} /></button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-surface-200 rounded-full h-3 mb-3">
                  <div
                    className="h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(progress, 100)}%`, backgroundColor: goal.color || '#4c6ef5' }}
                  />
                </div>

                <div className="flex justify-between items-end mb-3">
                  <div>
                    <p className="text-lg font-bold text-surface-900">{formatSEK(goal.currentAmount)}</p>
                    <p className="text-xs text-surface-400">av {formatSEK(goal.targetAmount)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: goal.color || '#4c6ef5' }}>
                      {progress.toFixed(0)}%
                    </p>
                    {remaining > 0 && (
                      <p className="text-xs text-surface-400">{formatSEK(remaining)} kvar</p>
                    )}
                  </div>
                </div>

                {/* Update current amount */}
                {updateAmountId === goal.id ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="input text-sm flex-1"
                      placeholder="Nytt belopp"
                      value={updateValue}
                      onChange={e => setUpdateValue(e.target.value)}
                      autoFocus
                    />
                    <button onClick={() => updateAmount(goal.id!)} className="btn-primary text-xs py-2">Spara</button>
                    <button onClick={() => setUpdateAmountId(null)} className="btn-secondary text-xs py-2">Avbryt</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setUpdateAmountId(goal.id!); setUpdateValue(String(goal.currentAmount)); }}
                    className="w-full btn-secondary text-xs justify-center"
                  >
                    Uppdatera belopp
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Target size={24} />}
            title="Inga sparmål ännu"
            description="Skapa ditt första sparmål för att börja följa din progress."
            action={
              <button onClick={() => { setEditGoal({ icon: '🎯', color: '#4c6ef5' }); setModalOpen(true); }} className="btn-primary">
                <Plus size={16} /> Skapa sparmål
              </button>
            }
          />
        </div>
      )}

      {/* Goal Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditGoal({ icon: '🎯', color: '#4c6ef5' }); }}
        title={editGoal.id ? 'Redigera mål' : 'Nytt sparmål'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Namn</label>
            <input className="input" placeholder="T.ex. Buffert 100k" value={editGoal.name || ''}
              onChange={e => setEditGoal({ ...editGoal, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Målbelopp (SEK)</label>
              <input type="number" className="input" value={editGoal.targetAmount || ''}
                onChange={e => setEditGoal({ ...editGoal, targetAmount: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-600 mb-1.5 block">Nuvarande belopp</label>
              <input type="number" className="input" value={editGoal.currentAmount || ''}
                onChange={e => setEditGoal({ ...editGoal, currentAmount: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-1.5 block">Måldatum</label>
            <input type="date" className="input" value={editGoal.targetDate || ''}
              onChange={e => setEditGoal({ ...editGoal, targetDate: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-2 block">Ikon</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_ICONS.map(icon => (
                <button
                  key={icon}
                  onClick={() => setEditGoal({ ...editGoal, icon })}
                  className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center transition-all
                    ${editGoal.icon === icon ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-surface-100 hover:bg-surface-200'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600 mb-2 block">Färg</label>
            <div className="flex flex-wrap gap-2">
              {GOAL_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setEditGoal({ ...editGoal, color })}
                  className={`w-8 h-8 rounded-full transition-all ${editGoal.color === color ? 'ring-2 ring-offset-2 ring-brand-500' : ''}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setModalOpen(false); setEditGoal({ icon: '🎯', color: '#4c6ef5' }); }} className="btn-secondary">Avbryt</button>
            <button onClick={saveGoal} className="btn-primary">Spara</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
