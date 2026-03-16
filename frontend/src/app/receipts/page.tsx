'use client';

import useSWR from 'swr';
import { getReceipts, formatDate } from '@/lib/api';
import type { Receipt } from '@/types';
import clsx from 'clsx';
import { FileImage, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending:    { label: 'OCR待ち',   color: 'bg-gray-100 text-gray-600',    icon: Clock          },
  processing: { label: '処理中',    color: 'bg-blue-100 text-blue-600',    icon: Clock          },
  parsed:     { label: 'OCR完了',   color: 'bg-amber-100 text-amber-700',  icon: CheckCircle2   },
  matched:    { label: 'マッチ済',  color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  unmatched:  { label: '未マッチ',  color: 'bg-orange-100 text-orange-600', icon: AlertCircle   },
  failed:     { label: '失敗',      color: 'bg-red-100 text-red-600',      icon: AlertCircle    },
};

export default function ReceiptsPage() {
  const { data, isLoading } = useSWR('receipts', () => getReceipts({ per_page: 50 }));

  return (
    <div className="p-6 md:p-8 space-y-5 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900">レシート</h2>

      {isLoading && (
        <div className="text-center py-16 text-gray-400 text-sm">読み込み中...</div>
      )}

      {!isLoading && data?.items.length === 0 && (
        <div className="card p-12 text-center text-gray-400 text-sm">
          レシートがまだありません。インポートページからアップロードしてください。
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.items.map((receipt) => (
          <ReceiptCard key={receipt.id} receipt={receipt} />
        ))}
      </div>
    </div>
  );
}

function ReceiptCard({ receipt }: { receipt: Receipt }) {
  const status = STATUS_CONFIG[receipt.status] ?? STATUS_CONFIG.unmatched;
  const StatusIcon = status.icon;

  return (
    <div className="card p-4 space-y-3 hover:shadow-md transition-shadow">
      {/* ファイル名 + ステータス */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileImage size={16} className="text-gray-400 shrink-0" />
          <span className="text-sm font-medium text-gray-700 truncate">
            {receipt.original_filename}
          </span>
        </div>
        <span className={clsx('badge shrink-0 flex items-center gap-1', status.color)}>
          <StatusIcon size={11} />
          {status.label}
        </span>
      </div>

      {/* OCR抽出結果 */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
        <Row label="店名" value={receipt.merchant_name} />
        <Row label="日付" value={receipt.purchase_date ? formatDate(receipt.purchase_date) : undefined} />
        <Row
          label="合計"
          value={receipt.total_amount ? `¥${Math.round(parseFloat(receipt.total_amount)).toLocaleString()}` : undefined}
          highlight
        />
        {receipt.tax_amount && (
          <Row label="消費税" value={`¥${Math.round(parseFloat(receipt.tax_amount)).toLocaleString()}`} />
        )}
      </div>

      {/* OCR信頼度 */}
      {receipt.ocr_confidence !== null && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>OCR信頼度</span>
            <span>{Math.round(receipt.ocr_confidence ?? 0)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={clsx(
                'h-1.5 rounded-full transition-all',
                (receipt.ocr_confidence ?? 0) >= 70 ? 'bg-emerald-400' :
                (receipt.ocr_confidence ?? 0) >= 40 ? 'bg-amber-400' : 'bg-red-400'
              )}
              style={{ width: `${Math.min(receipt.ocr_confidence ?? 0, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* アップロード日時 */}
      <p className="text-xs text-gray-400">
        アップロード: {formatDate(receipt.created_at)}
      </p>
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value?: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={clsx('text-right truncate', highlight ? 'font-semibold text-gray-900' : 'text-gray-700')}>
        {value ?? <span className="text-gray-300">未検出</span>}
      </span>
    </div>
  );
}
