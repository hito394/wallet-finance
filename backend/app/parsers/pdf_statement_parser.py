"""
PDF銀行明細パーサー。
pdfplumberでテキストを抽出し、表構造または行パターンで取引を検出する。
銀行によってPDFフォーマットが大きく異なるため、複数の抽出戦略を持つ。
"""
import logging
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

from app.parsers.base import BaseStatementParser, ParseResult, ParsedTransaction
from app.parsers.csv_parser import CSVStatementParser

logger = logging.getLogger(__name__)

# 日付パターン（行頭付近に現れる日付を検出）
DATE_PATTERNS = [
    re.compile(r"(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})"),  # 2024/01/15
    re.compile(r"R(\d+)[./年](\d{1,2})[./月](\d{1,2})"),      # R6.1.15（令和）
    re.compile(r"(\d{2})[/\-](\d{1,2})[/\-](\d{1,2})"),       # 24/01/15
]

# 金額パターン（カンマ区切り整数または小数）
AMOUNT_PATTERN = re.compile(r"[\-－]?[\d,，]+(?:\.\d{1,2})?")


class PDFStatementParser(BaseStatementParser):
    """
    PDF銀行明細パーサー。
    テーブル抽出と行パターンマッチングの2段階でデータを抽出する。
    """

    def can_parse(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".pdf"

    def parse(self, file_path: Path) -> ParseResult:
        result = ParseResult()
        result.meta["parser"] = "pdf"

        try:
            import pdfplumber
        except ImportError:
            result.errors.append("pdfplumberがインストールされていません: pip install pdfplumber")
            return result

        try:
            with pdfplumber.open(file_path) as pdf:
                result.meta["page_count"] = len(pdf.pages)
                all_tables: list[list[list[str | None]]] = []
                all_text_lines: list[str] = []

                for page in pdf.pages:
                    # 戦略1: テーブル構造として抽出（表が明確なPDFに有効）
                    tables = page.extract_tables()
                    for table in tables:
                        if table:
                            all_tables.extend([table])

                    # 戦略2: 生テキストとして抽出（テーブル検出失敗時のフォールバック）
                    text = page.extract_text() or ""
                    all_text_lines.extend(text.splitlines())

                # テーブルからパース試行
                if all_tables:
                    parsed_from_tables = self._parse_from_tables(all_tables, result)
                    if parsed_from_tables:
                        return result

                # フォールバック: テキスト行パターンマッチング
                self._parse_from_text_lines(all_text_lines, result)

        except Exception as e:
            logger.exception("PDFパース失敗: %s", file_path)
            result.errors.append(f"PDFパースエラー: {e}")

        return result

    # -------------------------------------------------------------------------
    # テーブルからパース
    # -------------------------------------------------------------------------

    def _parse_from_tables(
        self, tables: list[list[list[str | None]]], result: ParseResult
    ) -> bool:
        """
        pdfplumberのテーブル抽出結果からトランザクションをパースする。
        成功した場合はTrueを返す。
        """
        csv_parser = CSVStatementParser()
        total_found = 0

        for table in tables:
            if len(table) < 2:
                continue

            # ヘッダ行を取得（Noneセルを空文字に変換）
            header = [str(c or "").strip() for c in table[0]]
            if not self._is_statement_header(header):
                continue

            for row_cells in table[1:]:
                cells = [str(c or "").strip() for c in row_cells]
                if not any(cells):
                    continue

                # ヘッダとセルを辞書化してCSVパーサーのロジックを流用
                import pandas as pd
                row_dict = dict(zip(header, cells))
                row = pd.Series(row_dict)
                col_map = csv_parser._detect_columns(pd.DataFrame([row_dict]))

                if "date" not in col_map:
                    continue

                try:
                    parsed = csv_parser._parse_row(row, col_map, 0)
                    if parsed:
                        result.transactions.append(parsed)
                        total_found += 1
                    else:
                        result.skipped_rows += 1
                except Exception as e:
                    result.errors.append(f"テーブル行パースエラー: {e}")

        return total_found > 0

    # -------------------------------------------------------------------------
    # テキスト行パターンマッチング（フォールバック）
    # -------------------------------------------------------------------------

    def _parse_from_text_lines(self, lines: list[str], result: ParseResult) -> None:
        """
        フォールバック: テキスト行を正規表現でスキャンして取引を検出する。
        PDFがテーブル構造を持たない場合（スキャンPDF等）に使用。
        """
        result.meta["strategy"] = "text_line_pattern"
        current_date: Optional[date] = None
        row_num = 0

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # 行頭の日付を検出
            parsed_date = self._extract_date_from_line(line)
            if parsed_date:
                current_date = parsed_date

            if current_date is None:
                continue

            # 金額と方向を推定
            amounts = self._extract_amounts_from_line(line)
            if not amounts:
                continue

            # 摘要（日付・金額以外のテキストを抽出）
            merchant = self._extract_merchant_from_line(line, amounts)
            if not merchant:
                continue

            # 取引方向の推定（金額が2つある場合: 出金・入金・残高 の順が多い）
            if len(amounts) >= 2:
                # 最初の非ゼロ値が取引金額、次が残高
                amount = amounts[0]
                balance = amounts[1] if len(amounts) > 1 else None
                direction = "debit"  # PDF生テキストでは方向判定が困難
            else:
                amount = amounts[0]
                balance = None
                direction = "debit"

            result.transactions.append(
                ParsedTransaction(
                    transaction_date=current_date,
                    merchant_raw=merchant,
                    amount=amount,
                    direction=direction,
                    balance=balance,
                    raw_row=line,
                )
            )
            row_num += 1

        result.meta["text_rows_processed"] = row_num

    # -------------------------------------------------------------------------
    # ユーティリティ
    # -------------------------------------------------------------------------

    @staticmethod
    def _is_statement_header(header: list[str]) -> bool:
        """ヘッダ行が銀行明細のヘッダかどうかを判定する"""
        header_text = " ".join(header).lower()
        keywords = ["日付", "取引", "摘要", "出金", "入金", "残高", "date", "amount", "balance"]
        return sum(1 for kw in keywords if kw in header_text) >= 2

    @staticmethod
    def _extract_date_from_line(line: str) -> Optional[date]:
        """テキスト行から日付を抽出する"""
        for pattern in DATE_PATTERNS:
            m = pattern.search(line)
            if not m:
                continue
            groups = m.groups()
            try:
                if line.startswith("R") or "R" in line[:5]:
                    # 令和
                    year = 2018 + int(groups[0])
                    month, day = int(groups[1]), int(groups[2])
                elif len(groups[0]) == 2:
                    year = 2000 + int(groups[0])
                    month, day = int(groups[1]), int(groups[2])
                else:
                    year, month, day = int(groups[0]), int(groups[1]), int(groups[2])
                return date(year, month, day)
            except (ValueError, IndexError):
                continue
        return None

    @staticmethod
    def _extract_amounts_from_line(line: str) -> list[Decimal]:
        """テキスト行から金額リストを抽出する"""
        amounts = []
        for match in AMOUNT_PATTERN.finditer(line):
            raw = match.group().replace(",", "").replace("，", "")
            try:
                val = Decimal(raw)
                if val > 0:
                    amounts.append(val)
            except InvalidOperation:
                continue
        return amounts

    @staticmethod
    def _extract_merchant_from_line(line: str, amounts: list[Decimal]) -> str:
        """行テキストから金額・日付を除いた摘要部分を抽出する"""
        cleaned = line
        # 日付パターンを除去
        for pattern in DATE_PATTERNS:
            cleaned = pattern.sub("", cleaned)
        # 金額パターンを除去
        cleaned = AMOUNT_PATTERN.sub("", cleaned)
        # 余分なスペース・記号を整理
        cleaned = re.sub(r"[\s　]+", " ", cleaned).strip(" ・・|｜/／")
        return cleaned[:200] if len(cleaned) > 5 else ""
