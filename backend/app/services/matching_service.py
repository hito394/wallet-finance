"""
レシートと取引のマッチングサービス。
金額・日付・店名の3軸でスコアリングして自動紐付けを行う。
"""
from datetime import date
from decimal import Decimal
from typing import Optional

from rapidfuzz import fuzz


class MatchingService:
    """
    レシート↔取引自動マッチングサービス。
    スコアリング: 金額(50%) + 日付(30%) + 店名(20%)
    閾値: total_score >= 0.7 で候補として採用
    """

    SCORE_THRESHOLD = 0.65
    AMOUNT_WEIGHT = 0.50
    DATE_WEIGHT = 0.30
    MERCHANT_WEIGHT = 0.20
    DATE_TOLERANCE_DAYS = 3
    AMOUNT_TOLERANCE = Decimal("1.00")  # 1円の許容誤差

    def score(
        self,
        receipt_amount: Optional[Decimal],
        receipt_date: Optional[date],
        receipt_merchant: Optional[str],
        tx_amount: Decimal,
        tx_date: date,
        tx_merchant: str,
    ) -> dict:
        """
        1件のレシートと取引のマッチングスコアを計算する。
        各次元のスコアを0〜1で返す。
        """
        score_amount = self._score_amount(receipt_amount, tx_amount)
        score_date = self._score_date(receipt_date, tx_date)
        score_merchant = self._score_merchant(receipt_merchant, tx_merchant)

        total = (
            score_amount * self.AMOUNT_WEIGHT
            + score_date * self.DATE_WEIGHT
            + score_merchant * self.MERCHANT_WEIGHT
        )

        return {
            "score_total": round(total, 3),
            "score_amount": round(score_amount, 3),
            "score_date": round(score_date, 3),
            "score_merchant": round(score_merchant, 3),
            "is_candidate": total >= self.SCORE_THRESHOLD,
        }

    def find_best_match(
        self,
        receipt_amount: Optional[Decimal],
        receipt_date: Optional[date],
        receipt_merchant: Optional[str],
        candidates: list[dict],
    ) -> Optional[dict]:
        """
        候補取引リストから最も一致するものを返す。
        candidates: [{"id": int, "amount": Decimal, "date": date, "merchant": str}, ...]
        """
        best_score = 0.0
        best_match = None

        for tx in candidates:
            scores = self.score(
                receipt_amount=receipt_amount,
                receipt_date=receipt_date,
                receipt_merchant=receipt_merchant,
                tx_amount=tx["amount"],
                tx_date=tx["date"],
                tx_merchant=tx["merchant"],
            )
            if scores["is_candidate"] and scores["score_total"] > best_score:
                best_score = scores["score_total"]
                best_match = {**tx, **scores}

        return best_match

    # -------------------------------------------------------------------------
    # スコアリング各次元
    # -------------------------------------------------------------------------

    def _score_amount(
        self, receipt_amount: Optional[Decimal], tx_amount: Decimal
    ) -> float:
        """金額スコア: 完全一致=1.0、許容誤差内=0.8、大きな差=0.0"""
        if receipt_amount is None:
            return 0.0

        diff = abs(receipt_amount - tx_amount)
        if diff == 0:
            return 1.0
        if diff <= self.AMOUNT_TOLERANCE:
            return 0.9
        if diff <= tx_amount * Decimal("0.01"):  # 1%以内
            return 0.7
        if diff <= tx_amount * Decimal("0.05"):  # 5%以内
            return 0.3
        return 0.0

    def _score_date(
        self, receipt_date: Optional[date], tx_date: date
    ) -> float:
        """日付スコア: 同日=1.0、1日差=0.7、2日差=0.4、3日差=0.2、それ以上=0.0"""
        if receipt_date is None:
            return 0.0

        diff_days = abs((receipt_date - tx_date).days)
        date_scores = {0: 1.0, 1: 0.7, 2: 0.4, 3: 0.2}
        return date_scores.get(diff_days, 0.0)

    @staticmethod
    def _score_merchant(
        receipt_merchant: Optional[str], tx_merchant: str
    ) -> float:
        """店名スコア: rapidfuzzで文字列類似度を計算（0〜1）"""
        if not receipt_merchant or not tx_merchant:
            return 0.0

        # token_set_ratioは語順差・前置詞差に強い
        ratio = fuzz.token_set_ratio(
            receipt_merchant.upper(), tx_merchant.upper()
        )
        return ratio / 100.0
