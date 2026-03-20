"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

import StatusMessage from "@/components/status-message";
import {
  asNumber,
  updateTransaction,
  type TransactionCategoryOption,
  type TransactionItem,
} from "@/lib/api";

type Props = {
  rows: TransactionItem[];
  categories: TransactionCategoryOption[];
  entityId?: string;
};

type EditDraft = {
  category_id: string;
  notes: string;
  is_ignored: boolean;
};

export default function TransactionsTable({ rows, categories, entityId }: Props) {
  const [localRows, setLocalRows] = useState(rows);
  const [query, setQuery] = useState("");
  const [direction, setDirection] = useState<"all" | "debit" | "credit" | "transfer">("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setLocalRows(rows);
  }, [rows]);

  const categoriesById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.name]));
  }, [categories]);

  const filteredRows = useMemo(() => {
    return localRows.filter((row) => {
      if (direction !== "all" && row.direction !== direction) return false;
      if (!query.trim()) return true;
      const categoryName = row.category_id ? categoriesById.get(row.category_id) || "" : "";
      const text = `${row.merchant_normalized} ${row.description} ${row.currency} ${categoryName}`.toLowerCase();
      return text.includes(query.toLowerCase());
    });
  }, [localRows, direction, query, categoriesById]);

  const startEdit = (row: TransactionItem) => {
    setEditingId(row.id);
    setDraft({
      category_id: row.category_id || "",
      notes: row.notes || "",
      is_ignored: row.is_ignored,
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setPendingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !draft) return;
    if (!entityId) {
      setError("Entity not selected. Please select an entity and try again.");
      return;
    }

    setPendingId(editingId);
    setError(null);
    setSuccess(null);

    const result = await updateTransaction(
      editingId,
      {
        category_id: draft.category_id || null,
        notes: draft.notes.trim() ? draft.notes.trim() : null,
        is_ignored: draft.is_ignored,
      },
      entityId,
    );

    setPendingId(null);

    if (result.error || !result.data) {
      setError(result.error || "Failed to save transaction updates.");
      return;
    }

    setLocalRows((prev) => prev.map((row) => (row.id === result.data!.id ? result.data! : row)));
    setSuccess("Manual correction saved.");
    cancelEdit();
  };

  if (localRows.length === 0) {
    return <div className="empty-state">No transactions found for this entity yet.</div>;
  }

  return (
    <div className="panel">
      {success && <StatusMessage tone="success" title="Updated" detail={success} />}
      {error && <StatusMessage tone="error" title="Unable to save correction" detail={error} />}

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
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
          <option value="transfer">Transfer</option>
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
                <th>Notes</th>
                <th className="amount-col">Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const amount = asNumber(row.amount);
                const isEditing = editingId === row.id;
                const categoryName = row.category_id ? categoriesById.get(row.category_id) : null;
                return (
                  <Fragment key={row.id}>
                    <tr>
                      <td>{row.transaction_date}</td>
                      <td>{row.merchant_normalized || row.merchant_raw}</td>
                      <td>{row.description || "-"}</td>
                      <td>
                        <span className={`pill ${row.direction === "debit" ? "warn" : "success"}`}>{row.direction}</span>
                        {row.is_ignored && <span className="pill" style={{ marginLeft: 6 }}>ignored</span>}
                      </td>
                      <td>{categoryName || "Uncategorized"}</td>
                      <td>{row.notes || <span className="muted">-</span>}</td>
                      <td className="amount-col">
                        {row.currency} {amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary"
                          onClick={() => startEdit(row)}
                          disabled={pendingId === row.id || !entityId}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>

                    {isEditing && draft && (
                      <tr>
                        <td colSpan={8}>
                          <div style={{ background: "var(--soft)", border: "1px solid var(--line)", borderRadius: 10, padding: 12 }}>
                            <div className="form-grid" style={{ marginTop: 0 }}>
                              <label>
                                Category
                                <select
                                  className="input"
                                  value={draft.category_id}
                                  onChange={(event) => setDraft((prev) => prev ? { ...prev, category_id: event.target.value } : prev)}
                                >
                                  <option value="">Uncategorized</option>
                                  {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <label>
                                Notes
                                <textarea
                                  className="input"
                                  rows={3}
                                  placeholder="Reason for correction, memo, or context"
                                  value={draft.notes}
                                  onChange={(event) => setDraft((prev) => prev ? { ...prev, notes: event.target.value } : prev)}
                                />
                              </label>
                            </div>

                            <label className="label" style={{ marginTop: 10 }}>
                              <span>Options</span>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <input
                                  type="checkbox"
                                  checked={draft.is_ignored}
                                  onChange={(event) => setDraft((prev) => prev ? { ...prev, is_ignored: event.target.checked } : prev)}
                                />
                                Exclude from reports and totals
                              </span>
                            </label>

                            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                              <button
                                type="button"
                                className="btn primary"
                                onClick={saveEdit}
                                disabled={pendingId === row.id}
                              >
                                {pendingId === row.id ? "Saving..." : "Save correction"}
                              </button>
                              <button
                                type="button"
                                className="btn secondary"
                                onClick={cancelEdit}
                                disabled={pendingId === row.id}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
