"use client";

import { useState } from "react";

import type { DocumentItem } from "@/lib/api";
import { asNumber } from "@/lib/api";
import ConfidenceBadge from "@/components/documents/ConfidenceBadge";
import DocumentStatusBadge from "@/components/documents/DocumentStatusBadge";
import DocumentTypeBadge from "@/components/documents/DocumentTypeBadge";
import DocumentReviewDrawer from "@/components/documents/DocumentReviewDrawer";

type Props = {
  rows: DocumentItem[];
  filter?: string;
  search?: string;
};

export default function DocumentsTable({ rows, filter, search }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = rows.filter((row) => {
    if (filter === "review" && !row.review_required) return false;
    if (filter === "ok" && row.review_required) return false;
    if (filter === "failed" && row.parsing_status !== "failed") return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !row.source_name.toLowerCase().includes(q) &&
        !(row.merchant_name || "").toLowerCase().includes(q) &&
        !(row.likely_issuer || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  if (visible.length === 0) {
    return (
      <div className="empty-state">
        {rows.length === 0
          ? "No documents have been uploaded yet."
          : "No documents match the current filter."}
      </div>
    );
  }

  return (
    <div className="panel table-panel">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 24 }} />
              <th>Type</th>
              <th>Source</th>
              <th>Merchant / Issuer</th>
              <th>Status</th>
              <th>Confidence</th>
              <th className="amount-col">Total</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <>
                  <tr
                    key={row.id}
                    style={{ cursor: "pointer", background: isExpanded ? "#f1f5f9" : undefined }}
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  >
                    <td style={{ textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                      {isExpanded ? "▲" : "▼"}
                    </td>
                    <td>
                      <DocumentTypeBadge docType={row.document_type} />
                    </td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {row.source_name}
                    </td>
                    <td>
                      {row.merchant_name || row.likely_issuer || (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    <td>
                      <DocumentStatusBadge status={row.parsing_status ?? "pending"} />
                    </td>
                    <td>
                      <ConfidenceBadge confidence={row.document_type_confidence} />
                    </td>
                    <td className="amount-col">
                      {row.total_amount
                        ? `${row.currency} ${asNumber(row.total_amount).toFixed(2)}`
                        : <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td>{new Date(row.created_at).toLocaleDateString()}</td>
                  </tr>
                  {isExpanded && (
                    <DocumentReviewDrawer
                      key={`drawer-${row.id}`}
                      doc={row}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

