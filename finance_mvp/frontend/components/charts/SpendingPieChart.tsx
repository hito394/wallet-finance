"use client";

import { useState, useEffect } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { fetchTransactionCategories } from "@/lib/api";
import type { TransactionItem } from "@/lib/api";

const PALETTE = [
  "#0f766e", "#22c55e", "#3b82f6", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

type Slice = { category: string; total: string };

type Props = {
  data: Slice[];
  transactions?: TransactionItem[];
  entityId?: string;
};

function fmt(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

export default function SpendingPieChart({ data, transactions = [], entityId }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  // category name → id map
  const [catMap, setCatMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTransactionCategories(entityId).then(r => {
      const m: Record<string, string> = {};
      for (const c of r.data ?? []) m[c.name] = c.id;
      setCatMap(m);
    });
  }, [entityId]);

  if (!data.length) {
    return (
      <div className="panel chart-panel" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Spending Breakdown</h3>
        <div className="empty-state">No spending data for this period.</div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + Number(d.total), 0);
  const slices = data.map((d) => ({ name: d.category, value: Number(d.total) }));

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const catId = selectedCategory ? catMap[selectedCategory] : null;
  const drillRows = catId
    ? transactions.filter(t => t.category_id === catId && t.direction === "debit")
    : [];

  const handleRowClick = (name: string) => {
    setSelectedCategory(prev => prev === name ? null : name);
  };

  return (
    <div className="panel chart-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h3>Spending Breakdown</h3>
        <span style={{ color: "#5f7284", fontSize: 13 }}>{fmt(total)}</span>
      </div>

      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={slices}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={108}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={renderLabel}
            >
              {slices.map((s, i) => (
                <Cell
                  key={i}
                  fill={PALETTE[i % PALETTE.length]}
                  opacity={selectedCategory && selectedCategory !== s.name ? 0.4 : 1}
                  style={{ cursor: "pointer" }}
                  onClick={() => handleRowClick(s.name)}
                />
              ))}
            </Pie>
            <Tooltip formatter={(v: number) => fmt(v)} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center", pointerEvents: "none",
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#10212f", lineHeight: 1 }}>{fmt(total)}</div>
          <div style={{ fontSize: 11, color: "#5f7284", marginTop: 3 }}>支出合計</div>
        </div>
      </div>

      {/* Category table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 }}>
        <thead>
          <tr>
            {["Category", "Amount", "%", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#5f7284", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid #d4dee6" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slices.map((s, i) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            const isSelected = selectedCategory === s.name;
            return (
              <tr
                key={s.name}
                onClick={() => handleRowClick(s.name)}
                style={{
                  cursor: "pointer",
                  background: isSelected ? PALETTE[i % PALETTE.length] + "12" : "transparent",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSelected ? PALETTE[i % PALETTE.length] + "12" : "transparent"; }}
              >
                <td style={{ padding: "7px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE[i % PALETTE.length], display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontWeight: isSelected ? 700 : 400 }}>{s.name}</span>
                  {isSelected && <span style={{ fontSize: 10, color: PALETTE[i % PALETTE.length], fontWeight: 700 }}>▾</span>}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right", fontWeight: isSelected ? 700 : 400 }}>{fmt(s.value)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "#5f7284" }}>{pct.toFixed(1)}%</td>
                <td style={{ padding: "7px 8px", width: 80 }}>
                  <div style={{ height: 6, borderRadius: 4, background: "#eef3f6", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: PALETTE[i % PALETTE.length], borderRadius: 4 }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Drill-down panel */}
      {selectedCategory && (
        <div style={{ marginTop: 16, borderTop: "1px solid #e8eef3", paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#10212f" }}>
              {selectedCategory} の取引
              <span style={{ marginLeft: 8, fontSize: 12, color: "#5f7284", fontWeight: 400 }}>
                {drillRows.length}件
              </span>
            </span>
            <button
              onClick={() => setSelectedCategory(null)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1, padding: "2px 4px" }}
            >✕</button>
          </div>
          {drillRows.length === 0 ? (
            <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "12px 0" }}>
              {catId ? "取引なし" : "カテゴリ情報を読み込み中..."}
            </p>
          ) : (
            <div style={{ display: "grid", gap: 2, maxHeight: 240, overflowY: "auto" }}>
              {drillRows.map(tx => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 6px", borderRadius: 8, fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: "#10212f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {tx.merchant_normalized || tx.merchant_raw}
                    </p>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "#94a3b8" }}>{fmtDate(tx.transaction_date)}</p>
                  </div>
                  <span style={{ fontWeight: 700, color: "#dc2626", flexShrink: 0, marginLeft: 12 }}>
                    -${Number(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
