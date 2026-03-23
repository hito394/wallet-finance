"use client";

import { useState, useCallback, useEffect } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  fetchPlaidLinkToken,
  fetchPlaidAccounts,
  exchangePlaidToken,
  syncPlaidItem,
  disconnectPlaidItem,
} from "@/lib/api";
import type { PlaidItemOut } from "@/lib/api";

interface Props {
  entityId?: string;
}

// ── Utility ──────────────────────────────────────────────────────────────────

function fmt(v: number | null, currency = "USD") {
  if (v == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(v);
}

function accountTypeLabel(type: string | null, subtype: string | null): string {
  const parts = [type, subtype].filter(Boolean).map(s => s!.charAt(0).toUpperCase() + s!.slice(1));
  return parts.join(" · ") || "Account";
}

// ── Plaid Link Button ─────────────────────────────────────────────────────────

function PlaidLinkButton({ entityId, onSuccess }: { entityId?: string; onSuccess: () => void }) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [tokenErr, setTokenErr] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [exchanging, setExchanging] = useState(false);

  const fetchToken = useCallback(async () => {
    setFetching(true);
    setTokenErr(null);
    const res = await fetchPlaidLinkToken(entityId);
    setFetching(false);
    if (res.error || !res.data) {
      setTokenErr(res.error ?? "Failed to get link token");
    } else {
      setLinkToken(res.data.link_token);
    }
  }, [entityId]);

  useEffect(() => { fetchToken(); }, [fetchToken]);

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    setExchanging(true);
    const res = await exchangePlaidToken(publicToken, entityId);
    setExchanging(false);
    if (res.error) {
      setTokenErr(res.error);
    } else {
      onSuccess();
    }
  }, [entityId, onSuccess]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: onPlaidSuccess,
    onExit: () => {},
  });

  if (tokenErr) {
    return (
      <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#dc2626" }}>
        {tokenErr.includes("plaid_not_configured")
          ? "Plaid is not configured. Set PLAID_CLIENT_ID and PLAID_SECRET in environment variables."
          : tokenErr}
        <button
          onClick={fetchToken}
          style={{ marginLeft: 12, color: "#1e40af", background: "none", border: "none", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || !linkToken || exchanging || fetching}
      style={{
        padding: "10px 20px",
        borderRadius: 10,
        background: (ready && linkToken) ? "linear-gradient(135deg, #0f766e, #0d9488)" : "#e2e8f0",
        color: (ready && linkToken) ? "#fff" : "#94a3b8",
        border: "none",
        cursor: (ready && linkToken) ? "pointer" : "default",
        fontWeight: 700,
        fontSize: 14,
        display: "flex",
        alignItems: "center",
        gap: 8,
        transition: "opacity 0.2s",
      }}
    >
      {(fetching || exchanging) ? (
        <>
          <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #ffffff60", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          {exchanging ? "接続中…" : "準備中…"}
        </>
      ) : (
        <>🏦 銀行・クレカを追加</>
      )}
    </button>
  );
}

// ── Connected Item Card ───────────────────────────────────────────────────────

function ConnectedItemCard({ item, entityId, onRefresh }: { item: PlaidItemOut; entityId?: string; onRefresh: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await syncPlaidItem(item.id, entityId);
    setSyncing(false);
    if (res.data) {
      setSyncResult(`+${res.data.added} 件追加 / ${res.data.modified} 件更新`);
      setTimeout(() => setSyncResult(null), 4000);
      onRefresh();
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`「${item.institution_name}」との接続を解除しますか？`)) return;
    setDisconnecting(true);
    await disconnectPlaidItem(item.id, entityId);
    setDisconnecting(false);
    onRefresh();
  };

  const totalBalance = item.accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0);

  return (
    <div style={{ borderRadius: 12, border: "1px solid #e8eef3", overflow: "hidden", background: "#fff" }}>
      {/* Bank header */}
      <div style={{ padding: "14px 18px", background: "linear-gradient(140deg, #f0fdf4, #fff)", borderBottom: "1px solid #e8eef3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: "#10212f" }}>🏦 {item.institution_name}</p>
          {item.last_synced_at && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
              最終同期: {new Date(item.last_synced_at).toLocaleString("ja-JP", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {syncResult && <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>{syncResult}</span>}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ padding: "6px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#059669", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
          >
            {syncing ? "同期中…" : "🔄 同期"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{ padding: "6px 10px", borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
          >
            {disconnecting ? "…" : "✕"}
          </button>
        </div>
      </div>

      {/* Accounts list */}
      <div style={{ padding: "10px 18px 14px" }}>
        {item.accounts.map(acc => (
          <div key={acc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f8fafc" }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#374151" }}>{acc.name}</p>
              <p style={{ margin: "1px 0 0", fontSize: 11, color: "#94a3b8" }}>
                {accountTypeLabel(acc.account_type, acc.account_subtype)}{acc.mask && ` •••• ${acc.mask}`}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#10212f" }}>{fmt(acc.current_balance, acc.currency)}</p>
              {acc.available_balance != null && acc.available_balance !== acc.current_balance && (
                <p style={{ margin: "1px 0 0", fontSize: 11, color: "#94a3b8" }}>利用可能: {fmt(acc.available_balance, acc.currency)}</p>
              )}
            </div>
          </div>
        ))}
        {item.accounts.length > 1 && (
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
            <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>合計 {fmt(totalBalance)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PlaidConnect({ entityId }: Props) {
  const [items, setItems] = useState<PlaidItemOut[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    const res = await fetchPlaidAccounts(entityId);
    setItems(res.data?.items ?? []);
    setLoading(false);
  }, [entityId]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  return (
    <div className="panel" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#10212f" }}>銀行・クレカ接続</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#5f7284" }}>Plaid経由で口座を接続し、取引を自動インポート</p>
        </div>
        <PlaidLinkButton entityId={entityId} onSuccess={loadAccounts} />
      </div>

      {loading ? (
        <div style={{ display: "grid", gap: 12 }}>
          {[1, 2].map(i => <div key={i} style={{ height: 100, borderRadius: 12, background: "#f1f5f9", animation: "pulse 1.5s infinite" }} />)}
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
          <p style={{ fontSize: 36, margin: "0 0 12px" }}>🏦</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>まだ口座が接続されていません</p>
          <p style={{ fontSize: 13, margin: 0 }}>「銀行・クレカを追加」ボタンから口座を接続してください</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {items.map(item => (
            <ConnectedItemCard key={item.id} item={item} entityId={entityId} onRefresh={loadAccounts} />
          ))}
        </div>
      )}
    </div>
  );
}
