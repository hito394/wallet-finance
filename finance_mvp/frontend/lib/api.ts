const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

function buildHeaders(entityId?: string): HeadersInit {
  return entityId ? { "x-entity-id": entityId } : {};
}

export type MonthlyOverview = {
  month: string;
  total_spend: string;
  income: string;
  net: string;
  category_breakdown: { category: string; total: string }[];
  detected_subscriptions: string[];
  alerts: string[];
};

export type TransactionItem = {
  id: string;
  transaction_date: string;
  merchant_normalized: string;
  amount: string;
  currency: string;
  category_id: string | null;
  description: string;
};

export type EntityItem = {
  id: string;
  name: string;
  entity_type: "personal" | "freelancer" | "business" | "organization";
  base_currency: string;
};

export type DocumentItem = {
  id: string;
  document_type: string;
  review_required: boolean;
  merchant_name: string | null;
  total_amount: string | null;
};

export type ReviewQueueItem = {
  id: string;
  reason_code: string;
  reason_text: string;
  status: string;
};

export async function fetchMonthlyOverview(entityId?: string): Promise<MonthlyOverview> {
  const res = await fetch(`${API_BASE_URL}/analytics/monthly-overview`, {
    cache: "no-store",
    headers: buildHeaders(entityId),
  });
  if (!res.ok) throw new Error("Failed to fetch monthly overview");
  return res.json();
}

export async function fetchTransactions(entityId?: string): Promise<TransactionItem[]> {
  const res = await fetch(`${API_BASE_URL}/transactions`, {
    cache: "no-store",
    headers: buildHeaders(entityId),
  });
  if (!res.ok) throw new Error("Failed to fetch transactions");
  return res.json();
}

export async function fetchEntities(): Promise<EntityItem[]> {
  const res = await fetch(`${API_BASE_URL}/entities`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch entities");
  return res.json();
}

export async function fetchDocuments(entityId?: string): Promise<DocumentItem[]> {
  const res = await fetch(`${API_BASE_URL}/documents`, {
    cache: "no-store",
    headers: buildHeaders(entityId),
  });
  if (!res.ok) throw new Error("Failed to fetch documents");
  return res.json();
}

export async function fetchReviewQueue(entityId?: string): Promise<ReviewQueueItem[]> {
  const res = await fetch(`${API_BASE_URL}/review-queue`, {
    cache: "no-store",
    headers: buildHeaders(entityId),
  });
  if (!res.ok) throw new Error("Failed to fetch review queue");
  return res.json();
}
