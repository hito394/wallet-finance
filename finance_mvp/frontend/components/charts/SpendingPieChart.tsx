"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const PALETTE = [
  "#0f766e", "#22c55e", "#3b82f6", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

type Slice = { category: string; total: string };

type Props = {
  data: Slice[];
};

function fmt(v: number) {
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

export default function SpendingPieChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="panel chart-panel" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Spending Breakdown</h3>
        <div className="empty-state">No spending data for this period.</div>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + Number(d.total), 0);
  const slices = data.map((d) => ({ name: d.category, value: Number(d.total) }));

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.04) return null;
    const RADIAN = Math.PI / 180;
    const r = innerRadius + (outerRadius - innerRadius) * 0.55;
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="panel chart-panel" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h3>Spending Breakdown</h3>
        <span style={{ color: "#5f7284", fontSize: 13 }}>Total: {fmt(total)}</span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            labelLine={false}
            label={renderLabel}
          >
            {slices.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Legend
            formatter={(value) => <span style={{ fontSize: 12, color: "#10212f" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Category table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 }}>
        <thead>
          <tr>
            {["Category", "Amount", "%", ""].map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "6px 8px", color: "#5f7284", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.4px", borderBottom: "1px solid #d4dee6" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slices.map((s, i) => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <tr key={s.name}>
                <td style={{ padding: "7px 8px", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: PALETTE[i % PALETTE.length], display: "inline-block", flexShrink: 0 }} />
                  {s.name}
                </td>
                <td style={{ padding: "7px 8px", textAlign: "right" }}>{fmt(s.value)}</td>
                <td style={{ padding: "7px 8px", textAlign: "right", color: "#5f7284" }}>{pct.toFixed(1)}%</td>
                <td style={{ padding: "7px 8px", width: 80 }}>
                  <div style={{ height: 6, borderRadius: 4, background: "#eef3f6", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: PALETTE[i % PALETTE.length], borderRadius: 4 }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
