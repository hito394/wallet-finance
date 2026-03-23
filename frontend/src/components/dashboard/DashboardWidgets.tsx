'use client';

import { TrendingDown, TrendingUp, AlertTriangle, FileSearch, Copy, Wallet } from 'lucide-react';
import { SpendingChart } from './SpendingChart';
import { RecentTransactions } from './RecentTransactions';
import { SubscriptionWidget } from './SubscriptionWidget';
import { SpendingGoalChart } from './SpendingGoalChart';
import type { DashboardSummary, Transaction } from '@/types';

// カテゴリ表示名・色マッピング
const CATEGORY_META: Record<string, { label: string; color: string }> = {
  food_dining:    { label: '外食・飲食',   color: '#F97316' },
  grocery:        { label: 'スーパー',     color: '#22C55E' },
  shopping:       { label: 'ショッピング', color: '#8B5CF6' },
  transportation: { label: '交通費',       color: '#06B6D4' },
  entertainment:  { label: '娯楽',         color: '#EC4899' },
  subscriptions:  { label: 'サブスク',     color: '#6366F1' },
  utilities:      { label: '公共料金',     color: '#84CC16' },
  housing:        { label: '住居費',       color: '#F59E0B' },
  education:      { label: '教育',         color: '#14B8A6' },
  travel:         { label: '旅行',         color: '#3B82F6' },
  other:          { label: 'その他',       color: '#94A3B8' },
};

interface Props {
  dashboard: DashboardSummary;
  transactions: Transaction[];
}

// ─── KPI カード ───────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon,
  trend,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  icon: React.ReactNode;
  trend?: { direction: 'up' | 'down' | 'flat'; label: string };
}) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-2"
      style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: '#475569' }}>{label}</span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}18`, color }}
        >
          {icon}
        </div>
      </div>
      <p className="text-xl font-bold tabular-nums leading-none" style={{ color: '#F1F5F9' }}>
        {value}
      </p>
      {(sub || trend) && (
        <div className="flex items-center gap-2">
          {sub && <span className="text-xs" style={{ color: '#475569' }}>{sub}</span>}
          {trend && (
            <span
              className="text-xs font-medium"
              style={{
                color: trend.direction === 'up' ? '#4ADE80' : trend.direction === 'down' ? '#F87171' : '#64748B',
              }}
            >
              {trend.label}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── カテゴリ別横棒 ───────────────────────────────────────────────────────────

function CategoryBarsWidget({
  breakdown,
}: {
  breakdown: { category: string; total: number; count: number }[];
}) {
  const items = breakdown
    .filter(c => c.category !== 'income' && c.category !== 'transfer')
    .sort((a, b) => b.total - a.total)
    .slice(0, 7);

  const maxAmount = items[0]?.total ?? 1;
  const totalExpense = items.reduce((s, c) => s + c.total, 0);

  return (
    <div
      className="rounded-2xl p-5"
      style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>カテゴリ別支出</h3>
        <span className="text-xs" style={{ color: '#475569' }}>今月</span>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-center py-10" style={{ color: '#475569' }}>取引データなし</p>
      ) : (
        <div className="space-y-3.5">
          {items.map(cat => {
            const meta = CATEGORY_META[cat.category] ?? { label: cat.category, color: '#94A3B8' };
            const barPct = Math.round((cat.total / maxAmount) * 100);
            const ofTotal = totalExpense > 0 ? Math.round((cat.total / totalExpense) * 100) : 0;
            return (
              <div key={cat.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>{meta.label}</span>
                    <span className="text-xs" style={{ color: '#334155' }}>{ofTotal}%</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: '#E2E8F0' }}>
                    ¥{Math.round(cat.total).toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1E2030' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${barPct}%`, backgroundColor: meta.color, transition: 'width 0.6s ease' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── メイン ───────────────────────────────────────────────────────────────────

export function DashboardWidgets({ dashboard, transactions }: Props) {
  const expense = Math.round(parseFloat(dashboard.month_total_expense));
  const income  = Math.round(parseFloat(dashboard.month_total_income));
  const net     = Math.round(parseFloat(dashboard.month_net));

  const hasAlerts =
    dashboard.uncategorized_count > 0 ||
    dashboard.possible_duplicate_count > 0 ||
    dashboard.unmatched_receipt_count > 0;

  // 先月比（monthly_trends から算出）
  const sortedTrends = [...(dashboard.monthly_trends ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  const lastMonthExpense = sortedTrends.length >= 2
    ? Math.round(parseFloat(sortedTrends[sortedTrends.length - 2]?.expense ?? '0'))
    : null;
  const expenseChange = lastMonthExpense && lastMonthExpense > 0
    ? Math.round(((expense - lastMonthExpense) / lastMonthExpense) * 100)
    : null;

  return (
    <div className="space-y-4">

      {/* ── Row 1: KPI cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="今月の支出"
          value={`¥${expense.toLocaleString()}`}
          sub={`${dashboard.month_transaction_count}件`}
          color="#F87171"
          icon={<TrendingDown size={14} />}
          trend={expenseChange !== null ? {
            direction: expenseChange > 0 ? 'down' : 'up',
            label: `${expenseChange > 0 ? '+' : ''}${expenseChange}% 先月比`,
          } : undefined}
        />
        <KpiCard
          label="今月の収入"
          value={`¥${income.toLocaleString()}`}
          color="#4ADE80"
          icon={<TrendingUp size={14} />}
        />
        <KpiCard
          label="収支"
          value={`${net >= 0 ? '+' : ''}¥${net.toLocaleString()}`}
          color={net >= 0 ? '#4ADE80' : '#F87171'}
          icon={<Wallet size={14} />}
        />
        <KpiCard
          label="インポート回数"
          value={`${dashboard.total_import_count}回`}
          color="#7C6FFF"
          icon={<span className="text-xs">📂</span>}
        />
      </div>

      {/* ── アラート ── */}
      {hasAlerts && (
        <div className="flex flex-wrap gap-2">
          {dashboard.uncategorized_count > 0 && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#2D2006', color: '#FCD34D', border: '1px solid #78350F' }}
            >
              <AlertTriangle size={11} />未分類 {dashboard.uncategorized_count}件
            </span>
          )}
          {dashboard.possible_duplicate_count > 0 && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#2D1A06', color: '#FDBA74', border: '1px solid #7C2D12' }}
            >
              <Copy size={11} />重複候補 {dashboard.possible_duplicate_count}件
            </span>
          )}
          {dashboard.unmatched_receipt_count > 0 && (
            <span
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#1A0D2E', color: '#C4B5FD', border: '1px solid #581C87' }}
            >
              <FileSearch size={11} />未マッチレシート {dashboard.unmatched_receipt_count}件
            </span>
          )}
        </div>
      )}

      {/* ── Row 2: 月次トレンド + カテゴリ別 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* 支出トレンド */}
        <div
          className="lg:col-span-3 rounded-2xl p-5"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>月次収支トレンド</h3>
            <span className="text-xs" style={{ color: '#475569' }}>直近12ヶ月</span>
          </div>
          <SpendingChart data={dashboard.monthly_trends} />
        </div>

        {/* カテゴリ別支出 横棒 */}
        <div className="lg:col-span-2">
          <CategoryBarsWidget breakdown={dashboard.category_breakdown} />
        </div>
      </div>

      {/* ── Row 3: サブスク + 直近取引 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <SubscriptionWidget />
        </div>
        <div
          className="lg:col-span-3 rounded-2xl p-5"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <h3 className="text-sm font-semibold mb-4" style={{ color: '#CBD5E1' }}>直近の取引</h3>
          <RecentTransactions transactions={transactions} />
        </div>
      </div>

      {/* ── Row 4: 目標 vs 実績 ── */}
      <SpendingGoalChart />

    </div>
  );
}
