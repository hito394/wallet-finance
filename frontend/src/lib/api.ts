/**
 * バックエンドAPIクライアント
 * - クライアント: NEXT_PUBLIC_API_BASE_URL があればそれを優先（未設定なら /api を利用）
 * - サーバー: NEXT_SERVER_API_ORIGIN / BACKEND_API_ORIGIN を利用
 */

const SERVER_API_ORIGIN =
  process.env.NEXT_SERVER_API_ORIGIN ||
  process.env.BACKEND_API_ORIGIN ||
  'http://127.0.0.1:8000';

const CLIENT_API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || '';

const BASE_URL = typeof window === 'undefined' ? SERVER_API_ORIGIN : CLIENT_API_ORIGIN;

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API Error ${res.status}: ${errorBody}`);
  }

  return res.json() as Promise<T>;
}

// ---- ダッシュボード ----

export async function getDashboard(month?: string) {
  const q = month ? `?month=${month}` : '';
  return request<import('@/types').DashboardSummary>(`/api/analytics/dashboard${q}`);
}

// ---- 取引 ----

export async function getTransactions(params: Record<string, string | number | boolean | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return request<import('@/types').TransactionListResponse>(
    `/api/transactions${qs ? '?' + qs : ''}`
  );
}

export async function updateTransaction(id: number, data: Record<string, unknown>) {
  return request<import('@/types').Transaction>(`/api/transactions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ---- レシート ----

export async function getReceipts(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return request<import('@/types').ReceiptListResponse>(
    `/api/receipts${qs ? '?' + qs : ''}`
  );
}

export async function updateReceipt(id: number, data: Record<string, unknown>) {
  return request<import('@/types').Receipt>(`/api/receipts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ---- インポート ----

export async function getImports(page = 1) {
  return request<import('@/types').ImportRecord[]>(
    `/api/imports?page=${page}&per_page=20`
  );
}

export async function uploadStatement(file: File): Promise<import('@/types').ImportResultResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/imports/statement`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }
  return res.json();
}

export async function uploadReceipt(file: File): Promise<import('@/types').ImportResultResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/imports/receipt`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${err}`);
  }
  return res.json();
}

// ---- ユーティリティ ----

export function formatAmount(amount: string | number, direction?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const formatted = new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(Math.abs(num));
  return direction === 'credit' ? `+${formatted}` : formatted;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export const CATEGORY_LABELS: Record<string, string> = {
  food_dining:    '飲食・外食',
  grocery:        '食料品',
  transportation: '交通',
  shopping:       'ショッピング',
  housing:        '家賃・住居',
  utilities:      '光熱費',
  entertainment:  'エンタメ',
  travel:         '旅行',
  health:         '医療・健康',
  education:      '教育',
  subscriptions:  'サブスク',
  income:         '収入',
  transfer:       '振替',
  other:          'その他',
};

export async function getTransactionsForCalendar(year: number, month: number): Promise<import('@/types').Transaction[]> {
  return request<import('@/types').Transaction[]>(`/api/transactions?year=${year}&month=${month}`);
}

// ---- Plaid 銀行連携 ----

export interface BankAccount {
  id: string;
  plaid_account_id: string;
  name: string;
  official_name: string | null;
  account_type: string | null;
  account_subtype: string | null;
  mask: string | null;
  currency: string;
  current_balance: number | null;
  available_balance: number | null;
  last_synced_at: string | null;
}

export interface PlaidItem {
  id: string;
  institution_name: string;
  institution_id: string | null;
  last_synced_at: string | null;
  accounts: BankAccount[];
}

export async function getPlaidLinkToken(): Promise<{ link_token: string; plaid_env: string }> {
  return request('/api/plaid/link-token');
}

export async function exchangePlaidToken(public_token: string): Promise<{ item_id: string; institution_name: string }> {
  return request('/api/plaid/exchange', {
    method: 'POST',
    body: JSON.stringify({ public_token }),
  });
}

export async function getPlaidAccounts(): Promise<{ items: PlaidItem[] }> {
  return request('/api/plaid/accounts');
}

export async function syncPlaidItem(item_id: string): Promise<{ added: number; modified: number; removed: number }> {
  return request(`/api/plaid/sync/${item_id}`, { method: 'POST' });
}

export async function disconnectPlaidItem(item_id: string): Promise<void> {
  await request(`/api/plaid/items/${item_id}`, { method: 'DELETE' });
}

// ---- 口座・カード ----

export async function getLinkedAccounts() {
  return request<import('@/types').LinkedAccount[]>('/api/accounts');
}

export async function createLinkedAccount(data: import('@/types').LinkedAccountCreate) {
  return request<import('@/types').LinkedAccount>('/api/accounts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateLinkedAccount(id: number, data: Partial<import('@/types').LinkedAccountCreate & { is_active: boolean }>) {
  return request<import('@/types').LinkedAccount>(`/api/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteLinkedAccount(id: number) {
  return request<{ ok: boolean }>(`/api/accounts/${id}`, { method: 'DELETE' });
}

export async function getAccountSummary(id: number, month?: string) {
  const q = month ? `?month=${month}` : '';
  return request<import('@/types').AccountSummary>(`/api/accounts/${id}/summary${q}`);
}

export async function getAccountImports(id: number) {
  return request<import('@/types').AccountImport[]>(`/api/accounts/${id}/imports`);
}

export async function linkImportToAccount(accountId: number, importId: number) {
  return request<{ ok: boolean }>(`/api/accounts/${accountId}/imports/${importId}`, { method: 'POST' });
}

export async function unlinkImportFromAccount(accountId: number, importId: number) {
  return request<{ ok: boolean }>(`/api/accounts/${accountId}/imports/${importId}`, { method: 'DELETE' });
}

// ---- 支出目標 ----

export async function getGoals() {
  return request<import('@/types').SpendingGoal[]>('/api/goals');
}

export async function createGoal(data: import('@/types').SpendingGoalCreate) {
  return request<import('@/types').SpendingGoal>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateGoal(id: number, data: { target_amount?: number; is_recurring?: boolean }) {
  return request<import('@/types').SpendingGoal>(`/api/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteGoal(id: number) {
  return request<{ ok: boolean }>(`/api/goals/${id}`, { method: 'DELETE' });
}

// ---- サブスクリプション ----

export async function getSubscriptions() {
  return request<import('@/types').SubscriptionsResponse>('/api/goals/subscriptions');
}

// ---- 目標 vs 実績 ----

export async function getGoalVsActual(params: { category?: string; months?: number } = {}) {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString();
  return request<import('@/types').GoalVsActualResponse>(
    `/api/goals/vs-actual${qs ? '?' + qs : ''}`
  );
}

export const CATEGORY_COLORS: Record<string, string> = {
  food_dining:    '#FF6B6B',
  grocery:        '#FF8C42',
  transportation: '#4ECDC4',
  shopping:       '#A29BFE',
  housing:        '#6C5CE7',
  utilities:      '#FDCB6E',
  entertainment:  '#E17055',
  travel:         '#00B894',
  health:         '#55EFC4',
  education:      '#0984E3',
  subscriptions:  '#74B9FF',
  income:         '#00CEC9',
  transfer:       '#B2BEC3',
  other:          '#DFE6E9',
};
