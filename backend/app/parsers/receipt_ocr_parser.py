"""
レシートOCRパーサー。
pytesseractを使って画像・PDFからテキストを抽出し、
正規表現で金額・日付・店名を解析する。
ノイズの多いレシート画像に対応するための前処理も含む。
"""
import logging
import re
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Optional

from app.parsers.base import ParsedReceipt

logger = logging.getLogger(__name__)

# ---- 正規表現定義 --------------------------------------------------------

# 合計金額: 「合計 1,234円」「TOTAL ¥1,234」「お会計 1234」等
TOTAL_PATTERNS = [
    re.compile(r"(?:合計|お会計|小計|TOTAL|total|Total)[^\d]*[\¥￥]?\s*([\d,，]+(?:\.\d{1,2})?)", re.IGNORECASE),
    re.compile(r"[\¥￥]\s*([\d,，]{3,}(?:\.\d{1,2})?)"),
    re.compile(r"([\d,，]{3,})\s*(?:円|yen|JPY)", re.IGNORECASE),
]

# 消費税
TAX_PATTERNS = [
    re.compile(r"(?:消費税|税額|内税|外税|TAX|tax)[^\d]*[\¥￥]?\s*([\d,，]+(?:\.\d{1,2})?)", re.IGNORECASE),
    re.compile(r"(?:10%|8%)\s*税[^\d]*([\d,，]+)"),
]

# 小計
SUBTOTAL_PATTERNS = [
    re.compile(r"(?:小計|subtotal|Subtotal)[^\d]*[\¥￥]?\s*([\d,，]+(?:\.\d{1,2})?)", re.IGNORECASE),
]

# 日付
DATE_PATTERNS_RECEIPT = [
    re.compile(r"(\d{4})[/\-年](\d{1,2})[/\-月](\d{1,2})日?"),
    re.compile(r"R(\d+)[./年](\d{1,2})[./月](\d{1,2})日?"),  # 令和
    re.compile(r"(\d{2})[/\-](\d{1,2})[/\-](\d{1,2})"),
    re.compile(r"(\d{4})(\d{2})(\d{2})"),  # 20240115 形式
]

# 店名ヒント: レシート上部に現れることが多いキーワードを除外
NOISE_WORDS = re.compile(
    r"レシート|領収書|receipt|RECEIPT|明細|ご利用明細|ありがとうございました|"
    r"またのご来店|お買い上げ|いらっしゃいませ|TEL|FAX|〒|電話|住所",
    re.IGNORECASE
)


class ReceiptOCRParser:
    """
    レシートOCRパーサー。
    画像 → OCR → 構造化データ の変換パイプラインを担当。
    """

    def parse_image(self, file_path: Path) -> ParsedReceipt:
        """画像ファイルをOCRしてParsedReceiptを返す"""
        try:
            import pytesseract
            from PIL import Image
        except ImportError:
            logger.error("pytesseract/Pillowが未インストールです")
            return ParsedReceipt(parse_warnings=["OCRライブラリが未インストールです"])

        try:
            image = Image.open(file_path)
            image = self._preprocess_image(image)

            # OCR実行（日本語+英語）
            ocr_data = pytesseract.image_to_data(
                image,
                lang="jpn+eng",
                output_type=pytesseract.Output.DICT,
                config="--psm 6",  # 均一なテキストブロックとして処理
            )

            # 信頼度付きでテキストを結合
            raw_text, confidence = self._build_text_with_confidence(ocr_data)

            return self._extract_fields(raw_text, confidence)

        except Exception as e:
            logger.exception("画像OCR失敗: %s", file_path)
            return ParsedReceipt(parse_warnings=[f"OCRエラー: {e}"])

    def parse_pdf(self, file_path: Path) -> ParsedReceipt:
        """PDFレシートをテキスト抽出またはOCRで処理する"""
        try:
            import pdfplumber
        except ImportError:
            return ParsedReceipt(parse_warnings=["pdfplumberが未インストールです"])

        try:
            with pdfplumber.open(file_path) as pdf:
                text_parts = []
                for page in pdf.pages:
                    text = page.extract_text() or ""
                    if text.strip():
                        text_parts.append(text)

                if text_parts:
                    # テキストが抽出できた場合（デジタルレシートPDF）
                    raw_text = "\n".join(text_parts)
                    return self._extract_fields(raw_text, confidence=85.0)
                else:
                    # スキャンPDFの場合: 画像に変換してOCR
                    return self._ocr_scanned_pdf(file_path)

        except Exception as e:
            logger.exception("PDFレシートパース失敗: %s", file_path)
            return ParsedReceipt(parse_warnings=[f"PDFエラー: {e}"])

    # -------------------------------------------------------------------------
    # 画像前処理（OCR精度向上）
    # -------------------------------------------------------------------------

    @staticmethod
    def _preprocess_image(image):
        """
        OCR精度を向上させるための画像前処理。
        グレースケール化・コントラスト強調・リサイズを行う。
        """
        from PIL import ImageFilter, ImageEnhance

        # グレースケール変換
        if image.mode != "L":
            image = image.convert("L")

        # 解像度が低い場合はリサイズ（OCRの最適解像度は300dpi相当）
        width, height = image.size
        if width < 1000:
            scale = 1000 / width
            image = image.resize((int(width * scale), int(height * scale)))

        # シャープネス強調
        image = image.filter(ImageFilter.SHARPEN)

        # コントラスト強調
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.5)

        return image

    @staticmethod
    def _build_text_with_confidence(ocr_data: dict) -> tuple[str, float]:
        """pytesseractのimage_to_data出力からテキストと平均信頼度を計算する"""
        words = []
        confidences = []

        for i, text in enumerate(ocr_data["text"]):
            conf = int(ocr_data["conf"][i])
            if conf > 30 and text.strip():  # 信頼度30以上の単語のみ採用
                words.append(text.strip())
                confidences.append(conf)

        raw_text = " ".join(words)
        avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
        return raw_text, avg_confidence

    @staticmethod
    def _ocr_scanned_pdf(file_path: Path) -> "ParsedReceipt":
        """スキャンPDFをpdf2imageで画像化してからOCRする"""
        try:
            from pdf2image import convert_from_path
            import pytesseract

            images = convert_from_path(file_path, dpi=300, first_page=1, last_page=1)
            if not images:
                return ParsedReceipt(parse_warnings=["PDFから画像を生成できませんでした"])

            raw_text = pytesseract.image_to_string(images[0], lang="jpn+eng", config="--psm 6")
            ocr_data = pytesseract.image_to_data(
                images[0], lang="jpn+eng", output_type=pytesseract.Output.DICT
            )
            confs = [int(c) for c in ocr_data["conf"] if int(c) > 0]
            confidence = sum(confs) / len(confs) if confs else 0.0

            parser = ReceiptOCRParser()
            return parser._extract_fields(raw_text, confidence)

        except Exception as e:
            return ParsedReceipt(parse_warnings=[f"スキャンPDF OCRエラー: {e}"])

    # -------------------------------------------------------------------------
    # フィールド抽出
    # -------------------------------------------------------------------------

    def _extract_fields(self, raw_text: str, confidence: float) -> ParsedReceipt:
        """OCRテキストから各フィールドを正規表現で抽出する"""
        receipt = ParsedReceipt(raw_text=raw_text, confidence=confidence)

        lines = raw_text.splitlines()

        receipt.total_amount = self._extract_amount(raw_text, TOTAL_PATTERNS)
        receipt.tax_amount = self._extract_amount(raw_text, TAX_PATTERNS)
        receipt.subtotal_amount = self._extract_amount(raw_text, SUBTOTAL_PATTERNS)
        receipt.purchase_date = self._extract_date(raw_text)
        receipt.merchant_name = self._extract_merchant(lines)
        receipt.line_items = self._extract_line_items(lines)

        # 合計が取れなかった場合、最大金額を合計として採用（ヒューリスティック）
        if receipt.total_amount is None:
            amounts = self._extract_all_amounts(raw_text)
            if amounts:
                receipt.total_amount = max(amounts)
                receipt.parse_warnings.append("合計金額を最大金額から推定しました")

        return receipt

    @staticmethod
    def _extract_amount(text: str, patterns: list[re.Pattern]) -> Optional[Decimal]:
        """金額パターンリストを順に試して最初に一致した金額を返す"""
        for pattern in patterns:
            m = pattern.search(text)
            if m:
                raw = m.group(1).replace(",", "").replace("，", "")
                try:
                    return Decimal(raw)
                except InvalidOperation:
                    continue
        return None

    @staticmethod
    def _extract_all_amounts(text: str) -> list[Decimal]:
        """テキスト全体から全金額を抽出する"""
        amounts = []
        for m in re.finditer(r"[\d,，]{3,}(?:\.\d{1,2})?", text):
            raw = m.group().replace(",", "").replace("，", "")
            try:
                val = Decimal(raw)
                if val >= 10:  # 10円以上のみ対象
                    amounts.append(val)
            except InvalidOperation:
                continue
        return amounts

    @staticmethod
    def _extract_date(text: str) -> Optional[date]:
        """テキストから日付を抽出する"""
        for pattern in DATE_PATTERNS_RECEIPT:
            m = pattern.search(text)
            if not m:
                continue
            groups = m.groups()
            try:
                if len(groups[0]) == 1 or (len(groups[0]) <= 2 and int(groups[0]) <= 10):
                    # 令和年号
                    year = 2018 + int(groups[0])
                elif len(groups[0]) == 2:
                    year = 2000 + int(groups[0])
                else:
                    year = int(groups[0])
                month = int(groups[1])
                day = int(groups[2])
                if 1 <= month <= 12 and 1 <= day <= 31:
                    return date(year, month, day)
            except (ValueError, IndexError):
                continue
        return None

    @staticmethod
    def _extract_merchant(lines: list[str]) -> Optional[str]:
        """
        店名を抽出する。
        レシートの上部行に店名が来ることが多いため、上位5行を候補として処理。
        """
        for line in lines[:5]:
            line = line.strip()
            if not line:
                continue
            # ノイズワードを含む行はスキップ
            if NOISE_WORDS.search(line):
                continue
            # 日付や金額だけの行はスキップ
            if re.match(r"^[\d/\-年月日\s]+$", line):
                continue
            if len(line) >= 2:
                return line[:100]
        return None

    @staticmethod
    def _extract_line_items(lines: list[str]) -> list[dict]:
        """
        明細行（商品名と金額のペア）を抽出する。
        「商品名 ¥金額」「商品名　金額」のパターンを検出。
        """
        items = []
        item_pattern = re.compile(
            r"^(.+?)\s+[\¥￥]?\s*([\d,，]+(?:\.\d{1,2})?)\s*$"
        )
        for line in lines:
            line = line.strip()
            m = item_pattern.match(line)
            if m:
                name = m.group(1).strip()
                amount_str = m.group(2).replace(",", "").replace("，", "")
                try:
                    amount = float(amount_str)
                    if 1 <= amount <= 1_000_000 and len(name) >= 2:
                        items.append({"name": name, "amount": amount})
                except ValueError:
                    continue
        return items[:30]  # 最大30明細
