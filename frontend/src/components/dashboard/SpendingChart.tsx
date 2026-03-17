'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-4 py-3 text-sm"
      style={{
        backgroundColor: '#1A1C2E',
        border: '1px solid #2A2D42',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <p className="font-semibold mb-2" style={{ color: '#CBD5E1' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="tabular-nums" style={{ color: p.color }}>
          {p.name}：¥{Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
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
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <defs>
          <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#F87171" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#F87171" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#4ADE80" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#4ADE80" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#1E2030"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#475569' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v.toLocaleString()}`
          }
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 12, color: '#64748B', paddingTop: 8 }}
        />
        <Area
          type="monotone"
          dataKey="支出"
          stroke="#F87171"
          strokeWidth={2}
          fill="url(#gradExpense)"
          dot={false}
          activeDot={{ r: 4, fill: '#F87171', strokeWidth: 0 }}
        />
        <Area
          type="monotone"
          dataKey="収入"
          stroke="#4ADE80"
          strokeWidth={2}
          fill="url(#gradIncome)"
          dot={false}
          activeDot={{ r: 4, fill: '#4ADE80', strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
