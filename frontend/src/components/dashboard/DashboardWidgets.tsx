'use client';

import { useState, useEffect, useRef } from 'react';
import { Settings2, X, GripVertical, Eye, EyeOff } from 'lucide-react';
import { SummaryCard } from './SummaryCard';
import { SpendingChart } from './SpendingChart';
import { CategoryPieChart } from './CategoryPieChart';
import { RecentTransactions } from './RecentTransactions';
import { AlertTriangle, FileSearch, Copy } from 'lucide-react';
import type { DashboardSummary, Transaction } from '@/types';

type WidgetId = 'kpi' | 'trend' | 'category' | 'transactions';

type WidgetConfig = {
  id: WidgetId;
  label: string;
  visible: boolean;
};

const DEFAULT_CONFIG: WidgetConfig[] = [
  { id: 'kpi',          label: 'サマリーカード',   visible: true },
  { id: 'trend',        label: '月次トレンド',     visible: true },
  { id: 'category',     label: 'カテゴリ別支出',   visible: true },
  { id: 'transactions', label: '直近の取引',       visible: true },
];

const STORAGE_KEY = 'dashboard_widget_config_v1';

function loadConfig(): WidgetConfig[] {
  try {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: WidgetConfig[] = JSON.parse(raw);
      return DEFAULT_CONFIG.map(def => {
        const saved = parsed.find(p => p.id === def.id);
        return saved ? { ...def, visible: saved.visible } : def;
      }).sort((a, b) => {
        const ai = parsed.findIndex(p => p.id === a.id);
        const bi = parsed.findIndex(p => p.id === b.id);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
  } catch {}
  return DEFAULT_CONFIG;
}

function saveConfig(config: WidgetConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {}
}

// ─── Widget edit panel ───────────────────────────────────────────────────────

function EditPanel({
  config,
  onClose,
  onChange,
}: {
  config: WidgetConfig[];
  onClose: () => void;
  onChange: (cfg: WidgetConfig[]) => void;
}) {
  const dragIdx = useRef<number | null>(null);
  const [local, setLocal] = useState(config);

  function toggle(id: WidgetId) {
    const next = local.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setLocal(next);
    onChange(next);
  }

  function onDragStart(idx: number) {
    dragIdx.current = idx;
  }

  function onDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const next = [...local];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    setLocal(next);
    onChange(next);
  }

  function onDragEnd() {
    dragIdx.current = null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl md:rounded-2xl p-6"
        style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar (mobile) */}
        <div className="flex justify-center mb-4 md:hidden">
          <div className="w-10 h-1 rounded-full" style={{ backgroundColor: '#2A2D42' }} />
        </div>

        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#F1F5F9' }}>ウィジェットを編集</h2>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>長押し・ドラッグで並び替え</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: '#1E2030', color: '#64748B' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-2">
          {local.map((widget, idx) => (
            <div
              key={widget.id}
              draggable
              onDragStart={() => onDragStart(idx)}
              onDragOver={e => onDragOver(e, idx)}
              onDragEnd={onDragEnd}
              className="flex items-center gap-3 px-3 py-3 rounded-xl cursor-grab active:cursor-grabbing select-none transition-all"
              style={{
                backgroundColor: '#0E0F1A',
                border: '1px solid #1E2030',
                opacity: widget.visible ? 1 : 0.5,
              }}
            >
              <GripVertical size={16} style={{ color: '#334155', flexShrink: 0 }} />
              <span className="flex-1 text-sm font-medium" style={{ color: '#CBD5E1' }}>
                {widget.label}
              </span>
              <button
                onClick={() => toggle(widget.id)}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                style={{
                  backgroundColor: widget.visible ? '#1E2246' : '#1A1C2E',
                  color: widget.visible ? '#7C6FFF' : '#475569',
                }}
              >
                {widget.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-3 rounded-xl text-sm font-semibold transition-colors"
          style={{ backgroundColor: '#7C6FFF', color: '#fff' }}
        >
          完了
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  dashboard: DashboardSummary;
  transactions: Transaction[];
}

export function DashboardWidgets({ dashboard, transactions }: Props) {
  const [config, setConfig] = useState<WidgetConfig[]>(DEFAULT_CONFIG);
  const [editOpen, setEditOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
    setMounted(true);
  }, []);

  function handleChange(next: WidgetConfig[]) {
    setConfig(next);
    saveConfig(next);
  }

  const expense = Math.round(parseFloat(dashboard.month_total_expense));
  const income  = Math.round(parseFloat(dashboard.month_total_income));
  const net     = Math.round(parseFloat(dashboard.month_net));

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'kpi':
        return (
          <div key="kpi" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard title="今月の支出" value={`¥${expense.toLocaleString()}`} sub={`${dashboard.month_transaction_count}件`} icon="💸" color="red" />
            <SummaryCard title="今月の収入" value={`¥${income.toLocaleString()}`} icon="💰" color="green" />
            <SummaryCard title="収支" value={`${net >= 0 ? '+' : ''}¥${net.toLocaleString()}`} icon={net >= 0 ? '📈' : '📉'} color={net >= 0 ? 'green' : 'red'} />
            <SummaryCard title="インポート回数" value={`${dashboard.total_import_count}回`} icon="📂" color="purple" />
          </div>
        );

      case 'trend':
        return (
          <div key="trend" className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="rounded-2xl p-5 lg:col-span-3" style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>月次収支トレンド</h3>
                <span className="text-xs" style={{ color: '#475569' }}>直近12ヶ月</span>
              </div>
              <SpendingChart data={dashboard.monthly_trends} />
            </div>
            {config.find(w => w.id === 'category')?.visible ? null : (
              <div className="hidden lg:block lg:col-span-2" />
            )}
          </div>
        );

      case 'category':
        return (
          <div key="category" className="rounded-2xl p-5" style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>カテゴリ別支出</h3>
              <span className="text-xs" style={{ color: '#475569' }}>今月</span>
            </div>
            {dashboard.category_breakdown.length > 0 ? (
              <CategoryPieChart data={dashboard.category_breakdown} />
            ) : (
              <p className="text-sm text-center py-12" style={{ color: '#475569' }}>データなし</p>
            )}
          </div>
        );

      case 'transactions':
        return (
          <div key="transactions" className="rounded-2xl p-5" style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}>
            <h3 className="text-sm font-semibold mb-4" style={{ color: '#CBD5E1' }}>直近の取引</h3>
            <RecentTransactions transactions={transactions} />
          </div>
        );

      default:
        return null;
    }
  }

  // Handle trend+category side-by-side layout specially
  const visibleIds = config.filter(w => w.visible).map(w => w.id);
  const trendVisible = visibleIds.includes('trend');
  const categoryVisible = visibleIds.includes('category');

  return (
    <>
      {/* Alerts */}
      {(dashboard.uncategorized_count > 0 || dashboard.possible_duplicate_count > 0 || dashboard.unmatched_receipt_count > 0) && (
        <div className="flex flex-wrap gap-2">
          {dashboard.uncategorized_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#2D2006', color: '#FCD34D', border: '1px solid #78350F' }}>
              <AlertTriangle size={12} />未分類 {dashboard.uncategorized_count}件
            </div>
          )}
          {dashboard.possible_duplicate_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#2D1A06', color: '#FDBA74', border: '1px solid #7C2D12' }}>
              <Copy size={12} />重複候補 {dashboard.possible_duplicate_count}件
            </div>
          )}
          {dashboard.unmatched_receipt_count > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#1A0D2E', color: '#C4B5FD', border: '1px solid #581C87' }}>
              <FileSearch size={12} />未マッチレシート {dashboard.unmatched_receipt_count}件
            </div>
          )}
        </div>
      )}

      {/* Widget edit button */}
      <div className="flex justify-end">
        <button
          onClick={() => setEditOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
          style={{ backgroundColor: '#1A1C2E', color: '#64748B', border: '1px solid #1E2030' }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#CBD5E1';
            (e.currentTarget as HTMLElement).style.backgroundColor = '#161829';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = '#64748B';
            (e.currentTarget as HTMLElement).style.backgroundColor = '#1A1C2E';
          }}
        >
          <Settings2 size={13} />
          ウィジェットを編集
        </button>
      </div>

      {/* Widgets */}
      {mounted ? (
        <div className="space-y-5">
          {config.map(w => {
            if (!w.visible) return null;
            // Render trend and category side-by-side
            if (w.id === 'trend' && categoryVisible) {
              const catIdx = config.findIndex(c => c.id === 'category');
              const trendIdx = config.findIndex(c => c.id === 'trend');
              // Only render the combined block when we encounter trend
              return (
                <div key="trend-category" className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                  <div className="rounded-2xl p-5 lg:col-span-3" style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>月次収支トレンド</h3>
                      <span className="text-xs" style={{ color: '#475569' }}>直近12ヶ月</span>
                    </div>
                    <SpendingChart data={dashboard.monthly_trends} />
                  </div>
                  <div className="rounded-2xl p-5 lg:col-span-2" style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}>
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-sm font-semibold" style={{ color: '#CBD5E1' }}>カテゴリ別支出</h3>
                      <span className="text-xs" style={{ color: '#475569' }}>今月</span>
                    </div>
                    {dashboard.category_breakdown.length > 0 ? (
                      <CategoryPieChart data={dashboard.category_breakdown} />
                    ) : (
                      <p className="text-sm text-center py-12" style={{ color: '#475569' }}>データなし</p>
                    )}
                  </div>
                </div>
              );
            }
            // Skip category if trend is also visible (already rendered above)
            if (w.id === 'category' && trendVisible) return null;
            return renderWidget(w.id);
          })}
        </div>
      ) : (
        // SSR fallback - render all widgets
        <div className="space-y-5">
          {DEFAULT_CONFIG.map(w => renderWidget(w.id))}
        </div>
      )}

      {/* Edit panel */}
      {editOpen && (
        <EditPanel
          config={config}
          onClose={() => setEditOpen(false)}
          onChange={handleChange}
        />
      )}
    </>
  );
}
