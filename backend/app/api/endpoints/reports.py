import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Report, User, StatusHistory, Feedback
from app.schemas.schemas import (
    ReportCreate, ReportResponse, ReportStatusUpdate,
    ReportFeedbackCreate, ReportAssignRequest
)
from app.api.deps import get_current_user, get_current_officer

router = APIRouter()

def generate_ticket_id() -> str:
    return f"CIV-{uuid.uuid4().hex[:8].upper()}"

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket_id = generate_ticket_id()
    
    db_report = Report(
        ticket_id=ticket_id,
        citizen_id=current_user.id,
        description=report_in.description,
        latitude=report_in.latitude,
        longitude=report_in.longitude,
        category=report_in.category or "other",
        status="submitted",
        # Default placeholder values for Phase 1; AI verification & routing will populate these in later phases
        ai_confidence=0.0,
        severity="LOW",
        priority_score=0.0,
        priority_level="LOW",
        sla_hours=48,
    )
    
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    # Write initial history status
    history = StatusHistory(
        report_id=db_report.id,
        status="submitted",
        notes="Report submitted by citizen.",
        changed_by_user_id=current_user.id
    )
    db.add(history)
    db.commit()
    
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
