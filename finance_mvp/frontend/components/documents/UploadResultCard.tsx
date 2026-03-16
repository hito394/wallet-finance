"use client";

import type { DocumentItem } from "@/lib/api";
import ConfidenceBadge from "./ConfidenceBadge";
import DocumentStatusBadge from "./DocumentStatusBadge";
import DocumentTypeBadge from "./DocumentTypeBadge";

type Props = {
  doc: DocumentItem;
  onDismiss: () => void;
};

export default function UploadResultCard({ doc, onDismiss }: Props) {
  return (
    <div
      style={{
        border: "1px solid #22c55e66",
        borderRadius: 8,
        background: "#f0fdf4",
        padding: "16px 20px",
        marginTop: 12,
        position: "relative",
      }}
    >
      <button
        onClick={onDismiss}
        style={{
          position: "absolute",
          top: 10,
          right: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 16,
          color: "#64748b",
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      <div style={{ fontWeight: 700, fontSize: 14, color: "#15803d", marginBottom: 10 }}>
        ✓ Document processed
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "10px 24px",
          fontSize: 13,
        }}
      >
        <Field label="Detected Type">
          <DocumentTypeBadge docType={doc.document_type} />
        </Field>
        <Field label="Parse Status">
          <DocumentStatusBadge status={doc.parsing_status} />
        </Field>
        <Field label="Confidence">
          <ConfidenceBadge confidence={doc.document_type_confidence} />
        </Field>
        {doc.likely_issuer && (
          <Field label="Issuer">{doc.likely_issuer}</Field>
        )}
        {doc.merchant_name && (
          <Field label="Merchant">{doc.merchant_name}</Field>
        )}
        {doc.total_amount && (
          <Field label="Total">
            {doc.currency} {parseFloat(doc.total_amount).toFixed(2)}
          </Field>
        )}
        {doc.review_required && (
          <Field label="Review Needed">
            <span style={{ color: "#b45309", fontWeight: 600 }}>
              {doc.review_reason ?? "Manual review required"}
            </span>
          </Field>
        )}
        {doc.source_type_hint && doc.source_type_hint !== doc.document_type && (
          <Field label="Hint vs Detected">
            <span style={{ color: "#7c3aed", fontSize: 11 }}>
              Selected: {doc.source_type_hint} → Detected: {doc.document_type}
            </span>
          </Field>
        )}
      </div>

      {doc.parsing_failure_reason && (
        <div
          style={{
            marginTop: 10,
            padding: "6px 10px",
            background: "#fef2f2",
            borderRadius: 4,
            color: "#991b1b",
            fontSize: 12,
          }}
        >
          ⚠ {doc.parsing_failure_reason}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "#64748b", fontSize: 11, marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 500, color: "#1e293b" }}>{children}</div>
    </div>
  );
}
