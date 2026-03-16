from datetime import datetime
from pathlib import Path

from sqlalchemy import select
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
from app.services.parsers.pdf_statement_parser import parse_pdf_statement
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


def process_import(db: Session, job: ImportJob, local_file_path: str) -> None:
    job.status = ImportStatus.processing
    job.processed_at = None
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

        intelligence = analyze_financial_document(document_text, job.file_name)
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
            review_required=intelligence.review_required,
            review_reason=intelligence.review_reason,
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
            if suffix == ".csv":
                parser_name = "csv_statement_parser"
                source = "card" if job.source_type == ImportSourceType.credit_card_statement else "bank"
                parsed_transactions = parse_csv_statement(local_file_path, source=source)
            elif suffix == ".pdf":
                parser_name = "pdf_statement_parser"
                source = "card" if job.source_type == ImportSourceType.credit_card_statement else "bank"
                parsed_transactions = parse_pdf_statement(local_file_path, source=source)
            else:
                parser_name = "unknown"
                parsed_transactions = []

            created_count = 0
            duplicate_count = 0
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
                    duplicate_count += 1
                    continue

                tx = Transaction(
                    user_id=job.user_id,
                    entity_id=job.entity_id,
                    import_id=job.id,
                    external_txn_id=item.external_txn_id,
                    transaction_date=item.transaction_date,
                    posted_date=item.posted_date,
                    merchant_raw=item.merchant_raw,
                    merchant_normalized=merchant_normalized,
                    description=item.description,
                    amount=item.amount,
                    direction=item.direction,
                    currency=item.currency,
                    category_id=category.id,
                    source=item.source,
                    fingerprint=fingerprint,
                )
                db.add(tx)
                created_count += 1

            validation = cross_validate_document_with_transactions(db, document)
            document.match_confidence = validation["match_confidence"]
            document.match_reason = validation["match_reason"]
            document.matched_by_amount = validation["matched_by_amount"]
            document.matched_by_merchant = validation["matched_by_merchant"]
            document.matched_by_date = validation["matched_by_date"]

            job.metadata_json = {
                "created_transactions": created_count,
                "duplicate_transactions": duplicate_count,
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

            job.metadata_json = {
                "ocr_confidence": parsed_receipt.confidence,
                "matched_transaction": str(match.transaction_id) if match else None,
                "document_type": document.document_type.value,
            }
            job.parser_name = parser_name

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

        job.status = ImportStatus.completed
        job.processed_at = datetime.utcnow()
        db.commit()
    except Exception as exc:  # noqa: BLE001
        # Keep the document; only the extraction phase failed.
        job.status = ImportStatus.failed
        job.error_message = str(exc)
        job.processed_at = datetime.utcnow()
        db.commit()
