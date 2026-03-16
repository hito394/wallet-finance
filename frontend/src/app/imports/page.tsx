'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { getImports, uploadStatement, uploadReceipt, formatDate } from '@/lib/api';
import type { ImportRecord } from '@/types';
import { FileUpload } from '@/components/ui/FileUpload';
import clsx from 'clsx';
import { CheckCircle2, AlertCircle, Clock, Loader2 } from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: '待機中',   color: 'bg-gray-100 text-gray-600'    },
  processing: { label: '処理中',   color: 'bg-blue-100 text-blue-600'    },
  completed:  { label: '完了',     color: 'bg-emerald-100 text-emerald-700' },
  partial:    { label: '一部完了', color: 'bg-amber-100 text-amber-700'  },
  failed:     { label: '失敗',     color: 'bg-red-100 text-red-600'      },
};

const TYPE_LABELS: Record<string, string> = {
  csv_statement:  '銀行明細 CSV',
  pdf_statement:  '銀行明細 PDF',
  receipt_image:  'レシート画像',
  receipt_pdf:    'レシート PDF',
};

export default function ImportsPage() {
  const { data: imports, mutate, isLoading } = useSWR('imports', () => getImports());

  const handleStatementUpload = useCallback(
    async (file: File) => {
      const result = await uploadStatement(file);
      mutate();
      return result;
    },
    [mutate]
  );

  const handleReceiptUpload = useCallback(
    async (file: File) => {
      const result = await uploadReceipt(file);
      mutate();
      return result;
    },
    [mutate]
  );

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900">インポート</h2>

      {/* アップロードカード */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">銀行明細をインポート</h3>
            <p className="text-xs text-gray-500 mt-0.5">CSV・PDFに対応。三菱UFJ・三井住友・みずほ等の主要フォーマット</p>
          </div>
          <FileUpload
            label="銀行明細ファイル（CSV / PDF）"
            accept=".csv,.pdf"
            onUpload={handleStatementUpload}
          />
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">レシートをインポート</h3>
            <p className="text-xs text-gray-500 mt-0.5">画像・PDFのOCR解析で店名・金額・日付を自動抽出</p>
          </div>
          <FileUpload
            label="レシート（JPG / PNG / PDF）"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onUpload={handleReceiptUpload}
          />
        </div>
      </div>

      {/* インポート履歴 */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">インポート履歴</h3>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> 読み込み中...
          </div>
        )}

        {!isLoading && (!imports || (Array.isArray(imports) && imports.length === 0)) && (
          <p className="text-center py-12 text-sm text-gray-400">まだインポート履歴がありません</p>
        )}

        <div className="divide-y divide-gray-50">
          {Array.isArray(imports) && imports.map((record) => (
            <ImportRow key={record.id} record={record} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportRow({ record }: { record: ImportRecord }) {
  const status = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.pending;

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{record.original_filename}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
          <span>{TYPE_LABELS[record.import_type] ?? record.import_type}</span>
          <span>·</span>
          <span>{formatDate(record.created_at)}</span>
          {record.completed_at && (
            <>
              <span>·</span>
              <span className="text-emerald-600">
                {record.success_rows}件取込
              </span>
              {record.skipped_rows > 0 && (
                <span className="text-amber-600">{record.skipped_rows}件スキップ</span>
              )}
              {record.error_rows > 0 && (
                <span className="text-red-500">{record.error_rows}件エラー</span>
              )}
            </>
          )}
        </div>
        {record.error_message && (
          <p className="text-xs text-red-500 mt-1 truncate">{record.error_message}</p>
        )}
      </div>
      <span className={clsx('badge shrink-0', status.color)}>
        {status.label}
      </span>
    </div>
  );
}
