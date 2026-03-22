'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import {
  getLinkedAccounts,
  createLinkedAccount,
  updateLinkedAccount,
  deleteLinkedAccount,
  getAccountSummary,
  getAccountImports,
  linkImportToAccount,
  unlinkImportFromAccount,
  getImports,
} from '@/lib/api';
import type { LinkedAccount, AccountType, AccountSummary, AccountImport } from '@/types';
import {
  Building2,
  CreditCard,
  Plus,
  Trash2,
  Edit3,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Link2,
  Link2Off,
  FileText,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';

// ─── 定数 ────────────────────────────────────────────────────────────────────

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking:   '普通預金',
  savings:    '定期預金',
  credit:     'クレジットカード',
  debit:      'デビットカード',
  prepaid:    'プリペイド',
  investment: '証券口座',
  other:      'その他',
};

const ACCOUNT_TYPE_ICONS: Record<AccountType, React.ReactNode> = {
  checking:   <Building2 size={16} />,
  savings:    <Building2 size={16} />,
  credit:     <CreditCard size={16} />,
  debit:      <CreditCard size={16} />,
  prepaid:    <Wallet size={16} />,
  investment: <TrendingUp size={16} />,
  other:      <Wallet size={16} />,
};

const PRESET_COLORS = [
  '#7C6FFF', '#4ADE80', '#F87171', '#FBBF24',
  '#60A5FA', '#A78BFA', '#34D399', '#FB923C',
];

// ─── 口座カードアイコン ────────────────────────────────────────────────────────

function AccountIcon({ account, size = 40 }: { account: LinkedAccount; size?: number }) {
  const initial = account.institution.charAt(0);
  return (
    <div
      className="rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: account.color + '22',
        color: account.color,
        border: `1.5px solid ${account.color}44`,
        fontSize: size < 36 ? 11 : 14,
      }}
    >
      {initial}
    </div>
  );
}

// ─── 口座追加・編集フォーム ───────────────────────────────────────────────────

function AccountForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<LinkedAccount>;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [institution, setInstitution] = useState(initial?.institution ?? '');
  const [accountType, setAccountType] = useState<AccountType>(initial?.account_type ?? 'checking');
  const [last4, setLast4] = useState(initial?.last4 ?? '');
  const [color, setColor] = useState(initial?.color ?? '#7C6FFF');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !institution.trim()) {
      setError('口座名と金融機関名は必須です');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        institution: institution.trim(),
        account_type: accountType,
        last4: last4.trim() || undefined,
        color,
        notes: notes.trim() || undefined,
      });
    } catch {
      setError('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    backgroundColor: '#0E0F1A',
    border: '1px solid #1E2030',
    color: '#F1F5F9',
    borderRadius: 10,
    padding: '8px 12px',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  } as React.CSSProperties;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#2D1515', color: '#F87171' }}>
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#475569' }}>口座名（ニックネーム）*</label>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="例: 楽天メインカード" />
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#475569' }}>金融機関名*</label>
          <input style={inputStyle} value={institution} onChange={e => setInstitution(e.target.value)} placeholder="例: 楽天銀行" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#475569' }}>種別</label>
          <select
            style={{ ...inputStyle, appearance: 'none' }}
            value={accountType}
            onChange={e => setAccountType(e.target.value as AccountType)}
          >
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs mb-1 block" style={{ color: '#475569' }}>下4桁（任意）</label>
          <input
            style={inputStyle}
            value={last4}
            onChange={e => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
            maxLength={4}
          />
        </div>
      </div>

      {/* カラーピッカー */}
      <div>
        <label className="text-xs mb-2 block" style={{ color: '#475569' }}>カラー</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-lg transition-transform"
              style={{
                backgroundColor: c,
                transform: color === c ? 'scale(1.2)' : 'scale(1)',
                outline: color === c ? `2px solid ${c}` : 'none',
                outlineOffset: 2,
              }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={e => setColor(e.target.value)}
            className="w-7 h-7 rounded-lg cursor-pointer"
            style={{ backgroundColor: 'transparent', border: '1px solid #1E2030', padding: 1 }}
            title="カスタムカラー"
          />
        </div>
      </div>

      <div>
        <label className="text-xs mb-1 block" style={{ color: '#475569' }}>メモ（任意）</label>
        <input style={inputStyle} value={notes} onChange={e => setNotes(e.target.value)} placeholder="例: 生活費用メインカード" />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          style={{ backgroundColor: '#7C6FFF', color: '#fff' }}
        >
          {saving ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: '#1E2030', color: '#64748B' }}
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}

// ─── インポート紐付けパネル ───────────────────────────────────────────────────

function ImportLinkPanel({ account, onClose }: { account: LinkedAccount; onClose: () => void }) {
  const { data: linkedImports, mutate: mutateLinked } = useSWR(
    `account-imports-${account.id}`,
    () => getAccountImports(account.id)
  );
  const { data: allImportsRaw } = useSWR('all-imports', () => getImports(1));
  const allImports = Array.isArray(allImportsRaw) ? allImportsRaw : [];

  const linkedIds = new Set((linkedImports ?? []).map((i: AccountImport) => i.id));

  async function handleLink(importId: number) {
    await linkImportToAccount(account.id, importId);
    mutateLinked();
  }

  async function handleUnlink(importId: number) {
    await unlinkImportFromAccount(account.id, importId);
    mutateLinked();
  }

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl md:rounded-2xl p-6"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030', maxHeight: '80vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#F1F5F9' }}>インポートファイルを紐付け</h3>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{account.name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#1E2030', color: '#64748B' }}
          >
            <X size={14} />
          </button>
        </div>

        {allImports.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: '#475569' }}>
            インポート済みファイルがありません
          </p>
        ) : (
          <div className="space-y-2">
            {allImports.map((imp: any) => {
              const isLinked = linkedIds.has(imp.id);
              return (
                <div
                  key={imp.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl"
                  style={{
                    backgroundColor: isLinked ? '#0D1A12' : '#0E0F1A',
                    border: `1px solid ${isLinked ? '#14532D' : '#1E2030'}`,
                  }}
                >
                  <FileText size={14} style={{ color: isLinked ? '#4ADE80' : '#475569', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: '#CBD5E1' }}>
                      {imp.original_filename}
                    </p>
                    <p className="text-xs" style={{ color: '#475569' }}>
                      {fmtDate(imp.created_at)} · {imp.success_rows}件
                    </p>
                  </div>
                  <button
                    onClick={() => isLinked ? handleUnlink(imp.id) : handleLink(imp.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                    style={
                      isLinked
                        ? { backgroundColor: '#14532D', color: '#4ADE80' }
                        : { backgroundColor: '#1E2246', color: '#7C6FFF' }
                    }
                  >
                    {isLinked ? (
                      <><Link2Off size={11} />解除</>
                    ) : (
                      <><Link2 size={11} />紐付け</>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 口座詳細カード ───────────────────────────────────────────────────────────

function AccountCard({
  account,
  onUpdate,
  onDelete,
}: {
  account: LinkedAccount;
  onUpdate: () => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showLinkPanel, setShowLinkPanel] = useState(false);

  const { data: summary } = useSWR<AccountSummary>(
    expanded ? `account-summary-${account.id}` : null,
    () => getAccountSummary(account.id)
  );

  async function handleUpdate(data: any) {
    await updateLinkedAccount(account.id, data);
    onUpdate();
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirm(`「${account.name}」を削除しますか？\nインポートファイルの紐付けも解除されます。`)) return;
    await deleteLinkedAccount(account.id);
    onDelete(account.id);
  }

  const expense = summary ? Math.round(parseFloat(summary.month_expense)) : null;
  const income  = summary ? Math.round(parseFloat(summary.month_income)) : null;
  const net     = summary ? Math.round(parseFloat(summary.month_net)) : null;

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
      >
        {/* メインヘッダー */}
        <div className="p-4">
          {editing ? (
            <div className="space-y-1">
              <p className="text-xs font-medium mb-3" style={{ color: '#475569' }}>口座を編集</p>
              <AccountForm
                initial={account}
                onSave={handleUpdate}
                onCancel={() => setEditing(false)}
              />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AccountIcon account={account} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: '#F1F5F9' }}>
                    {account.name}
                  </p>
                  {account.last4 && (
                    <span className="text-xs flex-shrink-0" style={{ color: '#475569' }}>
                      ••{account.last4}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs" style={{ color: '#475569' }}>{account.institution}</span>
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-md"
                    style={{ backgroundColor: account.color + '22', color: account.color, fontSize: 10 }}
                  >
                    {ACCOUNT_TYPE_LABELS[account.account_type]}
                  </span>
                </div>
              </div>

              {/* アクションボタン */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setShowLinkPanel(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#1E2030', color: '#64748B' }}
                  title="インポートを紐付け"
                >
                  <Link2 size={13} />
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#1E2030', color: '#64748B' }}
                  title="編集"
                >
                  <Edit3 size={13} />
                </button>
                <button
                  onClick={handleDelete}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#1E2030', color: '#64748B' }}
                  title="削除"
                >
                  <Trash2 size={13} />
                </button>
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ backgroundColor: '#1E2030', color: '#64748B' }}
                >
                  {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 展開エリア: 今月の収支 */}
        {expanded && !editing && (
          <div
            className="px-4 pb-4 border-t"
            style={{ borderColor: '#1E2030' }}
          >
            <p className="text-xs font-medium mt-3 mb-3" style={{ color: '#475569' }}>今月の収支</p>
            {summary ? (
              <div className="grid grid-cols-3 gap-3">
                <div
                  className="px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: '#0E0F1A' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown size={12} style={{ color: '#F87171' }} />
                    <span className="text-xs" style={{ color: '#475569' }}>支出</span>
                  </div>
                  <p className="text-sm font-bold tabular-nums" style={{ color: '#F87171' }}>
                    ¥{expense?.toLocaleString()}
                  </p>
                </div>
                <div
                  className="px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: '#0E0F1A' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp size={12} style={{ color: '#4ADE80' }} />
                    <span className="text-xs" style={{ color: '#475569' }}>収入</span>
                  </div>
                  <p className="text-sm font-bold tabular-nums" style={{ color: '#4ADE80' }}>
                    ¥{income?.toLocaleString()}
                  </p>
                </div>
                <div
                  className="px-3 py-2.5 rounded-xl"
                  style={{ backgroundColor: '#0E0F1A' }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs" style={{ color: '#475569' }}>収支</span>
                  </div>
                  <p
                    className="text-sm font-bold tabular-nums"
                    style={{ color: net != null && net >= 0 ? '#4ADE80' : '#F87171' }}
                  >
                    {net != null && net >= 0 ? '+' : ''}¥{net?.toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(i => (
                  <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#1E2030' }} />
                ))}
              </div>
            )}
            {summary && (
              <div className="flex gap-4 mt-3">
                <p className="text-xs" style={{ color: '#334155' }}>
                  今月 {summary.month_transaction_count}件 ·
                  インポート計 {summary.total_import_count}回
                </p>
                {summary.last_import_at && (
                  <p className="text-xs" style={{ color: '#334155' }}>
                    最終: {new Date(summary.last_import_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showLinkPanel && (
        <ImportLinkPanel account={account} onClose={() => setShowLinkPanel(false)} />
      )}
    </>
  );
}

// ─── メインページ ─────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { data: accounts = [], mutate } = useSWR('linked-accounts', getLinkedAccounts);
  const [showAddForm, setShowAddForm] = useState(false);

  async function handleCreate(data: any) {
    await createLinkedAccount(data);
    mutate();
    setShowAddForm(false);
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-2xl mx-auto">
      {/* ヘッダー */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
            Accounts
          </p>
          <h2 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>口座・カード管理</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={{ backgroundColor: '#7C6FFF', color: '#fff' }}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'キャンセル' : '口座を追加'}
        </button>
      </div>

      {/* 追加フォーム */}
      {showAddForm && (
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#13151F', border: '1px solid #7C6FFF44' }}
        >
          <p className="text-sm font-semibold mb-4" style={{ color: '#CBD5E1' }}>新しい口座・カードを登録</p>
          <AccountForm onSave={handleCreate} onCancel={() => setShowAddForm(false)} />
        </div>
      )}

      {/* 口座リスト */}
      {accounts.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>
            登録済み ({accounts.length})
          </p>
          {accounts.map(account => (
            <AccountCard
              key={account.id}
              account={account}
              onUpdate={() => mutate()}
              onDelete={() => mutate()}
            />
          ))}
        </div>
      ) : !showAddForm ? (
        <div
          className="rounded-2xl p-10 text-center space-y-3"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ backgroundColor: '#1E2030' }}
          >
            <CreditCard size={24} style={{ color: '#475569' }} />
          </div>
          <p className="font-medium" style={{ color: '#CBD5E1' }}>まだ口座が登録されていません</p>
          <p className="text-sm" style={{ color: '#475569' }}>
            銀行口座やクレジットカードを登録して、<br />
            インポートファイルを紐付けることができます
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold mt-2"
            style={{ backgroundColor: '#7C6FFF', color: '#fff' }}
          >
            <Plus size={14} />
            最初の口座を登録
          </button>
        </div>
      ) : null}

      {/* 使い方ガイド */}
      <div
        className="rounded-2xl p-5"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: '#CBD5E1' }}>使い方</p>
        <div className="space-y-3">
          {[
            { step: '1', text: '上の「口座を追加」ボタンで銀行・クレカを登録' },
            { step: '2', text: '各口座カードの リンクアイコン を押してインポートファイルを紐付け' },
            { step: '3', text: '口座カードを展開すると今月の収支サマリーが確認できます' },
            { step: '4', text: '明細CSVは「インポート」ページからアップロードできます' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                style={{ backgroundColor: '#1E2246', color: '#7C6FFF' }}
              >
                {item.step}
              </div>
              <p className="text-sm" style={{ color: '#64748B' }}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
