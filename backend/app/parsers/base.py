"""
パーサー基底クラス。
全パーサーはこのインターフェースを実装することで、
ImportServiceが共通の方法でどのパーサーも扱える。
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from pathlib import Path
from typing import Optional


@dataclass
class ParsedTransaction:
    """パーサーが返す中間形式。モデルに依存しない純粋なデータクラス。"""
    transaction_date: date
    merchant_raw: str
    amount: Decimal
    direction: str  # "debit" or "credit"
    balance: Optional[Decimal] = None
    description: Optional[str] = None
    raw_row: Optional[str] = None  # 元の行テキスト（デバッグ用）


@dataclass
class ParseResult:
    """パーサーの実行結果をまとめたデータクラス。"""
    transactions: list[ParsedTransaction] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)
    skipped_rows: int = 0
    meta: dict = field(default_factory=dict)  # バンク名・通貨等のメタ情報

    @property
    def success_count(self) -> int:
        return len(self.transactions)

    @property
    def error_count(self) -> int:
        return len(self.errors)


class BaseStatementParser(ABC):
    """銀行明細パーサーの抽象基底クラス"""

    @abstractmethod
    def can_parse(self, file_path: Path) -> bool:
        """このパーサーがファイルを処理できるか判定"""
        ...

    @abstractmethod
    def parse(self, file_path: Path) -> ParseResult:
        """ファイルを解析してParseResultを返す"""
        ...


@dataclass
class ParsedReceipt:
    """OCRパーサーが返すレシート中間形式"""
    merchant_name: Optional[str] = None
    purchase_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    subtotal_amount: Optional[Decimal] = None
    line_items: list[dict] = field(default_factory=list)
    raw_text: str = ""
    confidence: float = 0.0  # 0〜100
    parse_warnings: list[str] = field(default_factory=list)
