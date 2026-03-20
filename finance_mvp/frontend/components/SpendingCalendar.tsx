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
  "#0f766e", "#2563eb", "#dc2626", "#d97706",
  "#7c3aed", "#db2777", "#059669", "#ea580c",
  "#0891b2", "#4f46e5",
];

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmt(amount: number): string {
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}k`;
  return `$${Math.round(amount)}`;
}

function fmtFull(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function SpendingCalendar({
  initialTransactions,
  categories,
  initialYear,
  initialMonth,
  entityId,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [transactions, setTransactions] = useState<TransactionItem[]>(initialTransactions);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // category id → { name, color }
  const catMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    categories.forEach((cat, i) => {
      map[cat.id] = { name: cat.name, color: CAT_PALETTE[i % CAT_PALETTE.length] };
    });
    return map;
  }, [categories]);

  // Fetch transactions when month/entity changes
  useEffect(() => {
    const isInitial = year === initialYear && month === initialMonth;
    if (isInitial) {
      setTransactions(initialTransactions);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    const headers: Record<string, string> = {};
    if (entityId) headers["x-entity-id"] = entityId;
    fetch(`/api/v1/transactions?${params}`, { headers })
      .then((r) => r.json())
      .then((data) => setTransactions(Array.isArray(data) ? data : []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, [year, month, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group transactions by calendar day
  const dayMap = useMemo(() => {
    const map: Record<number, TransactionItem[]> = {};
    for (const tx of transactions) {
      if (tx.is_ignored) continue;
      const d = new Date(tx.transaction_date + "T00:00:00").getDate();
      (map[d] ??= []).push(tx);
    }
    return map;
  }, [transactions]);

  // Max daily spend for heat map
  const maxDailySpend = useMemo(() => {
    let max = 0;
    for (const txs of Object.values(dayMap)) {
      const total = txs
        .filter((t) => t.direction === "debit")
        .reduce((s, t) => s + parseFloat(t.amount), 0);
      if (total > max) max = total;
    }
    return max || 1;
  }, [dayMap]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDow = new Date(year, month - 1, 1).getDay();

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const prevMonth = () => {
    setSelectedDay(null);
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    setSelectedDay(null);
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const monthName = new Date(year, month - 1).toLocaleString("en", {
    month: "long",
    year: "numeric",
  });
  const monthTotal = transactions
    .filter((t) => !t.is_ignored && t.direction === "debit")
    .reduce((s, t) => s + parseFloat(t.amount), 0);
  const monthIncome = transactions
    .filter((t) => !t.is_ignored && t.direction === "credit")
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  const today = new Date();
  const selectedTxs = selectedDay != null ? (dayMap[selectedDay] ?? []) : [];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Month navigation bar */}
      <div
        className="panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            padding: "8px 18px",
            fontSize: 14,
            fontWeight: 600,
            border: "1px solid var(--line)",
            borderRadius: 10,
            background: "none",
            cursor: "pointer",
            color: "var(--ink)",
            font: "inherit",
          }}
        >
          ← Prev
        </button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: "var(--ink)" }}>{monthName}</div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 4 }}>
            {monthTotal > 0 && (
              <span style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
                ↓ {fmtFull(monthTotal)}
              </span>
            )}
            {monthIncome > 0 && (
              <span style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>
                ↑ {fmtFull(monthIncome)}
              </span>
            )}
            {monthTotal === 0 && monthIncome === 0 && (
              <span style={{ fontSize: 13, color: "var(--muted)" }}>No data</span>
            )}
          </div>
        </div>

        <button
          onClick={nextMonth}
          style={{
            padding: "8px 18px",
            fontSize: 14,
            fontWeight: 600,
            border: "1px solid var(--line)",
            borderRadius: 10,
            background: "none",
            cursor: "pointer",
            color: "var(--ink)",
            font: "inherit",
          }}
        >
          Next →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="panel" style={{ padding: "16px 16px 20px" }}>
        {/* Day-of-week headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, 1fr)",
            gap: 4,
            marginBottom: 8,
          }}
        >
          {DOW_LABELS.map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                padding: "4px 0",
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells — row by row */}
        <div style={{ display: "grid", gap: 4 }}>
          {weeks.map((week, wi) => (
            <div
              key={wi}
              style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}
            >
              {week.map((day, di) => {
                if (!day) return <div key={di} style={{ minHeight: 88 }} />;

                const txs = dayMap[day] ?? [];
                const debits = txs.filter((t) => t.direction === "debit");
                const credits = txs.filter((t) => t.direction === "credit");
                const total = debits.reduce((s, t) => s + parseFloat(t.amount), 0);
                const income = credits.reduce((s, t) => s + parseFloat(t.amount), 0);

                // Top categories by spending
                const catTotals: Record<string, number> = {};
                for (const t of debits) {
                  if (t.category_id)
                    catTotals[t.category_id] = (catTotals[t.category_id] ?? 0) + parseFloat(t.amount);
                }
                const topCats = Object.entries(catTotals)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 3)
                  .map(([id]) => id);

                const isSelected = day === selectedDay;
                const isToday =
                  today.getFullYear() === year &&
                  today.getMonth() + 1 === month &&
                  today.getDate() === day;
                const hasData = txs.length > 0;

                // Heat map intensity (0–1)
                const heat = total > 0 ? total / maxDailySpend : 0;
                const heatBg = heat > 0
                  ? `rgba(220,38,38,${(heat * 0.22).toFixed(3)})`
                  : undefined;

                return (
                  <button
                    key={di}
                    onClick={() => hasData && setSelectedDay(isSelected ? null : day)}
                    style={{
                      minHeight: 88,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      padding: "8px 9px 7px",
                      borderRadius: 10,
                      border: isSelected
                        ? "2px solid #0f766e"
                        : isToday
                        ? "2px solid #0ea5e9"
                        : "1px solid var(--line)",
                      backgroundColor: isSelected
                        ? "#f0fdf4"
                        : heatBg ?? "transparent",
                      cursor: hasData ? "pointer" : "default",
                      overflow: "hidden",
                      font: "inherit",
                      textAlign: "left",
                      transition: "border-color 0.1s, background-color 0.1s",
                    }}
                  >
                    {/* Date number */}
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: isToday ? 800 : 600,
                        color: isToday ? "#0ea5e9" : isSelected ? "#0f766e" : "var(--ink)",
                        lineHeight: 1,
                      }}
                    >
                      {day}
                    </span>

                    {/* Spending amount */}
                    {total > 0 && (
                      <span
                        style={{
                          fontSize: 12,
                          color: "#dc2626",
                          fontWeight: 700,
                          marginTop: 4,
                          lineHeight: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmt(total)}
                      </span>
                    )}

                    {/* Income amount */}
                    {income > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          color: "#16a34a",
                          fontWeight: 600,
                          marginTop: 2,
                          lineHeight: 1,
                        }}
                      >
                        +{fmt(income)}
                      </span>
                    )}

                    {/* Transaction count */}
                    {txs.length > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--muted)",
                          marginTop: 3,
                          lineHeight: 1,
                        }}
                      >
                        {txs.length} txn{txs.length !== 1 ? "s" : ""}
                      </span>
                    )}

                    {/* Category dots */}
                    {topCats.length > 0 && (
                      <div style={{ display: "flex", gap: 3, marginTop: "auto", paddingTop: 6 }}>
                        {topCats.map((id) => (
                          <div
                            key={id}
                            title={catMap[id]?.name}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              backgroundColor: catMap[id]?.color ?? "#94a3b8",
                              flexShrink: 0,
                            }}
                          />
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
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 13, paddingTop: 16 }}>
            Loading…
          </p>
        )}
      </div>

      {/* Selected day detail */}
      {selectedDay != null && (
        <div className="panel" style={{ padding: 20 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", margin: 0 }}>
              {new Date(year, month - 1).toLocaleString("en", { month: "long" })} {selectedDay}
              <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 14, marginLeft: 8 }}>
                — {selectedTxs.length} transaction{selectedTxs.length !== 1 ? "s" : ""}
              </span>
            </h3>
            <button
              onClick={() => setSelectedDay(null)}
              style={{
                padding: "5px 12px",
                fontSize: 13,
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "none",
                cursor: "pointer",
                color: "var(--muted)",
                font: "inherit",
              }}
            >
              ✕ Close
            </button>
          </div>

          {selectedTxs.length === 0 ? (
            <p style={{ color: "var(--muted)", fontSize: 14 }}>No transactions on this day.</p>
          ) : (
            <>
              <div style={{ display: "grid", gap: 8 }}>
                {selectedTxs.map((tx) => (
                  <div
                    key={tx.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 14px",
                      borderRadius: 10,
                      backgroundColor: "var(--soft)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: catMap[tx.category_id ?? ""]?.color ?? "#94a3b8",
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: "var(--ink)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tx.merchant_normalized || tx.merchant_raw}
                      </div>
                      {tx.category_id && catMap[tx.category_id] && (
                        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                          {catMap[tx.category_id].name}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: tx.direction === "credit" ? "#16a34a" : "#dc2626",
                        flexShrink: 0,
                      }}
                    >
                      {tx.direction === "credit" ? "+" : "−"}
                      {fmtFull(parseFloat(tx.amount), tx.currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingTop: 14,
                  marginTop: 14,
                  borderTop: "1px solid var(--line)",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {selectedTxs.filter((t) => t.direction === "debit").length > 0 && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>Spent</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#dc2626" }}>
                      {fmtFull(
                        selectedTxs
                          .filter((t) => t.direction === "debit")
                          .reduce((s, t) => s + parseFloat(t.amount), 0)
                      )}
                    </span>
                  </div>
                )}
                {selectedTxs.filter((t) => t.direction === "credit").length > 0 && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "var(--muted)" }}>Received</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#16a34a" }}>
                      {fmtFull(
                        selectedTxs
                          .filter((t) => t.direction === "credit")
                          .reduce((s, t) => s + parseFloat(t.amount), 0)
                      )}
                    </span>
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
