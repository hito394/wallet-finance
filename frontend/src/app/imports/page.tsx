'use client';

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import { getImports, uploadStatement, uploadReceipt, formatDate, getLinkedAccounts, linkImportToAccount } from '@/lib/api';
import type { ImportRecord, LinkedAccount } from '@/types';
import { FileUpload } from '@/components/ui/FileUpload';
import { Loader2, CheckCircle2, AlertCircle, Clock, CreditCard } from 'lucide-react';

const STATUS_STYLE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  pending:    { label: '待機中',   bg: '#1E2030', color: '#64748B', border: '#2A2D42' },
  processing: { label: '処理中',   bg: '#1E2946', color: '#60A5FA', border: '#1E3A5F' },
  completed:  { label: '完了',     bg: '#14532D30', color: '#4ADE80', border: '#14532D' },
  partial:    { label: '一部完了', bg: '#2D2006', color: '#FBBF24', border: '#78350F' },
  failed:     { label: '失敗',     bg: '#2D151530', color: '#F87171', border: '#7F1D1D' },
};

const TYPE_LABELS: Record<string, string> = {
  csv_statement:  '銀行明細 CSV',
  pdf_statement:  '銀行明細 PDF',
  ofx_statement:  '銀行明細 OFX',
  receipt_image:  'レシート画像',
  receipt_pdf:    'レシート PDF',
};

// ─── 口座選択セレクト ─────────────────────────────────────────────────────────

function AccountSelect({
  accounts,
  value,
  onChange,
}: {
  accounts: LinkedAccount[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  if (accounts.length === 0) return null;
  return (
    <div>
      <label className="text-xs mb-1.5 flex items-center gap-1.5" style={{ color: '#475569' }}>
        <CreditCard size={11} />
        紐付ける口座（任意）
      </label>
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
        className="w-full text-xs rounded-xl px-3 py-2"
        style={{
          backgroundColor: '#0E0F1A',
          border: '1px solid #1E2030',
          color: value ? '#CBD5E1' : '#475569',
          outline: 'none',
        }}
      >
        <option value="">口座を選択しない</option>
        {accounts.map(a => (
          <option key={a.id} value={a.id}>
            {a.name}（{a.institution}）
          </option>
        ))}
      </select>
    </div>
  );
}

export default function ImportsPage() {
  const { data: imports, mutate, isLoading } = useSWR('imports', () => getImports());
  const { data: accounts = [] } = useSWR('linked-accounts', getLinkedAccounts);
  const [statementAccountId, setStatementAccountId] = useState<number | null>(null);

  const handleStatementUpload = useCallback(
    async (file: File) => {
      const result = await uploadStatement(file);
      // アップロード後に口座と紐付け
      if (statementAccountId && result.import_record?.id) {
        await linkImportToAccount(statementAccountId, result.import_record.id);
      }
      mutate();
      return result;
    },
    [mutate, statementAccountId]
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
      <div>
        <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
          Import
        </p>
        <h2 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>インポート</h2>
      </div>

      {/* Upload cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>銀行明細をインポート</h3>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              CSV・PDF・OFX/QFX形式に対応。日米主要銀行のフォーマット
            </p>
          </div>
          <AccountSelect
            accounts={accounts}
            value={statementAccountId}
            onChange={setStatementAccountId}
          />
          <FileUpload
            label="銀行明細ファイル"
            hint="CSV / PDF / OFX / QFX"
            accept=".csv,.pdf,.ofx,.qfx"
            onUpload={handleStatementUpload}
          />
        </div>

        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>レシートをインポート</h3>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              画像・PDFのOCR解析で店名・金額・日付を自動抽出
            </p>
          </div>
          <FileUpload
            label="レシート"
            hint="JPG / PNG / PDF"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onUpload={handleReceiptUpload}
          />
        </div>
      </div>

      {/* History table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: '1px solid #1E2030' }}>
          <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>インポート履歴</h3>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm" style={{ color: '#475569' }}>
            <Loader2 size={16} className="animate-spin" /> 読み込み中...
          </div>
        )}

        {!isLoading && (!imports || (Array.isArray(imports) && imports.length === 0)) && (
          <p className="text-center py-12 text-sm" style={{ color: '#475569' }}>
            まだインポート履歴がありません
          </p>
        )}

        <div>
          {Array.isArray(imports) && imports.map((record) => (
            <ImportRow key={record.id} record={record} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImportRow({ record }: { record: ImportRecord }) {
  const s = STATUS_STYLE[record.status] ?? STATUS_STYLE.pending;
  return (
    <div
      className="px-5 py-4 flex items-center justify-between gap-4"
      style={{ borderTop: '1px solid #1E2030' }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: '#CBD5E1' }}>
          {record.original_filename}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: '#475569' }}>
          <span>{TYPE_LABELS[record.import_type] ?? record.import_type}</span>
          <span style={{ color: '#2A2D42' }}>·</span>
          <span>{formatDate(record.created_at)}</span>
          {record.completed_at && (
            <>
              <span style={{ color: '#2A2D42' }}>·</span>
              <span style={{ color: '#4ADE80' }}>{record.success_rows}件取込</span>
              {record.skipped_rows > 0 && (
                <span style={{ color: '#FBBF24' }}>{record.skipped_rows}件スキップ</span>
              )}
              {record.error_rows > 0 && (
                <span style={{ color: '#F87171' }}>{record.error_rows}件エラー</span>
              )}
            </>
          )}
        </div>
        {record.error_message && (
          <p className="text-xs mt-1 truncate" style={{ color: '#F87171' }}>{record.error_message}</p>
        )}
      </div>
      <span
        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
        style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
      >
        {s.label}
      </span>
    </div>
  );
}
