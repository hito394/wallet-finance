'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { CategorySummary } from '@/types';

interface Props {
  data: CategorySummary[];
}

export function CategoryPieChart({ data }: Props) {
  const top = data.slice(0, 8); // 上位8カテゴリを表示

  return (
    <div className="flex gap-6 items-center">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie
            data={top}
            dataKey="percentage"
            nameKey="category_ja"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {top.map((entry) => (
              <Cell key={entry.category} fill={entry.color ?? '#DFE6E9'} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value.toFixed(1)}%`, name]}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 凡例 */}
      <ul className="flex-1 space-y-1.5">
        {top.map((cat) => (
          <li key={cat.category} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-gray-600 truncate">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: cat.color ?? '#DFE6E9' }}
              />
              {cat.icon} {cat.category_ja}
            </span>
            <span className="text-gray-800 font-medium tabular-nums shrink-0">
              ¥{Math.round(parseFloat(cat.total_amount)).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
