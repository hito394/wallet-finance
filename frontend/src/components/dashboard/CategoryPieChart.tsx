'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategorySummary } from '@/types';

interface Props {
  data: CategorySummary[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        backgroundColor: '#1A1C2E',
        border: '1px solid #2A2D42',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        color: '#CBD5E1',
      }}
    >
      <p className="font-semibold">{d.icon} {d.category_ja}</p>
      <p className="tabular-nums mt-0.5" style={{ color: d.color }}>
        ¥{Math.round(parseFloat(d.total_amount)).toLocaleString()}
        <span style={{ color: '#64748B' }}> ({d.percentage.toFixed(1)}%)</span>
      </p>
    </div>
  );
};

export function CategoryPieChart({ data }: Props) {
  const top = data.slice(0, 8);

  return (
    <div className="space-y-4">
      {/* Donut chart */}
      <div className="flex justify-center">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={top}
              dataKey="percentage"
              nameKey="category_ja"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={2}
              strokeWidth={0}
            >
              {top.map((entry) => (
                <Cell key={entry.category} fill={entry.color ?? '#2A2D42'} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend list */}
      <ul className="space-y-2">
        {top.map((cat) => {
          const pct = cat.percentage;
          return (
            <li key={cat.category} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5" style={{ color: '#94A3B8' }}>
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ background: cat.color ?? '#2A2D42' }}
                  />
                  {cat.icon} {cat.category_ja}
                </span>
                <span className="tabular-nums font-medium" style={{ color: '#CBD5E1' }}>
                  ¥{Math.round(parseFloat(cat.total_amount)).toLocaleString()}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-0.5 rounded-full overflow-hidden" style={{ backgroundColor: '#1E2030' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: cat.color ?? '#2A2D42' }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
