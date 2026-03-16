'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { getTransactions, updateTransaction, CATEGORY_LABELS, CATEGORY_COLORS, formatDate } from '@/lib/api';
import type { Transaction } from '@/types';
import clsx from 'clsx';
import { Pencil, ChevronLeft, ChevronRight, Search } from 'lucide-react';

// SWR用フェッチャー
const fetcher = (params: Record<string, string | number | boolean>) =>
  getTransactions(params);

const DIRECTIONS = [
  { value: '', label: 'すべて' },
  { value: 'debit', label: '支出' },
  { value: 'credit', label: '収入' },
];

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [category, setCategory] = useState('');
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const { data, mutate, isLoading } = useSWR(
    ['transactions', page, search, direction, category],
    () => fetcher({
      page,
      per_page: 50,
      ...(search && { search }),
      ...(direction && { direction }),
      ...(category && { category }),
    }),
    { keepPreviousData: true }
  );

  const handleSave = useCallback(
    async (id: number, patch: Record<string, unknown>) => {
      await updateTransaction(id, patch);
      setEditTx(null);
      mutate();
    },
    [mutate]
  );

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900">取引一覧</h2>

      {/* フィルターバー */}
      <div className="flex flex-wrap gap-3">
        {/* 検索 */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="店名・摘要で検索"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 w-52"
          />
        </div>

        {/* 収支フィルタ */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => { setDirection(d.value); setPage(1); }}
              className={clsx(
                'px-3 py-2 transition-colors',
                direction === d.value ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              )}
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* カテゴリフィルタ */}
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-white"
        >
          <option value="">全カテゴリ</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* テーブル */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">日付</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">店名</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">カテゴリ</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">金額</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">ソース</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">読み込み中...</td></tr>
              )}
              {!isLoading && data?.items.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">取引が見つかりません</td></tr>
              )}
              {data?.items.map((tx) => (
                <tr
                  key={tx.id}
                  className={clsx(
                    'hover:bg-gray-50 transition-colors',
                    tx.is_ignored && 'opacity-40'
                  )}
                >
                  <td className="td text-gray-500">{formatDate(tx.transaction_date)}</td>
                  <td className="td font-medium text-gray-800 max-w-xs truncate">
                    {tx.merchant_normalized ?? tx.merchant_raw}
                  </td>
                  <td className="td">
                    <span
                      className="badge text-white text-xs"
                      style={{ background: CATEGORY_COLORS[tx.category ?? 'other'] ?? '#DFE6E9' }}
                    >
                      {CATEGORY_LABELS[tx.category ?? 'other'] ?? tx.category}
                    </span>
                  </td>
                  <td className={clsx(
                    'td text-right font-semibold tabular-nums',
                    tx.direction === 'credit' ? 'text-emerald-600' : 'text-gray-800'
                  )}>
                    {tx.direction === 'credit' ? '+' : ''}
                    ¥{Math.round(parseFloat(tx.amount)).toLocaleString()}
                  </td>
                  <td className="td">
                    <span className="badge bg-gray-100 text-gray-600">
                      {tx.source_type === 'csv_statement' ? 'CSV' : tx.source_type === 'pdf_statement' ? 'PDF' : '手動'}
                    </span>
                  </td>
                  <td className="td">
                    <button
                      onClick={() => setEditTx(tx)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {data && data.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
            <span>{data.total}件中 {(page - 1) * 50 + 1}〜{Math.min(page * 50, data.total)}件</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {editTx && (
        <EditModal
          tx={editTx}
          onSave={handleSave}
          onClose={() => setEditTx(null)}
        />
      )}
    </div>
  );
}

// ---- インライン編集モーダル ----

function EditModal({
  tx,
  onSave,
  onClose,
}: {
  tx: Transaction;
  onSave: (id: number, data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(tx.category ?? 'other');
  const [notes, setNotes] = useState(tx.notes ?? '');
  const [isIgnored, setIsIgnored] = useState(tx.is_ignored);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    await onSave(tx.id, { category, notes, is_ignored: isIgnored });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">取引を編集</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1">✕</button>
        </div>

        {/* 情報 */}
        <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-1">
          <p className="font-medium text-gray-800">{tx.merchant_normalized ?? tx.merchant_raw}</p>
          <p className="text-gray-500">{formatDate(tx.transaction_date)}</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            ¥{Math.round(parseFloat(tx.amount)).toLocaleString()}
          </p>
        </div>

        {/* カテゴリ */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">カテゴリ</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* メモ */}
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1.5">メモ</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
            placeholder="メモを入力..."
          />
        </div>

        {/* 無視フラグ */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isIgnored}
            onChange={(e) => setIsIgnored(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-500"
          />
          <span className="text-sm text-gray-600">この取引を無視する（集計から除外）</span>
        </label>

        {/* ボタン */}
        <div className="flex gap-3 justify-end pt-1">
          <button onClick={onClose} className="btn-secondary">キャンセル</button>
          <button onClick={handleSubmit} disabled={saving} className="btn-primary">
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
