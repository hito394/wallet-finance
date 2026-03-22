// API型定義

export interface Transaction {
  id: number;
  user_id: number;
  import_record_id: number | null;
  transaction_date: string; // ISO date string
  merchant_raw: string;
  merchant_normalized: string | null;
  description: string | null;
  amount: string; // Decimal -> string
  balance: string | null;
  direction: 'debit' | 'credit';
  category: string | null;
  source_type: 'csv_statement' | 'pdf_statement' | 'manual';
  notes: string | null;
  is_ignored: boolean;
  dedup_hash: string | null;
  created_at: string;
  updated_at: string;
  receipt_id: number | null;
}

export interface TransactionListResponse {
  items: Transaction[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface Receipt {
  id: number;
  user_id: number;
  transaction_id: number | null;
  original_filename: string;
  file_type: string;
  status: 'pending' | 'processing' | 'parsed' | 'matched' | 'unmatched' | 'failed';
  merchant_name: string | null;
  purchase_date: string | null;
  total_amount: string | null;
  tax_amount: string | null;
  subtotal_amount: string | null;
  ocr_confidence: number | null;
  line_items: Array<{ name: string; amount: number }> | null;
  notes: string | null;
  is_manually_matched: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReceiptListResponse {
  items: Receipt[];
  total: number;
  page: number;
  per_page: number;
}

export interface ImportRecord {
  id: number;
  user_id: number;
  original_filename: string;
  import_type: 'csv_statement' | 'pdf_statement' | 'receipt_image' | 'receipt_pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  total_rows: number;
  success_rows: number;
  skipped_rows: number;
  error_rows: number;
  error_message: string | null;
  parser_meta: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
}

export interface ImportResultResponse {
  import_record: ImportRecord;
  message: string;
  transactions_created: number;
  transactions_skipped: number;
  errors: string[];
}

export interface CategorySummary {
  category: string;
  category_ja: string;
  icon: string | null;
  color: string | null;
  total_amount: string;
  transaction_count: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  total_expense: string;
  total_income: string;
  net: string;
  transaction_count: number;
}

export interface DashboardSummary {
  current_month: string;
  month_total_expense: string;
  month_total_income: string;
  month_net: string;
  month_transaction_count: number;
  category_breakdown: CategorySummary[];
  monthly_trends: MonthlyTrend[];
  uncategorized_count: number;
  unmatched_receipt_count: number;
  possible_duplicate_count: number;
  total_import_count: number;
}

export type TransactionDirection = 'debit' | 'credit';

// ── 口座・カード ──────────────────────────────────────────────────────────────

export type AccountType = 'checking' | 'savings' | 'credit' | 'debit' | 'prepaid' | 'investment' | 'other';

export interface LinkedAccount {
  id: number;
  user_id: number;
  name: string;
  institution: string;
  account_type: AccountType;
  last4: string | null;
  color: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinkedAccountCreate {
  name: string;
  institution: string;
  account_type: AccountType;
  last4?: string;
  color: string;
  notes?: string;
}

export interface AccountSummary {
  account: LinkedAccount;
  month_expense: string;
  month_income: string;
  month_net: string;
  month_transaction_count: number;
  total_import_count: number;
  last_import_at: string | null;
}

export interface AccountImport {
  id: number;
  original_filename: string;
  import_type: string;
  status: string;
  success_rows: number;
  created_at: string;
}

// ── 支出目標 ──────────────────────────────────────────────────────────────────

export interface SpendingGoal {
  id: number;
  user_id: number;
  category: string | null;
  month: string | null;
  target_amount: string;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpendingGoalCreate {
  category: string | null;
  month: string | null;
  target_amount: number;
  is_recurring: boolean;
}

// ── サブスクリプション ─────────────────────────────────────────────────────────

export interface SubscriptionItem {
  merchant: string;
  merchant_domain: string | null;
  monthly_amount: string;
  last_charge_date: string;
  charge_count: number;
  category: string;
}

export interface SubscriptionsResponse {
  subscriptions: SubscriptionItem[];
  total_monthly: string;
}

// ── 目標 vs 実績 ──────────────────────────────────────────────────────────────

export interface GoalVsActualPoint {
  month: string;
  actual: string;
  goal: string | null;
}

export interface GoalVsActualResponse {
  points: GoalVsActualPoint[];
  category: string | null;
  target_amount: string | null;
}
