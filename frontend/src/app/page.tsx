import { getDashboard, getTransactions } from '@/lib/api';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { AlertTriangle, FileSearch, Copy, TrendingUp } from 'lucide-react';

export const revalidate = 30;

export default async function DashboardPage() {
  let dashboard = null;
  let recentTxs = null;
  let error = null;

  try {
    [dashboard, recentTxs] = await Promise.all([
      getDashboard(),
      getTransactions({ per_page: 10, is_ignored: false }),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : '不明なエラー';
  }

  if (error) {
    return (
      <div className="p-8">
        <div
          className="rounded-2xl p-6 text-sm"
          style={{ backgroundColor: '#2D1515', border: '1px solid #7F1D1D', color: '#FCA5A5' }}
        >
          <p className="font-medium mb-1">バックエンドに接続できませんでした</p>
          <p style={{ color: '#F87171' }}>{error}</p>
          <p className="mt-3 text-xs" style={{ color: '#EF4444' }}>
            バックエンドを起動してから再読み込みしてください:{' '}
            <code className="font-mono">cd backend && uvicorn app.main:app --reload</code>
          </p>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const expense = Math.round(parseFloat(dashboard.month_total_expense));
  const income  = Math.round(parseFloat(dashboard.month_total_income));
  const net     = Math.round(parseFloat(dashboard.month_net));

  const [year, month] = dashboard.current_month.split('-');

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
            {year}年{month}月
          </p>
          <h2 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>
            ダッシュボード
          </h2>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#1A1C2E', color: '#7C6FFF', border: '1px solid #2A2D42' }}
        >
          <TrendingUp size={12} />
          {dashboard.month_transaction_count}件の取引
        </div>
      </div>

      {/* Alert banners */}
      {(dashboard.uncategorized_count > 0 ||
        dashboard.possible_duplicate_count > 0 ||
        dashboard.unmatched_receipt_count > 0) && (
        <div className="flex flex-wrap gap-2">
          {dashboard.uncategorized_count > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#2D2006', color: '#FCD34D', border: '1px solid #78350F' }}
            >
              <AlertTriangle size={12} />
              未分類 {dashboard.uncategorized_count}件
            </div>
          )}
          {dashboard.possible_duplicate_count > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#2D1A06', color: '#FDBA74', border: '1px solid #7C2D12' }}
            >
              <Copy size={12} />
              重複候補 {dashboard.possible_duplicate_count}件
            </div>
          )}
          {dashboard.unmatched_receipt_count > 0 && (
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: '#1A0D2E', color: '#C4B5FD', border: '1px solid #581C87' }}
            >
              <FileSearch size={12} />
              未マッチレシート {dashboard.unmatched_receipt_count}件
            </div>
          )}
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="今月の支出"
          value={`¥${expense.toLocaleString()}`}
          sub={`${dashboard.month_transaction_count}件`}
          icon="💸"
          color="red"
        />
        <SummaryCard
          title="今月の収入"
          value={`¥${income.toLocaleString()}`}
          icon="💰"
          color="green"
        />
        <SummaryCard
          title="収支"
          value={`${net >= 0 ? '+' : ''}¥${net.toLocaleString()}`}
          icon={net >= 0 ? '📈' : '📉'}
          color={net >= 0 ? 'green' : 'red'}
        />
        <SummaryCard
          title="インポート回数"
          value={`${dashboard.total_import_count}回`}
          icon="📂"
          color="purple"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Area chart */}
        <div
          className="rounded-2xl p-5 lg:col-span-3"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
              月次収支トレンド
            </h3>
            <span className="text-xs" style={{ color: '#475569' }}>直近12ヶ月</span>
          </div>
          <SpendingChart data={dashboard.monthly_trends} />
        </div>

        {/* Donut chart */}
        <div
          className="rounded-2xl p-5 lg:col-span-2"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
              カテゴリ別支出
            </h3>
            <span className="text-xs" style={{ color: '#475569' }}>今月</span>
          </div>
          {dashboard.category_breakdown.length > 0 ? (
            <CategoryPieChart data={dashboard.category_breakdown} />
          ) : (
            <p className="text-sm text-center py-12" style={{ color: '#475569' }}>
              データなし
            </p>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>
            直近の取引
          </h3>
        </div>
        <RecentTransactions transactions={recentTxs?.items ?? []} />
      </div>
    </div>
  );
}
