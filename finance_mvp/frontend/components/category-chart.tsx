"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Data = { category: string; total: string };

export default function CategoryChart({ data }: { data: Data[] }) {
  if (!data.length) {
    return (
      <div className="panel chart-panel">
        <h3>Category Breakdown</h3>
        <div className="empty-state">No category data available for this period.</div>
      </div>
    );
  }

  return (
    <div className="panel chart-panel">
      <h3>Category Breakdown</h3>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data}>
          <XAxis dataKey="category" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="total" fill="#0f766e" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
