"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Item = { month: string; spend: string; income: string };

type Props = {
  data: Item[];
};

function shortMonth(m: string) {
  // "2026-02" → "Feb"
  const [yr, mo] = m.split("-");
  const d = new Date(Number(yr), Number(mo) - 1, 1);
  return d.toLocaleString("en", { month: "short" }) + " " + yr.slice(2);
}

function fmt(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

export default function MonthlyBarChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="panel chart-panel" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Monthly Spending</h3>
        <div className="empty-state">Not enough history yet. Upload statements to populate this chart.</div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: shortMonth(d.month),
    Spend: Number(d.spend),
    Income: Number(d.income),
  }));

  return (
    <div className="panel chart-panel" style={{ padding: 20 }}>
      <h3 style={{ marginBottom: 16 }}>Monthly Spend vs Income</h3>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8eef3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#5f7284" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#5f7284" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(v: number, name: string) => [fmt(v), name]}
            contentStyle={{ borderRadius: 10, border: "1px solid #d4dee6", fontSize: 13 }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="Spend" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={36} />
          <Bar dataKey="Income" fill="#22c55e" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
