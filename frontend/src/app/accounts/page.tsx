'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { usePlaidLink } from 'react-plaid-link';
import {
  getPlaidLinkToken,
  getPlaidAccounts,
  syncPlaidItem,
  disconnectPlaidItem,
  type PlaidItem,
} from '@/lib/api';
import {
  Building2,
  CreditCard,
  RefreshCw,
  Trash2,
  Plus,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  Upload,
} from 'lucide-react';
import Link from 'next/link';

// ─── Plaid Link wrapper ───────────────────────────────────────────────────────

function ConnectBankButton({ onSuccess }: { onSuccess: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { open, ready } = usePlaidLink({
    token: token ?? '',
    onSuccess: async (publicToken) => {
      try {
        const { exchangePlaidToken } = await import('@/lib/api');
        await exchangePlaidToken(publicToken);
        onSuccess();
      } catch (e) {
        setError('接続に失敗しました。もう一度お試しください。');
      }
    },
  });

  const handleClick = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { link_token } = await getPlaidLinkToken();
      setToken(link_token);
    } catch (e: any) {
      const detail = e?.message ?? '';
      if (detail.includes('plaid_not_configured')) {
        setError(
          'Plaidの設定が必要です。環境変数 PLAID_CLIENT_ID と PLAID_SECRET を設定してください。'
        );
      } else {
        setError('リンクトークンの取得に失敗しました。');
      }
      setLoading(false);
      return;
    }
    setLoading(false);
  }, []);

  // Open Plaid Link once token is set
  if (token && ready) {
    open();
    setToken(null); // reset to avoid re-opening
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="btn-primary gap-2"
      >
        <Plus size={15} />
        {loading ? '準備中...' : '米国の銀行を接続'}
      </button>
      {error && (
        <p className="mt-2 text-xs" style={{ color: '#F87171' }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Account card ─────────────────────────────────────────────────────────────

function AccountCard({ account }: { account: PlaidItem['accounts'][0] }) {
  const typeIcon =
    account.account_type === 'credit' ? (
      <CreditCard size={14} style={{ color: '#F87171' }} />
    ) : (
      <Building2 size={14} style={{ color: '#4ADE80' }} />
    );

  return (
    <div
      className="flex items-center justify-between px-4 py-3 rounded-xl"
      style={{ backgroundColor: '#0E0F1A' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#1E2030' }}
        >
          {typeIcon}
        </div>
        <div>
          <p className="text-sm font-medium" style={{ color: '#CBD5E1' }}>
            {account.name}
            {account.mask && (
              <span className="ml-2 text-xs" style={{ color: '#475569' }}>
                ••{account.mask}
              </span>
            )}
          </p>
          <p className="text-xs capitalize" style={{ color: '#475569' }}>
            {account.account_subtype ?? account.account_type ?? ''}
          </p>
        </div>
      </div>
      {account.current_balance !== null && (
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums" style={{ color: '#E2E8F0' }}>
            {account.currency} {account.current_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          {account.available_balance !== null && account.available_balance !== account.current_balance && (
            <p className="text-xs" style={{ color: '#475569' }}>
              利用可能: {account.available_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bank item card ───────────────────────────────────────────────────────────

function BankItemCard({
  item,
  onSync,
  onDisconnect,
}: {
  item: PlaidItem;
  onSync: (id: string) => Promise<void>;
  onDisconnect: (id: string) => Promise<void>;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ added: number; modified: number } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await onSync(item.id);
      setSyncResult(result as any);
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`「${item.institution_name}」の接続を解除しますか？`)) return;
    setDisconnecting(true);
    await onDisconnect(item.id);
  };

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, #7C6FFF 0%, #4ADE80 100%)', color: '#fff' }}
          >
            {item.institution_name.slice(0, 2)}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>
              {item.institution_name}
            </p>
            {item.last_synced_at && (
              <p className="text-xs" style={{ color: '#475569' }}>
                最終同期: {new Date(item.last_synced_at).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {syncResult && (
            <span
              className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
              style={{ backgroundColor: '#14532D', color: '#4ADE80' }}
            >
              <CheckCircle size={11} />
              +{syncResult.added}件
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing || disconnecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#1E2030', color: '#94A3B8' }}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? '同期中...' : '同期'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="p-1.5 rounded-xl transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#1E2030', color: '#64748B' }}
            title="接続解除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Accounts */}
      {item.accounts.length > 0 && (
        <div className="space-y-2">
          {item.accounts.map((acct) => (
            <AccountCard key={acct.id} account={acct} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── OFX Info card ───────────────────────────────────────────────────────────

function OFXInfoCard() {
  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: '#1A1C2E', border: '1px solid #2A2D42' }}
        >
          <Upload size={18} style={{ color: '#7C6FFF' }} />
        </div>
        <div>
          <p className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>
            日本の銀行 — OFX/QFX形式インポート
          </p>
          <p className="text-xs" style={{ color: '#475569' }}>
            多くの日本の銀行はOFX形式のエクスポートに対応しています
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {[
          { name: '三菱UFJ銀行', note: 'インターネットバンキング → 明細照会 → OFX形式でダウンロード' },
          { name: '三井住友銀行', note: 'SMBCダイレクト → 入出金明細 → OFX形式' },
          { name: 'ゆうちょ銀行', note: 'ゆうちょダイレクト → 入出金明細 → OFX形式' },
          { name: '楽天銀行', note: '口座管理 → 入出金明細 → OFX形式でダウンロード' },
        ].map((bank) => (
          <div
            key={bank.name}
            className="flex items-start gap-3 px-4 py-3 rounded-xl"
            style={{ backgroundColor: '#0E0F1A' }}
          >
            <div
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: '#7C6FFF' }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: '#CBD5E1' }}>{bank.name}</p>
              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{bank.note}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/imports"
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
        style={{ backgroundColor: '#1E2246', color: '#7C6FFF', border: '1px solid #2A2D42' }}
      >
        <Upload size={14} />
        OFX/QFXファイルをインポートする
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AccountsPage() {
  const { data, mutate, isLoading } = useSWR('plaid-accounts', getPlaidAccounts);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async (itemId: string) => {
    try {
      const result = await syncPlaidItem(itemId);
      mutate();
      return result;
    } catch (e: any) {
      setError(e?.message ?? '同期に失敗しました');
      return { added: 0, modified: 0, removed: 0 };
    }
  };

  const handleDisconnect = async (itemId: string) => {
    try {
      await disconnectPlaidItem(itemId);
      mutate();
    } catch (e: any) {
      setError(e?.message ?? '接続解除に失敗しました');
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#475569' }}>
            Bank Integration
          </p>
          <h2 className="text-xl font-bold" style={{ color: '#F1F5F9' }}>口座連携</h2>
        </div>
        <ConnectBankButton onSuccess={() => mutate()} />
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
          style={{ backgroundColor: '#2D1515', border: '1px solid #7F1D1D', color: '#FCA5A5' }}
        >
          <AlertCircle size={15} />
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-12 text-sm" style={{ color: '#475569' }}>
          読み込み中...
        </div>
      )}

      {/* Connected banks */}
      {!isLoading && items.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>
            接続済みの銀行 ({items.length})
          </p>
          {items.map((item) => (
            <BankItemCard
              key={item.id}
              item={item}
              onSync={handleSync}
              onDisconnect={handleDisconnect}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <div
          className="rounded-2xl p-8 text-center space-y-3"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
            style={{ backgroundColor: '#1E2030' }}
          >
            <WifiOff size={24} style={{ color: '#475569' }} />
          </div>
          <p className="font-medium" style={{ color: '#CBD5E1' }}>まだ銀行が接続されていません</p>
          <p className="text-sm" style={{ color: '#475569' }}>
            米国の銀行はPlaidで自動連携、<br />
            日本の銀行はOFX形式でインポートできます
          </p>
        </div>
      )}

      {/* OFX info card (always shown) */}
      <OFXInfoCard />
    </div>
  );
}
