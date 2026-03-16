"use client";

import { useMemo, useState } from "react";

import type { TransactionItem } from "@/lib/api";
import { asNumber } from "@/lib/api";

type Props = {
  rows: TransactionItem[];
};

export default function TransactionsTable({ rows }: Props) {
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"all" | "inflow" | "outflow">("all");

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (direction !== "all" && row.direction !== direction) return false;
      if (!query.trim()) return true;
      const text = `${row.merchant_normalized} ${row.description} ${row.currency}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
  }, [rows, direction, query]);

  if (rows.length === 0) {
    return <div className="empty-state">No transactions found for this entity yet.</div>;
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <input
          className="input"
          type="search"
          placeholder="Search merchant or description"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="input" value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}>
          <option value="all">All directions</option>
          <option value="outflow">Outflow</option>
          <option value="inflow">Inflow</option>
        </select>
      </div>

      {filteredRows.length === 0 ? (
        <div className="empty-state">No rows match your current filters.</div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Description</th>
                <th>Direction</th>
                <th>Category</th>
                <th className="amount-col">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const amount = asNumber(row.amount);
                return (
                  <tr key={row.id}>
                    <td>{row.transaction_date}</td>
                    <td>{row.merchant_normalized || row.merchant_raw}</td>
                    <td>{row.description || "-"}</td>
                    <td>
                      <span className={`pill ${row.direction === "outflow" ? "warn" : "success"}`}>{row.direction}</span>
                    </td>
                    <td>{row.category_id ? row.category_id.slice(0, 8) : "Uncategorized"}</td>
                    <td className="amount-col">
                      {row.currency} {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
