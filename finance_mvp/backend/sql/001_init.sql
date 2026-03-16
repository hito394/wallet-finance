CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) UNIQUE NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    default_currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id),
    name VARCHAR(120) NOT NULL,
    entity_type VARCHAR(30) NOT NULL,
    base_currency CHAR(3) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS entity_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(30) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_entity_member UNIQUE (entity_id, user_id)
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id),
    name VARCHAR(80) NOT NULL,
    slug VARCHAR(80) NOT NULL,
    parent_id UUID NULL REFERENCES categories(id),
    CONSTRAINT uq_category_entity_slug UNIQUE (entity_id, slug)
);

CREATE TABLE IF NOT EXISTS imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    source_type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_uri VARCHAR(512) NOT NULL,
    parser_name VARCHAR(120),
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    import_id UUID REFERENCES imports(id),
    storage_uri VARCHAR(512) NOT NULL,
    source_name VARCHAR(255) NOT NULL,

    document_type VARCHAR(50) NOT NULL,
    document_type_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
    classification_explanation TEXT NOT NULL DEFAULT '',

    payment_status VARCHAR(20) NOT NULL DEFAULT 'unknown',
    is_proof_of_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    is_billing_request BOOLEAN NOT NULL DEFAULT FALSE,
    is_refund_document BOOLEAN NOT NULL DEFAULT FALSE,
    possible_duplicate_document BOOLEAN NOT NULL DEFAULT FALSE,

    business_expense_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    reimbursable_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    tax_relevant_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    retention_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    review_required BOOLEAN NOT NULL DEFAULT FALSE,
    review_reason VARCHAR(400),

    merchant_name VARCHAR(255),
    merchant_address VARCHAR(255),
    purchase_date DATE,
    invoice_date DATE,
    due_date DATE,
    subtotal_amount NUMERIC(12,2),
    total_amount NUMERIC(12,2),
    tax_amount NUMERIC(12,2),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    payment_method VARCHAR(120),
    invoice_number VARCHAR(120),
    order_number VARCHAR(120),
    line_items JSONB,
    raw_text TEXT,
    extraction_confidence DOUBLE PRECISION NOT NULL DEFAULT 0,

    match_confidence DOUBLE PRECISION,
    match_reason VARCHAR(300),
    matched_by_amount BOOLEAN NOT NULL DEFAULT FALSE,
    matched_by_merchant BOOLEAN NOT NULL DEFAULT FALSE,
    matched_by_date BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    import_id UUID REFERENCES imports(id),
    merchant_raw VARCHAR(255),
    merchant_normalized VARCHAR(255),
    total_amount NUMERIC(12,2),
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    purchase_date DATE,
    tax_amount NUMERIC(12,2),
    line_items JSONB,
    raw_text TEXT,
    ocr_confidence DOUBLE PRECISION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    import_id UUID REFERENCES imports(id),
    external_txn_id VARCHAR(120),
    transaction_date DATE NOT NULL,
    posted_date DATE,
    merchant_raw VARCHAR(255) NOT NULL,
    merchant_normalized VARCHAR(255) NOT NULL,
    description VARCHAR(512) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    category_id UUID REFERENCES categories(id),
    source VARCHAR(20) NOT NULL,
    receipt_id UUID REFERENCES receipts(id),
    duplicate_of_id UUID REFERENCES transactions(id),
    is_ignored BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    fingerprint VARCHAR(80) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    receipt_id UUID NOT NULL REFERENCES receipts(id),
    confidence DOUBLE PRECISION NOT NULL,
    signal_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    matcher_version VARCHAR(50) NOT NULL DEFAULT 'v1',
    matched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    document_id UUID REFERENCES documents(id),
    transaction_id UUID REFERENCES transactions(id),
    reason_code VARCHAR(80) NOT NULL,
    reason_text TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS learning_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    feedback_type VARCHAR(50) NOT NULL,
    source_object VARCHAR(80) NOT NULL,
    source_id UUID NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_owner ON entities(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_entity_members_entity_user ON entity_members(entity_id, user_id);
CREATE INDEX IF NOT EXISTS idx_categories_entity ON categories(entity_id);
CREATE INDEX IF NOT EXISTS idx_imports_entity_status ON imports(entity_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_entity_type ON documents(entity_id, document_type);
CREATE INDEX IF NOT EXISTS idx_documents_purchase_date ON documents(entity_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_transactions_entity_date ON transactions(entity_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_fingerprint ON transactions(entity_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_receipts_entity_date ON receipts(entity_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_review_queue_entity_status ON review_queue(entity_id, status);
CREATE INDEX IF NOT EXISTS idx_learning_feedback_entity_type ON learning_feedback(entity_id, feedback_type);
