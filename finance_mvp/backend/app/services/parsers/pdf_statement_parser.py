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


@dataclass
class StatementParseDiagnostics:
    issuer: str
    parser_confidence: float = 0.0
    detail_section_hits: int = 0
    summary_section_hits: int = 0
    skipped_summary_pages: int = 0
    matched_rows: int = 0
    suspicious_account_number_rows: int = 0


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

    # Determine transaction direction:
    # 1. If we know the section type (deposits vs withdrawals), trust that first.
    # 2. For bank statements with signed amounts: negative = outgoing (debit/expense),
    #    positive = incoming (credit/income).  This is the opposite of the raw credit-card
    #    convention used inside _parse_amount_token.
    # 3. For credit cards: keep raw convention (negative/CR → credit, positive → debit).
    if section_direction is not None:
        direction = section_direction
    elif source == "bank":
        direction = "debit" if is_negative else "credit"
    else:
        direction = raw_direction

    description = re.sub(r"\s+", " ", rest[: amount_match.start()].strip(" -\t"))
    if len(description) < 3:
        return None

    if _looks_like_account_number_fragment(description):
        diagnostics.suspicious_account_number_rows += 1
        return None

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


def parse_pdf_statement_with_diagnostics(
    file_path: str,
    source: str,
) -> tuple[list[ParsedTransaction], StatementParseDiagnostics]:
    try:
        with __import__("pdfplumber").open(file_path) as pdf:
            pages_text = [(page.extract_text() or "") for page in pdf.pages]
    except Exception:
        return [], StatementParseDiagnostics(issuer="unknown")

    issuer = _detect_issuer("\n".join(pages_text))
    diagnostics = StatementParseDiagnostics(issuer=issuer)
    scored_rows: list[tuple[int, ParsedTransaction]] = []

    for page_index, page_text in enumerate(pages_text):
        lines = [line.strip() for line in page_text.splitlines() if line.strip()]
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

    if not parsed:
        diagnostics.parser_confidence = 0.15 if diagnostics.summary_section_hits > 0 else 0.05
    elif diagnostics.detail_section_hits > 0:
        diagnostics.parser_confidence = 0.92
    elif diagnostics.suspicious_account_number_rows > 0:
        diagnostics.parser_confidence = 0.55
    else:
        diagnostics.parser_confidence = 0.75

    return parsed, diagnostics


def parse_pdf_statement(file_path: str, source: str) -> list[ParsedTransaction]:
    parsed, _ = parse_pdf_statement_with_diagnostics(file_path, source)
    return parsed

