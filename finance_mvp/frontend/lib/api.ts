export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";
const CLIENT_API_BASE_URL = "/api/v1";

function resolveApiBaseUrl(): string {
  // Use same-origin proxy for browser requests to avoid CORS failures in local dev.
  return typeof window === "undefined" ? API_BASE_URL : CLIENT_API_BASE_URL;
}

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number | null;
};

export type EntityItem = {
  id: string;
  name: string;
  entity_type: "personal" | "freelancer" | "business" | "organization";
  base_currency: string;
  created_at?: string;
};

export type MonthlyOverview = {
  month: string;
  total_spend: string;
  income: string;
  net: string;
  category_breakdown: { category: string; total: string }[];
  detected_subscriptions: string[];
  alerts: string[];
  duplicate_transaction_count: number;
};

export type MonthlyHistoryItem = {
  month: string;
  spend: string;
  income: string;
};

export type InsightItem = {
  title: string;
  detail: string;
  severity: "info" | "warning" | "critical";
};

export type TransactionItem = {
  id: string;
  entity_id: string;
  document_id: string | null;
  transaction_date: string;
  merchant_raw: string;
  merchant_normalized: string;
  description: string;
  amount: string;
  running_balance: string | null;
  direction: "debit" | "credit" | "transfer";
  currency: string;
  category_id: string | null;
  receipt_id: string | null;
  notes: string | null;
  is_ignored: boolean;
  created_at: string;
};

export type TransactionCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type TransactionUpdatePayload = {
  category_id?: string | null;
  notes?: string | null;
  is_ignored?: boolean;
  receipt_id?: string | null;
  transaction_date?: string;
  amount?: number;
  merchant_raw?: string;
  description?: string;
  direction?: "debit" | "credit" | "transfer";
};

export type DocumentItem = {
  id: string;
  entity_id: string;
  source_name: string;
  document_type: string;
  document_type_confidence: number;
  payment_status: string;
  review_required: boolean;
  review_reason: string | null;
  merchant_name: string | null;
  total_amount: string | null;
  currency: string;
  extraction_confidence: number;
  match_confidence: number | null;
  // enriched intelligence
  likely_issuer: string | null;
  source_type_hint: string | null;
  selected_source_type: string | null;
  detected_document_type: string | null;
  detected_document_type_confidence: number;
  parsing_status: string;
  parsing_failure_reason: string | null;
  raw_text_preview: string | null;
  extracted_transaction_count: number;
  transactions_created_count: number;
  extracted_total_amount: string | null;
  created_at: string;
};

export type ReviewQueueItem = {
  id: string;
  entity_id: string;
  document_id: string | null;
  transaction_id: string | null;
  reason_code: string;
  reason_text: string;
  status: "pending" | "approved" | "edited" | "merged" | "ignored";
  created_at: string;
  resolved_at: string | null;
};

export type LearningFeedbackItem = {
  id: string;
  entity_id: string;
  feedback_type: string;
  source_object: string;
  source_id: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ImportSourceType =
  | "bank_statement"
  | "credit_card_statement"
  | "receipt"
  | "invoice"
  | "paid_invoice"
  | "refund_confirmation"
  | "subscription_billing_record"
  | "financial_document"
  | "wallet_screenshot"
  | "email_receipt";

export type UploadSourceSelection = ImportSourceType | "auto";

export type ImportJob = {
  id: string;
  entity_id: string;
  source_type: ImportSourceType;
  status: "pending" | "processing" | "completed" | "failed";
  file_name: string;
  metadata_json?: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
};

type RequestOptions = {
  entityId?: string;
  cache?: RequestCache;
  headers?: HeadersInit;
};

function entityHeaders(entityId?: string): HeadersInit {
  return entityId ? { "x-entity-id": entityId } : {};
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (typeof data?.detail === "string") {
      return data.detail;
    }
    return JSON.stringify(data);
  } catch {
    return `${response.status} ${response.statusText}`;
  }
}

async function requestJson<T>(path: string, init?: RequestInit, options?: RequestOptions): Promise<ApiResult<T>> {
  const url = `${resolveApiBaseUrl()}${path}`;
  try {
    const response = await fetch(url, {
      ...init,
      cache: options?.cache ?? "no-store",
      headers: {
        ...entityHeaders(options?.entityId),
        ...(options?.headers ?? {}),
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const errorMessage = await parseErrorMessage(response);
      return { data: null, error: errorMessage, status: response.status };
    }

    const data = (await response.json()) as T;
    return { data, error: null, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected network error";
    return { data: null, error: message, status: null };
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export function asNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchEntities(): Promise<ApiResult<EntityItem[]>> {
  return requestJson<EntityItem[]>("/entities");
}

export async function fetchMonthlyOverview(entityId?: string, year?: number, month?: number): Promise<ApiResult<MonthlyOverview>> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<MonthlyOverview>(`/analytics/monthly-overview${query}`, undefined, { entityId });
}

export async function fetchInsights(entityId?: string, year?: number, month?: number): Promise<ApiResult<InsightItem[]>> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<InsightItem[]>(`/analytics/insights${query}`, undefined, { entityId });
}

export async function fetchMonthlyHistory(entityId?: string, months = 6): Promise<ApiResult<MonthlyHistoryItem[]>> {
  return requestJson<MonthlyHistoryItem[]>(`/analytics/monthly-history?months=${months}`, undefined, { entityId });
}

export async function fetchTransactions(entityId?: string, year?: number, month?: number): Promise<ApiResult<TransactionItem[]>> {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  const query = params.toString() ? `?${params.toString()}` : "";
  return requestJson<TransactionItem[]>(`/transactions${query}`, undefined, { entityId });
}

export async function fetchTransactionCategories(entityId?: string): Promise<ApiResult<TransactionCategoryOption[]>> {
  return requestJson<TransactionCategoryOption[]>("/transactions/categories", undefined, { entityId });
}

export async function updateTransaction(
  transactionId: string,
  payload: TransactionUpdatePayload,
  entityId?: string,
): Promise<ApiResult<TransactionItem>> {
  return requestJson<TransactionItem>(
    `/transactions/${encodeURIComponent(transactionId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    { entityId },
  );
}

export async function reclassifyTransactions(entityId?: string): Promise<ApiResult<{ updated_categories: number; newly_ignored_rows: number; scanned_rows: number }>> {
  return requestJson<{ updated_categories: number; newly_ignored_rows: number; scanned_rows: number }>(
    "/transactions/reclassify",
    {
      method: "POST",
    },
    { entityId },
  );
}

export async function fetchDocuments(entityId?: string): Promise<ApiResult<DocumentItem[]>> {
  return requestJson<DocumentItem[]>("/documents", undefined, { entityId });
}

export async function fetchDocumentsByImportId(
  importId: string,
  entityId?: string,
): Promise<ApiResult<DocumentItem[]>> {
  return requestJson<DocumentItem[]>(`/documents?import_id=${encodeURIComponent(importId)}`, undefined, { entityId });
}

export async function fetchImportJob(jobId: string, entityId?: string): Promise<ApiResult<ImportJob>> {
  return requestJson<ImportJob>(`/imports/${encodeURIComponent(jobId)}`, undefined, { entityId });
}

/**
 * Poll an import job until it reaches a terminal state (completed|failed) or the
 * timeout elapses. Returns the final job state.
 */
export async function pollImportJob(
  jobId: string,
  entityId?: string,
  maxMs = 15_000,
  intervalMs = 1_500,
): Promise<ApiResult<ImportJob>> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const result = await fetchImportJob(jobId, entityId);
    if (result.error) return result;
    if (result.data && (result.data.status === "completed" || result.data.status === "failed")) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return fetchImportJob(jobId, entityId); // last attempt
}

export async function fetchReviewQueue(entityId?: string): Promise<ApiResult<ReviewQueueItem[]>> {
  return requestJson<ReviewQueueItem[]>("/review-queue", undefined, { entityId });
}

export async function resolveReviewQueueItem(
  reviewId: string,
  status: "pending" | "approved" | "edited" | "merged" | "ignored",
  entityId?: string,
): Promise<ApiResult<ReviewQueueItem>> {
  return requestJson<ReviewQueueItem>(
    `/review-queue/${reviewId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    { entityId },
  );
}

export async function retryDocumentParse(
  documentId: string,
  entityId?: string,
): Promise<ApiResult<{ import_id: string; status: string }>> {
  return requestJson<{ import_id: string; status: string }>(
    `/documents/${encodeURIComponent(documentId)}/reparse`,
    { method: "POST" },
    { entityId },
  );
}

export async function updateDocumentTypeHint(
  documentId: string,
  sourceTypeHint: ImportSourceType,
  entityId?: string,
): Promise<ApiResult<DocumentItem>> {
  return requestJson<DocumentItem>(
    `/documents/${encodeURIComponent(documentId)}/type-hint`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source_type_hint: sourceTypeHint }),
    },
    { entityId },
  );
}

export async function fetchLearningFeedback(entityId?: string): Promise<ApiResult<LearningFeedbackItem[]>> {
  return requestJson<LearningFeedbackItem[]>("/learning", undefined, { entityId });
}

export async function uploadDocument(
  file: File,
  sourceType: UploadSourceSelection,
  entityId?: string,
): Promise<ApiResult<ImportJob>> {
  const form = new FormData();
  form.set("file", file);
  const query =
    sourceType && sourceType !== "auto"
      ? `?source_type=${encodeURIComponent(sourceType)}`
      : "";
  const path = `/imports/upload${query}`;
  const url = `${resolveApiBaseUrl()}${path}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      body: form,
      headers: entityHeaders(entityId),
    });

    if (!response.ok) {
      const errorMessage = await parseErrorMessage(response);
      return { data: null, error: errorMessage, status: response.status };
    }

    const data = (await response.json()) as ImportJob;
    return { data, error: null, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return { data: null, error: message, status: null };
  }
}

export async function deleteDocument(
  documentId: string,
  entityId?: string,
): Promise<ApiResult<null>> {
  const url = `${resolveApiBaseUrl()}/documents/${encodeURIComponent(documentId)}`;
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: entityHeaders(entityId),
    });
    if (!response.ok) {
      const errorMessage = await parseErrorMessage(response);
      return { data: null, error: errorMessage, status: response.status };
    }
    return { data: null, error: null, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed";
    return { data: null, error: message, status: null };
  }
}

export async function bulkDeleteDocuments(
  documentIds: string[],
  entityId?: string,
): Promise<ApiResult<{ deleted_count: number }>> {
  if (!documentIds.length) {
    return { data: { deleted_count: 0 }, error: null, status: 200 };
  }
  return requestJson<{ deleted_count: number }>(
    "/documents/bulk-delete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document_ids: documentIds }),
    },
    { entityId },
  );
}

export async function downloadAccountingCsv(entityId?: string): Promise<ApiResult<Blob>> {
  const url = `${resolveApiBaseUrl()}/exports/accounting.csv`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: entityHeaders(entityId),
    });
    if (!response.ok) {
      const errorMessage = await parseErrorMessage(response);
      return { data: null, error: errorMessage, status: response.status };
    }
    return { data: await response.blob(), error: null, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Download failed";
    return { data: null, error: message, status: null };
  }
}

export async function sendChatMessage(message: string, entityId?: string): Promise<ApiResult<{ reply: string }>> {
  const url = `${resolveApiBaseUrl()}/chat`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...entityHeaders(entityId),
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          data: {
            reply:
              "Chat endpoint is not enabled yet. You can still explore Dashboard, Transactions, Reports, and Documents now.",
          },
          error: null,
          status: response.status,
        };
      }

      const errorMessage = await parseErrorMessage(response);
      return { data: null, error: errorMessage, status: response.status };
    }

    const data = (await response.json()) as { reply: string };
    if (!data.reply) {
      return { data: { reply: "AI responded with an empty message." }, error: null, status: response.status };
    }
    return { data, error: null, status: response.status };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Chat request failed";
    return {
      data: {
        reply:
          "Chat service is currently unavailable. Please try again later or continue using other app pages.",
      },
      error: messageText,
      status: null,
    };
  }
}
