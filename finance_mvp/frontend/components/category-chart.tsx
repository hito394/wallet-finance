"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Data = { category: string; total: string };

export default function CategoryChart({ data }: { data: Data[] }) {
  return (
    <div className="panel" style={{ padding: 16, minHeight: 320 }}>
      <h3 style={{ marginBottom: 12 }}>Category Breakdown</h3>
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
