'use client';

import { useState, useMemo } from 'react';
import useSWR from 'swr';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getTransactionsForCalendar,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatAmount,
} from '@/lib/api';
import type { Transaction } from '@/types';

interface Props {
  initialMonth: string; // "YYYY-MM"
}

export function SpendingCalendar({ initialMonth }: Props) {
  const [ym, setYm] = useState(() => {
    const [y, m] = initialMonth.split('-').map(Number);
    return { year: y, month: m };
  });
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const { data: transactions = [], isLoading } = useSWR(
    `cal-${ym.year}-${ym.month}`,
    () => getTransactionsForCalendar(ym.year, ym.month),
    { revalidateOnFocus: false }
  );

  // Group by day (skip ignored)
  const dayMap = useMemo(() => {
    const map: Record<number, Transaction[]> = {};
    for (const tx of transactions) {
      if (tx.is_ignored) continue;
      // Append T00:00:00 to avoid UTC offset shifting the date
      const d = new Date(tx.transaction_date + 'T00:00:00').getDate();
      (map[d] ??= []).push(tx);
    }
    return map;
  }, [transactions]);

  const daysInMonth = new Date(ym.year, ym.month, 0).getDate();
  const firstDow = new Date(ym.year, ym.month - 1, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setYm(({ year, month }) =>
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
    );
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setYm(({ year, month }) =>
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
    );
    setSelectedDay(null);
  };

  // Build grid cells: null = blank, number = day
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const selectedTxs = selectedDay != null ? (dayMap[selectedDay] ?? []) : [];
  const today = new Date();

  // Monthly total for header
  const monthlyExpense = transactions
    .filter(t => !t.is_ignored && t.direction === 'debit')
    .reduce((s, t) => s + parseFloat(t.amount), 0);

  return (
    <div>
      {/* Month navigation + summary */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg"
          style={{ color: '#7C6FFF', backgroundColor: '#1A1C2E' }}
        >
          <ChevronLeft size={15} />
        </button>

        <div className="text-center">
          <p className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
            {ym.year}年{ym.month}月
          </p>
          {monthlyExpense > 0 && (
            <p className="text-xs mt-0.5" style={{ color: '#F87171' }}>
              支出合計 ¥{Math.round(monthlyExpense).toLocaleString()}
            </p>
          )}
        </div>

        <button
          onClick={nextMonth}
          className="p-2 rounded-lg"
          style={{ color: '#7C6FFF', backgroundColor: '#1A1C2E' }}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1">
        {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
          <div
            key={d}
            className="text-center text-[11px] py-1 font-medium"
            style={{
              color: i === 0 ? '#F87171' : i === 6 ? '#7C6FFF' : '#475569',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="aspect-square" />;

          const txs = dayMap[day] ?? [];
          const debits = txs.filter(t => t.direction === 'debit');
          const total = debits.reduce((s, t) => s + parseFloat(t.amount), 0);

          // Top 3 spending categories by amount
          const catTotals: Record<string, number> = {};
          for (const t of debits) {
            const cat = t.category ?? 'other';
            catTotals[cat] = (catTotals[cat] ?? 0) + parseFloat(t.amount);
          }
          const topCats = Object.entries(catTotals)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([cat]) => cat);

          const isSelected = day === selectedDay;
          const isToday =
            today.getFullYear() === ym.year &&
            today.getMonth() + 1 === ym.month &&
            today.getDate() === day;

          return (
            <button
              key={i}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className="aspect-square rounded-lg p-1 flex flex-col items-start text-left overflow-hidden transition-all"
              style={{
                backgroundColor: isSelected
                  ? '#2A2D56'
                  : txs.length > 0
                  ? '#1A1C2E'
                  : 'transparent',
                border: isSelected
                  ? '1px solid #7C6FFF'
                  : isToday
                  ? '1px solid #3D4270'
                  : '1px solid transparent',
                cursor: txs.length > 0 || isSelected ? 'pointer' : 'default',
              }}
            >
              <span
                className="text-[10px] font-medium leading-none"
                style={{ color: isToday ? '#7C6FFF' : '#94A3B8' }}
              >
                {day}
              </span>
              {total > 0 && (
                <span
                  className="text-[8px] leading-tight mt-0.5 font-semibold truncate w-full"
                  style={{ color: '#F87171' }}
                >
                  ¥{Math.round(total).toLocaleString()}
                </span>
              )}
              {topCats.length > 0 && (
                <div className="flex gap-0.5 mt-auto pt-0.5">
                  {topCats.map(cat => (
                    <div
                      key={cat}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: CATEGORY_COLORS[cat] ?? '#64748B',
                      }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <p className="text-center text-xs py-4" style={{ color: '#475569' }}>
          読み込み中...
        </p>
      )}

      {/* Selected day detail */}
      {selectedDay != null && (
        <div
          className="mt-4 rounded-xl p-4"
          style={{ backgroundColor: '#13151F', border: '1px solid #1E2030' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: '#F1F5F9' }}>
              {ym.month}月{selectedDay}日の取引
            </h3>
            <span className="text-xs" style={{ color: '#475569' }}>
              {selectedTxs.length}件
            </span>
          </div>

          {selectedTxs.length === 0 ? (
            <p className="text-sm" style={{ color: '#475569' }}>
              取引なし
            </p>
          ) : (
            <>
              <div className="space-y-2">
                {selectedTxs.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          CATEGORY_COLORS[tx.category ?? 'other'] ?? '#64748B',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: '#CBD5E1' }}
                      >
                        {tx.merchant_normalized ?? tx.merchant_raw}
                      </p>
                      {tx.category && (
                        <p
                          className="text-[10px]"
                          style={{ color: '#475569' }}
                        >
                          {CATEGORY_LABELS[tx.category] ?? tx.category}
                        </p>
                      )}
                    </div>
                    <span
                      className="text-xs font-semibold flex-shrink-0"
                      style={{
                        color:
                          tx.direction === 'credit' ? '#4ADE80' : '#F87171',
                      }}
                    >
                      {formatAmount(tx.amount, tx.direction)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Daily totals */}
              <div
                className="mt-3 pt-3 flex items-center justify-between"
                style={{ borderTop: '1px solid #1E2030' }}
              >
                <span className="text-xs" style={{ color: '#475569' }}>
                  支出合計
                </span>
                <span
                  className="text-sm font-bold"
                  style={{ color: '#F87171' }}
                >
                  ¥
                  {Math.round(
                    selectedTxs
                      .filter(t => t.direction === 'debit')
                      .reduce((s, t) => s + parseFloat(t.amount), 0)
                  ).toLocaleString()}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
