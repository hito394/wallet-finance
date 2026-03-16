"use client";

import { Fragment, useState } from "react";

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

const SOURCE_TYPE_LABELS: Record<string, string> = {
  bank_statement: "Bank Stmt",
  credit_card_statement: "CC Stmt",
  receipt: "Receipt",
  invoice: "Invoice",
  paid_invoice: "Paid Invoice",
  refund_confirmation: "Refund",
  subscription_billing_record: "Subscription",
  financial_document: "Financial Doc",
  wallet_screenshot: "Screenshot",
  email_receipt: "Email Receipt",
};

export default function DocumentsTable({ rows, filter, search }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visible = rows.filter((row) => {
    if (filter === "review" && !row.review_required) return false;
    if (filter === "ok" && row.review_required) return false;
    if (filter === "failed" && row.parsing_status !== "failed") return false;
    if (filter === "parsed" && row.parsing_status !== "parsed") return false;
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
              <th>Selected Type</th>
              <th>Detected Type</th>
              <th>Source</th>
              <th>Parse Status</th>
              <th>Confidence</th>
              <th style={{ textAlign: "right" }}>Tx Count</th>
              <th>Review Reason</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const isExpanded = expandedId === row.id;
              const hasTypeMismatch =
                row.source_type_hint && row.source_type_hint !== row.document_type;
              return (
                // key on Fragment fixes the React "unique key" warning
                <Fragment key={row.id}>
                  <tr
                    style={{
                      cursor: "pointer",
                      background: isExpanded ? "#f1f5f9" : undefined,
                      borderLeft: hasTypeMismatch ? "3px solid #f59e0b" : undefined,
                    }}
                    onClick={() => setExpandedId(isExpanded ? null : row.id)}
                  >
                    <td style={{ textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                      {isExpanded ? "▲" : "▼"}
                    </td>
                    {/* Selected source type (what user chose) */}
                    <td>
                      {row.source_type_hint ? (
                        <span style={{ fontSize: 11, color: "#6366f1", fontWeight: 600 }}>
                          {SOURCE_TYPE_LABELS[row.source_type_hint] ?? row.source_type_hint}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                    </td>
                    {/* Detected type (AI output) */}
                    <td>
                      <DocumentTypeBadge docType={row.document_type} />
                    </td>
                    <td
                      style={{
                        maxWidth: 160,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 12,
                        color: "#475569",
                      }}
                    >
                      {row.source_name}
                    </td>
                    <td>
                      <DocumentStatusBadge status={row.parsing_status ?? "pending"} />
                    </td>
                    <td>
                      <ConfidenceBadge confidence={row.document_type_confidence} />
                    </td>
                    {/* Extracted transaction count — shows 0/n or "—" for receipts */}
                    <td style={{ textAlign: "right", fontWeight: 600, fontSize: 13 }}>
                      {row.extracted_transaction_count > 0 ? (
                        <span style={{ color: "#15803d" }}>{row.extracted_transaction_count}</span>
                      ) : row.parsing_status === "parsed" ? (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>0</span>
                      )}
                    </td>
                    {/* Review reason (short) */}
                    <td style={{ fontSize: 11, color: "#b45309", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.review_required
                        ? (row.review_reason ?? "Review required")
                        : <span style={{ color: "#15803d", fontSize: 11 }}>✓</span>}
                    </td>
                    <td style={{ fontSize: 12, color: "#64748b" }}>
                      {new Date(row.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                  {isExpanded && (
                    <DocumentReviewDrawer
                      doc={row}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

