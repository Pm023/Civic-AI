from typing import List, Dict
from sqlalchemy import func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Report, Feedback
from app.schemas.schemas import DashboardStatsResponse, MapPoint, ReportResponse

router = APIRouter()

@router.get("/stats", response_model=DashboardStatsResponse)
def get_dashboard_stats(
    db: Session = Depends(get_db)
):
    total = db.query(func.count(Report.id)).scalar() or 0
    open_count = db.query(func.count(Report.id)).filter(Report.status.in_(["submitted", "verified", "assigned"])).scalar() or 0
    in_progress = db.query(func.count(Report.id)).filter(Report.status == "in_progress").scalar() or 0
    resolved = db.query(func.count(Report.id)).filter(Report.status == "resolved").scalar() or 0
    
    # Critical alerts (unresolved critical reports)
    critical_alerts = db.query(func.count(Report.id)).filter(
        Report.priority_level == "CRITICAL",
        Report.status != "resolved"
    ).scalar() or 0
    
    # Average response time in hours
    avg_resp = 0.0
    resolved_reports = db.query(Report).filter(
        Report.status == "resolved",
        Report.resolved_at.isnot(None),
        Report.created_at.isnot(None)
    ).all()
    if resolved_reports:
        total_hours = 0.0
        for r in resolved_reports:
            diff = r.resolved_at - r.created_at
            total_hours += diff.total_seconds() / 3600.0
        avg_resp = round(total_hours / len(resolved_reports), 2)
        
    # Citizen satisfaction (positive feedbacks / total feedbacks)
    sat_percentage = 0.0
    total_feedback = db.query(func.count(Feedback.id)).scalar() or 0
    if total_feedback > 0:
        pos_feedback = db.query(func.count(Feedback.id)).filter(Feedback.rating == "positive").scalar() or 0
        sat_percentage = round((pos_feedback / total_feedback) * 100, 2)
    else:
        # Default to 100% baseline if no feedback exists yet
        sat_percentage = 100.0
        
    # Category distribution
    cat_dist_query = db.query(Report.category, func.count(Report.id)).group_by(Report.category).all()
    category_distribution = {cat: count for cat, count in cat_dist_query}
    
    # Department Workload (active cases)
    dept_work_query = db.query(Report.department, func.count(Report.id)).filter(
        Report.status != "resolved",
        Report.department.isnot(None)
    ).group_by(Report.department).all()
    department_workload = {dept: count for dept, count in dept_work_query if dept}
    
    # Recent reports (limit 10)
    recent = db.query(Report).order_by(Report.created_at.desc()).limit(10).all()
    # Serialize to Pydantic
    recent_responses = [ReportResponse.model_validate(r) for r in recent]

    return DashboardStatsResponse(
        total_reports=total,
        open_reports=open_count,
        in_progress_reports=in_progress,
        resolved_reports=resolved,
        avg_response_time_hours=avg_resp,
        citizen_satisfaction_percentage=sat_percentage,
        critical_priority_alerts=critical_alerts,
        category_distribution=category_distribution,
        department_workload=department_workload,
        recent_reports=recent_responses
    )

@router.get("/map-data", response_model=List[MapPoint])
def get_map_data(
    db: Session = Depends(get_db)
):
    reports = db.query(Report).all()
    return [MapPoint.model_validate(r) for r in reports]
