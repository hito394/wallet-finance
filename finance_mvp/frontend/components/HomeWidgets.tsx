"use client";

import { useState, useEffect, useRef } from "react";
import SummaryCards from "@/components/dashboard/SummaryCards";
import MonthlyTrendChart from "@/components/charts/MonthlyTrendChart";
import SpendingPieChart from "@/components/charts/SpendingPieChart";
import RecentTransactionsList from "@/components/dashboard/RecentTransactionsList";
import type { MonthlyOverview, MonthlyHistoryItem, TransactionItem } from "@/lib/api";

const STORAGE_KEY = "home_widget_config_v1";

const DEFAULT_ORDER = ["kpi", "trend", "pie", "alerts", "recent"];

const WIDGET_LABELS: Record<string, string> = {
  kpi: "KPI Cards",
  trend: "Monthly Trend",
  pie: "Spending Breakdown",
  alerts: "Alerts",
  recent: "Recent Transactions",
};

type WidgetConfig = {
  order: string[];
  hidden: string[];
};

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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetConfig;
      if (Array.isArray(parsed.order) && Array.isArray(parsed.hidden)) return parsed;
    }
  } catch {}
  return { order: DEFAULT_ORDER, hidden: [] };
}

function saveConfig(cfg: WidgetConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
}

export default function HomeWidgets({
  overview,
  transactions,
  history,
  selectedMonth,
  entityId,
  docsRequiringReview,
  openReviewQueue,
  alerts,
}: Props) {
  const [config, setConfig] = useState<WidgetConfig>({ order: DEFAULT_ORDER, hidden: [] });
  const [editMode, setEditMode] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragItem = useRef<string | null>(null);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const updateConfig = (next: WidgetConfig) => {
    setConfig(next);
    saveConfig(next);
  };

  const toggleHidden = (id: string) => {
    const hidden = config.hidden.includes(id)
      ? config.hidden.filter((h) => h !== id)
      : [...config.hidden, id];
    updateConfig({ ...config, hidden });
  };

  const onDragStart = (id: string) => {
    dragItem.current = id;
  };

  const onDragEnter = (id: string) => {
    setDragOverId(id);
  };

  const onDragEnd = () => {
    const from = dragItem.current;
    const to = dragOverId;
    dragItem.current = null;
    setDragOverId(null);
    if (!from || !to || from === to) return;
    const order = [...config.order];
    const fromIdx = order.indexOf(from);
    const toIdx = order.indexOf(to);
    if (fromIdx === -1 || toIdx === -1) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, from);
    updateConfig({ ...config, order });
  };

  const renderWidget = (id: string) => {
    switch (id) {
      case "kpi":
        return (
          <SummaryCards
            overview={overview}
            docsRequiringReview={docsRequiringReview}
            openReviewQueue={openReviewQueue}
          />
        );
      case "trend":
        return <MonthlyTrendChart data={history} selectedMonth={selectedMonth} />;
      case "pie":
        return <SpendingPieChart data={overview?.category_breakdown ?? []} />;
      case "alerts":
        if (alerts.length === 0 && !editMode) return null;
        return (
          <div className="panel" style={{ padding: "14px 20px" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>Alerts</h3>
            {alerts.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>No alerts this month.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
                {alerts.map((alert) => (
                  <li key={alert} style={{ color: "#92400e", fontSize: 14 }}>
                    {alert}
                  </li>
                ))}
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

  // Merge stored order with DEFAULT_ORDER to handle newly added widgets
  const order = [
    ...config.order.filter((id) => DEFAULT_ORDER.includes(id)),
    ...DEFAULT_ORDER.filter((id) => !config.order.includes(id)),
  ];

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Customize toggle */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setEditMode((v) => !v)}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: editMode ? "var(--accent)" : "none",
            color: editMode ? "#fff" : "var(--muted)",
            cursor: "pointer",
            font: "inherit",
          }}
        >
          {editMode ? "Done" : "Customize"}
        </button>
      </div>

      {editMode && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            background: "#fffbeb",
            border: "1px solid #fde68a",
            fontSize: 13,
            color: "#92400e",
          }}
        >
          Drag widgets to reorder. Toggle the eye icon to show or hide.
        </div>
      )}

      {order.map((id) => {
        const isHidden = config.hidden.includes(id);
        if (!editMode && isHidden) return null;

        const content = renderWidget(id);
        // Skip widgets with no content outside edit mode
        if (!editMode && !content) return null;

        const isDragTarget = dragOverId === id && dragItem.current !== id;

        return (
          <div
            key={id}
            draggable={editMode}
            onDragStart={() => onDragStart(id)}
            onDragEnter={() => onDragEnter(id)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()}
            style={{
              opacity: isHidden ? 0.45 : 1,
              cursor: editMode ? "grab" : "default",
              outline: isDragTarget ? "2px dashed var(--accent)" : "none",
              outlineOffset: 4,
              borderRadius: 12,
              transition: "opacity 0.15s",
            }}
          >
            {editMode && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  padding: "0 4px",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--muted)",
                    letterSpacing: "0.4px",
                    userSelect: "none",
                  }}
                >
                  ⠿ {WIDGET_LABELS[id] ?? id}
                </span>
                <button
                  onClick={() => toggleHidden(id)}
                  title={isHidden ? "Show widget" : "Hide widget"}
                  style={{
                    padding: "3px 8px",
                    fontSize: 14,
                    border: "1px solid var(--line)",
                    borderRadius: 6,
                    background: "var(--soft)",
                    cursor: "pointer",
                    lineHeight: 1,
                    font: "inherit",
                  }}
                >
                  {isHidden ? "Show" : "Hide"}
                </button>
              </div>
            )}

            {isHidden ? (
              <div
                style={{
                  minHeight: 56,
                  border: "2px dashed var(--line)",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                {WIDGET_LABELS[id] ?? id} (hidden)
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
