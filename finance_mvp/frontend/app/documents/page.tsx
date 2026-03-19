"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import DocumentsTable from "@/components/documents-table";
import DocumentsUploadForm from "@/components/documents-upload-form";
import {
  deleteDocument,
  fetchDocuments,
  fetchEntities,
  fetchReviewQueue,
  retryDocumentParse,
  type DocumentItem,
  type ImportSourceType,
  updateDocumentTypeHint,
} from "@/lib/api";

const FILTER_OPTIONS = [
  { value: "all",         label: "All" },
  { value: "parsed",      label: "Parsed" },
  { value: "review",      label: "Needs Review" },
  { value: "failed",      label: "Parse Failed" },
];

export default function DocumentsPage() {
  const [entityId, setEntityId] = useState<string | undefined>();
  const [entities, setEntities] = useState<{ id: string; name: string }[]>([]);
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingDocumentId, setRetryingDocumentId] = useState<string | null>(null);
  const [updatingTypeDocumentId, setUpdatingTypeDocumentId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const load = async (eid?: string) => {
    setLoading(true);
    setError(null);
    const [entResult, docsResult, rvResult] = await Promise.all([
      fetchEntities(),
      fetchDocuments(eid),
      fetchReviewQueue(eid),
    ]);
    if (entResult.data) setEntities(entResult.data);
    if (docsResult.data) setDocs(docsResult.data);
    else setError(docsResult.error || "Failed to load documents");
    if (rvResult.data) setReviewCount(rvResult.data.filter((r) => r.status === "pending").length);
    setLoading(false);
  };

  useEffect(() => {
    fetchEntities().then((r) => {
      const first = r.data?.[0]?.id;
      setEntities(r.data || []);
      setEntityId(first);
      load(first);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEntityChange = (id: string) => {
    setEntityId(id);
    load(id);
  };

  const needsReviewCount = docs.filter((d) => d.review_required).length;

  const handleRetryParse = async (documentId: string) => {
    setRetryingDocumentId(documentId);
    setError(null);
    const result = await retryDocumentParse(documentId, entityId);
    setRetryingDocumentId(null);
    if (result.error) {
      setError(result.error || "Failed to queue re-parse");
      return;
    }
    await load(entityId);
  };

  const handleMarkType = async (documentId: string, sourceType: ImportSourceType) => {
    setUpdatingTypeDocumentId(documentId);
    setError(null);
    const result = await updateDocumentTypeHint(documentId, sourceType, entityId);
    setUpdatingTypeDocumentId(null);
    if (result.error) {
      setError(result.error || "Failed to update type hint");
      return;
    }
    await load(entityId);
  };

  const handleDeleteDocument = async (documentId: string) => {
    setDeletingDocumentId(documentId);
    setError(null);
    const result = await deleteDocument(documentId, entityId);
    setDeletingDocumentId(null);
    if (result.error) {
      setError(result.error || "Failed to delete uploaded document");
      return;
    }
    await load(entityId);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Documents</h1>
          <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>
            Upload statements, receipts, and invoices. AI classifies and extracts data automatically.
          </p>
        </div>
        <Link
          href={`/review?entityId=${entityId || ""}`}
          style={{
            padding: "8px 16px",
            background: "#f1f5f9",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#1e293b",
            textDecoration: "none",
          }}
        >
          Open Review Queue
        </Link>
      </div>

      {/* Entity switcher */}
      {entities.length > 1 && (
        <div style={{ marginBottom: 16 }}>
          <select
            className="input"
            style={{ maxWidth: 240 }}
            value={entityId || ""}
            onChange={(e) => handleEntityChange(e.target.value)}
          >
            {entities.map((ent) => (
              <option key={ent.id} value={ent.id}>{ent.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Stats bar */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 20,
          padding: "12px 16px",
          background: "#f8fafc",
          borderRadius: 8,
          border: "1px solid #e2e8f0",
          fontSize: 13,
        }}
      >
        <StatChip label="Total Documents" value={docs.length} />
        <StatChip label="Needs Review" value={needsReviewCount} color={needsReviewCount > 0 ? "#b45309" : undefined} />
        <StatChip label="Queue Items" value={reviewCount} color={reviewCount > 0 ? "#dc2626" : undefined} />
        <StatChip
          label="Parsed OK"
          value={docs.filter((d) => d.parsing_status === "parsed" || d.parsing_status === "partial").length}
          color="#15803d"
        />
        <StatChip
          label="Transactions Created"
          value={docs.reduce((sum, d) => sum + (d.extracted_transaction_count || 0), 0)}
          color="#2563eb"
        />
      </div>

      {/* Upload form */}
      <DocumentsUploadForm entityId={entityId} onUploaded={() => load(entityId)} />

      {/* Filter + search bar */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter(opt.value)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: filter === opt.value ? "#2563eb" : "#e2e8f0",
              background: filter === opt.value ? "#2563eb" : "white",
              color: filter === opt.value ? "white" : "#374151",
              fontWeight: 600,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
        <select
          className="input"
          value={sourceTypeFilter}
          onChange={(e) => setSourceTypeFilter(e.target.value)}
          style={{ maxWidth: 220 }}
        >
          <option value="all">All Source Types</option>
          <option value="bank_statement">Bank Statement</option>
          <option value="credit_card_statement">Credit Card Statement</option>
          <option value="receipt">Receipt</option>
          <option value="invoice">Invoice</option>
          <option value="paid_invoice">Paid Invoice</option>
          <option value="refund_confirmation">Refund Confirmation</option>
          <option value="subscription_billing_record">Subscription Billing</option>
          <option value="financial_document">Financial Document</option>
          <option value="wallet_screenshot">Wallet Screenshot</option>
          <option value="email_receipt">Email Receipt</option>
        </select>
        <select
          className="input"
          value={String(minConfidence)}
          onChange={(e) => setMinConfidence(Number(e.target.value))}
          style={{ maxWidth: 180 }}
        >
          <option value="0">Any Confidence</option>
          <option value="0.5">50%+</option>
          <option value="0.65">65%+</option>
          <option value="0.8">80%+</option>
        </select>
        <input
          type="text"
          placeholder="Search filename, merchant, issuer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input"
          style={{ maxWidth: 260, marginLeft: "auto" }}
        />
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#fef2f2",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            padding: "10px 14px",
            color: "#991b1b",
            marginBottom: 12,
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ color: "#94a3b8", padding: 32, textAlign: "center" }}>Loading…</div>
      ) : (
        <DocumentsTable
          rows={docs}
          filter={filter}
          search={search}
          sourceTypeFilter={sourceTypeFilter}
          minConfidence={minConfidence}
          onRetryParse={handleRetryParse}
          onMarkType={handleMarkType}
          onDeleteDocument={handleDeleteDocument}
          retryingDocumentId={retryingDocumentId}
          updatingTypeDocumentId={updatingTypeDocumentId}
          deletingDocumentId={deletingDocumentId}
        />
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontWeight: 700, color: color ?? "#1e293b", fontSize: 16 }}>{value}</span>
      <span style={{ color: "#64748b" }}>{label}</span>
    </div>
  );
}

