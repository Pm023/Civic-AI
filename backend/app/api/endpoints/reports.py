import os
import shutil
import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Report, User, StatusHistory, Feedback, AIPrediction
from app.schemas.schemas import (
    ReportCreate, ReportResponse, ReportStatusUpdate,
    ReportFeedbackCreate, ReportAssignRequest
)
from app.api.deps import get_current_user, get_current_officer
from app.config import settings
from app.services.ai_service import ai_service

router = APIRouter()

def generate_ticket_id() -> str:
    return f"CIV-{uuid.uuid4().hex[:8].upper()}"

@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    # Ensure it's an image
    if not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed."
        )
        
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, filename)
    
    # Ensure uploads directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    # Save the file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not save file: {str(e)}"
        )
        
    # Return the static URL
    return {"image_url": f"/uploads/{filename}"}

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Enforce that image_url is mandatory
    if not report_in.image_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Application rejected: An image upload is required to submit a complaint. Please upload a clear photo of the issue."
        )

    ticket_id = generate_ticket_id()
    
    # Check if there is an image, load it to get prediction
    image_bytes = None
    filename = os.path.basename(report_in.image_url)
    local_path = os.path.join(settings.UPLOAD_DIR, filename)
    if os.path.exists(local_path):
        try:
            with open(local_path, "rb") as f:
                image_bytes = f.read()
        except Exception:
            pass

    # Call AI verification service
    ai_res = ai_service.verify_complaint(
        description=report_in.description,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        image_bytes=image_bytes
    )

    # 2. Check if image prediction class matches dataset and has confidence >= 70%
    image_category = ai_res.get("image_prediction")
    image_confidence = ai_res.get("image_confidence", 0.0)
    valid_categories = ['garbage', 'pothole', 'road_damage', 'road_sign', 'vandalism']
    
    if not image_category or image_category not in valid_categories or image_confidence < 0.70:
        confidence_pct = image_confidence * 100
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Application rejected: Uploaded image is not recognized as a valid civic issue or "
                f"classification confidence ({confidence_pct:.1f}%) is below the required 70% threshold. "
                "Please upload a clear image of garbage, pothole, road damage, road sign, or vandalism."
            )
        )

    db_report = Report(
        ticket_id=ticket_id,
        citizen_id=current_user.id,
        image_url=report_in.image_url,
        description=report_in.description,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        category=ai_res["category"],
        ai_confidence=ai_res["confidence"],
        severity=ai_res["severity"],
        priority_score=ai_res["priority_score"],
        priority_level=ai_res["priority_level"],
        department=ai_res["department"],
        sla_hours=ai_res["sla_hours"],
        status="assigned" if ai_res["department"] else "submitted"
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    # Save the AI Prediction details
    ai_prediction_entry = AIPrediction(
        report_id=db_report.id,
        category=ai_res["category"],
        confidence=ai_res["confidence"],
        severity=ai_res["severity"],
        keywords=ai_res["keywords"],
        location_context=ai_res["location_context"],
        image_prediction=ai_res["image_prediction"],
        text_prediction=ai_res["text_prediction"]
    )
    db.add(ai_prediction_entry)
    
    # Write initial history status
    history = StatusHistory(
        report_id=db_report.id,
        status="submitted",
        notes="Report submitted by citizen.",
        changed_by_user_id=current_user.id
    )
    db.add(history)
    
    # Log auto-routed assignment status history
    if db_report.department:
        history_assign = StatusHistory(
            report_id=db_report.id,
            status="assigned",
            notes=f"Auto-routed to {db_report.department} (Priority: {db_report.priority_level}, SLA: {db_report.sla_hours}h).",
            changed_by_user_id=current_user.id
        )
        db.add(history_assign)
        
    db.commit()
    db.refresh(db_report)
    
    return db_report

@router.get("", response_model=List[ReportResponse])
def read_reports(
    status: Optional[str] = None,
    priority_level: Optional[str] = None,
    category: Optional[str] = None,
    citizen_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Report)
    
    # If the user is a citizen, restrict their search or filter by their ID
    if current_user.role == "citizen":
        query = query.filter(Report.citizen_id == current_user.id)
    elif citizen_id is not None:
        query = query.filter(Report.citizen_id == citizen_id)
        
    if status:
        query = query.filter(Report.status == status)
    if priority_level:
        query = query.filter(Report.priority_level == priority_level)
    if category:
        query = query.filter(Report.category == category)
        
    reports = query.order_by(Report.created_at.desc()).offset(skip).limit(limit).all()
    return reports

@router.get("/{id_or_ticket}", response_model=ReportResponse)
def read_report(
    id_or_ticket: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Try looking up by ID (integer) first, then ticket_id
    report = None
    if id_or_ticket.isdigit():
        report = db.query(Report).filter(Report.id == int(id_or_ticket)).first()
    
    if not report:
        report = db.query(Report).filter(Report.ticket_id == id_or_ticket).first()
        
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )
        
    # Citizens can only view their own reports
    if current_user.role == "citizen" and report.citizen_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to view this report."
        )
        
    return report

@router.patch("/{id}/status", response_model=ReportResponse)
def update_report_status(
    id: int,
    status_update: ReportStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_officer)  # Only officers can change status
):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )
        
    report.status = status_update.status
    if status_update.resolution_notes is not None:
        report.resolution_notes = status_update.resolution_notes
    if status_update.resolution_image is not None:
        report.resolution_image = status_update.resolution_image
        
    if status_update.status == "resolved":
        report.resolved_at = datetime.utcnow()
        
    db.commit()
    db.refresh(report)
    
    # Log status history
    history = StatusHistory(
        report_id=report.id,
        status=status_update.status,
        notes=status_update.resolution_notes or f"Status updated to {status_update.status}.",
        changed_by_user_id=current_user.id
    )
    db.add(history)
    db.commit()
    
    return report

@router.post("/{id}/assign", response_model=ReportResponse)
def assign_report(
    id: int,
    assignment: ReportAssignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_officer)  # Only officers/admins can assign
):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )
        
    report.department = assignment.department
    if assignment.assigned_officer:
        report.assigned_officer = assignment.assigned_officer
        
    report.status = "assigned"
    db.commit()
    db.refresh(report)
    
    # Log assignment in history
    history = StatusHistory(
        report_id=report.id,
        status="assigned",
        notes=f"Assigned to {assignment.department} (Officer: {assignment.assigned_officer or 'Unassigned'}).",
        changed_by_user_id=current_user.id
    )
    db.add(history)
    db.commit()
    
    return report

@router.post("/{id}/feedback", response_model=ReportResponse)
def submit_feedback(
    id: int,
    feedback_in: ReportFeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == id).first()
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )
        
    if report.citizen_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only submit feedback for your own reports."
        )
        
    # Store feedback in both Feedback table and Report object (as string rating + comment)
    feedback_entry = Feedback(
        report_id=report.id,
        rating=feedback_in.rating,
        comment=feedback_in.comment
    )
    db.add(feedback_entry)
    
    # Update report object's citizen_feedback field
    report.citizen_feedback = f"{feedback_in.rating.upper()}: {feedback_in.comment or ''}"
    db.commit()
    db.refresh(report)
    
    return report
