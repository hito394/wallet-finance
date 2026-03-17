"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Item = { month: string; spend: string; income: string };

type Props = {
  data: Item[];
  selectedMonth?: string; // "YYYY-MM"
};

function shortLabel(m: string) {
  const [yr, mo] = m.split("-");
  const d = new Date(Number(yr), Number(mo) - 1, 1);
  return d.toLocaleString("en", { month: "short" }) + " '" + yr.slice(2);
}

function fmt(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

export default function MonthlyTrendChart({ data, selectedMonth }: Props) {
  if (!data.length) {
    return (
      <div className="panel chart-panel" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>12-Month Trend</h3>
        <div className="empty-state">
          Upload bank statements to populate the spending trend chart.
        </div>
      </div>
    );
  }

  const chartData = data.map((d) => ({
    label: shortLabel(d.month),
    rawMonth: d.month,
    Spend: Number(d.spend),
    Income: Number(d.income),
  }));

  const selectedLabel = selectedMonth
    ? chartData.find((d) => d.rawMonth === selectedMonth)?.label
    : undefined;

  const maxVal = Math.max(...chartData.flatMap((d) => [d.Spend, d.Income]), 0);

  return (
    <div className="panel chart-panel" style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <h3 style={{ margin: 0 }}>Monthly Trend</h3>
        {selectedMonth && (
          <span
            style={{
              fontSize: 12,
              color: "#0f766e",
              fontWeight: 600,
              background: "#f0fdf9",
              border: "1px solid #99f6e4",
              borderRadius: 20,
              padding: "3px 10px",
            }}
          >
            Viewing: {shortLabel(selectedMonth)}
          </span>
        )}
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.18} />
              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#e8eef3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#5f7284" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#5f7284" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              maxVal >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
            }
            width={48}
          />
          <Tooltip
            formatter={(v: number, name: string) => [fmt(v), name]}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #d4dee6",
              fontSize: 13,
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />

          {selectedLabel && (
            <ReferenceLine
              x={selectedLabel}
              stroke="#0f766e"
              strokeWidth={2}
              strokeDasharray="5 3"
              label={{
                value: "▼",
                position: "top",
                fontSize: 12,
                fill: "#0f766e",
                offset: 2,
              }}
            />
          )}

          <Area
            type="monotone"
            dataKey="Income"
            stroke="#22c55e"
            strokeWidth={2.5}
            fill="url(#incomeGrad)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="Spend"
            stroke="#ef4444"
            strokeWidth={2.5}
            fill="url(#spendGrad)"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
