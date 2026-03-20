"use client";

import { useState, useEffect, useMemo } from "react";
import type { TransactionItem, TransactionCategoryOption } from "@/lib/api";

interface Props {
  initialTransactions: TransactionItem[];
  categories: TransactionCategoryOption[];
  initialYear: number;
  initialMonth: number;
  entityId?: string;
}

const CAT_PALETTE = [
  "#6366f1", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
  "#f97316", "#06b6d4",
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(n: number) {
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function fmtFull(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

export default function SpendingCalendar({ initialTransactions, categories, initialYear, initialMonth, entityId }: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [transactions, setTransactions] = useState<TransactionItem[]>(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const catMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    categories.forEach((c, i) => { m[c.id] = { name: c.name, color: CAT_PALETTE[i % CAT_PALETTE.length] }; });
    return m;
  }, [categories]);

  useEffect(() => {
    const isInitial = year === initialYear && month === initialMonth;
    if (isInitial) { setTransactions(initialTransactions); return; }
    setLoading(true);
    const headers: Record<string, string> = {};
    if (entityId) headers["x-entity-id"] = entityId;
    fetch(`/api/v1/transactions?year=${year}&month=${month}`, { headers })
      .then((r) => r.json())
      .then((d) => setTransactions(Array.isArray(d) ? d : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [year, month, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayMap = useMemo(() => {
    const m: Record<number, TransactionItem[]> = {};
    for (const tx of transactions) {
      if (tx.is_ignored) continue;
      const d = new Date(tx.transaction_date + "T00:00:00").getDate();
      (m[d] ??= []).push(tx);
    }
    return m;
  }, [transactions]);

  const maxDailySpend = useMemo(() => {
    let max = 0;
    for (const txs of Object.values(dayMap)) {
      const s = txs.filter((t) => t.direction === "debit").reduce((a, t) => a + parseFloat(t.amount), 0);
      if (s > max) max = s;
    }
    return max || 1;
  }, [dayMap]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const today = new Date();
  const monthName = new Date(year, month - 1).toLocaleString("en", { month: "long", year: "numeric" });
  const monthSpend = transactions.filter((t) => !t.is_ignored && t.direction === "debit").reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthIncome = transactions.filter((t) => !t.is_ignored && t.direction === "credit").reduce((s, t) => s + parseFloat(t.amount), 0);
  const selectedTxs = selectedDay != null ? (dayMap[selectedDay] ?? []) : [];

  const nav = (dir: -1 | 1) => {
    setSelectedDay(null);
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg,#0f766e,#0891b2)",
        borderRadius: 20,
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "0 8px 32px rgba(15,118,110,0.28)",
      }}>
        <button onClick={() => nav(-1)} style={navBtnStyle}>← Prev</button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", letterSpacing: "-0.3px" }}>{monthName}</div>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 6 }}>
            {monthSpend > 0 && <Chip label="Spent" value={fmtFull(monthSpend)} color="#fca5a5" />}
            {monthIncome > 0 && <Chip label="Income" value={fmtFull(monthIncome)} color="#86efac" />}
          </div>
        </div>

        <button onClick={() => nav(1)} style={navBtnStyle}>Next →</button>
      </div>

      {/* ── Grid ── */}
      <div className="panel" style={{ padding: "20px 20px 24px", overflow: "hidden" }}>
        {/* DOW headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 10 }}>
          {DOW.map((d) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>{d}</div>
          ))}
        </div>

        {/* Rows */}
        <div style={{ display: "grid", gap: 6 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} style={{ minHeight: 96 }} />;

                const txs = dayMap[day] ?? [];
                const debits = txs.filter((t) => t.direction === "debit");
                const credits = txs.filter((t) => t.direction === "credit");
                const spend = debits.reduce((s, t) => s + parseFloat(t.amount), 0);
                const income = credits.reduce((s, t) => s + parseFloat(t.amount), 0);

                const catTotals: Record<string, number> = {};
                for (const t of debits) if (t.category_id) catTotals[t.category_id] = (catTotals[t.category_id] ?? 0) + parseFloat(t.amount);
                const topCats = Object.entries(catTotals).sort(([, a], [, b]) => b - a).slice(0, 3).map(([id]) => id);

                const isSelected = day === selectedDay;
                const isToday = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
                const hasData = txs.length > 0;
                const heat = spend > 0 ? spend / maxDailySpend : 0;

                return (
                  <button
                    key={di}
                    onClick={() => hasData && setSelectedDay(isSelected ? null : day)}
                    style={{
                      minHeight: 96,
                      display: "flex",
                      flexDirection: "column",
                      padding: "10px 10px 8px",
                      borderRadius: 12,
                      border: isSelected ? "2.5px solid #0f766e" : isToday ? "2.5px solid #0ea5e9" : "1.5px solid #e2e8f0",
                      background: isSelected
                        ? "linear-gradient(135deg,#ecfdf5,#f0fdf4)"
                        : heat > 0
                        ? `rgba(239,68,68,${(heat * 0.18).toFixed(3)})`
                        : "#fafcfe",
                      cursor: hasData ? "pointer" : "default",
                      font: "inherit",
                      textAlign: "left",
                      transition: "transform 0.1s, box-shadow 0.1s",
                      boxShadow: isSelected ? "0 4px 16px rgba(15,118,110,0.18)" : "none",
                    }}
                  >
                    {/* Date */}
                    <span style={{ fontSize: 15, fontWeight: isToday ? 900 : 700, color: isToday ? "#0ea5e9" : isSelected ? "#0f766e" : "#1e293b", lineHeight: 1 }}>
                      {day}
                    </span>

                    {/* Spend */}
                    {spend > 0 && (
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", marginTop: 5, lineHeight: 1 }}>
                        {fmt(spend)}
                      </span>
                    )}

                    {/* Income */}
                    {income > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", marginTop: 3, lineHeight: 1 }}>
                        +{fmt(income)}
                      </span>
                    )}

                    {/* Txn count */}
                    {txs.length > 0 && (
                      <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, lineHeight: 1 }}>
                        {txs.length} txn{txs.length !== 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Cat dots */}
                    {topCats.length > 0 && (
                      <div style={{ display: "flex", gap: 3, marginTop: "auto", paddingTop: 6 }}>
                        {topCats.map((id) => (
                          <div key={id} title={catMap[id]?.name} style={{ width: 9, height: 9, borderRadius: "50%", background: catMap[id]?.color ?? "#94a3b8" }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#94a3b8", fontSize: 14 }}>Loading…</div>
        )}
      </div>

      {/* ── Category legend ── */}
      {categories.length > 0 && (
        <div className="panel" style={{ padding: "12px 16px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: 4 }}>Categories</span>
          {categories.slice(0, 10).map((cat, i) => (
            <span key={cat.id} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#475569" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: CAT_PALETTE[i % CAT_PALETTE.length], display: "inline-block" }} />
              {cat.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Day detail ── */}
      {selectedDay != null && (
        <div className="panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                {new Date(year, month - 1).toLocaleString("en", { month: "long" })} {selectedDay}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                {selectedTxs.length} transaction{selectedTxs.length !== 1 ? "s" : ""}
              </div>
            </div>
            <button onClick={() => setSelectedDay(null)} style={{ padding: "6px 14px", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", cursor: "pointer", fontWeight: 600, color: "#64748b", font: "inherit" }}>
              Close ✕
            </button>
          </div>

          {selectedTxs.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No transactions on this day.</p>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {selectedTxs.map((tx) => {
                  const color = catMap[tx.category_id ?? ""]?.color ?? "#94a3b8";
                  const isCredit = tx.direction === "credit";
                  return (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: color }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tx.merchant_normalized || tx.merchant_raw}
                        </div>
                        {tx.category_id && catMap[tx.category_id] && (
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{catMap[tx.category_id].name}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: isCredit ? "#16a34a" : "#dc2626", flexShrink: 0 }}>
                        {isCredit ? "+" : "−"}{fmtFull(parseFloat(tx.amount), tx.currency)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Day summary */}
              <div style={{ display: "flex", gap: 16, marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
                {selectedTxs.some((t) => t.direction === "debit") && (
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "10px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Spent</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#dc2626", marginTop: 4 }}>
                      {fmtFull(selectedTxs.filter((t) => t.direction === "debit").reduce((s, t) => s + parseFloat(t.amount), 0))}
                    </div>
                  </div>
                )}
                {selectedTxs.some((t) => t.direction === "credit") && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "10px 16px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Received</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#15803d", marginTop: 4 }}>
                      {fmtFull(selectedTxs.filter((t) => t.direction === "credit").reduce((s, t) => s + parseFloat(t.amount), 0))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────
const navBtnStyle: React.CSSProperties = {
  padding: "9px 20px",
  fontSize: 14,
  fontWeight: 700,
  border: "1.5px solid rgba(255,255,255,0.4)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.15)",
  color: "#fff",
  cursor: "pointer",
  font: "inherit",
  backdropFilter: "blur(4px)",
};

function Chip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", background: "rgba(255,255,255,0.18)", borderRadius: 99, padding: "3px 10px" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{value}</span>
    </span>
  );
}
