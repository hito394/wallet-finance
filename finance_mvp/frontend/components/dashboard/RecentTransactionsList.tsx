import Link from "next/link";
import type { TransactionItem } from "@/lib/api";

type Props = {
  rows: TransactionItem[];
  entityId?: string;
};

const PALETTE = [
  "#0f766e","#22c55e","#3b82f6","#f59e0b",
  "#ef4444","#8b5cf6","#ec4899","#14b8a6",
  "#f97316","#6366f1",
];

function merchantColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function fmtDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export default function RecentTransactionsList({ rows, entityId }: Props) {
  const items = rows.slice(0, 10);
  const href = `/transactions${entityId ? `?entityId=${entityId}` : ""}`;

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#10212f" }}>最近の取引</h3>
        <Link href={href} style={{ fontSize: 13, color: "#0f766e", fontWeight: 600, textDecoration: "none" }}>
          すべて表示 →
        </Link>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 14 }}>
          取引データがまだありません。明細をアップロードしてください。
        </div>
      ) : (
        <div style={{ display: "grid", gap: 2 }}>
          {items.map((row) => {
            const isCredit = row.direction === "credit";
            const merchant = row.merchant_normalized || row.merchant_raw;
            const initials = merchant.slice(0, 2).toUpperCase();
            const color = merchantColor(merchant);
            const amount = Number(row.amount);

            return (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 8px",
                  borderRadius: 10,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: color + "20",
                  border: `1.5px solid ${color}40`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 800, color, flexShrink: 0,
                  letterSpacing: "-0.5px",
                }}>
                  {initials}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#10212f", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {merchant}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>
                    {fmtDate(row.transaction_date)}
                    {row.description && row.description !== merchant && (
                      <span style={{ marginLeft: 6 }}>· {row.description.slice(0, 28)}</span>
                    )}
                  </p>
                </div>

                {/* Amount */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{
                    margin: 0, fontSize: 15, fontWeight: 700,
                    color: isCredit ? "#16a34a" : "#dc2626",
                  }}>
                    {isCredit ? "+" : "-"}{row.currency} {amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </p>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 99,
                    background: isCredit ? "#dcfce7" : "#fee2e2",
                    color: isCredit ? "#16a34a" : "#dc2626",
                  }}>
                    {isCredit ? "収入" : "支出"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
