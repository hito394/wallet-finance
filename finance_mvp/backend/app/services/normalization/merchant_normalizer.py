import re

NORMALIZATION_RULES = {
    r"^starbucks.*": "Starbucks",
    r"^amazon.*": "Amazon",
    r"^uber\s*trip.*": "Uber",
    r"^uber\s*eats.*": "Uber Eats",
    r"^netflix.*": "Netflix",
    r"^spotify.*": "Spotify",
    r"^apple\.com/bill.*": "Apple Services",
    r"^walmart.*": "Walmart",
    r"^costco.*": "Costco",
    r"^h-?e-?b.*": "H-E-B",
    r"^mitsuwa.*": "Mitsuwa",
    r"^ntta.*": "NTTA",
    r"^openai.*chatgpt.*": "OpenAI ChatGPT",
    r"^peacock.*": "Peacock",
    r"^urbanoutfitters.*": "Urban Outfitters",
    r"^online\s*payment.*": "Online Payment",
    r"^jal.*": "JAL",
    r"^ana.*": "ANA",
    r"^paypal.*": "PayPal",
    r"^target.*": "Target",
    r"^doordash.*": "DoorDash",
    r"^chipotle.*": "Chipotle",
    r"^chick.fil.a.*": "Chick-fil-A",
    r"^mcdonald.*": "McDonald's",
    r"^in.n.out.*": "In-N-Out",
    r"^raising cane.*": "Raising Cane's",
    r"^texas roadhouse.*": "Texas Roadhouse",
    r"^paris baguette.*": "Paris Baguette",
    r"^h-e-b.*": "H-E-B",
    r"^99 ?ranch.*": "99 Ranch",
}

# Matches leading numeric reference codes (10+ digit runs) used by card issuers
_LEADING_REF_PATTERN = re.compile(r"^(?:\d{10,}\s+)+")
# Matches common statement noise prefixes
_NOISE_PREFIX_PATTERN = re.compile(
    r"^(?:tst\*|pos\s+|debit\s+card\s+purchase\s+|card\s+purchase\s+(?:with\s+pin\s+)?(?:\d{2}/\d{2}\s+)?)",
    re.IGNORECASE,
)
# Trailing noise: city/state, card numbers, ZIP codes, phone-like suffixes
_TRAILING_NOISE_PATTERN = re.compile(
    r"\s+(?:[A-Z]{2}\s+)?(?:card\s+\d{4}|\d{5}(?:-\d{4})?|\d{3,4})$",
    re.IGNORECASE,
)


def strip_statement_noise(text: str) -> str:
    """Remove leading reference codes and common noise from a raw statement description."""
    cleaned = text.strip()
    cleaned = _LEADING_REF_PATTERN.sub("", cleaned)
    cleaned = _NOISE_PREFIX_PATTERN.sub("", cleaned)
    cleaned = _TRAILING_NOISE_PATTERN.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def normalize_merchant(raw_merchant: str | None) -> str:
    if not raw_merchant:
        return "Unknown"

    cleaned = strip_statement_noise(raw_merchant).lower()
    if not cleaned:
        return "Unknown"

    for pattern, normalized in NORMALIZATION_RULES.items():
        if re.match(pattern, cleaned):
            return normalized

    return cleaned.title()
