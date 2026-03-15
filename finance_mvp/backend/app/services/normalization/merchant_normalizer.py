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
}


def normalize_merchant(raw_merchant: str | None) -> str:
    if not raw_merchant:
        return "Unknown"

    cleaned = re.sub(r"\s+", " ", raw_merchant.strip()).lower()
    for pattern, normalized in NORMALIZATION_RULES.items():
        if re.match(pattern, cleaned):
            return normalized

    return cleaned.title()
