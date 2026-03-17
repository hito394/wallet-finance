from datetime import datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.category import Category
from app.models.document import FinancialDocument
from app.models.import_job import ImportJob, ImportSourceType, ImportStatus
from app.models.receipt import Receipt
from app.models.review_queue import ReviewQueueItem
from app.models.transaction import Transaction
from app.services.analytics.review_queue_rules import derive_review_reason
from app.services.categorization.engine import categorize_transaction
from app.services.dedupe.duplicate_detector import find_duplicate_by_fingerprint
from app.services.document_intelligence.pipeline import analyze_financial_document
from app.services.matching.receipt_transaction_matcher import match_receipt_to_transactions
from app.services.matching.document_cross_validator import cross_validate_document_with_transactions
from app.services.normalization.merchant_normalizer import normalize_merchant
from app.services.parsers.csv_statement_parser import parse_csv_statement
from app.services.parsers.pdf_statement_parser import parse_pdf_statement_with_diagnostics
from app.services.parsers.receipt_ocr import extract_text, parse_receipt
from app.utils.fingerprint import transaction_fingerprint


def _get_or_create_category(db: Session, entity_id, category_name: str) -> Category:
    slug = category_name.lower().replace(" ", "-")
    category = db.scalar(select(Category).where(Category.entity_id == entity_id, Category.slug == slug))
    if category:
        return category
    category = Category(entity_id=entity_id, name=category_name, slug=slug)
    db.add(category)
    db.flush()
    return category


def _detect_possible_duplicate_document(db: Session, document: FinancialDocument) -> bool:
    if not document.total_amount or not document.purchase_date:
        return False
    existing = db.scalar(
        select(FinancialDocument).where(
            FinancialDocument.entity_id == document.entity_id,
            FinancialDocument.id != document.id,
            FinancialDocument.total_amount == document.total_amount,
            FinancialDocument.purchase_date == document.purchase_date,
            FinancialDocument.merchant_name == document.merchant_name,
        )
    )
    return existing is not None


def _clear_existing_review_items(db: Session, document_id) -> None:
    db.execute(
        delete(ReviewQueueItem).where(
            ReviewQueueItem.document_id == document_id,
            ReviewQueueItem.status == "pending",
        )
    )


def process_import(
    db: Session,
    job: ImportJob,
    local_file_path: str,
    *,
    force_reprocess: bool = False,
) -> None:
    job.status = ImportStatus.processing
    job.processed_at = None
    job.error_message = None
    db.flush()

    # ── Phase 1: document intelligence ────────────────────────────────────────
    # If anything here fails we roll back everything and mark the job failed.
    try:
        file_path = Path(local_file_path)
        suffix = file_path.suffix.lower()

        document_text = ""
        if suffix in {".pdf", ".png", ".jpg", ".jpeg", ".webp"}:
            document_text = extract_text(local_file_path)
        elif suffix == ".csv":
            document_text = f"statement file {job.file_name}"

        source_hint = job.source_type.value if job.source_type else None
        intelligence = analyze_financial_document(document_text, job.file_name, source_type_hint=source_hint)

        existing_document = db.scalar(
            select(FinancialDocument).where(FinancialDocument.import_id == job.id)
        )

        if existing_document and not force_reprocess and existing_document.parsing_status in {
            "parsed",
            "partial",
            "needs_review",
            "failed",
        }:
            job.status = ImportStatus.completed
            job.processed_at = datetime.utcnow()
            job.metadata_json = {
                **(job.metadata_json or {}),
                "idempotent_reuse": True,
                "document_id": str(existing_document.id),
            }
            db.commit()
            return

        if existing_document:
            document = existing_document
            document.storage_uri = job.storage_uri
            document.source_name = job.file_name
            document.document_type = intelligence.document_type
            document.document_type_confidence = intelligence.document_type_confidence
            document.classification_explanation = intelligence.classification_explanation
            document.payment_status = intelligence.payment_status
            document.is_proof_of_purchase = intelligence.is_proof_of_purchase
            document.is_billing_request = intelligence.is_billing_request
            document.is_refund_document = intelligence.is_refund_document
            document.business_expense_candidate = intelligence.business_expense_candidate
            document.reimbursable_candidate = intelligence.reimbursable_candidate
            document.tax_relevant_candidate = intelligence.tax_relevant_candidate
            document.retention_recommended = intelligence.retention_recommended
            document.merchant_name = intelligence.merchant_name
            document.merchant_address = intelligence.merchant_address
            document.purchase_date = intelligence.purchase_date
            document.invoice_date = intelligence.invoice_date
            document.due_date = intelligence.due_date
            document.subtotal_amount = intelligence.subtotal_amount
            document.total_amount = intelligence.total_amount
            document.tax_amount = intelligence.tax_amount
            document.currency = intelligence.currency
            document.payment_method = intelligence.payment_method
            document.invoice_number = intelligence.invoice_number
            document.order_number = intelligence.order_number
            document.line_items = intelligence.line_items
            document.raw_text = intelligence.raw_text
            document.extraction_confidence = intelligence.extraction_confidence
            document.likely_issuer = intelligence.likely_issuer
            document.source_type_hint = intelligence.source_type_hint
            document.raw_text_preview = intelligence.raw_text_preview
            document.parsing_status = "pending"
            document.parsing_failure_reason = None
            document.review_required = False
            document.review_reason = None
            document.extracted_transaction_count = 0
            document.transactions_created_count = 0
            document.extracted_total_amount = None
            document.match_confidence = None
            document.match_reason = None
            document.matched_by_amount = False
            document.matched_by_merchant = False
            document.matched_by_date = False
        else:
            document = FinancialDocument(
                user_id=job.user_id,
                entity_id=job.entity_id,
                import_id=job.id,
                storage_uri=job.storage_uri,
                source_name=job.file_name,
                document_type=intelligence.document_type,
                document_type_confidence=intelligence.document_type_confidence,
                classification_explanation=intelligence.classification_explanation,
                payment_status=intelligence.payment_status,
                is_proof_of_purchase=intelligence.is_proof_of_purchase,
                is_billing_request=intelligence.is_billing_request,
                is_refund_document=intelligence.is_refund_document,
                possible_duplicate_document=False,
                business_expense_candidate=intelligence.business_expense_candidate,
                reimbursable_candidate=intelligence.reimbursable_candidate,
                tax_relevant_candidate=intelligence.tax_relevant_candidate,
                retention_recommended=intelligence.retention_recommended,
                review_required=False,
                review_reason=None,
                merchant_name=intelligence.merchant_name,
                merchant_address=intelligence.merchant_address,
                purchase_date=intelligence.purchase_date,
                invoice_date=intelligence.invoice_date,
                due_date=intelligence.due_date,
                subtotal_amount=intelligence.subtotal_amount,
                total_amount=intelligence.total_amount,
                tax_amount=intelligence.tax_amount,
                currency=intelligence.currency,
                payment_method=intelligence.payment_method,
                invoice_number=intelligence.invoice_number,
                order_number=intelligence.order_number,
                line_items=intelligence.line_items,
                raw_text=intelligence.raw_text,
                extraction_confidence=intelligence.extraction_confidence,
                likely_issuer=intelligence.likely_issuer,
                source_type_hint=intelligence.source_type_hint,
                parsing_status="pending",
                parsing_failure_reason=None,
                raw_text_preview=intelligence.raw_text_preview,
                extracted_transaction_count=0,
                transactions_created_count=0,
                extracted_total_amount=None,
            )
            db.add(document)

        db.flush()
        document.possible_duplicate_document = _detect_possible_duplicate_document(db, document)
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        job.status = ImportStatus.failed
        job.error_message = str(exc)
        job.processed_at = datetime.utcnow()
        db.add(job)
        db.commit()
        return

    # ── Phase 2: transaction / receipt extraction ─────────────────────────────
    # The FinancialDocument is already flushed.  If parsing fails we still
    # commit the document so it appears in the UI; only the job is marked failed.
    try:
        if job.source_type in {ImportSourceType.bank_statement, ImportSourceType.credit_card_statement}:
            parser_confidence = 0.9
            summary_without_detail = False
            suspicious_account_number_rows = 0
            if suffix == ".csv":
                parser_name = "csv_statement_parser"
                source = "card" if job.source_type == ImportSourceType.credit_card_statement else "bank"
                parsed_transactions = parse_csv_statement(local_file_path, source=source)
            elif suffix == ".pdf":
                parser_name = "pdf_statement_parser"
                source = "card" if job.source_type == ImportSourceType.credit_card_statement else "bank"
                parsed_transactions, statement_diagnostics = parse_pdf_statement_with_diagnostics(
                    local_file_path,
                    source=source,
                )
                parser_confidence = statement_diagnostics.parser_confidence
                summary_without_detail = (
                    statement_diagnostics.summary_section_hits > 0
                    and statement_diagnostics.detail_section_hits == 0
                )
                suspicious_account_number_rows = statement_diagnostics.suspicious_account_number_rows
            else:
                parser_name = "unknown"
                parsed_transactions = []
                parser_confidence = 0.0

            # Delete old transactions only after parsing succeeds, so a parse
            # failure never leaves the import with zero transactions.
            if force_reprocess:
                db.execute(
                    delete(Transaction).where(
                        Transaction.entity_id == job.entity_id,
                        Transaction.import_id == job.id,
                    )
                )

            created_count = 0
            duplicate_count = 0
            same_import_existing_count = 0
            extracted_amount_total = Decimal("0")
            for item in parsed_transactions:
                merchant_normalized = normalize_merchant(item.merchant_raw)
                category_result = categorize_transaction(item.merchant_raw, item.description)
                category = _get_or_create_category(db, job.entity_id, category_result.category)
                fingerprint = transaction_fingerprint(
                    item.transaction_date,
                    item.amount,
                    merchant_normalized,
                    item.description,
                    item.source,
                )

                duplicate = find_duplicate_by_fingerprint(db, job.entity_id, fingerprint)
                if duplicate:
                    if duplicate.import_id == job.id:
                        same_import_existing_count += 1
                    else:
                        duplicate_count += 1
                    continue

                tx = Transaction(
                    user_id=job.user_id,
                    entity_id=job.entity_id,
                    import_id=job.id,
                    document_id=document.id,
                    external_txn_id=item.external_txn_id,
                    transaction_date=item.transaction_date,
                    posted_date=item.posted_date,
                    merchant_raw=item.merchant_raw,
                    merchant_normalized=merchant_normalized,
                    description=item.description,
                    amount=item.amount,
                    running_balance=item.running_balance,
                    direction=item.direction,
                    currency=item.currency,
                    category_id=category.id,
                    source=item.source,
                    fingerprint=fingerprint,
                )
                db.add(tx)
                created_count += 1
                extracted_amount_total += item.amount or Decimal("0")

            parsed_row_count = len(parsed_transactions)

            if parsed_row_count == 0:
                extracted_amount_total = Decimal("0")
            else:
                extracted_amount_total = sum((item.amount or Decimal("0") for item in parsed_transactions), Decimal("0"))

            # Statements generate rows and may include partial extraction confidence.
            document.match_confidence = parser_confidence
            document.match_reason = (
                f"statement_rows={parsed_row_count} created={created_count} duplicates={duplicate_count}"
            )
            document.matched_by_amount = created_count > 0
            document.matched_by_merchant = False
            document.matched_by_date = parsed_row_count > 0
            document.extraction_confidence = max(document.extraction_confidence, parser_confidence)

            # Persist extraction outcome
            document.extracted_transaction_count = parsed_row_count
            document.transactions_created_count = created_count
            document.extracted_total_amount = extracted_amount_total if parsed_row_count > 0 else None

            if parsed_row_count > 0 and created_count > 0:
                if parser_confidence < 0.65:
                    document.parsing_status = "partial"
                    document.parsing_failure_reason = (
                        "low_confidence_statement_extraction: "
                        "Transactions extracted but parser confidence is low"
                    )
                elif duplicate_count > 0 or created_count < parsed_row_count:
                    document.parsing_status = "partial"
                    document.parsing_failure_reason = (
                        "partial_statement_parse: "
                        "Some rows were skipped as duplicates or could not be saved"
                    )
                else:
                    document.parsing_status = "parsed"
                    document.parsing_failure_reason = None
            elif parsed_row_count > 0 and created_count == 0 and same_import_existing_count > 0:
                document.parsing_status = "parsed"
                document.parsing_failure_reason = None
            elif parsed_row_count > 0 and created_count == 0:
                document.parsing_status = "needs_review"
                document.parsing_failure_reason = (
                    "partial_statement_parse: "
                    "Rows were extracted but no new transactions were created"
                )
            elif summary_without_detail:
                document.parsing_status = "failed"
                document.parsing_failure_reason = (
                    "statement_summary_detected_without_detail_rows: "
                    "Summary sections found without transaction detail rows"
                )
            elif suspicious_account_number_rows > 0:
                document.parsing_status = "failed"
                document.parsing_failure_reason = (
                    "account_number_misread_as_merchant: "
                    "Account-number-like tokens were detected instead of merchant rows"
                )
            else:
                document.parsing_status = "failed"
                document.parsing_failure_reason = (
                    "missing_transaction_rows: No transaction rows were extracted from statement"
                )

            job.metadata_json = {
                "created_transactions": created_count,
                "duplicate_transactions": duplicate_count,
                "same_import_existing_transactions": same_import_existing_count,
                "parsed_statement_rows": parsed_row_count,
                "parser_confidence": parser_confidence,
                "transactions_created": created_count > 0,
                "document_type": document.document_type.value,
            }
            job.parser_name = parser_name

        else:
            parser_name = "receipt_ocr"
            parsed_receipt = parse_receipt(local_file_path)
            merchant_normalized = normalize_merchant(parsed_receipt.merchant_raw)
            receipt = Receipt(
                user_id=job.user_id,
                entity_id=job.entity_id,
                import_id=job.id,
                merchant_raw=parsed_receipt.merchant_raw,
                merchant_normalized=merchant_normalized,
                total_amount=parsed_receipt.total_amount,
                currency=parsed_receipt.currency,
                purchase_date=parsed_receipt.purchase_date,
                tax_amount=parsed_receipt.tax_amount,
                line_items=parsed_receipt.line_items,
                raw_text=parsed_receipt.raw_text,
                ocr_confidence=parsed_receipt.confidence,
            )
            db.add(receipt)
            db.flush()

            match = match_receipt_to_transactions(db, receipt)
            validation = cross_validate_document_with_transactions(db, document)
            document.match_confidence = validation["match_confidence"]
            document.match_reason = validation["match_reason"]
            document.matched_by_amount = validation["matched_by_amount"]
            document.matched_by_merchant = validation["matched_by_merchant"]
            document.matched_by_date = validation["matched_by_date"]

            # Receipts: no transaction rows to count, but OCR extraction succeeded
            document.extracted_transaction_count = 0
            document.transactions_created_count = 0
            document.extracted_total_amount = None
            if parsed_receipt.total_amount:
                document.parsing_status = "parsed"
                document.parsing_failure_reason = None
            else:
                document.parsing_status = "needs_review"
                document.parsing_failure_reason = "Could not extract total amount from receipt"

            job.metadata_json = {
                "ocr_confidence": parsed_receipt.confidence,
                "matched_transaction": str(match.transaction_id) if match else None,
                "document_type": document.document_type.value,
            }
            job.parser_name = parser_name

        _clear_existing_review_items(db, document.id)
        document.review_required = False
        document.review_reason = None
        need_review, reason_code, reason_text = derive_review_reason(document)
        if need_review and reason_code and reason_text:
            db.add(
                ReviewQueueItem(
                    user_id=job.user_id,
                    entity_id=job.entity_id,
                    document_id=document.id,
                    reason_code=reason_code,
                    reason_text=reason_text,
                )
            )
            document.review_required = True
            document.review_reason = reason_text
            # Keep partial status when available; parsed documents with a review issue
            # are downgraded to needs_review.
            if document.parsing_status == "parsed":
                document.parsing_status = "needs_review"

        job.status = ImportStatus.completed
        job.processed_at = datetime.utcnow()
        db.commit()
    except Exception as exc:  # noqa: BLE001
        # Keep the document; only the extraction phase failed.
        document.parsing_status = "failed"
        document.parsing_failure_reason = str(exc)[:400]
        job.status = ImportStatus.failed
        job.error_message = str(exc)
        job.processed_at = datetime.utcnow()
        db.commit()
