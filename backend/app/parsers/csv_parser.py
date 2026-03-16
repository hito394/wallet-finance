"""
CSVフォーマット銀行明細パーサー。
日本の主要銀行（三菱UFJ・三井住友・みずほ・楽天銀行等）の
CSVフォーマットに対応するための正規化ロジックを含む。
"""
import re
import logging
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

import pandas as pd
from dateutil import parser as dateutil_parser

from app.parsers.base import BaseStatementParser, ParseResult, ParsedTransaction

logger = logging.getLogger(__name__)


# 各銀行のCSVカラムマッピング定義。
# キー: 内部フィールド名, 値: 候補となるCSVヘッダ名リスト（優先順）
COLUMN_ALIASES = {
    "date": [
        "日付", "取引日", "日時", "取引年月日", "振込日", "date", "transaction_date",
    ],
    "description": [
        "摘要", "取引内容", "内容", "備考", "description", "memo",
    ],
    "debit": [
        "お引出し", "引出金額", "出金", "支払金額", "debit", "withdrawal", "お支払金額",
    ],
    "credit": [
        "お預入れ", "入金金額", "入金", "受取金額", "credit", "deposit", "お受取金額",
    ],
    "balance": [
        "残高", "差引残高", "口座残高", "balance",
    ],
}


class CSVStatementParser(BaseStatementParser):
    """
    CSVフォーマット銀行明細パーサー。
    銀行ごとのフォーマット差異を吸収する正規化ロジックを搭載。
    """

    def can_parse(self, file_path: Path) -> bool:
        return file_path.suffix.lower() == ".csv"

    def parse(self, file_path: Path) -> ParseResult:
        result = ParseResult()
        result.meta["parser"] = "csv"

        try:
            df, encoding = self._read_csv_with_encoding_detection(file_path)
            result.meta["encoding"] = encoding
            result.meta["original_columns"] = list(df.columns)

            col_map = self._detect_columns(df)
            if "date" not in col_map:
                result.errors.append("日付カラムを検出できませんでした。CSVのヘッダ行を確認してください。")
                return result

            result.meta["column_mapping"] = col_map
            result.meta["bank_name"] = self._guess_bank_name(df, file_path)

            for idx, row in df.iterrows():
                try:
                    parsed = self._parse_row(row, col_map, int(str(idx)))
                    if parsed:
                        result.transactions.append(parsed)
                    else:
                        result.skipped_rows += 1
                except Exception as e:
                    result.errors.append(f"行{idx}: {e}")
                    result.skipped_rows += 1

        except Exception as e:
            logger.exception("CSVパース失敗: %s", file_path)
            result.errors.append(f"ファイル読み込みエラー: {e}")

        return result

    # -------------------------------------------------------------------------
    # 内部メソッド
    # -------------------------------------------------------------------------

    def _read_csv_with_encoding_detection(
        self, file_path: Path
    ) -> tuple[pd.DataFrame, str]:
        """エンコーディングを自動検出してCSVを読み込む"""
        for encoding in ["utf-8-sig", "shift_jis", "cp932", "utf-8", "iso-2022-jp"]:
            try:
                # ヘッダのないCSV、BOM付きUTF-8、Shift-JIS全て試行
                df = pd.read_csv(
                    file_path,
                    encoding=encoding,
                    skip_blank_lines=True,
                    on_bad_lines="skip",
                )
                # 少なくとも1列2行以上あれば読み込み成功とみなす
                if df.shape[0] >= 1 and df.shape[1] >= 1:
                    df.columns = [str(c).strip() for c in df.columns]
                    return df, encoding
            except (UnicodeDecodeError, pd.errors.ParserError):
                continue
        raise ValueError("対応エンコーディングでCSVを読み込めませんでした")

    def _detect_columns(self, df: pd.DataFrame) -> dict[str, str]:
        """データフレームのカラム名から各フィールドに対応するカラム名を特定する"""
        normalized_cols = {col.strip().lower(): col for col in df.columns}
        detected: dict[str, str] = {}

        for field_name, aliases in COLUMN_ALIASES.items():
            for alias in aliases:
                if alias.lower() in normalized_cols:
                    detected[field_name] = normalized_cols[alias.lower()]
                    break

        return detected

    def _parse_row(
        self, row: pd.Series, col_map: dict[str, str], row_idx: int
    ) -> Optional[ParsedTransaction]:
        """1行をパースしてParsedTransactionを返す"""
        # 日付
        raw_date = str(row.get(col_map["date"], "")).strip()
        if not raw_date or raw_date.lower() in ("nan", ""):
            return None

        parsed_date = self._parse_date(raw_date)
        if not parsed_date:
            return None

        # 摘要
        desc_col = col_map.get("description")
        merchant_raw = str(row.get(desc_col, "")).strip() if desc_col else ""
        if merchant_raw.lower() == "nan":
            merchant_raw = ""

        # 金額・方向の判定
        debit_col = col_map.get("debit")
        credit_col = col_map.get("credit")

        debit_val = self._parse_amount(str(row.get(debit_col, "")) if debit_col else "")
        credit_val = self._parse_amount(str(row.get(credit_col, "")) if credit_col else "")

        if debit_val and debit_val > 0:
            amount = debit_val
            direction = "debit"
        elif credit_val and credit_val > 0:
            amount = credit_val
            direction = "credit"
        else:
            # 単一金額カラムの場合、符号で判断（負数=支出）
            return None

        # 残高
        balance_col = col_map.get("balance")
        balance = self._parse_amount(str(row.get(balance_col, "")) if balance_col else "")

        raw_row = row.to_json(force_ascii=False, date_format="iso")

        return ParsedTransaction(
            transaction_date=parsed_date,
            merchant_raw=merchant_raw or "不明",
            amount=amount,
            direction=direction,
            balance=balance,
            raw_row=raw_row,
        )

    @staticmethod
    def _parse_date(raw: str) -> Optional[date]:
        """'2024/01/15'、'2024-01-15'、'R6.1.15'など多様な日付形式をパース"""
        raw = raw.strip()

        # 和暦変換（令和）
        wareki_match = re.match(r"R(\d+)[./年](\d+)[./月](\d+)", raw)
        if wareki_match:
            year = 2018 + int(wareki_match.group(1))
            month = int(wareki_match.group(2))
            day = int(wareki_match.group(3))
            return date(year, month, day)

        # スラッシュ・ハイフン・ドット区切り
        normalized = re.sub(r"[年月/\.]", "-", raw).rstrip("日").strip()
        try:
            return dateutil_parser.parse(normalized, yearfirst=True).date()
        except (ValueError, OverflowError):
            pass

        return None

    @staticmethod
    def _parse_amount(raw: str) -> Optional[Decimal]:
        """'1,234', '¥1,234', '1234.56' 等をDecimalに変換"""
        if not raw or raw.strip().lower() in ("nan", "", "-", "－"):
            return None
        # 通貨記号・カンマ・全角文字を除去
        cleaned = re.sub(r"[¥,￥\s]", "", raw).replace("，", "").replace("　", "")
        # 全角数字を半角に変換
        cleaned = cleaned.translate(str.maketrans("０１２３４５６７８９．", "0123456789."))
        try:
            val = Decimal(cleaned)
            return val if val > 0 else None
        except InvalidOperation:
            return None

    @staticmethod
    def _guess_bank_name(df: pd.DataFrame, file_path: Path) -> str:
        """ファイル名やカラム名から銀行名を推測する（メタ情報として記録）"""
        filename = file_path.stem.lower()
        name_hints = {
            "mufg": "三菱UFJ銀行", "mitsubishi": "三菱UFJ銀行",
            "smbc": "三井住友銀行", "sumitomo": "三井住友銀行",
            "mizuho": "みずほ銀行",
            "rakuten": "楽天銀行",
            "sony": "ソニー銀行",
            "sbi": "SBI新生銀行",
            "aeon": "イオン銀行",
        }
        for key, name in name_hints.items():
            if key in filename:
                return name
        return "不明"
