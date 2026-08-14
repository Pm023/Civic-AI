from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Text, Boolean
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, nullable=False, default="citizen")  # "citizen", "officer", or "admin"
    is_active = Column(Boolean, default=True, server_default='1', nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    officer_profile = relationship("Officer", back_populates="user", uselist=False)
    reports = relationship("Report", back_populates="citizen", foreign_keys="Report.citizen_id")
    status_updates = relationship("StatusHistory", back_populates="changed_by_user")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    sla_hours_low = Column(Integer, default=48)
    sla_hours_medium = Column(Integer, default=24)
    sla_hours_high = Column(Integer, default=12)
    sla_hours_critical = Column(Integer, default=4)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    officers = relationship("Officer", back_populates="department")


class Officer(Base):
    __tablename__ = "officers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True, nullable=False)
    badge_number = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="officer_profile")
    department = relationship("Department", back_populates="officers")
    work_orders = relationship("WorkOrder", back_populates="officer")


class MasterCase(Base):
    __tablename__ = "master_cases"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, index=True, nullable=False)
    status = Column(String, index=True, nullable=False)
    priority_level = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    # Relationships
    duplicate_reports = relationship("Report", back_populates="master_case", foreign_keys="Report.master_case_id")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(String, unique=True, index=True, nullable=False)
    citizen_id = Column(Integer, ForeignKey("users.id"), index=True, nullable=True)
    image_url = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    latitude = Column(Float, index=True, nullable=False)
    longitude = Column(Float, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Classification & AI
    category = Column(String, index=True, nullable=False)
    ai_confidence = Column(Float, default=0.0)
    severity = Column(String, default="LOW")
    priority_score = Column(Float, default=0.0, index=True)
    priority_level = Column(String, default="LOW")
    
    # Duplicate detection & hierarchy
    duplicate_of = Column(Integer, ForeignKey("reports.id"), nullable=True)
    master_case_id = Column(Integer, ForeignKey("master_cases.id"), nullable=True)
    
    # Assignment & routing
    department = Column(String, nullable=True)
    assigned_officer = Column(String, nullable=True)
    status = Column(String, default="submitted", index=True)  # "submitted", "verified", "assigned", "in_progress", "resolved"
    sla_hours = Column(Integer, default=48)
    
    # Resolution details
    resolution_notes = Column(Text, nullable=True)
    resolution_image = Column(String, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    
    # Citizen feedback string (stored on report object directly as requested)
    citizen_feedback = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    citizen = relationship("User", back_populates="reports", foreign_keys=[citizen_id])
    master_case = relationship("MasterCase", back_populates="duplicate_reports", foreign_keys=[master_case_id])
    ai_prediction = relationship("AIPrediction", back_populates="report", uselist=False)
    work_orders = relationship("WorkOrder", back_populates="report")
    status_history = relationship("StatusHistory", back_populates="report")
    feedbacks = relationship("Feedback", back_populates="report")


class AIPrediction(Base):
    __tablename__ = "ai_predictions"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), index=True, nullable=False)
    category = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    severity = Column(String, nullable=False)
    keywords = Column(JSON, nullable=True)  # List of strings
    location_context = Column(JSON, nullable=True)  # List of strings
    image_prediction = Column(String, nullable=True)
    text_prediction = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    report = relationship("Report", back_populates="ai_prediction")


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), index=True, nullable=False)
    officer_id = Column(Integer, ForeignKey("officers.id"), index=True, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String, default="pending")  # "pending", "assigned", "completed", "cancelled"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    report = relationship("Report", back_populates="work_orders")
    officer = relationship("Officer", back_populates="work_orders")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), index=True, nullable=False)
    status = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    changed_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    report = relationship("Report", back_populates="status_history")
    changed_by_user = relationship("User", back_populates="status_updates")


class Feedback(Base):
    __tablename__ = "feedback"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"), index=True, nullable=False)
    rating = Column(String, nullable=False)  # "positive", "neutral", "negative"
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    report = relationship("Report", back_populates="feedbacks")
