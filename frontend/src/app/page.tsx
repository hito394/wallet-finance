import { getDashboard, getTransactions } from '@/lib/api';
import { HomeClient } from '@/components/HomeClient';

export const revalidate = 30;

export default async function HomePage() {
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
            ホーム
          </h2>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ backgroundColor: '#1A1C2E', color: '#7C6FFF', border: '1px solid #2A2D42' }}
        >
          {dashboard.month_transaction_count}件の取引
        </div>
      </div>

      <HomeClient
        dashboard={dashboard}
        transactions={recentTxs?.items ?? []}
      />
    </div>
  );
}
