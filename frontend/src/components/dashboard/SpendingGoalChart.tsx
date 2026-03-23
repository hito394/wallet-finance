'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend, Area, AreaChart,
} from 'recharts';
import { Target, Edit3, Check, X as XIcon, Plus, Trash2 } from 'lucide-react';
import { getGoalVsActual, createGoal, deleteGoal, getGoals } from '@/lib/api';
import type { GoalVsActualResponse, SpendingGoal } from '@/types';
import { CATEGORY_LABELS } from '@/lib/api';

// ─── カスタムツールチップ ─────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl px-4 py-3 text-xs"
      style={{ backgroundColor: '#1E2030', border: '1px solid #2A2D42', minWidth: 160 }}
    >
      <p className="font-semibold mb-2" style={{ color: '#94A3B8' }}>
        {label?.replace('-', '年').replace(/(\d{2})$/, '$1月')}
      </p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>
            {p.name === 'actual' ? '実績' : '目標'}
          </span>
          <span className="font-bold" style={{ color: '#F1F5F9' }}>
            ¥{Math.round(p.value).toLocaleString()}
          </span>
        </div>
      ))}
      {payload.length === 2 && payload[0].name === 'actual' && payload[1].value != null && (
        <div
          className="mt-2 pt-2 flex justify-between"
          style={{ borderTop: '1px solid #1E2030', color: '#475569' }}
        >
          <span>差額</span>
          <span style={{ color: payload[0].value > payload[1].value ? '#EF4444' : '#22C55E' }}>
            {payload[0].value > payload[1].value ? '▲' : '▼'}
            ¥{Math.abs(Math.round(payload[0].value - payload[1].value)).toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 目標設定フォーム ─────────────────────────────────────────────────────────

function GoalEditor({
  currentGoal,
  category,
  onSave,
  onDelete,
}: {
  currentGoal: SpendingGoal | null;
  category: string | null;
  onSave: (amount: number) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    currentGoal ? Math.round(parseFloat(currentGoal.target_amount)).toString() : ''
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const num = parseInt(value.replace(/,/g, ''), 10);
    if (!num || num <= 0) return;
    setSaving(true);
    await onSave(num);
    setSaving(false);
    setEditing(false);
  }

  const label = category ? (CATEGORY_LABELS[category] ?? category) : '合計支出';

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        {currentGoal ? (
          <>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
              style={{ backgroundColor: '#1A2035', border: '1px solid #2A3F65', color: '#74B9FF' }}
            >
              <Target size={12} />
              <span>目標: ¥{Math.round(parseFloat(currentGoal.target_amount)).toLocaleString()}</span>
            </div>
            <button
              onClick={() => { setValue(Math.round(parseFloat(currentGoal.target_amount)).toString()); setEditing(true); }}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: '#1E2030', color: '#64748B' }}
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={onDelete}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: '#1E2030', color: '#64748B' }}
            >
              <Trash2 size={12} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{ backgroundColor: '#1E2030', color: '#7C6FFF', border: '1px solid #2A2D42' }}
          >
            <Plus size={12} />
            {label}の目標を設定
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs" style={{ color: '#475569' }}>目標:</span>
      <div
        className="flex items-center gap-1 px-2 py-1 rounded-lg"
        style={{ backgroundColor: '#1E2030', border: '1px solid #7C6FFF' }}
      >
        <span className="text-xs" style={{ color: '#94A3B8' }}>¥</span>
        <input
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="w-24 text-xs bg-transparent outline-none"
          style={{ color: '#F1F5F9' }}
          placeholder="例: 50000"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: '#7C6FFF', color: '#fff' }}
      >
        <Check size={12} />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: '#1E2030', color: '#64748B' }}
      >
        <XIcon size={12} />
      </button>
    </div>
  );
}

// ─── カテゴリタブ ─────────────────────────────────────────────────────────────

const CHART_CATEGORIES = [
  { key: null, label: '合計' },
  { key: 'food_dining', label: '飲食' },
  { key: 'grocery', label: '食料品' },
  { key: 'shopping', label: 'ショッピング' },
  { key: 'subscriptions', label: 'サブスク' },
  { key: 'entertainment', label: 'エンタメ' },
  { key: 'transportation', label: '交通' },
];

// ─── メインチャート ───────────────────────────────────────────────────────────

export function SpendingGoalChart() {
  const [category, setCategory] = useState<string | null>(null);
  const [chartData, setChartData] = useState<GoalVsActualResponse | null>(null);
  const [goals, setGoals] = useState<SpendingGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const currentGoal = goals.find(
    g => g.category === category && g.month === null && g.is_recurring
  ) ?? null;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [chart, goalsData] = await Promise.all([
        getGoalVsActual({ category: category ?? undefined, months: 12 }),
        getGoals(),
      ]);
      setChartData(chart);
      setGoals(goalsData);
    } catch {}
    setLoading(false);
  }, [category]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleSaveGoal(amount: number) {
    await createGoal({ category, month: null, target_amount: amount, is_recurring: true });
    await loadData();
  }

  async function handleDeleteGoal() {
    if (!currentGoal) return;
    await deleteGoal(currentGoal.id);
    await loadData();
  }

  // グラフ用データ整形
  const points = chartData?.points.map(p => ({
    month: p.month,
    actual: Math.round(parseFloat(p.actual)),
    goal: p.goal != null ? Math.round(parseFloat(p.goal)) : undefined,
  })) ?? [];

  const hasGoal = points.some(p => p.goal != null);
  const maxVal = Math.max(...points.map(p => Math.max(p.actual, p.goal ?? 0)), 1);

  function fmtMonth(m: string) {
    const [y, mo] = m.split('-');
    return `${mo}月`;
  }

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
    >
      {/* ヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
            目標 vs 実績
          </h3>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>直近12ヶ月</p>
        </div>
        <GoalEditor
          currentGoal={currentGoal}
          category={category}
          onSave={handleSaveGoal}
          onDelete={handleDeleteGoal}
        />
      </div>

      {/* カテゴリタブ */}
      <div className="flex flex-wrap gap-1.5 mb-5 overflow-x-auto pb-1">
        {CHART_CATEGORIES.map(c => (
          <button
            key={String(c.key)}
            onClick={() => setCategory(c.key)}
            className="px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            style={
              category === c.key
                ? { backgroundColor: '#7C6FFF', color: '#fff' }
                : { backgroundColor: '#1E2030', color: '#64748B' }
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* ローディング */}
      {loading && (
        <div
          className="h-48 rounded-xl animate-pulse"
          style={{ backgroundColor: '#1E2030' }}
        />
      )}

      {/* グラフ */}
      {!loading && points.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={points} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C6FFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#7C6FFF" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradGoal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#74B9FF" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#74B9FF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1E2030" vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={fmtMonth}
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#475569', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 10000 ? `${Math.round(v / 10000)}万` : `${v}`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={v => v === 'actual' ? '実績' : '目標'}
              wrapperStyle={{ fontSize: 11, color: '#64748B', paddingTop: 8 }}
            />
            {hasGoal && (
              <Area
                type="monotone"
                dataKey="goal"
                stroke="#74B9FF"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                fill="url(#gradGoal)"
                dot={false}
                connectNulls
              />
            )}
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#7C6FFF"
              strokeWidth={2}
              fill="url(#gradActual)"
              dot={{ fill: '#7C6FFF', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#7C6FFF' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!loading && points.length === 0 && (
        <p className="text-sm text-center py-12" style={{ color: '#475569' }}>
          データなし
        </p>
      )}

      {/* 今月のサマリー */}
      {!loading && points.length > 0 && (() => {
        const last = points[points.length - 1];
        if (!last) return null;
        const over = last.goal != null && last.actual > last.goal;
        const pct = last.goal ? Math.round((last.actual / last.goal) * 100) : null;

        return (
          <div
            className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl"
            style={{
              backgroundColor: over ? '#1A0D0D' : '#0D1A12',
              border: `1px solid ${over ? '#7F1D1D' : '#14532D'}`,
            }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: over ? '#EF4444' : '#22C55E' }}>
                今月{over ? '予算オーバー' : '予算内'}
              </p>
              <p className="text-lg font-bold mt-0.5" style={{ color: '#F1F5F9' }}>
                ¥{last.actual.toLocaleString()}
              </p>
            </div>
            {last.goal != null && (
              <div className="text-right">
                <p className="text-xs" style={{ color: '#475569' }}>目標</p>
                <p className="text-base font-semibold" style={{ color: '#94A3B8' }}>
                  ¥{last.goal.toLocaleString()}
                </p>
                {pct != null && (
                  <p className="text-xs mt-0.5" style={{ color: over ? '#EF4444' : '#22C55E' }}>
                    {pct}%
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
