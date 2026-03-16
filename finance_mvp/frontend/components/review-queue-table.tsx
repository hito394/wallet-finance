"use client";

import { useState } from "react";

import { resolveReviewQueueItem, type ReviewQueueItem } from "@/lib/api";
import StatusMessage from "@/components/status-message";

type Props = {
  initialRows: ReviewQueueItem[];
};

export default function ReviewQueueTable({ initialRows }: Props) {
  const [rows, setRows] = useState(initialRows);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (!rows.length) {
    return <div className="empty-state">No review items are open right now.</div>;
  }

  return (
    <div className="panel table-panel">
      {error && <StatusMessage tone="error" title="Unable to update review item" detail={error} />}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Reason</th>
              <th>Status</th>
              <th>Created</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <strong>{row.reason_code}</strong>
                  <p style={{ margin: "4px 0 0", color: "var(--muted)" }}>{row.reason_text}</p>
                </td>
                <td>
                  <span className={`pill ${row.status === "open" ? "warn" : "success"}`}>{row.status}</span>
                </td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>
                  {row.status === "open" ? (
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={pendingId === row.id}
                      onClick={async () => {
                        setPendingId(row.id);
                        setError(null);
                        const result = await resolveReviewQueueItem(row.id, "resolved", row.entity_id);
                        setPendingId(null);
                        if (result.error || !result.data) {
                          setError(result.error || "Failed to resolve review item.");
                          return;
                        }
                        setRows((prev) => prev.map((item) => (item.id === row.id ? result.data! : item)));
                      }}
                    >
                      {pendingId === row.id ? "Saving..." : "Mark Resolved"}
                    </button>
                  ) : (
                    <span className="muted">Completed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
