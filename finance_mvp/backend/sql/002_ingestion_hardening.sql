-- Ingestion hardening migration
-- Goals:
-- 1) Add idempotency and parsing observability columns
-- 2) Add document extraction / matching columns required by production code
-- 3) Link transactions to documents
-- 4) Enforce uniqueness to prevent duplicate document/transaction rows

ALTER TABLE imports
    ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS raw_text_preview VARCHAR(2000),
    ADD COLUMN IF NOT EXISTS likely_issuer VARCHAR(120),
    ADD COLUMN IF NOT EXISTS source_type_hint VARCHAR(80),
    ADD COLUMN IF NOT EXISTS parsing_status VARCHAR(40) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS parsing_failure_reason VARCHAR(400),
    ADD COLUMN IF NOT EXISTS extracted_transaction_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS transactions_created_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS extracted_total_amount NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS match_confidence DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS match_reason VARCHAR(400),
    ADD COLUMN IF NOT EXISTS matched_by_amount BOOLEAN,
    ADD COLUMN IF NOT EXISTS matched_by_merchant BOOLEAN,
    ADD COLUMN IF NOT EXISTS matched_by_date BOOLEAN;

ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id),
    ADD COLUMN IF NOT EXISTS running_balance NUMERIC(12,2);

-- Backfill document_id from import_id where possible.
WITH latest_doc AS (
    SELECT DISTINCT ON (import_id) import_id, id
    FROM documents
    WHERE import_id IS NOT NULL
    ORDER BY import_id, created_at DESC, id DESC
)
UPDATE transactions t
SET document_id = ld.id
FROM latest_doc ld
WHERE t.import_id = ld.import_id
  AND t.document_id IS NULL;

-- Remove duplicate documents for the same import before adding uniqueness.
WITH ranked_docs AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY import_id
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM documents
    WHERE import_id IS NOT NULL
)
DELETE FROM documents d
USING ranked_docs r
WHERE d.id = r.id
  AND r.rn > 1;

-- Remove duplicate transactions by fingerprint before adding uniqueness.
WITH ranked_tx AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY entity_id, fingerprint
            ORDER BY created_at DESC, id DESC
        ) AS rn
    FROM transactions
    WHERE fingerprint IS NOT NULL
)
DELETE FROM transactions t
USING ranked_tx r
WHERE t.id = r.id
  AND r.rn > 1;

CREATE INDEX IF NOT EXISTS idx_imports_entity_source_hash
    ON imports(entity_id, source_type, file_hash);

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_import_id
    ON documents(import_id)
    WHERE import_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_entity_fingerprint
    ON transactions(entity_id, fingerprint)
    WHERE fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_document_id
    ON transactions(document_id);
