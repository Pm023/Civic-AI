import os
from fastapi import APIRouter, Depends, status
from app.schemas.schemas import AIVerifyRequest, AIPredictionResponse
from app.api.deps import get_current_user
from app.models.models import User
from app.config import settings
from app.services.ai_service import ai_service

router = APIRouter()

@router.post("/verify", response_model=AIPredictionResponse)
def verify_report(
    payload: AIVerifyRequest,
    current_user: User = Depends(get_current_user)
):
    # Check if there is an image, load it to get prediction
    image_bytes = None
    if payload.image_url:
        filename = os.path.basename(payload.image_url)
        local_path = os.path.join(settings.UPLOAD_DIR, filename)
        if os.path.exists(local_path):
            try:
                with open(local_path, "rb") as f:
                    image_bytes = f.read()
            except Exception:
                pass

    # Call AI verification service
    ai_res = ai_service.verify_complaint(
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
        image_bytes=image_bytes
    )

    return AIPredictionResponse(
        category=ai_res["category"],
        confidence=ai_res["confidence"],
        severity=ai_res["severity"],
        keywords=ai_res["keywords"],
        location_context=ai_res["location_context"],
        image_prediction=ai_res["image_prediction"],
        text_prediction=ai_res["text_prediction"]
    )
