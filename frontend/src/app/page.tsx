import { getDashboard, getTransactions, formatAmount } from '@/lib/api';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { AlertTriangle, FileSearch, Copy } from 'lucide-react';

// Next.js App Router: サーバーコンポーネントとして30秒キャッシュ
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
        <div className="bg-red-50 text-red-600 rounded-2xl p-6 text-sm">
          <p className="font-medium mb-1">バックエンドに接続できませんでした</p>
          <p className="text-red-400">{error}</p>
          <p className="mt-3 text-xs text-red-400">
            バックエンドを起動してから再読み込みしてください: <code>cd backend && uvicorn app.main:app --reload</code>
          </p>
        </div>
      </div>
    );
  }

  if (!dashboard) return null;

  const expense = Math.round(parseFloat(dashboard.month_total_expense));
  const income  = Math.round(parseFloat(dashboard.month_total_income));
  const net     = Math.round(parseFloat(dashboard.month_net));

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* ヘッダー */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">ダッシュボード</h2>
        <p className="text-sm text-gray-500 mt-1">
          {dashboard.current_month.replace('-', '年')}月の概要
        </p>
      </div>

      {/* ステータスバナー */}
      {(dashboard.uncategorized_count > 0 || dashboard.possible_duplicate_count > 0 || dashboard.unmatched_receipt_count > 0) && (
        <div className="flex flex-wrap gap-3">
          {dashboard.uncategorized_count > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-4 py-2 rounded-full text-xs font-medium">
              <AlertTriangle size={14} />
              未分類の取引が{dashboard.uncategorized_count}件あります
            </div>
          )}
          {dashboard.possible_duplicate_count > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-full text-xs font-medium">
              <Copy size={14} />
              重複候補が{dashboard.possible_duplicate_count}件あります
            </div>
          )}
          {dashboard.unmatched_receipt_count > 0 && (
            <div className="flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-full text-xs font-medium">
              <FileSearch size={14} />
              未マッチのレシートが{dashboard.unmatched_receipt_count}件あります
            </div>
          )}
        </div>
      )}

      {/* KPIカード */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="今月の支出"
          value={`¥${expense.toLocaleString()}`}
          sub={`${dashboard.month_transaction_count}件の取引`}
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
        />
      </div>

      {/* メインコンテンツ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 月次トレンド */}
        <div className="card p-5 lg:col-span-3">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">月次収支トレンド</h3>
          <SpendingChart data={dashboard.monthly_trends} />
        </div>

        {/* カテゴリ別内訳 */}
        <div className="card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">カテゴリ別支出</h3>
          {dashboard.category_breakdown.length > 0 ? (
            <CategoryPieChart data={dashboard.category_breakdown} />
          ) : (
            <p className="text-sm text-gray-400 text-center py-12">データなし</p>
          )}
        </div>
      </div>

      {/* 直近の取引 */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">直近の取引</h3>
        <RecentTransactions transactions={recentTxs?.items ?? []} />
      </div>
    </div>
  );
}
