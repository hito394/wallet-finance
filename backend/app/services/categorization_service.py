"""
自動カテゴリ分類サービス。
レイヤー構成:
  1. キーワードルールベース（高速・高精度）
  2. 商号正規化後のエイリアスベース
  3. 将来: AI分類（OpenAI/ローカルLLM）へのフックポイント付き
"""
import re
from typing import Optional


# カテゴリルール: カテゴリ名 → キーワードリスト（優先度順）
# 上位のルールが優先される（breakで停止するため）
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    # ---------- 収入 ----------
    ("income", [
        "給与", "給料", "賞与", "ボーナス", "振込入金", "入金", "還付",
        "salary", "payroll", "income", "refund",
    ]),
    # ---------- 家賃・住居 ----------
    ("housing", [
        "家賃", "地代", "管理費", "修繕", "不動産", "賃貸", "敷金", "礼金",
        "rent", "housing",
    ]),
    # ---------- 光熱費・公共料金 ----------
    ("utilities", [
        "東京電力", "関西電力", "電力", "東京ガス", "大阪ガス", "ガス料金",
        "水道料金", "水道局", "nhk", "NHK",
        "electric", "gas", "water", "utility",
    ]),
    # ---------- サブスクリプション ----------
    ("subscriptions", [
        # 動画・音楽ストリーミング
        "netflix", "spotify", "hulu", "dazn", "disney", "disney+",
        "apple tv", "apple music", "apple one", "youtube premium",
        "youtube music", "amazon prime", "prime video", "peacock",
        "paramount", "max hbo", "espn+", "starz", "showtime",
        "abema", "niconico", "nicovideo", "u-next", "unext", "dtv",
        "rakuten tv", "plex", "tidal", "deezer", "pandora", "iheartradio",
        # ツール・クラウド
        "adobe", "photoshop", "illustrator", "creative cloud",
        "microsoft 365", "office 365", "dropbox", "google one",
        "icloud", "box.com", "notion", "figma", "canva", "sketch",
        "github", "gitlab", "bitbucket", "vercel", "heroku",
        "aws ", "amazon web", "google cloud", "azure",
        "chatgpt", "openai", "claude", "midjourney",
        "grammarly", "duolingo", "headspace", "calm",
        "1password", "lastpass", "nordvpn", "expressvpn",
        # コミュニケーション・業務
        "slack", "zoom", "teams", "webex", "loom",
        "monday.com", "asana", "trello", "jira", "basecamp",
        "hubspot", "salesforce", "zendesk",
        # ゲーム
        "xbox game pass", "playstation plus", "ps plus",
        "nintendo switch online", "steam", "epic games",
        "ea play", "ubisoft",
        # フィットネス・ライフスタイル
        "peloton", "fitbit", "noom", "weightwatchers",
        # ニュース・読書
        "new york times", "wall street journal", "bloomberg",
        "audible", "kindle unlimited", "scribd",
        # 日本語キーワード
        "月額", "年額", "定期", "月額料金", "年額料金",
        "定期購読", "定期課金", "自動更新", "サブスク",
        "月会費", "年会費",
    ]),
    # ---------- 交通 ----------
    ("transportation", [
        "スイカ", "Suica", "SUICA", "PASMO", "パスモ", "バス", "タクシー",
        "電車", "地下鉄", "JR", "鉄道", "新幹線", "航空", "高速", "駐車",
        "ガソリン", "出光", "ENEOS", "エネオス",
        "taxi", "train", "bus", "rail", "toll", "parking",
    ]),
    # ---------- 食料品・スーパー ----------
    ("grocery", [
        "イオン", "ライフ", "マルエツ", "オーケー", "ヨークマート",
        "コープ", "業務スーパー", "成城石井", "西友", "ヤオコー",
        "スーパー", "食料品", "grocery",
    ]),
    # ---------- コンビニ（食料品に分類） ----------
    ("grocery", [
        "セブンイレブン", "セブン-イレブン", "ローソン", "ファミリーマート",
        "ミニストップ", "デイリーヤマザキ",
        "7-eleven", "7eleven", "lawson", "familymart",
    ]),
    # ---------- 飲食・外食 ----------
    ("food_dining", [
        "マクドナルド", "吉野家", "すき家", "松屋", "なか卯",
        "スターバックス", "ドトール", "タリーズ", "コメダ",
        "くら寿司", "はま寿司", "サイゼリヤ", "ガスト",
        "レストラン", "居酒屋", "焼肉", "ラーメン", "そば", "うどん",
        "restaurant", "cafe", "coffee", "diner",
    ]),
    # ---------- 医療・健康 ----------
    ("health", [
        "薬局", "ドラッグ", "マツモトキヨシ", "ウェルシア", "スギ薬局",
        "病院", "クリニック", "歯科", "医院", "調剤", "診療",
        "pharmacy", "hospital", "clinic", "medical",
    ]),
    # ---------- ショッピング ----------
    ("shopping", [
        "ユニクロ", "GU", "無印良品", "MUJI", "zara", "ZARA",
        "ヨドバシ", "ビックカメラ", "ヤマダ電機", "Amazon", "楽天",
        "マルイ", "百貨店", "デパート", "洋服",
        "shopping", "store", "shop",
    ]),
    # ---------- 旅行 ----------
    ("travel", [
        "ホテル", "旅館", "宿泊", "じゃらん", "楽天トラベル", "ANA", "JAL",
        "エアライン", "空港", "旅行",
        "hotel", "inn", "airline", "travel", "resort",
    ]),
    # ---------- エンタメ ----------
    ("entertainment", [
        "映画", "シネマ", "ゲーム", "カラオケ", "bowling", "ボウリング",
        "コンサート", "チケット", "遊園地", "美術館", "博物館",
        "movie", "cinema", "game", "entertainment",
    ]),
    # ---------- 教育 ----------
    ("education", [
        "学費", "授業料", "塾", "予備校", "書籍", "本屋", "ブックオフ",
        "udemy", "UDEMY", "coursera",
        "school", "course", "education", "book",
    ]),
    # ---------- 振替・移動 ----------
    ("transfer", [
        "振替", "振込", "口座振替", "transfer", "ATM", "両替",
    ]),
]

# カテゴリキー → 日本語名マッピング（表示用）
CATEGORY_JA: dict[str, str] = {
    "food_dining": "飲食・外食",
    "grocery": "食料品・スーパー",
    "transportation": "交通・移動",
    "shopping": "ショッピング",
    "housing": "家賃・住居",
    "utilities": "光熱費・公共料金",
    "entertainment": "エンタメ・趣味",
    "travel": "旅行",
    "health": "医療・健康",
    "education": "教育・学習",
    "subscriptions": "サブスクリプション",
    "income": "収入",
    "transfer": "振替・移動",
    "other": "その他",
}


class CategorizationService:
    """
    取引の自動カテゴリ分類サービス。
    ルールベース分類を実装し、将来のAI分類拡張に備えたインターフェースを持つ。
    """

    def classify(
        self,
        merchant_raw: str,
        merchant_normalized: Optional[str] = None,
        description: Optional[str] = None,
        direction: str = "debit",
    ) -> str:
        """
        取引をカテゴリに分類する。
        複数のテキストを結合して検索テキストを構成し、ルールを順に適用する。
        """
        # 収入は方向から判定
        if direction == "credit":
            result = self._classify_by_rules(
                merchant_raw, merchant_normalized, description
            )
            # ルールで収入・振替に分類されない場合はincomeをデフォルトに
            if result in ("income", "transfer"):
                return result
            return "income"

        return self._classify_by_rules(merchant_raw, merchant_normalized, description)

    @staticmethod
    def _classify_by_rules(
        merchant_raw: str,
        merchant_normalized: Optional[str],
        description: Optional[str],
    ) -> str:
        """ルールベースキーワードマッチング"""
        # 検索対象テキストを結合（大文字化して大小文字を無視）
        search_text = " ".join(filter(None, [
            merchant_raw,
            merchant_normalized,
            description,
        ])).upper()

        for category, keywords in CATEGORY_RULES:
            for keyword in keywords:
                if keyword.upper() in search_text:
                    return category

        return "other"

    def classify_batch(
        self, transactions: list[dict]
    ) -> list[str]:
        """
        取引リストをバッチ分類する。
        各要素にはmerchant_raw, merchant_normalized, description, directionキーが必要。
        """
        return [
            self.classify(
                tx.get("merchant_raw", ""),
                tx.get("merchant_normalized"),
                tx.get("description"),
                tx.get("direction", "debit"),
            )
            for tx in transactions
        ]

    # -------------------------------------------------------------------------
    # 将来のAI分類フックポイント
    # -------------------------------------------------------------------------

    async def classify_with_ai(
        self,
        merchant_raw: str,
        merchant_normalized: Optional[str] = None,
        description: Optional[str] = None,
    ) -> str:
        """
        AI分類フックポイント（将来実装）。
        ルールで "other" になった場合にここを呼ぶことで精度向上が可能。
        OpenAI API / ローカルLLM（Ollama等）への切り替えはここを編集するだけ。
        """
        # TODO: AI分類を実装する
        # prompt = f"Classify this Japanese transaction: {merchant_raw}"
        # category = await openai_client.classify(prompt)
        # return category
        return "other"

    @staticmethod
    def get_category_ja(category_key: str) -> str:
        """カテゴリキーを日本語名に変換する"""
        return CATEGORY_JA.get(category_key, "その他")
