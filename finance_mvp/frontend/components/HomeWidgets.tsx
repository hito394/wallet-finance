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

const STORAGE_KEY = "home_widget_config_v3";

type WidgetConfig = { order: string[]; hidden: string[] };

function loadConfig(): WidgetConfig {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw) as WidgetConfig;
      if (Array.isArray(p.order) && Array.isArray(p.hidden)) return p;
    }
  } catch { /* ignore */ }
  return { order: DEFAULT_ORDER, hidden: [] };
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
  const [config, setConfig] = useState<WidgetConfig>({ order: DEFAULT_ORDER, hidden: [] });
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

  // ── Build individual KPI card ──
  const fmt = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
  const spend  = asNumber(overview?.total_spend);
  const income = asNumber(overview?.income);
  const net    = asNumber(overview?.net);
  const subs   = overview?.detected_subscriptions.length ?? 0;
  const dupCount = (overview as any)?.duplicate_transaction_count ?? 0;

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

  // ── Render a non-KPI widget ──
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

  // ── Build widget list: group consecutive visible KPI cards into a grid row ──
  function buildWidgets(activeOrder: string[], hidden: string[]) {
    const elements: React.ReactNode[] = [];
    let kpiBuffer: string[] = [];

    function flushKpi() {
      if (kpiBuffer.length === 0) return;
      const buf = [...kpiBuffer];
      kpiBuffer = [];
      elements.push(
        <div key={`kpi-row-${buf.join("-")}`} style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {buf.map((id) => <div key={id}>{renderKpiCard(id)}</div>)}
        </div>
      );
    }

    for (const id of activeOrder) {
      const isHidden = hidden.includes(id);
      if (!editMode && isHidden) {
        // If we hit a non-KPI hidden widget, flush KPI buffer first
        if (!KPI_IDS.has(id)) flushKpi();
        continue;
      }

      if (KPI_IDS.has(id)) {
        kpiBuffer.push(id);
      } else {
        flushKpi();
        const content = renderWidget(id);
        if (content) {
          elements.push(
            <WidgetWrapper
              key={id}
              id={id}
              isHidden={isHidden}
              isDragging={draggingId === id}
              isDropTarget={overIdx === activeOrder.indexOf(id) && draggingId !== id}
              editMode={editMode}
              label={WIDGET_LABELS[id] ?? id}
              onToggleHidden={toggleHidden}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              idx={activeOrder.indexOf(id)}
            >
              {isHidden ? (
                <div style={{ minHeight: 52, border: "2px dashed #e2e8f0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc" }}>
                  {WIDGET_LABELS[id] ?? id} — hidden
                </div>
              ) : content}
            </WidgetWrapper>
          );
        }
      }
    }
    flushKpi();
    return elements;
  }

  if (!mounted) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          {["card_spend", "card_income", "card_net", "card_subs", "card_docs", "card_queue"].map(id => (
            <div key={id}>{renderKpiCard(id)}</div>
          ))}
        </div>
        {renderWidget("alerts")}
        {renderWidget("trend")}
        {renderWidget("pie")}
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
            ⠿ Drag to reorder · Eye to hide
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

      {/* ── Edit mode: show all widgets with drag handles ── */}
      {editMode ? (
        <div style={{ display: "grid", gap: 20 }}>
          {order.map((id, idx) => {
            const isHidden = config.hidden.includes(id);
            const isDragging = draggingId === id;
            const isDropTarget = overIdx === idx && draggingId !== id;
            const content = KPI_IDS.has(id) ? renderKpiCard(id) : renderWidget(id);

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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 4px", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.3px", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>⠿</span>
                    {WIDGET_LABELS[id] ?? id}
                    {KPI_IDS.has(id) && (
                      <span style={{ fontSize: 10, background: "#dbeafe", color: "#1e40af", borderRadius: 4, padding: "1px 5px", fontWeight: 700 }}>KPI</span>
                    )}
                  </span>
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
                {isHidden ? (
                  <div style={{ minHeight: 52, border: "2px dashed #e2e8f0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc" }}>
                    {WIDGET_LABELS[id] ?? id} — hidden
                  </div>
                ) : (content ?? <div style={{ color: "#94a3b8", fontSize: 13, padding: 12 }}>No content</div>)}
              </div>
            );
          })}
        </div>
      ) : (
        /* ── Normal mode: KPI cards grouped into grid rows ── */
        <div style={{ display: "grid", gap: 20 }}>
          {buildWidgets(order, config.hidden)}
        </div>
      )}
    </div>
  );
}

// Simple wrapper (only used for non-KPI widgets in normal mode — unused now but kept for type safety)
function WidgetWrapper({ children, id, isHidden, isDragging, isDropTarget, editMode, label, onToggleHidden, onDragStart, onDragOver, onDrop, onDragEnd, idx }: {
  children: React.ReactNode; id: string; isHidden: boolean; isDragging: boolean; isDropTarget: boolean;
  editMode: boolean; label: string; onToggleHidden: (id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
  onDragEnd: () => void; idx: number;
}) {
  return (
    <div
      draggable={editMode}
      onDragStart={(e) => onDragStart(e, id)}
      onDragOver={(e) => onDragOver(e, idx)}
      onDrop={(e) => onDrop(e, idx)}
      onDragEnd={onDragEnd}
      style={{
        opacity: isDragging ? 0.4 : isHidden ? 0.45 : 1,
        cursor: editMode ? "grab" : "default",
        borderRadius: 16,
        border: isDropTarget ? "2px dashed #0f766e" : "2px solid transparent",
        transition: "opacity 0.15s, border-color 0.15s",
      }}
    >
      {children}
    </div>
  );
}
