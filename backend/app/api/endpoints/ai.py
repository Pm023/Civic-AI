from fastapi import APIRouter, Depends, status
from app.schemas.schemas import AIVerifyRequest, AIPredictionResponse
from app.api.deps import get_current_user
from app.models.models import User

router = APIRouter()

@router.post("/verify", response_model=AIPredictionResponse)
def verify_report(
    payload: AIVerifyRequest,
    current_user: User = Depends(get_current_user)
):
    # Phase 1: Mock verification response that matches AIPredictionResponse schema
    # This will be wired up to AIService in Phase 3.
    desc_lower = payload.description.lower()
    
    category = "other"
    confidence = 0.50
    severity = "LOW"
    keywords = ["civic", "report"]
    location_context = ["General location"]
    
    # Simple rule-based mock matching
    if "pothole" in desc_lower or "hole" in desc_lower or "road" in desc_lower:
        category = "pothole"
        confidence = 0.85
        severity = "MEDIUM"
        keywords = ["road", "pothole", "asphalt"]
    elif "light" in desc_lower or "dark" in desc_lower or "street" in desc_lower:
        category = "streetlight"
        confidence = 0.90
        severity = "LOW"
        keywords = ["streetlight", "bulb", "darkness"]
    elif "water" in desc_lower or "leak" in desc_lower or "drain" in desc_lower or "flood" in desc_lower:
        category = "drainage"
        confidence = 0.88
        severity = "HIGH"
        keywords = ["drainage", "flood", "water"]
    elif "garbage" in desc_lower or "trash" in desc_lower or "waste" in desc_lower:
        category = "garbage"
        confidence = 0.92
        severity = "MEDIUM"
        keywords = ["garbage", "trash", "litter"]

    return AIPredictionResponse(
        category=category,
        confidence=confidence,
        severity=severity,
        keywords=keywords,
        location_context=location_context,
        image_prediction=category if payload.image_url else None,
        text_prediction=category
    )
