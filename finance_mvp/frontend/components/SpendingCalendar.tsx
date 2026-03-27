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

// Merchant → color seed for deterministic badge color
const MERCHANT_COLORS = [
  "#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444",
  "#8b5cf6","#ec4899","#14b8a6","#f97316","#06b6d4",
  "#84cc16","#f43f5e","#a855f7","#22d3ee","#fb923c",
];

function merchantColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return MERCHANT_COLORS[Math.abs(hash) % MERCHANT_COLORS.length];
}

function merchantInitial(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, " ").trim();
  return (clean.charAt(0) || "?").toUpperCase();
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(n: number) {
  if (n >= 10000) return `$${(n / 1000).toFixed(0)}k`;
  if (n >= 1000)  return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function fmtFull(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

// Detect payday: single credit >= $500
function isPayday(txs: TransactionItem[]): boolean {
  return txs.some(t => t.direction === "credit" && parseFloat(t.amount) >= 500);
}

export default function SpendingCalendar({
  initialTransactions, categories, initialYear, initialMonth, entityId,
}: Props) {
  const [year, setYear]           = useState(initialYear);
  const [month, setMonth]         = useState(initialMonth);
  const [transactions, setTxns]   = useState<TransactionItem[]>(initialTransactions);
  const [loading, setLoading]     = useState(false);
  const [selectedDay, setSelected] = useState<number | null>(null);

  const catMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    categories.forEach((c, i) => { m[c.id] = { name: c.name, color: CAT_PALETTE[i % CAT_PALETTE.length] }; });
    return m;
  }, [categories]);

  useEffect(() => {
    if (year === initialYear && month === initialMonth) { setTxns(initialTransactions); return; }
    setLoading(true);
    const hdrs: Record<string, string> = {};
    if (entityId) hdrs["x-entity-id"] = entityId;
    fetch(`/api/v1/transactions?year=${year}&month=${month}`, { headers: hdrs })
      .then(r => r.json()).then(d => setTxns(Array.isArray(d) ? d : []))
      .catch(() => setTxns([])).finally(() => setLoading(false));
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
      const s = txs.filter(t => t.direction === "debit").reduce((a, t) => a + parseFloat(t.amount), 0);
      if (s > max) max = s;
    }
    return max || 1;
  }, [dayMap]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow    = new Date(year, month - 1, 1).getDay();
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  const today     = new Date();
  const monthName = new Date(year, month - 1).toLocaleString("en", { month: "long", year: "numeric" });
  const monthSpend  = transactions.filter(t => !t.is_ignored && t.direction === "debit").reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthIncome = transactions.filter(t => !t.is_ignored && t.direction === "credit").reduce((s, t) => s + parseFloat(t.amount), 0);
  const selectedTxs = selectedDay != null ? (dayMap[selectedDay] ?? []) : [];

  const nav = (dir: -1 | 1) => {
    setSelected(null);
    const d = new Date(year, month - 1 + dir, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth() + 1);
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg,#0f172a 0%,#1e293b 100%)",
        borderRadius: 20, padding: "22px 28px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
      }}>
        <button onClick={() => nav(-1)} style={navBtnStyle}>← Prev</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: "-0.5px" }}>{monthName}</div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
            {monthSpend > 0  && <StatChip label="Spent"  value={fmtFull(monthSpend)}  color="#fca5a5" />}
            {monthIncome > 0 && <StatChip label="Income" value={fmtFull(monthIncome)} color="#86efac" />}
            {monthIncome > 0 && monthSpend > 0 && (
              <StatChip
                label="Net"
                value={fmtFull(monthIncome - monthSpend)}
                color={monthIncome >= monthSpend ? "#6ee7b7" : "#fca5a5"}
              />
            )}
          </div>
        </div>
        <button onClick={() => nav(1)} style={navBtnStyle}>Next →</button>
      </div>

      {/* ── Calendar grid ── */}
      <div className="panel" style={{ padding: "20px 16px 24px", overflow: "hidden" }}>
        {/* DOW headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 10 }}>
          {DOW.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.6px" }}>{d}</div>
          ))}
        </div>

        {/* Weeks */}
        <div style={{ display: "grid", gap: 6 }}>
          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
              {week.map((day, di) => {
                if (!day) return <div key={di} style={{ minHeight: 100 }} />;

                const txs     = dayMap[day] ?? [];
                const debits  = txs.filter(t => t.direction === "debit");
                const credits = txs.filter(t => t.direction === "credit");
                const spend   = debits.reduce((s, t) => s + parseFloat(t.amount), 0);
                const income  = credits.reduce((s, t) => s + parseFloat(t.amount), 0);
                const payday  = isPayday(txs);
                const heat    = spend > 0 ? spend / maxDailySpend : 0;

                const isSelected = day === selectedDay;
                const isToday    = today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day;
                const hasData    = txs.length > 0;

                // Top 3 unique merchants for badge display
                const seen = new Set<string>();
                const badges: { label: string; color: string }[] = [];
                for (const tx of txs) {
                  const name = tx.merchant_normalized || tx.merchant_raw;
                  if (!seen.has(name) && badges.length < 3) {
                    seen.add(name);
                    badges.push({ label: merchantInitial(name), color: merchantColor(name) });
                  }
                }

                return (
                  <button
                    key={di}
                    onClick={() => hasData && setSelected(isSelected ? null : day)}
                    style={{
                      minHeight: 100,
                      display: "flex", flexDirection: "column",
                      padding: "8px 8px 6px",
                      borderRadius: 14,
                      border: isSelected
                        ? "2.5px solid #6366f1"
                        : isToday
                        ? "2.5px solid #0ea5e9"
                        : "1.5px solid #e2e8f0",
                      background: isSelected
                        ? "linear-gradient(135deg,#eef2ff,#f5f3ff)"
                        : payday
                        ? "linear-gradient(135deg,#f0fdf4,#fafffe)"
                        : heat > 0
                        ? `rgba(239,68,68,${(heat * 0.14).toFixed(3)})`
                        : "#fafcfe",
                      cursor: hasData ? "pointer" : "default",
                      font: "inherit", textAlign: "left",
                      transition: "transform 0.12s, box-shadow 0.12s",
                      boxShadow: isSelected ? "0 4px 18px rgba(99,102,241,0.18)" : "none",
                    }}
                    onMouseEnter={e => { if (hasData) (e.currentTarget as HTMLElement).style.transform = "scale(1.03)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
                  >
                    {/* Date number */}
                    <span style={{
                      fontSize: 14, fontWeight: isToday ? 900 : 700,
                      color: isToday ? "#0ea5e9" : isSelected ? "#6366f1" : "#1e293b",
                      lineHeight: 1,
                    }}>
                      {day}
                    </span>

                    {/* Payday badge */}
                    {payday && (
                      <span style={{
                        display: "inline-block", marginTop: 4,
                        background: "#16a34a", color: "#fff",
                        borderRadius: 6, padding: "1px 5px",
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.3px",
                      }}>
                        💰 PAYDAY
                      </span>
                    )}

                    {/* Income pill */}
                    {income > 0 && (
                      <span style={{
                        display: "inline-block", marginTop: 3,
                        background: "#dcfce7", color: "#15803d",
                        borderRadius: 6, padding: "2px 5px",
                        fontSize: 10, fontWeight: 800,
                      }}>
                        +{fmt(income)}
                      </span>
                    )}

                    {/* Spend amount */}
                    {spend > 0 && (
                      <span style={{
                        fontSize: 11, fontWeight: 800,
                        color: heat > 0.7 ? "#dc2626" : "#ef4444",
                        marginTop: 3, lineHeight: 1,
                      }}>
                        {fmt(spend)}
                      </span>
                    )}

                    {/* Merchant badges */}
                    {badges.length > 0 && (
                      <div style={{ display: "flex", gap: 3, marginTop: "auto", paddingTop: 5 }}>
                        {badges.map((b, idx) => (
                          <div key={idx} style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: b.color, color: "#fff",
                            fontSize: 8, fontWeight: 900,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
                          }}>
                            {b.label}
                          </div>
                        ))}
                        {txs.length > 3 && (
                          <div style={{
                            width: 20, height: 20, borderRadius: "50%",
                            background: "#e2e8f0", color: "#64748b",
                            fontSize: 8, fontWeight: 800,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            +{txs.length - 3}
                          </div>
                        )}
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

      {/* ── Day detail panel ── */}
      {selectedDay != null && (
        <div className="panel" style={{ padding: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                {new Date(year, month - 1).toLocaleString("en", { month: "long" })} {selectedDay}
                {isPayday(selectedTxs) && (
                  <span style={{ marginLeft: 10, background: "#dcfce7", color: "#15803d", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                    💰 Payday
                  </span>
                )}
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                {selectedTxs.length} transaction{selectedTxs.length !== 1 ? "s" : ""}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ padding: "6px 14px", fontSize: 13, border: "1px solid #e2e8f0", borderRadius: 10, background: "#f8fafc", cursor: "pointer", fontWeight: 600, color: "#64748b", font: "inherit" }}>
              Close ✕
            </button>
          </div>

          {selectedTxs.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 14 }}>No transactions on this day.</p>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {selectedTxs.map(tx => {
                  const name     = tx.merchant_normalized || tx.merchant_raw;
                  const badgeClr = merchantColor(name);
                  const catInfo  = catMap[tx.category_id ?? ""];
                  const isCredit = tx.direction === "credit";
                  return (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                      {/* Merchant badge */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: badgeClr, color: "#fff",
                        fontSize: 16, fontWeight: 900,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0, boxShadow: `0 2px 8px ${badgeClr}55`,
                      }}>
                        {merchantInitial(name)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {name}
                        </div>
                        {catInfo && (
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ width: 7, height: 7, borderRadius: "50%", background: catInfo.color, display: "inline-block" }} />
                            {catInfo.name}
                          </div>
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
              <div style={{ display: "flex", gap: 12, marginTop: 18, paddingTop: 18, borderTop: "1px solid #e2e8f0", flexWrap: "wrap" }}>
                {selectedTxs.some(t => t.direction === "debit") && (
                  <SummaryChip
                    label="Total Spent"
                    value={fmtFull(selectedTxs.filter(t => t.direction === "debit").reduce((s, t) => s + parseFloat(t.amount), 0))}
                    bg="#fef2f2" border="#fecaca" labelColor="#ef4444" valueColor="#dc2626"
                  />
                )}
                {selectedTxs.some(t => t.direction === "credit") && (
                  <SummaryChip
                    label="Total Received"
                    value={fmtFull(selectedTxs.filter(t => t.direction === "credit").reduce((s, t) => s + parseFloat(t.amount), 0))}
                    bg="#f0fdf4" border="#bbf7d0" labelColor="#16a34a" valueColor="#15803d"
                  />
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  padding: "9px 20px", fontSize: 14, fontWeight: 700,
  border: "1.5px solid rgba(255,255,255,0.25)", borderRadius: 12,
  background: "rgba(255,255,255,0.10)", color: "#fff",
  cursor: "pointer", font: "inherit", backdropFilter: "blur(4px)",
};

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <span style={{ display: "inline-flex", gap: 5, alignItems: "center", background: "rgba(255,255,255,0.12)", borderRadius: 99, padding: "4px 12px" }}>
      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.65)" }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color }}>{value}</span>
    </span>
  );
}

function SummaryChip({ label, value, bg, border, labelColor, valueColor }: {
  label: string; value: string; bg: string; border: string; labelColor: string; valueColor: string;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "10px 16px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: valueColor, marginTop: 4 }}>{value}</div>
    </div>
  );
}
