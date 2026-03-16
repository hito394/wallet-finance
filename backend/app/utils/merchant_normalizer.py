"""
商号正規化ユーティリティ。
OCRや銀行明細で揺れのある店名を正規化することで、
重複検出・カテゴリ分類・マッチング精度を向上させる。
"""
import re
from functools import lru_cache


# 銀行明細で頻出するノイズフレーズ（除去対象）
_NOISE_PATTERNS = [
    re.compile(r"\b\d{4}/\d{2}/\d{2}\b"),           # 日付
    re.compile(r"\b\d{10,16}\b"),                    # カード番号
    re.compile(r"(?:払込|振込|引落|自動引落)[^\s]*"),  # 銀行操作語
    re.compile(r"[Aa][Tt][Mm](?:\s|$)"),              # ATM
    re.compile(r"ｶ[ﾅﾆﾇ]?ﾄﾞ|カード"),                # カード関連
    re.compile(r"\s{2,}"),                            # 連続スペース
]

# カタカナ正規化（半角→全角）
_HALF_KANA_MAP = str.maketrans(
    "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ",
    "ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン゛゜",
)

# 著名チェーン店の正規化マッピング
MERCHANT_ALIASES: dict[str, str] = {
    # コンビニ
    "セブンイレブン": "セブン-イレブン",
    "SEVEN ELEVEN": "セブン-イレブン",
    "7-ELEVEN": "セブン-イレブン",
    "7ELEVEN": "セブン-イレブン",
    "ローソン": "ローソン",
    "LAWSON": "ローソン",
    "ファミリーマート": "ファミリーマート",
    "FAMILY MART": "ファミリーマート",
    "FAMILYMART": "ファミリーマート",
    "ミニストップ": "ミニストップ",
    # スーパー
    "イオン": "イオン",
    "AEON": "イオン",
    "ライフ": "ライフ",
    "マルエツ": "マルエツ",
    "成城石井": "成城石井",
    # 交通
    "スイカ": "Suica",
    "SUICA": "Suica",
    "パスモ": "PASMO",
    "PASMO": "PASMO",
    "東日本旅客鉄道": "JR東日本",
    "西日本旅客鉄道": "JR西日本",
    # 飲食
    "マクドナルド": "マクドナルド",
    "MCDONALDS": "マクドナルド",
    "MCDONALD": "マクドナルド",
    "スターバックス": "スターバックス",
    "STARBUCKS": "スターバックス",
    "ドトール": "ドトールコーヒー",
    "DOUTOR": "ドトールコーヒー",
    "吉野家": "吉野家",
    "すき家": "すき家",
    "松屋": "松屋",
    # ネット・サブスク
    "NETFLIX": "Netflix",
    "SPOTIFY": "Spotify",
    "AMAZON": "Amazon",
    "AMAZONPRIME": "Amazon Prime",
    "APPLE": "Apple",
    "GOOGLE": "Google",
    # 銀行
    "三菱UFJ": "三菱UFJ銀行",
    "三井住友": "三井住友銀行",
    "みずほ": "みずほ銀行",
    "楽天銀行": "楽天銀行",
}


def normalize_merchant(raw: str) -> str:
    """
    店名を正規化する。
    1. 前後の空白除去
    2. 半角カナ→全角カナ変換
    3. 全角英数字→半角変換
    4. ノイズフレーズ除去
    5. エイリアスマッピング適用
    6. 大文字統一
    """
    if not raw:
        return ""

    text = raw.strip()

    # 半角カタカナを全角に変換
    text = text.translate(_HALF_KANA_MAP)

    # 全角英数字を半角に変換
    text = _fullwidth_to_halfwidth(text)

    # ノイズパターンを除去
    for pattern in _NOISE_PATTERNS:
        text = pattern.sub(" ", text)

    text = text.strip()

    # エイリアスを適用（大文字化して比較）
    upper_text = text.upper()
    for alias_key, canonical in MERCHANT_ALIASES.items():
        if alias_key.upper() in upper_text:
            return canonical

    # 最大50文字に切り詰め
    return text[:50] if text else raw[:50]


@lru_cache(maxsize=1024)
def normalize_merchant_cached(raw: str) -> str:
    """正規化結果をキャッシュするラッパー（同一セッション内の高速化）"""
    return normalize_merchant(raw)


def _fullwidth_to_halfwidth(text: str) -> str:
    """全角英数字・記号を半角に変換する"""
    result = []
    for char in text:
        code = ord(char)
        # 全角英数字: U+FF01〜U+FF5E → 対応する半角へ
        if 0xFF01 <= code <= 0xFF5E:
            result.append(chr(code - 0xFEE0))
        elif char == "\u3000":  # 全角スペース
            result.append(" ")
        else:
            result.append(char)
    return "".join(result)
