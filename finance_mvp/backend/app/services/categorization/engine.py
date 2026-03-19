from dataclasses import dataclass

from app.services.normalization.merchant_normalizer import normalize_merchant

CATEGORY_RULES = {
    "Food": ["restaurant", "uber eats", "doordash", "coffee", "starbucks", "mcdonald", "kfc", "sushi", "ramen"],
    "Groceries": ["walmart", "costco", "whole foods", "market", "grocery", "supermarket", "trader joe", "seiyu", "aeon", "maxvalu", "donki", "コンビニ", "7-eleven", "familymart", "lawson"],
    "Transportation": ["uber", "lyft", "shell", "exxon", "train", "jr", "suica", "pasmo", "icoca", "gas station", "toll", "parking", "taxi"],
    "Shopping": ["amazon", "target", "best buy", "shop", "rakuten", "mercari", "yodobashi", "bic camera"],
    "Rent": ["rent", "landlord", "apartment"],
    "Utilities": ["electric", "water", "internet", "gas bill", "electricity", "utility", "nuro", "docomo", "softbank", "au"],
    "Travel": ["hotel", "airlines", "airbnb", "booking", "jal", "ana", "shinkansen", "expedia"],
    "Entertainment": ["cinema", "movie", "steam", "xbox", "playstation", "hulu", "disney+"],
    "Health": ["pharmacy", "hospital", "clinic", "dental", "drug store", "welcia", "matsumoto kiyoshi"],
    "Subscriptions": ["netflix", "spotify", "subscription", "apple services", "icloud", "google one", "adobe"],
    "Income": ["salary", "payroll", "direct deposit", "bonus", "interest", "dividend", "refund", "reimbursement", "給与", "給料", "入金", "配当", "還付"],
    "Transfers": ["transfer", "zelle", "venmo", "cash app", "wire", "wise", "振込", "振替", "送金", "立替", "payment thank you", "autopay"],
}


@dataclass
class CategorizationResult:
    category: str
    confidence: float
    strategy: str


def categorize_transaction(
    merchant_raw: str,
    description: str,
    *,
    direction: str | None = None,
    source: str | None = None,
) -> CategorizationResult:
    normalized = normalize_merchant(merchant_raw)
    text = f"{normalized} {description}".lower()

    # Distinguish common money-in patterns before generic category matching.
    if direction == "credit":
        if any(keyword in text for keyword in CATEGORY_RULES["Income"]):
            return CategorizationResult(category="Income", confidence=0.94, strategy="directional_rule")
        if any(keyword in text for keyword in CATEGORY_RULES["Transfers"]):
            return CategorizationResult(category="Transfers", confidence=0.95, strategy="directional_rule")
        if source == "card" and "payment" in text:
            return CategorizationResult(category="Transfers", confidence=0.9, strategy="directional_rule")

    best_category = None
    best_score = 0
    for category, keywords in CATEGORY_RULES.items():
        score = sum(1 for keyword in keywords if keyword in text)
        if score > best_score:
            best_score = score
            best_category = category

    if best_category:
        confidence = min(0.82 + 0.05 * best_score, 0.97)
        return CategorizationResult(category=best_category, confidence=confidence, strategy="keyword_rule")

    if direction == "credit":
        return CategorizationResult(category="Income", confidence=0.58, strategy="fallback_credit")

    return CategorizationResult(category="Uncategorized", confidence=0.0, strategy="fallback_baseline")
