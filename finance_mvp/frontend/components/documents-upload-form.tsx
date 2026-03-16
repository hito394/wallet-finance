"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { uploadDocument, type ImportSourceType } from "@/lib/api";
import StatusMessage from "@/components/status-message";

const SOURCE_TYPES: ImportSourceType[] = [
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

type Props = {
  entityId?: string;
  onUploaded?: () => void;
};

export default function DocumentsUploadForm({ entityId, onUploaded }: Props) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState<ImportSourceType>("bank_statement");
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const canSubmit = useMemo(() => !!file && !isUploading, [file, isUploading]);

  return (
    <div className="panel form-panel">
      <h3>Upload Financial Document</h3>
      <p className="muted">Connect a real ingestion flow: choose a source type and upload receipt/invoice/statement files.</p>

      <div className="form-grid">
        <div>
          <label className="label">Source Type</label>
          <select
            className="input"
            value={sourceType}
            onChange={(event) => setSourceType(event.target.value as ImportSourceType)}
          >
            {SOURCE_TYPES.map((type) => (
              <option value={type} key={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">File</label>
          <input
            className="input"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
            accept=".pdf,.csv,.png,.jpg,.jpeg"
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
            setMessage(null);
            const result = await uploadDocument(file, sourceType, entityId);
            setIsUploading(false);

            if (result.error || !result.data) {
              setMessage({ tone: "error", text: result.error || "Upload failed" });
              return;
            }

            setMessage({ tone: "success", text: `Uploaded as import job ${result.data.id.slice(0, 8)}.` });
            setFile(null);
            onUploaded?.();
            router.refresh();
          }}
        >
          {isUploading ? "Uploading..." : "Upload"}
        </button>
      </div>

      {message && (
        <StatusMessage
          tone={message.tone === "success" ? "success" : "error"}
          title={message.tone === "success" ? "Upload completed" : "Upload failed"}
          detail={message.text}
        />
      )}
    </div>
  );
}
