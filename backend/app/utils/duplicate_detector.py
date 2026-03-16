"""
重複取引検出ユーティリティ。
インポート時・一覧表示時に重複候補を検出する。
"""
import hashlib
from datetime import date
from decimal import Decimal


def compute_dedup_hash(
    transaction_date: date,
    amount: Decimal,
    merchant_normalized: str,
    direction: str,
) -> str:
    """
    取引の重複検出用ハッシュを生成する。
    同日・同金額・同方向・同正規化後店名の取引を同一とみなす。
    """
    key = f"{transaction_date.isoformat()}|{amount}|{merchant_normalized.upper().strip()}|{direction}"
    return hashlib.sha256(key.encode()).hexdigest()
