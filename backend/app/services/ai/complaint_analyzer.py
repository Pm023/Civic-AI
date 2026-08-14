import re
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger("app.ai.complaint_analyzer")

# Robust NLTK WordNet initialization with graceful fallback
_lemmatizer = None
try:
    import nltk
    from nltk.stem import WordNetLemmatizer
    try:
        nltk.download("wordnet", quiet=True)
        nltk.download("omw-1.4", quiet=True)
        _lemmatizer = WordNetLemmatizer()
    except Exception as e:
        logger.warning(f"Could not download NLTK wordnet resources: {e}. Falling back to raw token analysis.")
        _lemmatizer = None
except Exception as e:
    logger.warning(f"NLTK not available: {e}. Falling back to raw token analysis.")
    _lemmatizer = None

# Single consistent sentinel constant for location detection
UNKNOWN_LOCATION = "Unknown Location"

# Category keyword dictionary
CATEGORY_MAP: Dict[str, List[str]] = {
    "pothole": [
        "pothole", "potholes", "road hole", "crack", "cracked asphalt", "asphalt",
        "crater", "cave in", "hole in road", "road damage", "damaged road", "crater on road"
    ],
    "garbage": [
        "garbage", "waste", "trash", "rubbish", "dump", "litter", "overflowing bin",
        "dumping", "refuse", "debris", "stinking waste", "dumpyard"
    ],
    "drainage": [
        "water leakage", "leak", "pipe burst", "drainage", "sewage", "waterlogging",
        "water leak", "flood", "flooding", "overflow", "clogged drain", "sewer", "gutter"
    ],
    "streetlight": [
        "streetlight", "street light", "street lamp", "light post", "dark street",
        "broken light", "lamp post", "bulb out", "light outage", "lights out", "no light"
    ]
}

# Category to Department mapping matching exact Department database seed names in main.py
CATEGORY_DEPARTMENT_MAP: Dict[str, str] = {
    "pothole": "Public Works",
    "garbage": "Sanitation Department",
    "drainage": "Water & Drainage",
    "streetlight": "Electrical Department"
}

DEFAULT_DEPARTMENT = "General Civic Services"

# Severity keyword hierarchy
SEVERITY_KEYWORDS: Dict[str, List[str]] = {
    "CRITICAL": [
        "death", "dead", "hospital", "school", "manhole", "life threatening",
        "severe injury", "electrocution", "collapsed", "emergency", "fatal", "hazard"
    ],
    "HIGH": [
        "accident", "accidents", "dangerous", "injury", "injuries", "huge",
        "massive", "slipped", "major leak", "deep hole", "hazardous", "overflowing badly"
    ],
    "MEDIUM": [
        "broken", "slow traffic", "leak", "smell", "overflow", "stinking",
        "dark", "crack", "minor damage", "inconvenience"
    ]
}

# Fallback SLA hours (only used when Department cannot be resolved from database)
FALLBACK_SLA_HOURS: Dict[str, int] = {
    "CRITICAL": 4,
    "HIGH": 12,
    "MEDIUM": 24,
    "LOW": 48
}

STOP_WORDS = {
    "there", "is", "a", "and", "two", "in", "on", "the", "near", "for", "of", "to",
    "was", "yesterday", "because", "having", "this", "that", "it", "with", "as",
    "by", "at", "an", "be", "are", "from", "some", "very", "our", "all", "so",
    "but", "about", "would", "could", "should", "please", "been", "have", "has",
    "out", "over", "under", "again", "then", "once", "here", "why", "how", "where"
}


def preprocess_text(text: str) -> str:
    """
    Lowercases and strips non-alphanumeric characters, retaining spaces.
    If text is empty or whitespace only, defaults to 'general civic issue'.
    """
    if not text or not text.strip():
        return "general civic issue"
    text_clean = text.lower()
    return re.sub(r"[^a-z0-9\s]", " ", text_clean).strip()


def extract_location(text: str) -> str:
    """
    Regex-matches landmark / location patterns like 'near X college/hospital/road...'
    Returns the extracted location phrase, or UNKNOWN_LOCATION sentinel.
    """
    if not text or not text.strip():
        return UNKNOWN_LOCATION

    pattern = (
        r"(?:near|outside|at|opposite|behind|on|in front of|by)\s+"
        r"([a-z0-9\s]+(?:college|hospital|mall|gate|road|street|park|station|school|"
        r"junction|circle|bridge|market|nagar|cross|lane|avenue|highway))"
    )
    match = re.search(pattern, text.lower())
    if match:
        extracted = match.group(1).strip()
        # Clean up multi-space
        extracted = re.sub(r"\s+", " ", extracted)
        return extracted.title()

    return UNKNOWN_LOCATION


def extract_keywords(text: str) -> List[str]:
    """
    Lemmatizes tokens (using WordNetLemmatizer if available, else raw tokens),
    removes stopwords, filters tokens <= 2 chars, and returns unique keywords in order.
    """
    cleaned = preprocess_text(text)
    words = cleaned.split()

    result = []
    for word in words:
        if len(word) <= 2 or word in STOP_WORDS:
            continue

        token = word
        if _lemmatizer is not None:
            try:
                token = _lemmatizer.lemmatize(word)
            except Exception:
                token = word

        if len(token) > 2 and token not in STOP_WORDS and token not in result:
            result.append(token)

    return result


def analyze_complaint(text: str) -> Dict[str, Any]:
    """
    Analyzes complaint description:
    1. Preprocesses text
    2. Matches against CATEGORY_MAP (first match wins, confidence scaled by matching terms)
    3. Looks up mapped department (fallback to DEFAULT_DEPARTMENT)
    4. Determines severity via SEVERITY_KEYWORDS (first match wins, fallback to LOW)
    5. Extracts landmark location and lemmatized keywords
    """
    clean_text = preprocess_text(text)

    # 1. Category Detection
    detected_category = "other"
    confidence_score = 0.50

    for category, terms in CATEGORY_MAP.items():
        matched_terms = [t for t in terms if t in clean_text]
        if matched_terms:
            detected_category = category
            # Confidence formula: min(0.75 + 0.10 * num_matching_terms, 0.98)
            confidence_score = min(0.75 + (0.10 * len(matched_terms)), 0.98)
            break

    # 2. Department Resolution
    department = CATEGORY_DEPARTMENT_MAP.get(detected_category, DEFAULT_DEPARTMENT)

    # 3. Severity Determination
    detected_severity = "LOW"
    for severity_level, keywords in SEVERITY_KEYWORDS.items():
        if any(kw in clean_text for kw in keywords):
            detected_severity = severity_level
            break

    # 4. Location and Keywords
    location = extract_location(text)
    keywords = extract_keywords(text)

    return {
        "category": detected_category,
        "confidence": round(confidence_score, 2),
        "severity": detected_severity,
        "department": department,
        "location": location,
        "keywords": keywords
    }
