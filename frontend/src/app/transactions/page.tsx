'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { getTransactions, updateTransaction, CATEGORY_LABELS, CATEGORY_COLORS, formatDate } from '@/lib/api';
import type { Transaction } from '@/types';
import clsx from 'clsx';
import { Pencil, ChevronLeft, ChevronRight, Search, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

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
      ...(search    && { search }),
      ...(direction && { direction }),
      ...(category  && { category }),
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

  const thStyle = {
    padding: '12px 16px',
    fontSize: 11,
    fontWeight: 600,
    color: '#475569',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    borderBottom: '1px solid #1E2030',
  };

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-7xl mx-auto">
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>取引一覧</h2>
        {data && (
          <p className="text-xs mt-1" style={{ color: '#475569' }}>
            {data.total}件の取引
          </p>
        )}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#475569' }}
          />
          <input
            type="text"
            placeholder="店名・摘要で検索"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 pr-4 py-2 text-sm rounded-xl w-52 focus:outline-none"
            style={{
              backgroundColor: '#13151F',
              border: '1px solid #2A2D42',
              color: '#CBD5E1',
            }}
          />
        </div>

        {/* Direction toggle */}
        <div
          className="flex rounded-xl overflow-hidden text-sm"
          style={{ border: '1px solid #2A2D42' }}
        >
          {DIRECTIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => { setDirection(d.value); setPage(1); }}
              className="px-3 py-2 transition-colors font-medium"
              style={
                direction === d.value
                  ? { backgroundColor: '#7C6FFF', color: '#fff' }
                  : { backgroundColor: '#13151F', color: '#64748B' }
              }
            >
              {d.label}
            </button>
          ))}
        </div>

        {/* Category select */}
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value); setPage(1); }}
          className="px-3 py-2 text-sm rounded-xl focus:outline-none"
          style={{
            backgroundColor: '#13151F',
            border: '1px solid #2A2D42',
            color: '#94A3B8',
          }}
        >
          <option value="">全カテゴリ</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>日付</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>店名</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>カテゴリ</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>金額</th>
                <th style={{ ...thStyle, textAlign: 'left' }}>ソース</th>
                <th style={{ ...thStyle }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#475569' }}>
                    読み込み中...
                  </td>
                </tr>
              )}
              {!isLoading && data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm" style={{ color: '#475569' }}>
                    取引が見つかりません
                  </td>
                </tr>
              )}
              {data?.items.map((tx) => {
                const catColor = CATEGORY_COLORS[tx.category ?? 'other'] ?? '#2A2D42';
                const isCredit = tx.direction === 'credit';
                return (
                  <tr
                    key={tx.id}
                    className={clsx('transition-colors', tx.is_ignored && 'opacity-40')}
                    style={{ borderTop: '1px solid #1E2030' }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#161829';
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td className="px-4 py-3 text-sm whitespace-nowrap" style={{ color: '#64748B' }}>
                      {formatDate(tx.transaction_date)}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-medium whitespace-nowrap max-w-xs truncate"
                      style={{ color: '#CBD5E1' }}
                    >
                      {tx.merchant_normalized ?? tx.merchant_raw}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: catColor + '25',
                          color: catColor,
                          border: `1px solid ${catColor}50`,
                        }}
                      >
                        {CATEGORY_LABELS[tx.category ?? 'other'] ?? tx.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: isCredit ? '#4ADE8020' : '#F8717120' }}
                        >
                          {isCredit
                            ? <ArrowDownLeft size={11} color="#4ADE80" />
                            : <ArrowUpRight size={11} color="#F87171" />}
                        </span>
                        <span
                          className="text-sm font-semibold tabular-nums"
                          style={{ color: isCredit ? '#4ADE80' : '#F87171' }}
                        >
                          {isCredit ? '+' : '-'}¥{Math.round(parseFloat(tx.amount)).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: '#1E2030', color: '#64748B' }}
                      >
                        {tx.source_type === 'csv_statement'
                          ? 'CSV'
                          : tx.source_type === 'pdf_statement'
                          ? 'PDF'
                          : '手動'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditTx(tx)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: '#475569' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = '#1E2030';
                          (e.currentTarget as HTMLElement).style.color = '#7C6FFF';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = '#475569';
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div
            className="px-4 py-3 flex items-center justify-between text-sm"
            style={{ borderTop: '1px solid #1E2030', color: '#64748B' }}
          >
            <span>
              {data.total}件中 {(page - 1) * 50 + 1}〜{Math.min(page * 50, data.total)}件
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ border: '1px solid #2A2D42', color: '#64748B' }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                disabled={page === data.total_pages}
                className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                style={{ border: '1px solid #2A2D42', color: '#64748B' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit modal */}
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

// ── Edit modal ──────────────────────────────────────────

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

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 14,
    borderRadius: 12,
    border: '1px solid #2A2D42',
    backgroundColor: '#0E0F1A',
    color: '#CBD5E1',
    outline: 'none',
  };

  return (
    <div
      className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ backgroundColor: '#13151F', border: '1px solid #2A2D42' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold" style={{ color: '#F1F5F9' }}>取引を編集</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors"
            style={{ color: '#64748B', backgroundColor: '#1E2030' }}
          >
            ✕
          </button>
        </div>

        {/* Transaction info */}
        <div className="rounded-xl p-4 text-sm space-y-1" style={{ backgroundColor: '#0E0F1A' }}>
          <p className="font-medium" style={{ color: '#CBD5E1' }}>
            {tx.merchant_normalized ?? tx.merchant_raw}
          </p>
          <p style={{ color: '#64748B' }}>{formatDate(tx.transaction_date)}</p>
          <p
            className="text-lg font-bold mt-1"
            style={{ color: tx.direction === 'credit' ? '#4ADE80' : '#F87171' }}
          >
            {tx.direction === 'credit' ? '+' : '-'}¥{Math.round(parseFloat(tx.amount)).toLocaleString()}
          </p>
        </div>

        {/* Category */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: '#64748B' }}>
            カテゴリ
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inputStyle}
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: '#64748B' }}>
            メモ
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'none' }}
            placeholder="メモを入力..."
          />
        </div>

        {/* Ignore toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={isIgnored}
            onChange={(e) => setIsIgnored(e.target.checked)}
            className="w-4 h-4 rounded"
            style={{ accentColor: '#7C6FFF' }}
          />
          <span className="text-sm" style={{ color: '#94A3B8' }}>
            この取引を無視する（集計から除外）
          </span>
        </label>

        {/* Buttons */}
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
