"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import SummaryCards from "@/components/dashboard/SummaryCards";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import SpendingPieChart from "@/components/charts/SpendingPieChart";
import RecentTransactionsList from "@/components/dashboard/RecentTransactionsList";
import type { MonthlyOverview, MonthlyHistoryItem, TransactionItem } from "@/lib/api";

const STORAGE_KEY = "home_widget_config_v2";
const DEFAULT_ORDER = ["kpi", "trend", "pie", "alerts", "recent"];
const WIDGET_LABELS: Record<string, string> = {
  kpi: "KPI Cards",
  trend: "Monthly Trend",
  pie: "Spending Breakdown",
  alerts: "Alerts",
  recent: "Recent Transactions",
};

type WidgetConfig = { order: string[]; hidden: string[] };

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

export default function HomeWidgets({ overview, transactions, history, selectedMonth, entityId, docsRequiringReview, openReviewQueue, alerts }: Props) {
  const [mounted, setMounted] = useState(false);
  const [config, setConfig] = useState<WidgetConfig>({ order: DEFAULT_ORDER, hidden: [] });
  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const dragItemId = useRef<string | null>(null);

  // Load from localStorage only on client to prevent hydration mismatch
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

  const renderWidget = (id: string) => {
    switch (id) {
      case "kpi":
        return <SummaryCards overview={overview} docsRequiringReview={docsRequiringReview} openReviewQueue={openReviewQueue} />;
      case "trend":
        return <MonthlyTrendChart data={history} selectedMonth={selectedMonth} />;
      case "pie":
        return <SpendingPieChart data={overview?.category_breakdown ?? []} />;
      case "alerts":
        if (alerts.length === 0 && !editMode) return null;
        return (
          <div className="panel" style={{ padding: "16px 20px" }}>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 700 }}>Alerts</h3>
            {alerts.length === 0 ? (
              <p style={{ color: "#94a3b8", fontSize: 14 }}>No alerts this month.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                {alerts.map((a) => <li key={a} style={{ color: "#92400e", fontSize: 14 }}>{a}</li>)}
              </ul>
            )}
          </div>
        );
      case "recent":
        return <RecentTransactionsList rows={transactions} entityId={entityId} />;
      default:
        return null;
    }
  };

  // Before client hydration, render widgets with default order (no edit controls)
  if (!mounted) {
    return (
      <div style={{ display: "grid", gap: 20 }}>
        {DEFAULT_ORDER.map((id) => {
          const c = renderWidget(id);
          return c ? <div key={id}>{c}</div> : null;
        })}
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
            padding: "7px 16px",
            fontSize: 13,
            fontWeight: 700,
            border: editMode ? "none" : "1px solid #e2e8f0",
            borderRadius: 10,
            background: editMode ? "linear-gradient(135deg,#0f766e,#0891b2)" : "#fff",
            color: editMode ? "#fff" : "#475569",
            cursor: "pointer",
            font: "inherit",
            boxShadow: editMode ? "0 2px 10px rgba(15,118,110,0.3)" : "none",
          }}
        >
          {editMode ? "✓ Done" : "⚙ Customize"}
        </button>
      </div>

      {/* ── Widgets ── */}
      {order.map((id, idx) => {
        const isHidden = config.hidden.includes(id);
        if (!editMode && isHidden) return null;

        const content = renderWidget(id);
        if (!editMode && !content) return null;

        const isDragging = draggingId === id;
        const isDropTarget = overIdx === idx && draggingId !== id;

        return (
          <div
            key={id}
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
            {/* Edit mode toolbar */}
            {editMode && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px 4px", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#64748b", letterSpacing: "0.3px", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>⠿</span>
                  {WIDGET_LABELS[id] ?? id}
                </span>
                <button
                  onClick={() => toggleHidden(id)}
                  style={{
                    padding: "4px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    background: isHidden ? "#fef2f2" : "#f0fdf4",
                    color: isHidden ? "#dc2626" : "#16a34a",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  {isHidden ? "Show" : "Hide"}
                </button>
              </div>
            )}

            {/* Widget body or placeholder */}
            {isHidden ? (
              <div style={{ minHeight: 52, border: "2px dashed #e2e8f0", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, background: "#f8fafc" }}>
                {WIDGET_LABELS[id] ?? id} — hidden
              </div>
            ) : (
              content
            )}
          </div>
        );
      })}
    </div>
  );
}
