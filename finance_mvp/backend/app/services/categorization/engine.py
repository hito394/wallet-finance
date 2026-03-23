from dataclasses import dataclass
import re

from app.services.normalization.merchant_normalizer import normalize_merchant

CATEGORY_RULES = {
    "Food": ["restaurant", "uber eats", "doordash", "coffee", "starbucks", "mcdonald", "kfc", "sushi", "ramen", "texasroadhouse", "parisbaguette", "tst*"],
    "Groceries": ["walmart", "costco", "whole foods", "market", "grocery", "supermarket", "trader joe", "seiyu", "aeon", "maxvalu", "donki", "コンビニ", "7-eleven", "familymart", "lawson", "h-e-b", "heb", "mitsuwa"],
    "Transportation": ["uber", "lyft", "shell", "exxon", "train", "jr", "suica", "pasmo", "icoca", "gas station", "toll", "parking", "taxi", "ntta", "tolltag"],
    "Shopping": ["amazon", "target", "best buy", "shop", "rakuten", "mercari", "yodobashi", "bic camera", "urbanoutfitters", "legacyer"],
    "Rent": ["rent", "landlord", "apartment"],
    "Utilities": ["electric", "water", "internet", "gas bill", "electricity", "utility", "nuro", "docomo", "softbank", "au"],
    "Travel": ["hotel", "airlines", "airbnb", "booking", "jal", "ana", "shinkansen", "expedia"],
    "Entertainment": ["cinema", "movie", "steam", "xbox", "playstation", "hulu", "disney+"],
    "Health": ["pharmacy", "hospital", "clinic", "dental", "drug store", "welcia", "matsumoto kiyoshi"],
    "Education": ["university", "college", "tuition", "student", "school", "tamu", "tamu applications", "parchment", "bookstore", "tech bookstore", "tech campus"],
    "Subscriptions": [
        # General
        "subscription", "monthly plan", "annual plan", "auto-renew", "autorenew",
        # Video streaming
        "netflix", "hulu", "disney+", "disneyplus", "disney plus", "amazon prime",
        "prime video", "apple tv+", "apple tv plus", "youtube premium", "dazn",
        "abema", "u-next", "unext", "crunchyroll", "funimation", "peacock",
        "paramount+", "paramount plus", "hbo max", "max.com", "showtime", "starz",
        # Music / audio
        "spotify", "apple music", "youtube music", "amazon music", "tidal",
        "deezer", "audible", "scribd",
        # Cloud storage
        "icloud", "google one", "dropbox", "onedrive", "box.com",
        # Software / SaaS
        "adobe", "apple services", "apple.com/bill", "apple.com/storage",
        "microsoft 365", "office 365", "m365", "github", "gitlab",
        "notion", "notion.so", "slack", "figma", "canva", "zoom",
        "chatgpt", "openai", "anthropic", "claude.ai",
        "grammarly", "1password", "lastpass", "dashlane",
        "nordvpn", "expressvpn", "surfshark",
        "loom", "calendly", "miro", "asana", "monday.com",
        "evernote", "todoist", "airtable",
        # Gaming
        "xbox game pass", "game pass", "playstation plus", "ps plus", "ps+",
        "nintendo switch online", "nintendo online", "ea play", "ubisoft+",
        "steam subscription",
        # Health / fitness
        "headspace", "calm", "peloton", "noom", "beachbody",
        # Education
        "duolingo", "skillshare", "masterclass", "coursera", "udemy",
        "linkedin learning", "linkedin premium",
        # Japanese services
        "ニコニコ", "nicovideo", "nico nico", "dmm", "kindle unlimited",
        "rakuten viki", "nhk plus",
    ],
    "Income": ["salary", "payroll", "direct deposit", "bonus", "interest", "dividend", "refund", "reimbursement", "給与", "給料", "入金", "配当", "還付"],
    "Transfers": [
        "transfer", "zelle", "venmo", "cash app", "wire", "wise",
        "振込", "振替", "送金", "立替",
        "payment thank you", "payment thank", "payment received",
        "autopay", "auto pay", "onlinepayment", "online payment",
        "credit card payment", "credit card pmt", "card payment", "cc payment", "cc pmt",
        "visa payment", "visa pmt", "mastercard payment", "mastercard pmt",
        "amex payment", "amex pmt", "discover payment", "discover pmt",
        "statement payment", "minimum payment due",
    ],
}


@dataclass
class CategorizationResult:
    category: str
    confidence: float
    strategy: str


_LEADING_REF_PATTERN = re.compile(r"^(?:\d{10,}\s+)+")

# Patterns that indicate statement artifacts/noise rather than real transactions
_NOISE_PATTERNS = [
    "frgnamt:",
    "payment reversal",
    "payment rev-",
    "reposted payment",
    "new balance",
    "minimum payment",
    "payment due",
    "account summary",
    "starting balance",
    "ending balance",
]


def _is_noise_transaction(text: str) -> bool:
    """Check if transaction is a statement artifact rather than real spending."""
    return any(pattern in text for pattern in _NOISE_PATTERNS)


def _sanitize_text(text: str) -> str:
    cleaned = _LEADING_REF_PATTERN.sub("", text.strip().lower())
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned


def categorize_transaction(
    merchant_raw: str,
    description: str,
    *,
    direction: str | None = None,
    source: str | None = None,
) -> CategorizationResult:
    normalized = normalize_merchant(merchant_raw)
    text = _sanitize_text(f"{normalized} {description}")

    # Check for statement noise/artifacts first
    if _is_noise_transaction(text):
        return CategorizationResult(category="Uncategorized", confidence=0.0, strategy="noise_artifact")

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
