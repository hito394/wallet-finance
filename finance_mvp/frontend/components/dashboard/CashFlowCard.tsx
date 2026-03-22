"use client";

import { asNumber } from "@/lib/api";
import type { MonthlyOverview } from "@/lib/api";

type Props = {
  overview: MonthlyOverview | null;
};

function fmtJpy(v: number) {
  return `¥${Math.abs(v).toLocaleString()}`;
}

export default function CashFlowCard({ overview }: Props) {
  const income  = asNumber(overview?.income);
  const spend   = asNumber(overview?.total_spend);
  const net     = asNumber(overview?.net);
  const savings = income > 0 ? Math.round((net / income) * 100) : 0;
  const barPct  = income > 0 ? Math.min(100, Math.round((spend / income) * 100)) : 0;

  const cols: { label: string; value: string; sub?: string; color: string }[] = [
    { label: "収入", value: fmtJpy(income), color: "#22c55e" },
    { label: "支出", value: fmtJpy(spend),  color: "#f87171" },
    { label: "純額", value: (net >= 0 ? "+" : "-") + fmtJpy(net), color: net >= 0 ? "#3b82f6" : "#f87171" },
    { label: "貯蓄率", value: `${savings}%`, sub: net >= 0 ? "Good" : "Overspent", color: savings >= 20 ? "#22c55e" : savings >= 0 ? "#f59e0b" : "#f87171" },
  ];

  return (
    <div className="panel" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#10212f" }}>キャッシュフロー</h3>
        <span style={{ fontSize: 12, color: "#5f7284" }}>{overview?.month ?? "—"}</span>
      </div>

      {/* 4-column metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 0 }}>
        {cols.map((col, i) => (
          <div
            key={col.label}
            style={{
              padding: "12px 16px",
              borderLeft: i > 0 ? "1px solid #e8eef3" : "none",
            }}
          >
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#5f7284", textTransform: "uppercase", letterSpacing: "0.4px" }}>
              {col.label}
            </p>
            <p style={{ margin: "6px 0 2px", fontSize: 22, fontWeight: 800, color: col.color, lineHeight: 1 }}>
              {col.value}
            </p>
            {col.sub && (
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8" }}>{col.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Income vs spend bar */}
      <div style={{ marginTop: 16, padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11, color: "#5f7284" }}>
          <span>支出 {barPct}%</span>
          <span>残り {100 - barPct}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "#e8eef3", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${barPct}%`,
              borderRadius: 99,
              background: barPct > 90
                ? "linear-gradient(90deg,#f87171,#ef4444)"
                : barPct > 70
                ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                : "linear-gradient(90deg,#22c55e,#16a34a)",
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}
