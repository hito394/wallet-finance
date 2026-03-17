from dataclasses import dataclass

from app.services.normalization.merchant_normalizer import normalize_merchant

CATEGORY_RULES = {
    "Food": ["restaurant", "uber eats", "doordash", "coffee", "starbucks"],
    "Groceries": ["walmart", "costco", "whole foods", "market", "grocery"],
    "Transportation": ["uber", "lyft", "shell", "exxon", "train"],
    "Shopping": ["amazon", "target", "best buy", "shop"],
    "Rent": ["rent", "landlord", "apartment"],
    "Utilities": ["electric", "water", "internet", "gas bill"],
    "Travel": ["hotel", "airlines", "airbnb", "booking"],
    "Entertainment": ["cinema", "movie", "steam", "xbox"],
    "Health": ["pharmacy", "hospital", "clinic", "dental"],
    "Subscriptions": ["netflix", "spotify", "subscription", "apple services"],
    "Income": ["salary", "payroll", "deposit"],
    "Transfers": ["transfer", "zelle", "venmo", "cash app"],
}


@dataclass
class CategorizationResult:
    category: str
    confidence: float
    strategy: str


def categorize_transaction(merchant_raw: str, description: str) -> CategorizationResult:
    normalized = normalize_merchant(merchant_raw)
    text = f"{normalized} {description}".lower()

    for category, keywords in CATEGORY_RULES.items():
        if any(keyword in text for keyword in keywords):
            return CategorizationResult(category=category, confidence=0.92, strategy="keyword_rule")

    return CategorizationResult(category="Uncategorized", confidence=0.0, strategy="fallback_baseline")
