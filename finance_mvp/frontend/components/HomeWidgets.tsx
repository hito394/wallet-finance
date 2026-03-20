"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import SpendingPieChart from "@/components/charts/SpendingPieChart";
import RecentTransactionsList from "@/components/dashboard/RecentTransactionsList";
import { asNumber } from "@/lib/api";
import type { MonthlyOverview, MonthlyHistoryItem, TransactionItem } from "@/lib/api";

// ─── Individual KPI card ──────────────────────────────────────────────────────

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
    <div className="panel" style={{ padding: "18px 20px", background: s.bg, display: "flex", alignItems: "flex-start", gap: 14 }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: s.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ color: "#5f7284", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", margin: 0 }}>{label}</p>
        <strong style={{ display: "block", fontSize: 26, fontWeight: 800, color: s.valueColor, lineHeight: 1.1, marginTop: 4 }}>{value}</strong>
        {sub && <p style={{ color: "#5f7284", fontSize: 12, marginTop: 4 }}>{sub}</p>}
      </div>
    </div>
  );
}

// ─── Widget config ────────────────────────────────────────────────────────────

const KPI_IDS = new Set(["card_spend", "card_income", "card_net", "card_subs", "card_docs", "card_queue"]);
// Widgets that can be resized (non-KPI)
const RESIZABLE_IDS = new Set(["alerts", "trend", "pie", "recent"]);

const DEFAULT_ORDER = [
  "card_spend", "card_income", "card_net", "card_subs", "card_docs", "card_queue",
  "alerts", "trend", "pie", "recent",
];

const WIDGET_LABELS: Record<string, string> = {
  card_spend:  "Monthly Spend",
  card_income: "Monthly Income",
  card_net:    "Net Cashflow",
  card_subs:   "Subscriptions",
  card_docs:   "Docs for Review",
  card_queue:  "Review Queue",
  alerts:      "Alerts",
  trend:       "Monthly Trend",
  pie:         "Spending Breakdown",
  recent:      "Recent Transactions",
};

const STORAGE_KEY = "home_widget_config_v4";

type WidgetSize = "full" | "half";
type WidgetConfig = {
  order: string[];
  hidden: string[];
  sizes: Record<string, WidgetSize>;
};

const DEFAULT_SIZES: Record<string, WidgetSize> = {
  trend: "half",
  pie:   "half",
};

function loadConfig(): WidgetConfig {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as WidgetConfig;
      if (Array.isArray(p.order) && Array.isArray(p.hidden)) {
        return { sizes: {}, ...p };
      }
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_ORDER, hidden: [], sizes: DEFAULT_SIZES };
}

function saveConfig(cfg: WidgetConfig) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
}

// ─── Main component ───────────────────────────────────────────────────────────

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
  const [config, setConfig] = useState<WidgetConfig>({ order: DEFAULT_ORDER, hidden: [], sizes: DEFAULT_SIZES });
  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragItemId = useRef<string | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
    setMounted(true);
  }, []);

  const update = useCallback((next: WidgetConfig) => {
    setConfig(next);
    saveConfig(next);
  }, []);

  const toggleHidden = (id: string) => {
    const hidden = config.hidden.includes(id)
      ? config.hidden.filter((h) => h !== id)
      : [...config.hidden, id];
    update({ ...config, hidden });
  };

  const cycleSize = (id: string) => {
    const current = config.sizes[id] ?? "full";
    const next: WidgetSize = current === "full" ? "half" : "full";
    update({ ...config, sizes: { ...config.sizes, [id]: next } });
  };

  const order = [
    ...config.order.filter((id) => DEFAULT_ORDER.includes(id)),
    ...DEFAULT_ORDER.filter((id) => !config.order.includes(id)),
  ];

  const onDragStart = (e: React.DragEvent, id: string) => {
    dragItemId.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverIdx(idx);
  };

  const onDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragItemId.current;
    if (!from) return;
    const fromIdx = order.indexOf(from);
    if (fromIdx === -1 || fromIdx === idx) { setDraggingId(null); setOverIdx(null); return; }
    const next = [...order];
    next.splice(fromIdx, 1);
    next.splice(idx, 0, from);
    update({ ...config, order: next });
    setDraggingId(null);
    setOverIdx(null);
    dragItemId.current = null;
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setOverIdx(null);
    dragItemId.current = null;
  };

  // ── KPI card renderers ──
  const fmt = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  const spend  = asNumber(overview?.total_spend);
  const income = asNumber(overview?.income);
  const net    = asNumber(overview?.net);
  const subs   = overview?.detected_subscriptions.length ?? 0;
  const dupCount = overview?.duplicate_transaction_count ?? 0;

  function renderKpiCard(id: string) {
    switch (id) {
      case "card_spend":
        return <KpiCard label="Monthly Spend" value={fmt(spend)} sub={overview?.month ?? "—"} icon="💸" variant="red" />;
      case "card_income":
        return <KpiCard label="Monthly Income" value={fmt(income)} sub={overview?.month ?? "—"} icon="💰" variant="green" />;
      case "card_net":
        return <KpiCard label="Net Cashflow" value={(net >= 0 ? "+" : "") + fmt(net)} sub={net >= 0 ? "Positive" : "Negative"} icon={net >= 0 ? "📈" : "📉"} variant={net >= 0 ? "green" : "red"} />;
      case "card_subs":
        return <KpiCard label="Subscriptions" value={String(subs)} sub={subs > 0 ? "Recurring detected" : "None detected"} icon="🔄" variant="blue" />;
      case "card_docs":
        return <KpiCard label="Docs for Review" value={String(docsRequiringReview)} sub={docsRequiringReview > 0 ? "Action needed" : "All clear"} icon="📄" variant={docsRequiringReview > 0 ? "amber" : "neutral"} />;
      case "card_queue":
        return <KpiCard label="Review Queue" value={String(openReviewQueue)} sub={openReviewQueue > 0 ? "Items open" : "Queue empty"} icon="✅" variant={openReviewQueue > 0 ? "amber" : "neutral"} />;
      default:
        return null;
    }
  }

  function renderWidget(id: string) {
    switch (id) {
      case "alerts": {
        const allAlerts = [
          ...alerts,
          ...(dupCount > 0 ? [`${dupCount} possible duplicate transaction${dupCount > 1 ? "s" : ""} detected across sources.`] : []),
        ];
        if (allAlerts.length === 0 && !editMode) return null;
        return (
          <div className="panel" style={{ padding: "16px 20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Alerts</h3>
            {allAlerts.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 14 }}>No alerts this month.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                {allAlerts.map((a) => <li key={a} style={{ color: "#92400e", fontSize: 14 }}>{a}</li>)}
              </ul>
            )}
          </div>
        );
      }
      case "trend":
        return <MonthlyTrendChart data={history} selectedMonth={selectedMonth} />;
      case "pie":
        return <SpendingPieChart data={overview?.category_breakdown ?? []} />;
      case "recent":
        return <RecentTransactionsList rows={transactions} entityId={entityId} />;
      default:
        return null;
    }
  }

  // ─── Normal-mode layout: group KPI cards in a row, pair half-size widgets ───

  type LayoutRow =
    | { type: "kpi"; ids: string[] }
    | { type: "pair"; a: string; b: string }
    | { type: "single"; id: string };

  function buildLayout(activeOrder: string[], hidden: string[]): LayoutRow[] {
    const rows: LayoutRow[] = [];
    let kpiBuf: string[] = [];
    let halfBuf: string | null = null;

    function flushKpi() {
      if (!kpiBuf.length) return;
      rows.push({ type: "kpi", ids: [...kpiBuf] });
      kpiBuf = [];
    }

    function flushHalf() {
      if (!halfBuf) return;
      rows.push({ type: "single", id: halfBuf });
      halfBuf = null;
    }

    for (const id of activeOrder) {
      if (hidden.includes(id)) continue;
      if (KPI_IDS.has(id)) {
        flushHalf();
        kpiBuf.push(id);
        continue;
      }
      flushKpi();
      const content = renderWidget(id);
      if (!content) continue;
      const size = config.sizes[id] ?? "full";
      if (size === "half") {
        if (halfBuf) {
          rows.push({ type: "pair", a: halfBuf, b: id });
          halfBuf = null;
        } else {
          halfBuf = id;
        }
      } else {
        flushHalf();
        rows.push({ type: "single", id });
      }
    }
    flushKpi();
    flushHalf();
    return rows;
  }

  // ─── SSR fallback ─────────────────────────────────────────────────────────
  if (!mounted) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {["card_spend", "card_income", "card_net", "card_subs", "card_docs", "card_queue"].map(id => (
            <div key={id}>{renderKpiCard(id)}</div>
          ))}
        </div>
        {renderWidget("alerts")}
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
          {renderWidget("trend")}
          {renderWidget("pie")}
        </div>
        {renderWidget("recent")}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* ── Customize bar ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>
        {editMode && (
          <span style={{ fontSize: 12, color: "#64748b", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: 8, padding: "5px 10px" }}>
            ⠿ Drag · Eye Hide · ⬡ Size
          </span>
        )}
        <button
          onClick={() => setEditMode((v) => !v)}
          style={{
            padding: "7px 16px", fontSize: 13, fontWeight: 700,
            border: editMode ? "none" : "1px solid #e2e8f0",
            borderRadius: 10,
            background: editMode ? "linear-gradient(135deg,#0f766e,#0891b2)" : "#fff",
            color: editMode ? "#fff" : "#475569",
            cursor: "pointer", font: "inherit",
            boxShadow: editMode ? "0 2px 10px rgba(15,118,110,0.3)" : "none",
          }}
        >
          {editMode ? "✓ Done" : "⚙ Customize"}
        </button>
      </div>

      {editMode ? (
        /* ── Edit mode: flat list with drag / hide / size controls ── */
        <div style={{ display: "grid", gap: 16 }}>
          {order.map((id, idx) => {
            const isHidden = config.hidden.includes(id);
            const isDragging = draggingId === id;
            const isDropTarget = overIdx === idx && draggingId !== id;
            const size = config.sizes[id] ?? "full";
            const content = KPI_IDS.has(id) ? renderKpiCard(id) : renderWidget(id);
            const canResize = RESIZABLE_IDS.has(id);

            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => onDragStart(e, id)}
                onDragOver={(e) => onDragOver(e, idx)}
                onDrop={(e) => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                style={{
                  opacity: isDragging ? 0.4 : isHidden ? 0.45 : 1,
                  cursor: "grab",
                  borderRadius: 16,
                  border: isDropTarget ? "2px dashed #0f766e" : "2px solid transparent",
                  transition: "opacity 0.15s, border-color 0.15s",
                }}
              >
                {/* Toolbar */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 4px", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.3px", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>⠿</span>
                    {WIDGET_LABELS[id] ?? id}
                    {KPI_IDS.has(id) && (
                      <span style={{ fontSize: 10, background: "#dbeafe", color: "#1e40af", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>KPI</span>
                    )}
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {canResize && (
                      <button
                        onClick={() => cycleSize(id)}
                        title={`Width: ${size} — click to toggle`}
                        style={{
                          padding: "4px 12px", fontSize: 12, fontWeight: 700,
                          border: "1px solid #e2e8f0", borderRadius: 8,
                          background: size === "half" ? "#eff6ff" : "#f8fafc",
                          color: size === "half" ? "#1e40af" : "#475569",
                          cursor: "pointer", font: "inherit",
                        }}
                      >
                        {size === "half" ? "⬛ Half" : "⬜ Full"}
                      </button>
                    )}
                    <button
                      onClick={() => toggleHidden(id)}
                      style={{
                        padding: "4px 12px", fontSize: 12, fontWeight: 700,
                        border: "1px solid #e2e8f0", borderRadius: 8,
                        background: isHidden ? "#fef2f2" : "#f0fdf4",
                        color: isHidden ? "#dc2626" : "#16a34a",
                        cursor: "pointer", font: "inherit",
                      }}
                    >
                      {isHidden ? "Show" : "Hide"}
                    </button>
                  </div>
                </div>

                {/* Preview */}
                {isHidden ? (
                  <div style={{ minHeight: 52, border: "2px dashed #e2e8f0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc" }}>
                    {WIDGET_LABELS[id] ?? id} — hidden
                  </div>
                ) : (
                  <div style={{ opacity: 0.75, pointerEvents: "none" }}>
                    {content ?? <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>No content</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Normal mode: grouped layout with half/full sizing ── */
        <div style={{ display: "grid", gap: 20 }}>
          {buildLayout(order, config.hidden).map((row, i) => {
            if (row.type === "kpi") {
              return (
                <div key={`kpi-${i}`} style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                  {row.ids.map((id) => <div key={id}>{renderKpiCard(id)}</div>)}
                </div>
              );
            }
            if (row.type === "pair") {
              return (
                <div key={`pair-${i}`} style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
                  <div>{renderWidget(row.a)}</div>
                  <div>{renderWidget(row.b)}</div>
                </div>
              );
            }
            return <div key={`single-${i}`}>{renderWidget(row.id)}</div>;
          })}
        </div>
      )}
    </div>
  );
}
