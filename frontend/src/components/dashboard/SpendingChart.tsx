'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { MonthlyTrend } from '@/types';

interface Props {
  data: MonthlyTrend[];
}

const MONTH_LABELS: Record<string, string> = {
  '01': '1月', '02': '2月', '03': '3月', '04': '4月',
  '05': '5月', '06': '6月', '07': '7月', '08': '8月',
  '09': '9月', '10': '10月', '11': '11月', '12': '12月',
};

export function SpendingChart({ data }: Props) {
  const chartData = data.map((d) => {
    const [, month] = d.month.split('-');
    return {
      name: MONTH_LABELS[month] ?? month,
      支出: Math.round(parseFloat(d.total_expense)),
      収入: Math.round(parseFloat(d.total_income)),
    };
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v.toLocaleString()}`
          }
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `¥${value.toLocaleString()}`,
            name,
          ]}
          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
        />
        <Legend iconType="circle" iconSize={8} />
        <Bar dataKey="支出" fill="#FF6B6B" radius={[6, 6, 0, 0]} maxBarSize={32} />
        <Bar dataKey="収入" fill="#4ECDC4" radius={[6, 6, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}
