"""
パーサーのテスト。
実際のサンプルデータを使って各パーサーの動作を検証する。
"""
import tempfile
import textwrap
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest

from app.services.parsers.csv_statement_parser import parse_csv_statement
from app.services.parsers.pdf_statement_parser import parse_statement_text_with_diagnostics
from app.services.parsers.receipt_ocr import parse_receipt


# ---- CSVパーサーテスト ----

SAMPLE_CSV_STANDARD = textwrap.dedent("""\
    date,description,amount
    2024-01-15,Amazon Prime,14.99
    2024-01-16,Starbucks,5.50
    2024-01-17,Shell Gas Station,45.00
""")

SAMPLE_CSV_DEBIT_CREDIT = textwrap.dedent("""\
    date,description,debit,credit,balance
    2024-02-01,Rent Payment,1500.00,,2000.00
    2024-02-05,Salary Deposit,,3000.00,5000.00
    2024-02-10,Grocery Store,120.50,,4879.50
""")


def _write_temp_csv(content: str) -> str:
    f = tempfile.NamedTemporaryFile(
        delete=False, suffix=".csv", mode="w", encoding="utf-8-sig"
    )
    f.write(content)
    f.close()
    return f.name


class TestCSVParser:
    def test_parse_standard_amount_column(self):
        path = _write_temp_csv(SAMPLE_CSV_STANDARD)
        result = parse_csv_statement(path, source="card")

        assert len(result) == 3
        assert result[0].merchant_raw == "Amazon Prime"
        assert result[0].amount == Decimal("14.99")
        assert result[0].transaction_date == date(2024, 1, 15)

    def test_parse_debit_credit_columns(self):
        path = _write_temp_csv(SAMPLE_CSV_DEBIT_CREDIT)
        result = parse_csv_statement(path, source="bank")

        assert len(result) == 3
        debits = [t for t in result if t.direction == "debit"]
        credits = [t for t in result if t.direction == "credit"]
        assert len(debits) == 2
        assert len(credits) == 1
        assert credits[0].amount == Decimal("3000.00")

    def test_running_balance_extracted(self):
        path = _write_temp_csv(SAMPLE_CSV_DEBIT_CREDIT)
        result = parse_csv_statement(path, source="bank")
        assert result[0].running_balance == Decimal("2000.00")

    def test_returns_empty_for_missing_required_columns(self):
        content = "col_a,col_b\n1,2\n"
        path = _write_temp_csv(content)
        result = parse_csv_statement(path, source="card")
        assert result == []

    def test_returns_empty_for_corrupt_file(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".csv", mode="wb") as f:
            f.write(b"\xff\xfe" * 100)
            path = f.name
        result = parse_csv_statement(path, source="card")
        assert result == []

    def test_skips_rows_with_bad_dates(self):
        content = textwrap.dedent("""\
            date,description,amount
            2024-01-15,Valid Transaction,10.00
            NOT-A-DATE,Bad Row,20.00
            2024-01-17,Another Valid,30.00
        """)
        path = _write_temp_csv(content)
        result = parse_csv_statement(path, source="card")
        assert len(result) == 2
        assert result[0].merchant_raw == "Valid Transaction"

    def test_source_is_preserved(self):
        path = _write_temp_csv(SAMPLE_CSV_STANDARD)
        result = parse_csv_statement(path, source="bank")
        assert all(t.source == "bank" for t in result)


# ---- receipt_ocr: extract_text のエラーハンドリングテスト ----

class TestReceiptOCRExtractText:
    def test_returns_empty_string_for_nonexistent_file(self):
        from app.services.parsers.receipt_ocr import extract_text
        result = extract_text("/nonexistent/path/to/file.pdf")
        assert result == ""

    def test_returns_empty_string_for_corrupt_pdf(self):
        from app.services.parsers.receipt_ocr import extract_text
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", mode="wb") as f:
            f.write(b"this is not a pdf")
            path = f.name
        result = extract_text(path)
        assert result == ""

    def test_returns_empty_string_for_corrupt_image(self):
        from app.services.parsers.receipt_ocr import extract_text
        with tempfile.NamedTemporaryFile(delete=False, suffix=".png", mode="wb") as f:
            f.write(b"\xff\xd8\xff garbage data")
            path = f.name
        result = extract_text(path)
        assert result == ""

    def test_parse_receipt_returns_low_confidence_on_empty_text(self):
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf", mode="wb") as f:
            f.write(b"not a pdf")
            path = f.name
        result = parse_receipt(path)
        assert result.confidence == 0.5
        assert result.total_amount is None


class TestStatementTextFallbackParser:
    def test_parses_compound_line_with_two_transactions(self):
        text = textwrap.dedent(
            """\
            TRANSACTION DETAIL
            DATE DESCRIPTION AMOUNT BALANCE
            12/03 ATM Cash Deposit 12/03 Branch 3,000.00 3,305.21 12/04 Watterscape Urba Web Pmts -1,625.93 1,679.28
            """
        )

        rows, diagnostics = parse_statement_text_with_diagnostics(text, source="bank")

        assert len(rows) == 2
        assert rows[0].transaction_date.month == 12
        assert rows[0].transaction_date.day == 3
        assert rows[0].amount == Decimal("3000.00")
        assert rows[0].running_balance == Decimal("3305.21")
        assert rows[1].amount == Decimal("1625.93")
        assert rows[1].running_balance == Decimal("1679.28")
        assert diagnostics.matched_rows >= 2

    def test_keeps_detail_context_after_beginning_balance_marker(self):
        text = textwrap.dedent(
            """\
            TRANSACTION DETAIL
            DATE DESCRIPTION AMOUNT BALANCE
            Beginning Balance $305.21
            12/03 ATM Cash Deposit 12/03 Branch 3,000.00 3,305.21
            12/04 Watterscape Urba Web Pmts -1,625.93 1,679.28
            """
        )

        rows, diagnostics = parse_statement_text_with_diagnostics(text, source="bank")

        assert len(rows) == 2
        assert rows[0].amount == Decimal("3000.00")
        assert rows[1].amount == Decimal("1625.93")
        assert diagnostics.matched_rows >= 2

    def test_does_not_split_on_embedded_date_before_amount(self):
        text = textwrap.dedent(
            """\
            TRANSACTION DETAIL
            12/15 Card Purchase 12/14 Subway 69602 Dfw Airport TX Card 5003 -16.77 4,478.08
            """
        )

        rows, _ = parse_statement_text_with_diagnostics(text, source="bank")

        assert len(rows) == 1
        assert rows[0].amount == Decimal("16.77")
        assert rows[0].running_balance == Decimal("4478.08")
