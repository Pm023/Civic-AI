import math
import difflib
import logging
from typing import List, Dict, Any, Tuple, Optional
from app.config import settings
from app.services.ai.complaint_analyzer import analyze_complaint, UNKNOWN_LOCATION

logger = logging.getLogger("app.ai.duplicate_detector")

# Module-level singleton for lazy loading sentence transformer model
_sentence_model = None
_sentence_model_failed = False


def _get_sentence_model():
    """
    Lazily loads the SentenceTransformer model on first real use.
    If the model fails to download or load (e.g. offline), falls back to SequenceMatcher.
    """
    global _sentence_model, _sentence_model_failed
    if _sentence_model is not None:
        return _sentence_model

    if _sentence_model_failed:
        return None

    try:
        from sentence_transformers import SentenceTransformer
        logger.info(f"Loading SentenceTransformer model: {settings.TEXT_MODEL_NAME}...")
        _sentence_model = SentenceTransformer(settings.TEXT_MODEL_NAME)
        logger.info("SentenceTransformer model successfully loaded.")
        return _sentence_model
    except Exception as e:
        logger.warning(
            f"Could not load SentenceTransformer model ({settings.TEXT_MODEL_NAME}): {e}. "
            "Falling back to SequenceMatcher for semantic similarity."
        )
        _sentence_model_failed = True
        return None


def compute_gps_distance_meters(
    lat1: Optional[float],
    lon1: Optional[float],
    lat2: Optional[float],
    lon2: Optional[float]
) -> float:
    """
    Calculates physical distance in meters between two GPS coordinates
    using the Haversine formula. Returns 999999.0 if any coordinate is missing or invalid.
    """
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return 999999.0

    try:
        lat1, lon1, lat2, lon2 = float(lat1), float(lon1), float(lat2), float(lon2)
    except (ValueError, TypeError):
        return 999999.0

    # Earth radius in meters
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c


def compute_semantic_similarity(text1: str, text2: str) -> float:
    """
    Computes semantic similarity between two texts:
    1. Attempts embedding cosine similarity via SentenceTransformer and scikit-learn.
    2. Falls back to difflib.SequenceMatcher ratio if ML model is unavailable.
    """
    model = _get_sentence_model()
    if model is not None:
        try:
            from sklearn.metrics.pairwise import cosine_similarity
            emb = model.encode([text1, text2])
            sim = float(cosine_similarity([emb[0]], [emb[1]])[0][0])
            return max(0.0, min(sim, 1.0))
        except Exception as e:
            logger.warning(f"Error during SentenceTransformer encoding: {e}. Using SequenceMatcher fallback.")

    # Robust fallback using string sequence matching ratio
    return difflib.SequenceMatcher(None, text1.lower(), text2.lower()).ratio()


def check_duplicate_smart(
    new_complaint_text: str,
    existing_complaints: List[Dict[str, Any]],
    new_gps: Tuple[Optional[float], Optional[float]] = (None, None)
) -> Dict[str, Any]:
    """
    Evaluates new complaint against existing active complaints using a weighted multi-signal composite score:
    - 35% Semantic Similarity (SentenceTransformer cosine similarity or SequenceMatcher)
    - 20% Category Match
    - 35% GPS Proximity Score (1.0 <= DUPLICATE_RADIUS_METERS, 0.5 <= radius*5, or landmark text match)
    - 10% Keyword Overlap (Jaccard similarity)

    Args:
        new_complaint_text: Description text of the incoming complaint
        existing_complaints: List of dicts [{"id": int, "text": str, "lat": float, "lon": float}, ...]
        new_gps: Tuple of (latitude, longitude) for the incoming complaint

    Returns:
        Dict containing duplicate decision, best match id, text, distance, score, category.
    """
    new_analysis = analyze_complaint(new_complaint_text)
    best_match_id = None
    best_match_text = None
    highest_score = 0.0
    matched_distance = "N/A"

    new_lat, new_lon = new_gps

    radius_meters = float(settings.DUPLICATE_RADIUS_METERS)
    threshold = float(settings.DUPLICATE_SIMILARITY_THRESHOLD)

    for item in existing_complaints:
        existing_text = item.get("text", "")
        existing_id = item.get("id")
        existing_analysis = analyze_complaint(existing_text)

        # Signal 1: Semantic Similarity (Weight: 35%)
        sem_score = compute_semantic_similarity(new_complaint_text, existing_text)

        # Signal 2: Category Match (Weight: 20%)
        cat_score = 1.0 if new_analysis["category"] == existing_analysis["category"] else 0.0

        # Signal 3: GPS Proximity Score (Weight: 35%)
        item_lat = item.get("lat")
        item_lon = item.get("lon")
        distance_meters = compute_gps_distance_meters(new_lat, new_lon, item_lat, item_lon)

        if distance_meters <= radius_meters:
            gps_score = 1.0
        elif distance_meters <= (radius_meters * 5.0):
            gps_score = 0.5
        else:
            # Fallback to text location matching using the same UNKNOWN_LOCATION sentinel
            loc1, loc2 = new_analysis["location"], existing_analysis["location"]
            if (
                loc1 != UNKNOWN_LOCATION
                and loc2 != UNKNOWN_LOCATION
                and (loc1.lower() in loc2.lower() or loc2.lower() in loc1.lower())
            ):
                gps_score = 1.0
            else:
                gps_score = 0.0

        # Signal 4: Keyword Overlap - Jaccard similarity (Weight: 10%)
        kw1 = set(new_analysis["keywords"])
        kw2 = set(existing_analysis["keywords"])
        union_len = len(kw1.union(kw2))
        overlap = len(kw1.intersection(kw2)) / max(union_len, 1)

        # Composite Score Calculation
        composite_score = (
            (0.35 * sem_score)
            + (0.20 * cat_score)
            + (0.35 * gps_score)
            + (0.10 * overlap)
        )

        if composite_score > highest_score:
            highest_score = composite_score
            best_match_id = existing_id
            best_match_text = existing_text
            matched_distance = round(distance_meters, 1) if distance_meters < 999999.0 else "N/A"

    is_duplicate = highest_score >= threshold

    return {
        "is_duplicate": is_duplicate,
        "matched_report_id": best_match_id if is_duplicate else None,
        "matched_complaint_text": best_match_text if is_duplicate else None,
        "distance_meters": matched_distance,
        "score": round(highest_score, 4),
        "new_complaint_category": new_analysis["category"]
    }
