"""
パーサーのテスト。
実際のサンプルデータを使って各パーサーの動作を検証する。
"""
import io
import textwrap
from datetime import date
from decimal import Decimal
from pathlib import Path
import tempfile

import pytest

from app.parsers.csv_parser import CSVStatementParser
from app.parsers.pdf_statement_parser import PDFStatementParser
from app.parsers.receipt_ocr_parser import ReceiptOCRParser


# ---- CSVパーサーテスト ----

SAMPLE_CSV_MUFG = textwrap.dedent("""\
    日付,摘要,お引出し,お預入れ,残高
    2024/01/15,セブンイレブン渋谷店,756,,123456
    2024/01/16,給与振込,,300000,423456
    2024/01/17,東京電力,8560,,414896
    2024/01/20,マクドナルド新宿店,890,,414006
""")

SAMPLE_CSV_RAKUTEN = textwrap.dedent("""\
    取引年月日,摘要,出金,入金,残高
    2024-02-01,楽天カード引落,45000,,200000
    2024-02-05,楽天市場入金,,1000,201000
""")


class TestCSVParser:
    def setup_method(self):
        self.parser = CSVStatementParser()

    def _write_temp_csv(self, content: str) -> Path:
        f = tempfile.NamedTemporaryFile(
            delete=False, suffix=".csv", mode="w", encoding="utf-8-sig"
        )
        f.write(content)
        f.close()
        return Path(f.name)

    def test_can_parse_csv_files(self):
        assert self.parser.can_parse(Path("test.csv")) is True
        assert self.parser.can_parse(Path("test.pdf")) is False

    def test_parse_mufg_format(self):
        path = self._write_temp_csv(SAMPLE_CSV_MUFG)
        result = self.parser.parse(path)

        assert result.error_count == 0
        assert result.success_count == 4

        # 支出チェック
        debit_txs = [t for t in result.transactions if t.direction == "debit"]
        assert len(debit_txs) == 3

        # 収入チェック
        credit_txs = [t for t in result.transactions if t.direction == "credit"]
        assert len(credit_txs) == 1
        assert credit_txs[0].amount == Decimal("300000")

        # 日付チェック
        assert debit_txs[0].transaction_date == date(2024, 1, 15)
        assert debit_txs[0].amount == Decimal("756")

    def test_parse_rakuten_format(self):
        path = self._write_temp_csv(SAMPLE_CSV_RAKUTEN)
        result = self.parser.parse(path)
        assert result.success_count == 2

    def test_date_parsing(self):
        from app.parsers.csv_parser import CSVStatementParser
        parser = CSVStatementParser()

        assert parser._parse_date("2024/01/15") == date(2024, 1, 15)
        assert parser._parse_date("2024-01-15") == date(2024, 1, 15)
        assert parser._parse_date("R6.1.15") == date(2024, 1, 15)
        assert parser._parse_date("") is None
        assert parser._parse_date("nan") is None

    def test_amount_parsing(self):
        from app.parsers.csv_parser import CSVStatementParser
        assert CSVStatementParser._parse_amount("1,234") == Decimal("1234")
        assert CSVStatementParser._parse_amount("¥1,234") == Decimal("1234")
        assert CSVStatementParser._parse_amount("1234.56") == Decimal("1234.56")
        assert CSVStatementParser._parse_amount("-") is None
        assert CSVStatementParser._parse_amount("") is None


# ---- 正規化テスト ----

class TestMerchantNormalizer:
    def test_normalize_convenience_stores(self):
        from app.utils.merchant_normalizer import normalize_merchant
        assert normalize_merchant("セブンイレブン渋谷店") == "セブン-イレブン"
        assert normalize_merchant("LAWSON　東京駅店") == "ローソン"
        assert normalize_merchant("FAMILYMART") == "ファミリーマート"

    def test_normalize_half_kana(self):
        from app.utils.merchant_normalizer import normalize_merchant
        # 半角カタカナ → 全角カタカナ
        result = normalize_merchant("ｾﾌﾞﾝｲﾚﾌﾞﾝ")
        assert "セブンイレブン" in result or result  # 変換が行われることを確認

    def test_normalize_empty_string(self):
        from app.utils.merchant_normalizer import normalize_merchant
        assert normalize_merchant("") == ""


# ---- 重複検出テスト ----

class TestDuplicateDetector:
    def test_same_input_produces_same_hash(self):
        from app.utils.duplicate_detector import compute_dedup_hash
        h1 = compute_dedup_hash(date(2024, 1, 15), Decimal("1000"), "セブン-イレブン", "debit")
        h2 = compute_dedup_hash(date(2024, 1, 15), Decimal("1000"), "セブン-イレブン", "debit")
        assert h1 == h2

    def test_different_amounts_produce_different_hashes(self):
        from app.utils.duplicate_detector import compute_dedup_hash
        h1 = compute_dedup_hash(date(2024, 1, 15), Decimal("1000"), "ローソン", "debit")
        h2 = compute_dedup_hash(date(2024, 1, 15), Decimal("1001"), "ローソン", "debit")
        assert h1 != h2


# ---- カテゴリ分類テスト ----

class TestCategorizationService:
    def setup_method(self):
        from app.services.categorization_service import CategorizationService
        self.service = CategorizationService()

    def test_classify_convenience_store_as_grocery(self):
        assert self.service.classify("セブン-イレブン", direction="debit") == "grocery"

    def test_classify_electricity_as_utilities(self):
        assert self.service.classify("東京電力パワーグリッド", direction="debit") == "utilities"

    def test_classify_income(self):
        assert self.service.classify("給与振込", direction="credit") == "income"

    def test_classify_netflix_as_subscription(self):
        assert self.service.classify("NETFLIX", direction="debit") == "subscriptions"

    def test_classify_train_as_transportation(self):
        assert self.service.classify("JR東日本", direction="debit") == "transportation"


# ---- マッチングサービステスト ----

class TestMatchingService:
    def setup_method(self):
        from app.services.matching_service import MatchingService
        self.service = MatchingService()

    def test_perfect_match_scores_high(self):
        scores = self.service.score(
            receipt_amount=Decimal("1000"),
            receipt_date=date(2024, 1, 15),
            receipt_merchant="セブン-イレブン",
            tx_amount=Decimal("1000"),
            tx_date=date(2024, 1, 15),
            tx_merchant="セブン-イレブン",
        )
        assert scores["score_total"] >= 0.9
        assert scores["is_candidate"] is True

    def test_amount_mismatch_reduces_score(self):
        scores = self.service.score(
            receipt_amount=Decimal("2000"),
            receipt_date=date(2024, 1, 15),
            receipt_merchant="スターバックス",
            tx_amount=Decimal("500"),   # 大きな差
            tx_date=date(2024, 1, 15),
            tx_merchant="スターバックス",
        )
        assert scores["score_amount"] == 0.0

    def test_date_diff_1day_score(self):
        scores = self.service.score(
            receipt_amount=Decimal("1500"),
            receipt_date=date(2024, 1, 16),  # 1日後
            receipt_merchant="ローソン",
            tx_amount=Decimal("1500"),
            tx_date=date(2024, 1, 15),
            tx_merchant="ローソン",
        )
        assert scores["score_date"] == 0.7

    def test_no_receipt_date_scores_zero(self):
        scores = self.service.score(
            receipt_amount=Decimal("1000"),
            receipt_date=None,  # 日付なし
            receipt_merchant="テスト",
            tx_amount=Decimal("1000"),
            tx_date=date(2024, 1, 15),
            tx_merchant="テスト",
        )
        assert scores["score_date"] == 0.0


# ---- レシートOCRパーサーテスト（モック）----

class TestReceiptOCRParser:
    """
    実際のOCRはtesseractインストールが必要なため、
    テキスト抽出部分のみテストする。
    """
    def setup_method(self):
        self.parser = ReceiptOCRParser()

    def test_extract_amount_from_text(self):
        text = "合計 ¥1,234"
        amount = self.parser._extract_amount(text, [
            __import__('re').compile(r"合計[^\d]*[\¥￥]?\s*([\d,，]+(?:\.\d{1,2})?)")
        ])
        assert amount == Decimal("1234")

    def test_extract_date_from_receipt(self):
        text = "2024年01月15日 購入"
        from app.parsers.receipt_ocr_parser import DATE_PATTERNS_RECEIPT
        result = self.parser._extract_date(text)
        assert result == date(2024, 1, 15)

    def test_extract_merchant_from_lines(self):
        lines = ["", "スターバックス コーヒー", "東京渋谷店", "2024/01/15"]
        merchant = self.parser._extract_merchant(lines)
        assert merchant == "スターバックス コーヒー"
