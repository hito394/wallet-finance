"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  uploadDocument,
  pollImportJob,
  fetchDocumentsByImportId,
  type DocumentItem,
  type ImportSourceType,
  type UploadSourceSelection,
} from "@/lib/api";
import StatusMessage from "@/components/status-message";
import UploadResultCard from "@/components/documents/UploadResultCard";

const SOURCE_TYPE_LABELS: Record<ImportSourceType, string> = {
  bank_statement:              "Bank Statement",
  credit_card_statement:       "Credit Card Statement",
  receipt:                     "Receipt",
  invoice:                     "Invoice",
  paid_invoice:                "Paid Invoice",
  refund_confirmation:         "Refund Confirmation",
  subscription_billing_record: "Subscription Billing Record",
  financial_document:          "Other Financial Document",
  wallet_screenshot:           "Wallet / App Screenshot",
  email_receipt:               "Email Receipt",
};

const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABELS) as ImportSourceType[];
const SOURCE_SELECTIONS: UploadSourceSelection[] = ["auto", ...SOURCE_TYPES];
const SOURCE_SELECTION_LABELS: Record<UploadSourceSelection, string> = {
  auto: "Auto Detect",
  ...SOURCE_TYPE_LABELS,
};

type Props = {
  entityId?: string;
  onUploaded?: () => void;
};

export default function DocumentsUploadForm({ entityId, onUploaded }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<UploadSourceSelection>("auto");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [processedDoc, setProcessedDoc] = useState<DocumentItem | null>(null);

  const canSubmit = useMemo(() => !!file && !isUploading, [file, isUploading]);

  return (
    <div className="panel form-panel">
      <h3>Upload Financial Document</h3>
      <p className="muted">
        Upload a receipt, invoice, or statement. Source type is auto-detected by default,
        and you can still override it manually when needed.
      </p>

      <div className="form-grid">
        <div>
          <label className="label">Source Type</label>
          <select
            className="input"
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as UploadSourceSelection)}
          >
            {SOURCE_SELECTIONS.map((type) => (
              <option value={type} key={type}>
                {SOURCE_SELECTION_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">File</label>
          <input
            className="input"
            type="file"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setProcessedDoc(null);
              setError(null);
              setInfo(null);
            }}
            accept=".pdf,.csv,.png,.jpg,.jpeg,.webp,.ofx,.qfx"
          />
        </div>
      </div>


      <div className="toolbar">
        <button
          type="button"
          className="btn primary"
          disabled={!canSubmit}
          onClick={async () => {
            if (!file) return;
            setIsUploading(true);
            setError(null);
            setInfo(null);
            setProcessedDoc(null);

            // Step 1: upload → get import job ID
            const uploadResult = await uploadDocument(file, sourceType, entityId);
            if (uploadResult.error || !uploadResult.data) {
              setIsUploading(false);
              setError(uploadResult.error || "Upload failed");
              return;
            }

            const jobId = uploadResult.data.id;

            // Step 2: poll until job completes (up to 15 s)
            const jobResult = await pollImportJob(jobId, entityId, 15_000);

            // Step 3: regardless of job success/fail, fetch the document for this import
            const docsResult = await fetchDocumentsByImportId(jobId, entityId);
            const doc = docsResult.data?.[0] ?? null;

            setIsUploading(false);
            setFile(null);
            setProcessedDoc(doc);

            if (jobResult.data?.status === "failed" && !doc) {
              setError(jobResult.data.error_message || "Processing failed — no document was created.");
            }

            onUploaded?.();
            router.refresh();
          }}
        >
          {isUploading ? "Processing…" : "Upload"}
        </button>
      </div>

      {error && (
        <StatusMessage tone="error" title="Upload failed" detail={error} />
      )}

      {info && (
        <StatusMessage tone="info" title="Upload reused existing result" detail={info} />
      )}

      {processedDoc && (
        <UploadResultCard
          doc={processedDoc}
          onDismiss={() => setProcessedDoc(null)}
        />
      )}
    </div>
  );
}

