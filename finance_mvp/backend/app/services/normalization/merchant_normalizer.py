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
}


_LEADING_REF_PATTERN = re.compile(r"^(?:\d{10,}\s+)+")
_NOISE_PREFIX_PATTERN = re.compile(r"^(?:tst\*|pos\s+|debit\s+card\s+purchase\s+)", re.IGNORECASE)


def _strip_statement_noise(text: str) -> str:
    cleaned = text.strip()
    cleaned = _LEADING_REF_PATTERN.sub("", cleaned)
    cleaned = _NOISE_PREFIX_PATTERN.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


def normalize_merchant(raw_merchant: str | None) -> str:
    if not raw_merchant:
        return "Unknown"

    cleaned = _strip_statement_noise(raw_merchant).lower()
    if not cleaned:
        return "Unknown"

    for pattern, normalized in NORMALIZATION_RULES.items():
        if re.match(pattern, cleaned):
            return normalized

    return cleaned.title()
