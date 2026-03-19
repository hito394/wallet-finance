import hashlib
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.db.session import get_db
from app.models.document import FinancialDocument
from app.models.import_job import ImportJob, ImportSourceType, ImportStatus
from app.schemas.import_job import ImportJobRead
from app.services.ingestion.pipeline import process_import
from app.utils.user_context import resolve_actor_context

router = APIRouter()


def _infer_source_type(file_name: str) -> ImportSourceType:
    name = (file_name or "").lower()
    suffix = Path(file_name or "").suffix.lower()

    def has_any(*tokens: str) -> bool:
        return any(token in name for token in tokens)

    if suffix in {".ofx", ".qfx"}:
        return ImportSourceType.bank_statement

    if suffix == ".csv":
        if has_any("credit", "card", "visa", "master", "amex", "jcb"):
            return ImportSourceType.credit_card_statement
        return ImportSourceType.bank_statement

    if has_any("wallet", "screenshot", "screen-shot", "スクショ", "スクリーンショット"):
        return ImportSourceType.wallet_screenshot

    if has_any("refund", "返金", "chargeback"):
        return ImportSourceType.refund_confirmation

    if has_any("subscription", "subscr", "membership", "monthly", "月額", "定期"):
        return ImportSourceType.subscription_billing_record

    if has_any("paid-invoice", "invoice-paid", "paid invoice", "支払済", "支払い済"):
        return ImportSourceType.paid_invoice

    if has_any("invoice", "請求", "bill"):
        return ImportSourceType.invoice

    if has_any("email", "mail") and has_any("receipt", "invoice", "領収"):
        return ImportSourceType.email_receipt

    if has_any("receipt", "領収", "レシート"):
        return ImportSourceType.receipt

    if has_any("credit-card", "card-statement", "カード明細", "cc_"):
        return ImportSourceType.credit_card_statement

    if has_any("bank-statement", "statement", "account-activity", "取引明細", "明細"):
        return ImportSourceType.bank_statement

    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return ImportSourceType.receipt

    return ImportSourceType.financial_document


def _infer_source_type_from_content(file_path: Path, file_name: str) -> ImportSourceType | None:
    suffix = file_path.suffix.lower()

    def classify_text(raw_text: str) -> ImportSourceType | None:
        text = (raw_text or "").lower()
        if not text:
            return None

        card_hints = (
            "credit card",
            "cardmember",
            "payment due",
            "minimum payment",
            "visa",
            "mastercard",
            "amex",
            "jcb",
            "カード",
        )
        bank_hints = (
            "account statement",
            "account activity",
            "available balance",
            "deposits",
            "withdrawals",
            "bank statement",
            "残高",
            "口座",
            "入出金",
        )
        receipt_hints = (
            "receipt",
            "thank you",
            "subtotal",
            "tax",
            "total",
            "領収",
            "レシート",
        )
        invoice_hints = (
            "invoice",
            "bill to",
            "invoice #",
            "due date",
            "請求",
            "請求書",
        )

        if any(hint in text for hint in card_hints):
            return ImportSourceType.credit_card_statement
        if any(hint in text for hint in bank_hints):
            return ImportSourceType.bank_statement
        if any(hint in text for hint in invoice_hints):
            return ImportSourceType.invoice
        if any(hint in text for hint in receipt_hints):
            return ImportSourceType.receipt
        return None

    try:
        if suffix in {".csv", ".ofx", ".qfx", ".txt"}:
            sample = file_path.read_text(encoding="utf-8", errors="ignore")[:12000]
            return classify_text(sample)

        if suffix == ".pdf":
            try:
                pdfplumber = __import__("pdfplumber")
                with pdfplumber.open(str(file_path)) as pdf:
                    pages = pdf.pages[:2]
                    sample = "\n".join((page.extract_text() or "") for page in pages)[:20000]
                classified = classify_text(sample)
                if classified:
                    return classified
            except Exception:
                return None
    except Exception:
        return None

    # Filename remains fallback for media files where OCR is expensive here.
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return _infer_source_type(file_name)

    return None


def _upload_size(file: UploadFile) -> int:
    if file.size is not None:
        return file.size

    # Fallback for servers that don't provide UploadFile.size.
    position = file.file.tell()
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(position)
    return size


def _persist_upload_and_hash(file: UploadFile, destination: Path) -> str:
    digest = hashlib.sha256()
    with destination.open("wb") as buffer:
        while True:
            chunk = file.file.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            buffer.write(chunk)
    return digest.hexdigest()


def _run_import_job(import_id: str) -> None:
    with SessionLocal() as db:
        job = db.scalar(select(ImportJob).where(ImportJob.id == import_id))
        if not job:
            return
        process_import(db, job, job.storage_uri)


@router.post("/upload", response_model=ImportJobRead, status_code=status.HTTP_201_CREATED)
def upload_import(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    source_type: str | None = None,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ImportJobRead:
    user, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    upload_size = _upload_size(file)
    max_upload_bytes = settings.max_upload_mb * 1024 * 1024
    if upload_size > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_upload_mb}MB limit",
        )

    settings.file_storage_root.mkdir(parents=True, exist_ok=True)

    safe_name = Path(file.filename or "upload.bin").name
    destination = settings.file_storage_root / f"{uuid4()}_{safe_name}"
    file_hash = _persist_upload_and_hash(file, destination)

    parsed_source_type: ImportSourceType | None = None
    if source_type and source_type.lower() != "auto":
        try:
            parsed_source_type = ImportSourceType(source_type)
        except ValueError as exc:
            allowed_values = ", ".join(t.value for t in ImportSourceType)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid source_type '{source_type}'. Allowed values: {allowed_values}, auto",
            ) from exc

    if parsed_source_type is not None:
        resolved_source_type = parsed_source_type
    else:
        resolved_source_type = _infer_source_type_from_content(destination, safe_name) or _infer_source_type(safe_name)

    # Idempotency guard: same entity + source_type + content hash reuses the
    # existing import job to avoid duplicate document/transaction rows.
    existing = db.scalar(
        select(ImportJob)
        .where(
            ImportJob.entity_id == entity.id,
            ImportJob.source_type == resolved_source_type,
            ImportJob.file_hash == file_hash,
        )
        .order_by(ImportJob.created_at.desc())
    )

    if existing and existing.status in {ImportStatus.pending, ImportStatus.processing, ImportStatus.completed}:
        existing_document = db.scalar(
            select(FinancialDocument)
            .where(
                FinancialDocument.entity_id == entity.id,
                FinancialDocument.import_id == existing.id,
            )
            .order_by(FinancialDocument.created_at.desc())
        )
        # Reuse should not lock users into a failed parse result.
        if existing_document and existing_document.parsing_status == "failed":
            existing = None

    if existing and existing.status in {ImportStatus.pending, ImportStatus.processing, ImportStatus.completed}:
        # Best-effort cleanup: this request uploaded a duplicate payload, so we
        # can discard the newly written temporary file.
        try:
            destination.unlink(missing_ok=True)
        except Exception:
            pass

        existing.metadata_json = {
            **(existing.metadata_json or {}),
            "idempotent_reuse": True,
            "reused_upload_file_name": safe_name,
        }
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing

    job = ImportJob(
        user_id=user.id,
        entity_id=entity.id,
        source_type=resolved_source_type,
        status=ImportStatus.pending,
        file_name=safe_name,
        file_hash=file_hash,
        storage_uri=str(destination),
        metadata_json={},
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_run_import_job, str(job.id))

    return job


@router.get("/{import_id}", response_model=ImportJobRead)
def get_import(
    import_id: str,
    x_user_id: str | None = Header(default=None),
    x_entity_id: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> ImportJobRead:
    import uuid as _uuid

    _, entity = resolve_actor_context(db, x_user_id, x_entity_id)
    try:
        import_uuid = _uuid.UUID(import_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid import_id")

    job = db.scalar(
        select(ImportJob).where(
            ImportJob.id == import_uuid,
            ImportJob.entity_id == entity.id,
        )
    )
    if not job:
        raise HTTPException(status_code=404, detail="Import job not found")
    return job
