from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "citizen"  # "citizen" or "officer"

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[int] = None
    role: Optional[str] = None

# Report Schemas
class ReportCreate(BaseModel):
    description: str
    latitude: float
    longitude: float
    category: Optional[str] = "other"  # Can be selected or set to 'other' initially

class ReportStatusUpdate(BaseModel):
    status: str  # "submitted", "verified", "assigned", "in_progress", "resolved"
    resolution_notes: Optional[str] = None
    resolution_image: Optional[str] = None

class ReportFeedbackCreate(BaseModel):
    rating: str  # "positive", "neutral", "negative"
    comment: Optional[str] = None

class StatusHistoryResponse(BaseModel):
    id: int
    report_id: int
    status: str
    notes: Optional[str] = None
    changed_by_user_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class ReportResponse(BaseModel):
    id: int
    ticket_id: str
    citizen_id: Optional[int] = None
    image_url: Optional[str] = None
    description: str
    latitude: float
    longitude: float
    timestamp: datetime
    category: str
    ai_confidence: float
    severity: str
    priority_score: float
    priority_level: str
    duplicate_of: Optional[int] = None
    master_case_id: Optional[int] = None
    department: Optional[str] = None
    assigned_officer: Optional[str] = None
    status: str
    sla_hours: int
    resolution_notes: Optional[str] = None
    resolution_image: Optional[str] = None
    resolved_at: Optional[datetime] = None
    citizen_feedback: Optional[str] = None
    created_at: datetime
    status_history: List[StatusHistoryResponse] = []

    class Config:
        from_attributes = True

# AI Verification Schemas
class AIVerifyRequest(BaseModel):
    description: str
    latitude: float
    longitude: float
    image_url: Optional[str] = None

class AIPredictionResponse(BaseModel):
    category: str
    confidence: float
    severity: str
    keywords: List[str] = []
    location_context: List[str] = []
    image_prediction: Optional[str] = None
    text_prediction: Optional[str] = None

# Assignment Schema
class ReportAssignRequest(BaseModel):
    department: str
    assigned_officer: Optional[str] = None

# Department and Officer response schemas
class DepartmentResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    sla_hours_low: int
    sla_hours_medium: int
    sla_hours_high: int
    sla_hours_critical: int

    class Config:
        from_attributes = True

class OfficerResponse(BaseModel):
    id: int
    user_id: int
    department_id: int
    badge_number: str
    full_name: str

    class Config:
        from_attributes = True

class OfficerCreate(BaseModel):
    email: EmailStr
    full_name: str
    password: str
    department_id: int

class OfficerUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    department_id: Optional[int] = None
    badge_number: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class OfficerDetailResponse(BaseModel):
    id: int
    user_id: int
    email: EmailStr
    full_name: str
    role: str
    department_id: int
    department_name: Optional[str] = None
    badge_number: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

# Dashboard Stats Schemas
class DashboardStatsResponse(BaseModel):
    total_reports: int
    open_reports: int
    in_progress_reports: int
    resolved_reports: int
    avg_response_time_hours: float
    citizen_satisfaction_percentage: float
    critical_priority_alerts: int
    category_distribution: Dict[str, int]
    department_workload: Dict[str, int]
    recent_reports: List[ReportResponse]

class MapPoint(BaseModel):
    id: int
    ticket_id: str
    category: str
    status: str
    priority_level: str
    latitude: float
    longitude: float
    description: str

    class Config:
        from_attributes = True
