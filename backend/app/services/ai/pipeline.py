import logging
from typing import Optional, Dict, Any, List
from sqlalchemy.orm import Session
from app.models.models import Report, Department
from app.services.ai.complaint_analyzer import analyze_complaint, FALLBACK_SLA_HOURS
from app.services.ai.duplicate_detector import check_duplicate_smart

logger = logging.getLogger("app.ai.pipeline")

# Active lifecycle statuses considered for duplicate candidate matching
ACTIVE_STATUSES = ["submitted", "verified", "assigned", "in_progress"]
SENSITIVE_LANDMARKS = ["school", "college", "hospital", "highway", "station"]


def calculate_risk_priority(
    severity: str,
    location: str,
    is_duplicate: bool
) -> Dict[str, Any]:
    """
    Computes priority score and level:
    - Base score: LOW=25, MEDIUM=50, HIGH=75, CRITICAL=90
    - +10 if extracted location contains sensitive landmark
    - +10 if flagged as duplicate
    - Capped at 100
    - Priority Level: CRITICAL if score >= 80, HIGH if score >= 60, else NORMAL
    """
    base_scores = {
        "LOW": 25,
        "MEDIUM": 50,
        "HIGH": 75,
        "CRITICAL": 90
    }
    score = base_scores.get(severity.upper(), 25)

    if any(landmark in location.lower() for landmark in SENSITIVE_LANDMARKS):
        score += 10

    if is_duplicate:
        score += 10

    score = min(score, 100)
    priority_score = float(score)

    if priority_score >= 80.0:
        priority_level = "CRITICAL"
    elif priority_score >= 60.0:
        priority_level = "HIGH"
    else:
        priority_level = "NORMAL"

    return {
        "priority_score": priority_score,
        "priority_level": priority_level
    }


def resolve_department_sla(
    db: Session,
    department_name: str,
    severity: str
) -> int:
    """
    Looks up the department row in the real database and reads the SLA column
    for the specific severity level. Falls back to FALLBACK_SLA_HOURS if not found.
    """
    severity_upper = severity.upper()
    dept = db.query(Department).filter(Department.name == department_name).first()

    if dept:
        if severity_upper == "CRITICAL":
            return dept.sla_hours_critical or 4
        elif severity_upper == "HIGH":
            return dept.sla_hours_high or 12
        elif severity_upper == "MEDIUM":
            return dept.sla_hours_medium or 24
        else:
            return dept.sla_hours_low or 48

    return FALLBACK_SLA_HOURS.get(severity_upper, 48)


def run_ai_pipeline(
    db: Session,
    description: str,
    latitude: float,
    longitude: float,
    exclude_report_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Executes the full end-to-end NLP & AI verification pipeline:
    1. Queries real active reports from the database for duplicate candidate matching.
    2. Runs complaint analysis (category, confidence, severity, department, location, keywords).
    3. Runs smart duplicate detection (GPS distance, semantic similarity, category match, keyword overlap).
    4. Resolves dynamic department SLA from the Department database table.
    5. Calculates composite risk / priority score and level.
    6. Returns structured pipeline dictionary.
    """
    # 1. Query active reports from database
    query = db.query(Report).filter(Report.status.in_(ACTIVE_STATUSES))
    if exclude_report_id is not None:
        query = query.filter(Report.id != exclude_report_id)

    active_reports = query.all()
    existing_candidates = [
        {
            "id": r.id,
            "text": r.description,
            "lat": r.latitude,
            "lon": r.longitude
        }
        for r in active_reports
    ]

    # 2. Run text analysis
    analysis = analyze_complaint(description)

    # 3. Run smart duplicate check
    dup_result = check_duplicate_smart(
        new_complaint_text=description,
        existing_complaints=existing_candidates,
        new_gps=(latitude, longitude)
    )

    # 4. Resolve SLA hours from database
    sla_hours = resolve_department_sla(
        db=db,
        department_name=analysis["department"],
        severity=analysis["severity"]
    )

    # 5. Calculate priority score and level
    priority_info = calculate_risk_priority(
        severity=analysis["severity"],
        location=analysis["location"],
        is_duplicate=dup_result["is_duplicate"]
    )

    # 6. Format location context
    location_context = [analysis["location"]]
    if latitude is not None and longitude is not None:
        location_context.append(f"Lat: {latitude:.4f}")
        location_context.append(f"Lng: {longitude:.4f}")

    return {
        "category": analysis["category"],
        "confidence": analysis["confidence"],
        "severity": analysis["severity"],
        "keywords": analysis["keywords"],
        "location_context": location_context,
        "text_prediction": analysis["category"],
        "department": analysis["department"],
        "sla_hours": sla_hours,
        "priority_score": priority_info["priority_score"],
        "priority_level": priority_info["priority_level"],
        "duplicate_check": dup_result
    }
