"use client";

import { useState, useEffect } from "react";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import SpendingPieChart from "@/components/charts/SpendingPieChart";
import CashFlowCard from "@/components/dashboard/CashFlowCard";
import RecentTransactionsList from "@/components/dashboard/RecentTransactionsList";
import SubscriptionsWidget from "@/components/SubscriptionsWidget";
import { asNumber } from "@/lib/api";
import type { MonthlyOverview, MonthlyHistoryItem, TransactionItem } from "@/lib/api";

// ─── カテゴリ表示名・色マッピング ─────────────────────────────────────────────

const CATEGORY_META: Record<string, { color: string }> = {
  "Travel":          { color: "#0ea5e9" },
  "Shopping":        { color: "#8b5cf6" },
  "Food":            { color: "#f97316" },
  "Groceries":       { color: "#22c55e" },
  "Subscriptions":   { color: "#6366f1" },
  "Entertainment":   { color: "#ec4899" },
  "Transportation":  { color: "#06b6d4" },
  "Utilities":       { color: "#84cc16" },
  "Housing":         { color: "#f59e0b" },
  "Education":       { color: "#14b8a6" },
  "Healthcare":      { color: "#ef4444" },
  "Uncategorized":   { color: "#94a3b8" },
};

function getCategoryColor(name: string): string {
  return CATEGORY_META[name]?.color ?? "#94a3b8";
}

// ─── KPI カード ───────────────────────────────────────────────────────────────

type CardVariant = "green" | "red" | "blue" | "amber" | "neutral";
const CARD_STYLES: Record<CardVariant, { bg: string; iconBg: string; valueColor: string }> = {
  green:   { bg: "linear-gradient(140deg,#ecfdf5 0%,#f8fffd 100%)", iconBg: "#bbf7d0", valueColor: "#065f46" },
  red:     { bg: "linear-gradient(140deg,#fef2f2 0%,#fff 100%)",    iconBg: "#fecaca", valueColor: "#991b1b" },
  blue:    { bg: "linear-gradient(140deg,#eff6ff 0%,#fff 100%)",    iconBg: "#bfdbfe", valueColor: "#1e40af" },
  amber:   { bg: "linear-gradient(140deg,#fffbeb 0%,#fff 100%)",    iconBg: "#fde68a", valueColor: "#92400e" },
  neutral: { bg: "#fff",                                             iconBg: "#e8eef3", valueColor: "#10212f" },
};

function KpiCard({ label, value, sub, icon, variant }: { label: string; value: string; sub?: string; icon: string; variant: CardVariant }) {
  const s = CARD_STYLES[variant];
  return (
    <div className="panel" style={{ padding: "16px 18px", background: s.bg, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: "#5f7284", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>{label}</p>
        <strong style={{ display: "block", fontSize: 22, fontWeight: 800, color: s.valueColor, lineHeight: 1.1, marginTop: 3 }}>{value}</strong>
        {sub && <p style={{ color: "#5f7284", fontSize: 11, marginTop: 3, margin: "3px 0 0" }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── カテゴリ横棒ウィジェット ─────────────────────────────────────────────────

function CategoryBarsWidget({ breakdown }: { breakdown: { category: string; total: string }[] }) {
  const items = breakdown
    .filter(c => !["income", "transfer", "Income", "Transfer", "Transfers"].includes(c.category))
    .slice(0, 8);
  const maxVal = Math.max(...items.map(c => asNumber(c.total)), 1);
  const totalVal = items.reduce((s, c) => s + asNumber(c.total), 0);

  return (
    <div className="panel" style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#10212f" }}>Top Expense Categories</h3>
        <span style={{ fontSize: 12, color: "#5f7284" }}>今月</span>
      </div>
      {items.length === 0 ? (
        <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "32px 0" }}>データなし</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {items.map(cat => {
            const val = asNumber(cat.total);
            const pct = Math.round((val / maxVal) * 100);
            const ofTotal = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;
            const color = getCategoryColor(cat.category);
            return (
              <div key={cat.category}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{cat.category}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{ofTotal}%</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#10212f" }}>
                    ${val.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ height: 6, borderRadius: 99, background: "#f1f5f9", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, borderRadius: 99, background: color, transition: "width 0.5s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── アラート ─────────────────────────────────────────────────────────────────

function AlertsWidget({ alerts, dupCount }: { alerts: string[]; dupCount: number }) {
  const all = [
    ...alerts,
    ...(dupCount > 0 ? [`${dupCount} possible duplicate transaction${dupCount > 1 ? "s" : ""} detected.`] : []),
  ];
  if (all.length === 0) return null;
  return (
    <div className="panel" style={{ padding: "14px 20px", borderLeft: "4px solid #f59e0b" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#92400e" }}>⚠ Alerts</h3>
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 4 }}>
        {all.map(a => <li key={a} style={{ color: "#78350f", fontSize: 13 }}>{a}</li>)}
      </ul>
    </div>
  );
}

// ─── メイン ───────────────────────────────────────────────────────────────────

interface Props {
  overview: MonthlyOverview | null;
  transactions: TransactionItem[];
  history: MonthlyHistoryItem[];
  selectedMonth: string;
  entityId: string | undefined;
  docsRequiringReview: number;
  openReviewQueue: number;
  alerts: string[];
}

export default function HomeWidgets({ overview, transactions, history, selectedMonth, entityId, docsRequiringReview, openReviewQueue, alerts }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const fmt = (v: number) => `$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  const spend  = asNumber(overview?.total_spend);
  const income = asNumber(overview?.income);
  const net    = asNumber(overview?.net);
  const dupCount = overview?.duplicate_transaction_count ?? 0;

  // SSRフォールバック
  if (!mounted) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: 80, borderRadius: 12, background: "#f1f5f9" }} />)}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>

      {/* ── Row 1: KPI カード ── */}
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <KpiCard label="Monthly Spend"   value={fmt(spend)}  sub={overview?.month ?? "—"} icon="💸" variant="red" />
        <KpiCard label="Monthly Income"  value={fmt(income)} sub={overview?.month ?? "—"} icon="💰" variant="green" />
        <KpiCard label="Net Cashflow"    value={(net >= 0 ? "+" : "-") + fmt(net)} sub={net >= 0 ? "Positive" : "Negative"} icon={net >= 0 ? "📈" : "📉"} variant={net >= 0 ? "green" : "red"} />
        <KpiCard label="Docs for Review" value={String(docsRequiringReview)} sub={docsRequiringReview > 0 ? "Action needed" : "All clear"} icon="📄" variant={docsRequiringReview > 0 ? "amber" : "neutral"} />
        <KpiCard label="Review Queue"    value={String(openReviewQueue)} sub={openReviewQueue > 0 ? "Items open" : "Queue empty"} icon="✅" variant={openReviewQueue > 0 ? "amber" : "neutral"} />
      </div>

      {/* ── アラート ── */}
      <AlertsWidget alerts={alerts} dupCount={dupCount} />

      {/* ── Row 2: Cash Flow + 円グラフ ── */}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
        <CashFlowCard overview={overview} />
        <SpendingPieChart data={(overview?.category_breakdown ?? []).filter(c => !["income", "transfer", "Income", "Transfer", "Transfers"].includes(c.category))} transactions={transactions} entityId={entityId} />
      </div>

      {/* ── Row 3: トレンドチャート + サブスク ── */}
      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "3fr 2fr" }}>
        <MonthlyTrendChart data={history} selectedMonth={selectedMonth} />
        <SubscriptionsWidget entityId={entityId} />
      </div>

      {/* ── Row 4: 直近の取引 (全幅) ── */}
      <RecentTransactionsList rows={transactions} entityId={entityId} />

    </div>
  );
}
