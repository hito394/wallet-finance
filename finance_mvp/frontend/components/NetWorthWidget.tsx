"use client";

import { useEffect, useState } from "react";
import { fetchNetWorth, type NetWorthData, type NetWorthAccount } from "@/lib/api";

function fmt(v: number) {
  const abs = Math.abs(v);
  return (v < 0 ? "-" : "") + "$" + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function AccountRow({ acct }: { acct: NetWorthAccount }) {
  const isCredit = (acct.account_type || "").toLowerCase() === "credit";
  const bal = acct.current_balance;
  const label = acct.name + (acct.mask ? ` ••${acct.mask}` : "");
  const sub = [acct.institution_name, acct.account_subtype].filter(Boolean).join(" · ");
  const icon = isCredit ? "💳" : acct.account_subtype === "savings" ? "🏦" : "🏧";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#10212f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </div>
        {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: isCredit ? "#ef4444" : "#065f46", whiteSpace: "nowrap" }}>
        {isCredit ? `-${fmt(bal)}` : fmt(bal)}
      </div>
    </div>
  );
}

export default function NetWorthWidget({ entityId }: { entityId?: string }) {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchNetWorth(entityId).then((r) => {
      setData(r.data);
      setLoading(false);
    });
  }, [entityId]);

  if (loading) {
    return (
      <div className="panel" style={{ padding: 20 }}>
        <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!data || data.accounts.length === 0) {
    return (
      <div className="panel" style={{ padding: 20 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#5f7284" }}>NET WORTH</h3>
        <div className="empty-state" style={{ fontSize: 13 }}>
          Connect a bank account via Plaid to see your net worth.
        </div>
      </div>
    );
  }

  const nw = data.net_worth;
  const nwColor = nw >= 0 ? "#065f46" : "#991b1b";
  const nwBg = nw >= 0
    ? "linear-gradient(135deg,#ecfdf5 0%,#f0fdf9 100%)"
    : "linear-gradient(135deg,#fef2f2 0%,#fff5f5 100%)";

  const assets = data.accounts.filter(a => (a.account_type || "").toLowerCase() !== "credit");
  const liabilities = data.accounts.filter(a => (a.account_type || "").toLowerCase() === "credit");

  return (
    <div className="panel" style={{ padding: 20 }}>
      {/* Header */}
      <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#5f7284", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Net Worth
      </h3>

      {/* Big number */}
      <div style={{
        borderRadius: 14,
        background: nwBg,
        padding: "16px 18px",
        marginBottom: 18,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 11, color: "#5f7284", fontWeight: 600, marginBottom: 4 }}>Total Net Worth</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: nwColor, letterSpacing: "-0.5px" }}>{fmt(nw)}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>Assets</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#065f46" }}>{fmt(data.total_assets)}</div>
          <div style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, marginTop: 4 }}>Liabilities</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#991b1b" }}>-{fmt(data.total_liabilities)}</div>
        </div>
      </div>

      {/* Account list */}
      {assets.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>
            Assets
          </div>
          {assets.map(a => <AccountRow key={a.id} acct={a} />)}
        </>
      )}
      {liabilities.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "12px 0 4px" }}>
            Liabilities
          </div>
          {liabilities.map(a => <AccountRow key={a.id} acct={a} />)}
        </>
      )}
    </div>
  );
}
