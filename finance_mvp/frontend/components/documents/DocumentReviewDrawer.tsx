"use client";

import { useState } from "react";

import type { DocumentItem } from "@/lib/api";
import type { ImportSourceType } from "@/lib/api";
import ConfidenceBadge from "./ConfidenceBadge";
import DocumentStatusBadge from "./DocumentStatusBadge";
import DocumentTypeBadge from "./DocumentTypeBadge";

type Props = {
  doc: DocumentItem;
  onClose: () => void;
  colSpan?: number;
  onRetryParse?: () => Promise<void>;
  onMarkType?: (sourceType: ImportSourceType) => Promise<void>;
  onDeleteDocument?: () => Promise<void>;
  isRetrying?: boolean;
  isUpdatingType?: boolean;
  isDeleting?: boolean;
};

const TYPE_OPTIONS: ImportSourceType[] = [
  "bank_statement",
  "credit_card_statement",
  "receipt",
  "invoice",
  "paid_invoice",
  "refund_confirmation",
  "subscription_billing_record",
  "financial_document",
  "wallet_screenshot",
  "email_receipt",
];

export default function DocumentReviewDrawer({
  doc,
  onClose,
  colSpan = 10,
  onRetryParse,
  onMarkType,
  onDeleteDocument,
  isRetrying,
  isUpdatingType,
  isDeleting,
}: Props) {
  const [selectedType, setSelectedType] = useState<ImportSourceType>(
    (doc.source_type_hint as ImportSourceType) || "financial_document",
  );
  const hasTypeMismatch =
    doc.source_type_hint &&
    doc.source_type_hint !== doc.document_type;

  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: 0 }}>
        <div
          style={{
            background: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            padding: "16px 20px",
            fontSize: 13,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
            }}
          >
            {/* Left: metadata grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "10px 24px",
                flex: 1,
              }}
            >
              <Field label="Document Type">
                <DocumentTypeBadge docType={doc.document_type} />
              </Field>
              <Field label="Parse Status">
                <DocumentStatusBadge status={doc.parsing_status} />
              </Field>
              <Field label="Confidence">
                <ConfidenceBadge confidence={doc.document_type_confidence} />
              </Field>
              {doc.likely_issuer && <Field label="Issuer">{doc.likely_issuer}</Field>}
              {doc.merchant_name && <Field label="Merchant">{doc.merchant_name}</Field>}
              {doc.total_amount && (
                <Field label="Total">
                  {doc.currency} {parseFloat(doc.total_amount).toFixed(2)}
                </Field>
              )}
              {doc.source_type_hint && (
                <Field label="User-selected Type">
                  <span style={{ color: "#4f46e5", fontWeight: 600 }}>
                    {doc.source_type_hint}
                  </span>
                </Field>
              )}
              {hasTypeMismatch && (
                <Field label="Type Mismatch">
                  <span style={{ color: "#b45309" }}>
                    ⚠ Selected ≠ Detected
                  </span>
                </Field>
              )}
              {doc.review_reason && (
                <Field label="Review Reason">
                  <span style={{ color: "#b45309" }}>{doc.review_reason}</span>
                </Field>
              )}
              {doc.parsing_failure_reason && (
                <Field label="Parse Error">
                  <span style={{ color: "#dc2626" }}>{doc.parsing_failure_reason}</span>
                </Field>
              )}
              <Field label="Transactions Created Count">
                <span style={{ color: doc.transactions_created_count > 0 ? "#15803d" : "#94a3b8" }}>
                  {doc.transactions_created_count}
                </span>
              </Field>
              <Field label="Transactions Created">
                {doc.transactions_created_count > 0 ? (
                  <span style={{ color: "#15803d", fontWeight: 700 }}>
                    ✓ {doc.transactions_created_count} transaction{doc.transactions_created_count !== 1 ? "s" : ""}
                  </span>
                ) : (
                  <span style={{ color: "#94a3b8" }}>None extracted</span>
                )}
              </Field>
              {doc.extracted_total_amount && (
                <Field label="Extracted Total">
                  {doc.currency} {parseFloat(doc.extracted_total_amount).toFixed(2)}
                </Field>
              )}
            </div>

            {/* Right: close button */}
            <div style={{ display: "grid", gap: 8, minWidth: 180 }}>
              {onRetryParse && (
                <button
                  onClick={onRetryParse}
                  disabled={isRetrying}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #0f172a",
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: isRetrying ? "not-allowed" : "pointer",
                    fontSize: 12,
                    color: "#f8fafc",
                    fontWeight: 600,
                  }}
                >
                  {isRetrying ? "Retrying..." : "Retry Parse"}
                </button>
              )}
              {onMarkType && (
                <>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as ImportSourceType)}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 12,
                    }}
                  >
                    {TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onMarkType(selectedType)}
                    disabled={isUpdatingType}
                    style={{
                      background: "#eff6ff",
                      border: "1px solid #93c5fd",
                      borderRadius: 6,
                      padding: "6px 10px",
                      cursor: isUpdatingType ? "not-allowed" : "pointer",
                      fontSize: 12,
                      color: "#1d4ed8",
                      fontWeight: 600,
                    }}
                  >
                    {isUpdatingType ? "Saving..." : "Mark Correct Type"}
                  </button>
                </>
              )}
              {onDeleteDocument && (
                <button
                  onClick={async () => {
                    const confirmed = window.confirm(
                      "Delete this upload and related extracted data? This cannot be undone.",
                    );
                    if (!confirmed) return;
                    await onDeleteDocument();
                    onClose();
                  }}
                  disabled={isDeleting}
                  style={{
                    background: "#fef2f2",
                    border: "1px solid #fca5a5",
                    borderRadius: 6,
                    padding: "6px 10px",
                    cursor: isDeleting ? "not-allowed" : "pointer",
                    fontSize: 12,
                    color: "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  {isDeleting ? "Deleting..." : "Delete Upload"}
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  padding: "4px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#64748b",
                  flexShrink: 0,
                }}
              >
                Close ↑
              </button>
            </div>
          </div>

          {/* Raw text preview */}
          {doc.raw_text_preview && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom: 6,
                }}
              >
                Raw Text Preview
              </div>
              <pre
                style={{
                  background: "#1e293b",
                  color: "#e2e8f0",
                  borderRadius: 6,
                  padding: "10px 14px",
                  fontSize: 11,
                  lineHeight: 1.6,
                  maxHeight: 240,
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  margin: 0,
                }}
              >
                {doc.raw_text_preview}
              </pre>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "#94a3b8", fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#1e293b" }}>{children}</div>
    </div>
  );
}
