import os
from typing import Optional
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.schemas import AIVerifyRequest, AIPredictionResponse, DuplicateCheckResult
from app.api.deps import get_current_user
from app.models.models import User
from app.config import settings
from app.services.ai_service import ai_service
from app.services.ai.pipeline import run_ai_pipeline

router = APIRouter()


def _mock_verify_report(payload: AIVerifyRequest) -> AIPredictionResponse:
    """
    Existing rule-based mock verification logic used when settings.MOCK_AI is True.
    """
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
        image_prediction=ai_res.get("image_prediction"),
        text_prediction=ai_res.get("text_prediction"),
        duplicate_check=None,
        priority_score=ai_res.get("priority_score"),
        priority_level=ai_res.get("priority_level"),
        department=ai_res.get("department"),
        sla_hours=ai_res.get("sla_hours")
    )


@router.post("/verify", response_model=AIPredictionResponse)
def verify_report(
    payload: AIVerifyRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Preview/verification endpoint for citizen complaints:
    - When settings.MOCK_AI is True: Runs rule-based mock verification.
    - When settings.MOCK_AI is False: Runs real NLP classification pipeline (read-only, no DB persistence).
    """
    if settings.MOCK_AI:
        return _mock_verify_report(payload)

    # Real NLP pipeline verification
    pipeline_res = run_ai_pipeline(
        db=db,
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude
    )

    dup_raw = pipeline_res.get("duplicate_check", {})
    dup_result = DuplicateCheckResult(
        is_duplicate=dup_raw.get("is_duplicate", False),
        matched_report_id=dup_raw.get("matched_report_id"),
        matched_complaint_text=dup_raw.get("matched_complaint_text"),
        distance_meters=dup_raw.get("distance_meters"),
        score=dup_raw.get("score", 0.0),
        new_complaint_category=dup_raw.get("new_complaint_category")
    )

    return AIPredictionResponse(
        category=pipeline_res["category"],
        confidence=pipeline_res["confidence"],
        severity=pipeline_res["severity"],
        keywords=pipeline_res["keywords"],
        location_context=pipeline_res["location_context"],
        image_prediction=None,
        text_prediction=pipeline_res["text_prediction"],
        duplicate_check=dup_result,
        priority_score=pipeline_res.get("priority_score"),
        priority_level=pipeline_res.get("priority_level"),
        department=pipeline_res.get("department"),
        sla_hours=pipeline_res.get("sla_hours")
    )

