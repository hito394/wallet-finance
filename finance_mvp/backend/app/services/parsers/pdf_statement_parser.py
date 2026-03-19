import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from dateutil import parser as date_parser

from app.services.parsers.types import ParsedTransaction


# Supports common formats: MM/DD/YYYY, YYYY/MM/DD, YYYY-MM-DD, M/D/YY, MM/DD, M/D, etc.
DATE_PATTERN = r"\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|\d{1,2}[/\-]\d{1,2}"
DATE_PREFIX_PATTERN = re.compile(
    rf"^(?P<date>{DATE_PATTERN})(?:\s+(?P<posted>{DATE_PATTERN}))?\s+(?P<rest>.+)$"
)
AMOUNT_TOKEN_PATTERN = re.compile(r"\(?-?\$?\d[\d,]*\.\d{2}\)?(?:\s*CR)?", re.IGNORECASE)

DETAIL_SECTION_TITLES = {
    "TRANSACTION DETAIL",
    "TRANSACTION DETAIL (CONTINUED)",
    "TRANSACTIONS",
    "PAYMENTS AND OTHER CREDITS",
    "DEPOSITS AND ADDITIONS",
    "ELECTRONIC WITHDRAWALS",
    "CHECKS PAID",
    "ATM & DEBIT CARD WITHDRAWALS",
    "ATM AND DEBIT CARD WITHDRAWALS",
    "ATM AND DEBIT CARD ACTIVITY",
    "OTHER WITHDRAWALS, FEES & CHARGES",
    "OTHER WITHDRAWALS",
    "PURCHASE TRANSACTIONS",
    "DAILY TRANSACTIONS",
}
# Sections where every transaction is incoming (credit/income)
CREDIT_SECTION_TITLES = {
    "PAYMENTS AND OTHER CREDITS",
    "DEPOSITS AND ADDITIONS",
}
# Sections where every transaction is outgoing (debit/expense)
DEBIT_SECTION_TITLES = {
    "ELECTRONIC WITHDRAWALS",
    "CHECKS PAID",
    "ATM & DEBIT CARD WITHDRAWALS",
    "ATM AND DEBIT CARD WITHDRAWALS",
    "ATM AND DEBIT CARD ACTIVITY",
    "OTHER WITHDRAWALS, FEES & CHARGES",
    "OTHER WITHDRAWALS",
    "PURCHASE TRANSACTIONS",
}
SUMMARY_SECTION_TITLES = {
    "MINIMUM PAYMENT DUE",
    "NEW BALANCE",
    "PAYMENT DUE DATE",
    "ACCOUNT SUMMARY",
    "BEGINNING BALANCE",
    "ENDING BALANCE",
}

SUMMARY_LINE_KEYWORDS = {
    "MINIMUM PAYMENT DUE",
    "NEW BALANCE",
    "PAYMENT DUE DATE",
    "ACCOUNT SUMMARY",
    "BEGINNING BALANCE",
    "ENDING BALANCE",
    "CREDIT LIMIT",
    "TOTAL FEES",
    "TOTAL INTEREST",
    "PREVIOUS BALANCE",
    "ACCOUNT NUMBER",
}

ACCOUNT_NUMBER_PATTERN = re.compile(r"\b(?:acct|account)\b.*\b\d{4,}\b", re.IGNORECASE)
ACCOUNT_LIKE_FRAGMENT_PATTERN = re.compile(r"^[#*xX\-\s\d]{6,}$")
_CREDIT_HINTS = (
    "salary",
    "payroll",
    "deposit",
    "refund",
    "interest",
    "direct dep",
    "ach credit",
    "transfer in",
    "zelle credit",
    "入金",
    "給与",
)
_DEBIT_HINTS = (
    "withdraw",
    "debit",
    "purchase",
    "charge",
    "fee",
    "payment",
    "transfer out",
    "ach debit",
    "atm",
    "zelle debit",
    "引落",
    "出金",
)


@dataclass
class StatementParseDiagnostics:
    issuer: str
    parser_confidence: float = 0.0
    detail_section_hits: int = 0
    summary_section_hits: int = 0
    skipped_summary_pages: int = 0
    matched_rows: int = 0
    suspicious_account_number_rows: int = 0


def _dedupe_scored_rows(scored_rows: list[tuple[int, ParsedTransaction]]) -> list[ParsedTransaction]:
    parsed: list[ParsedTransaction] = []
    seen: set[tuple[str, str, str, str]] = set()
    for _, tx in scored_rows:
        key = (
            tx.transaction_date.isoformat(),
            tx.description,
            str(tx.amount),
            tx.direction,
        )
        if key in seen:
            continue
        seen.add(key)
        parsed.append(tx)
    return parsed


def _set_parser_confidence(parsed: list[ParsedTransaction], diagnostics: StatementParseDiagnostics) -> None:
    if not parsed:
        diagnostics.parser_confidence = 0.15 if diagnostics.summary_section_hits > 0 else 0.05
    elif diagnostics.detail_section_hits > 0:
        diagnostics.parser_confidence = 0.92
    elif diagnostics.suspicious_account_number_rows > 0:
        diagnostics.parser_confidence = 0.55
    else:
        diagnostics.parser_confidence = 0.75


def _try_parse_date(raw: str):
    try:
        return date_parser.parse(raw, dayfirst=False).date()
    except Exception:
        return None


def _normalize_heading(raw: str) -> str:
    return re.sub(r"\s+", " ", raw.strip().upper())


def _has_section_title(line: str, titles: set[str]) -> bool:
    normalized = _normalize_heading(line)
    return any(title in normalized for title in titles)


def _detect_issuer(text: str) -> str:
    upper = text.upper()
    if "FNBO" in upper or "FIRST NATIONAL BANK OF OMAHA" in upper:
        return "fnbo"
    if "CHASE" in upper or "JPMORGAN" in upper:
        return "chase"
    return "unknown"


def _is_summary_heavy_page(lines: list[str]) -> bool:
    summary_hits = 0
    detail_hits = 0
    for line in lines:
        if _has_section_title(line, SUMMARY_SECTION_TITLES):
            summary_hits += 1
        if _has_section_title(line, DETAIL_SECTION_TITLES):
            detail_hits += 1
    return summary_hits >= 2 and detail_hits == 0


def _parse_amount_token(token: str) -> tuple[Decimal, str, bool] | None:
    """Returns (abs_amount, direction, is_negative).

    direction uses credit-card convention (negative/CR → credit) as a raw default.
    Callers responsible for bank-statement should override direction using
    section context or flip is_negative → debit.
    """
    cleaned = token.strip().upper().replace("$", "")
    has_cr_marker = cleaned.endswith("CR")
    if has_cr_marker:
        cleaned = cleaned[:-2].strip()

    is_negative = False
    if cleaned.startswith("(") and cleaned.endswith(")"):
        is_negative = True
        cleaned = cleaned[1:-1].strip()
    if cleaned.startswith("-"):
        is_negative = True
        cleaned = cleaned[1:].strip()

    cleaned = cleaned.replace(",", "")
    try:
        amount = Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None

    direction = "credit" if has_cr_marker or is_negative else "debit"
    return abs(amount), direction, is_negative


def _pick_amount_match(matches: list[re.Match[str]], source: str) -> re.Match[str]:
    if len(matches) <= 1:
        return matches[-1]
    # For statement rows that include a running balance, the last amount is
    # usually balance, while the prior amount is the transaction value.
    if source in {"bank", "card"}:
        return matches[-2]
    return matches[-1]


def _looks_like_account_number_fragment(value: str) -> bool:
    stripped = value.strip()
    return bool(ACCOUNT_LIKE_FRAGMENT_PATTERN.fullmatch(stripped))


def _should_skip_line(line_upper: str) -> bool:
    return any(keyword in line_upper for keyword in SUMMARY_LINE_KEYWORDS)


def _parse_transaction_line(
    line: str,
    *,
    source: str,
    diagnostics: StatementParseDiagnostics,
    section_direction: str | None = None,
) -> ParsedTransaction | None:
    match = DATE_PREFIX_PATTERN.match(line)
    if not match:
        return None

    line_upper = line.upper()
    if _should_skip_line(line_upper):
        return None

    tx_date = _try_parse_date(match.group("date"))
    if tx_date is None:
        return None

    posted_raw = match.group("posted")
    posted_date = _try_parse_date(posted_raw) if posted_raw else None

    rest = match.group("rest").strip()
    amount_matches = list(AMOUNT_TOKEN_PATTERN.finditer(rest))
    if not amount_matches:
        return None

    amount_match = _pick_amount_match(amount_matches, source)
    parsed_amount = _parse_amount_token(amount_match.group(0))
    if not parsed_amount:
        return None

    amount, raw_direction, is_negative = parsed_amount
    running_balance = None
    if len(amount_matches) >= 2 and source in {"bank", "card"}:
        balance_candidate = amount_matches[-1]
        if balance_candidate.start() != amount_match.start():
            parsed_balance = _parse_amount_token(balance_candidate.group(0))
            if parsed_balance:
                running_balance = parsed_balance[0]

    description = re.sub(r"\s+", " ", rest[: amount_match.start()].strip(" -\t"))
    if len(description) < 3:
        return None

    if _looks_like_account_number_fragment(description):
        diagnostics.suspicious_account_number_rows += 1
        return None

    lower_desc = description.lower()
    # Determine transaction direction:
    # 1) Section context is strongest when available.
    # 2) Description hints override ambiguous numeric sign conventions.
    # 3) Bank default is debit (spend) for unsigned rows; card follows raw sign/CR.
    if section_direction is not None:
        direction = section_direction
    elif any(hint in lower_desc for hint in _CREDIT_HINTS):
        direction = "credit"
    elif any(hint in lower_desc for hint in _DEBIT_HINTS):
        direction = "debit"
    elif source == "bank":
        if is_negative:
            direction = "debit"
        elif raw_direction == "credit":
            direction = "credit"
        else:
            direction = "debit"
    else:
        direction = raw_direction

    return ParsedTransaction(
        transaction_date=tx_date,
        posted_date=posted_date,
        merchant_raw=description,
        description=description,
        amount=amount,
        running_balance=running_balance,
        direction=direction,
        currency="USD",
        source=source,
    )


def _extract_lines_from_page(page) -> list[str]:
    """Reconstruct text lines from a PDF page using word bounding boxes.

    pdfplumber's extract_text() merges multi-column layouts incorrectly for
    bank statements.  extract_words() gives each token with its (x, y) position,
    so we can group tokens that share the same vertical position into a single
    line – preserving the natural left-to-right column order.

    Falls back to extract_text().splitlines() if extract_words() returns nothing.
    """
    try:
        words = page.extract_words(x_tolerance=3, y_tolerance=3, keep_blank_chars=False)
    except Exception:
        words = []

    if not words:
        # Fallback: plain text extraction
        text = page.extract_text() or ""
        return [ln.strip() for ln in text.splitlines() if ln.strip()]

    # Group words by their top-edge coordinate (within a small tolerance so that
    # words on the same typographic line are merged even if they differ by a pixel).
    Y_TOLERANCE = 3.0
    rows: list[tuple[float, list[dict]]] = []  # (representative_y, [word, ...])

    for word in words:
        top = float(word["top"])
        matched = False
        for i, (rep_y, bucket) in enumerate(rows):
            if abs(rep_y - top) <= Y_TOLERANCE:
                bucket.append(word)
                matched = True
                break
        if not matched:
            rows.append((top, [word]))

    # Sort rows top-to-bottom, words left-to-right within each row.
    rows.sort(key=lambda r: r[0])
    lines: list[str] = []
    for _, bucket in rows:
        bucket.sort(key=lambda w: float(w["x0"]))
        line = " ".join(w["text"] for w in bucket).strip()
        if line:
            lines.append(line)

    # ── Continuation-line merging ────────────────────────────────────────────
    # Some bank statements put the transaction description on line N and the
    # amount on line N+1 (no date prefix on N+1).  If line N starts with a date
    # but has no amount token, AND line N+1 has no date prefix, merge them.
    merged: list[str] = []
    i = 0
    while i < len(lines):
        current = lines[i]
        # Does this line start with a date?
        if DATE_PREFIX_PATTERN.match(current):
            # Does it already contain an amount token?
            has_amount = bool(AMOUNT_TOKEN_PATTERN.search(current))
            if not has_amount and i + 1 < len(lines):
                next_line = lines[i + 1]
                # Only merge if the next line does NOT start with a date
                if not DATE_PREFIX_PATTERN.match(next_line):
                    merged.append(current + " " + next_line)
                    i += 2
                    continue
        merged.append(current)
        i += 1

    return merged


def parse_pdf_statement_with_diagnostics(
    file_path: str,
    source: str,
) -> tuple[list[ParsedTransaction], StatementParseDiagnostics]:
    try:
        with __import__("pdfplumber").open(file_path) as pdf:
            pages = list(pdf.pages)
            # Plain text only for issuer detection (cheap single-pass).
            issuer_text = " ".join((p.extract_text() or "") for p in pages)
            issuer = _detect_issuer(issuer_text)
            diagnostics = StatementParseDiagnostics(issuer=issuer)
            scored_rows: list[tuple[int, ParsedTransaction]] = []

            for page_index, page in enumerate(pages):
                lines = _extract_lines_from_page(page)
                if not lines:
                    continue

                if issuer == "fnbo" and page_index == 0 and _is_summary_heavy_page(lines):
                    diagnostics.skipped_summary_pages += 1
                    diagnostics.summary_section_hits += 1
                    continue

                in_detail_section = False
                in_summary_section = False
                section_direction: str | None = None  # "debit" | "credit" | None

                for raw_line in lines:
                    if _has_section_title(raw_line, DETAIL_SECTION_TITLES):
                        diagnostics.detail_section_hits += 1
                        in_detail_section = True
                        in_summary_section = False
                        if _has_section_title(raw_line, CREDIT_SECTION_TITLES):
                            section_direction = "credit"
                        elif _has_section_title(raw_line, DEBIT_SECTION_TITLES):
                            section_direction = "debit"
                        else:
                            section_direction = None
                        continue
                    if _has_section_title(raw_line, SUMMARY_SECTION_TITLES):
                        diagnostics.summary_section_hits += 1
                        in_summary_section = True
                        in_detail_section = False
                        section_direction = None
                        continue

                    if ACCOUNT_NUMBER_PATTERN.search(raw_line):
                        diagnostics.suspicious_account_number_rows += 1

                    tx = _parse_transaction_line(
                        raw_line,
                        source=source,
                        diagnostics=diagnostics,
                        section_direction=section_direction,
                    )
                    if tx is None:
                        continue

                    score = 1
                    if in_detail_section:
                        score += 2
                    if in_summary_section:
                        score -= 2
                    if issuer == "chase" and tx.posted_date is not None:
                        score += 1

                    if score >= 1:
                        diagnostics.matched_rows += 1
                        scored_rows.append((score, tx))

    except Exception:
        return [], StatementParseDiagnostics(issuer="unknown")

    parsed = _dedupe_scored_rows(scored_rows)
    _set_parser_confidence(parsed, diagnostics)

    return parsed, diagnostics


def parse_statement_text_with_diagnostics(
    text: str,
    source: str,
) -> tuple[list[ParsedTransaction], StatementParseDiagnostics]:
    issuer = _detect_issuer(text)
    diagnostics = StatementParseDiagnostics(issuer=issuer)
    scored_rows: list[tuple[int, ParsedTransaction]] = []

    in_detail_section = False
    in_summary_section = False
    section_direction: str | None = None

    for raw_line in text.splitlines():
        line = re.sub(r"\s+", " ", (raw_line or "").strip())
        if not line:
            continue

        if _has_section_title(line, DETAIL_SECTION_TITLES):
            diagnostics.detail_section_hits += 1
            in_detail_section = True
            in_summary_section = False
            if _has_section_title(line, CREDIT_SECTION_TITLES):
                section_direction = "credit"
            elif _has_section_title(line, DEBIT_SECTION_TITLES):
                section_direction = "debit"
            else:
                section_direction = None
            continue

        if _has_section_title(line, SUMMARY_SECTION_TITLES):
            diagnostics.summary_section_hits += 1
            in_summary_section = True
            in_detail_section = False
            section_direction = None
            continue

        if ACCOUNT_NUMBER_PATTERN.search(line):
            diagnostics.suspicious_account_number_rows += 1

        tx = _parse_transaction_line(
            line,
            source=source,
            diagnostics=diagnostics,
            section_direction=section_direction,
        )
        if tx is None:
            continue

        score = 1
        if in_detail_section:
            score += 2
        if in_summary_section:
            score -= 2
        if issuer == "chase" and tx.posted_date is not None:
            score += 1

        if score >= 1:
            diagnostics.matched_rows += 1
            scored_rows.append((score, tx))

    parsed = _dedupe_scored_rows(scored_rows)
    _set_parser_confidence(parsed, diagnostics)

    return parsed, diagnostics


def parse_pdf_statement(file_path: str, source: str) -> list[ParsedTransaction]:
    parsed, _ = parse_pdf_statement_with_diagnostics(file_path, source)
    return parsed

