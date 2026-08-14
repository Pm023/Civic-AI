from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Officer, User, Department
from app.schemas.schemas import OfficerResponse, OfficerCreate, OfficerUpdate, OfficerDetailResponse
from app.api.deps import get_current_admin, get_current_user
from app.utils.security import get_password_hash

router = APIRouter()

def build_officer_detail(officer: Officer) -> OfficerDetailResponse:
    user = officer.user
    dept = officer.department
    return OfficerDetailResponse(
        id=officer.id,
        user_id=officer.user_id,
        email=user.email if user else "",
        full_name=user.full_name if user else "",
        role=user.role if user else "officer",
        department_id=officer.department_id,
        department_name=dept.name if dept else None,
        badge_number=officer.badge_number,
        is_active=user.is_active if user else True,
        created_at=officer.created_at or (user.created_at if user else datetime.utcnow())
    )

@router.get("", response_model=List[OfficerDetailResponse])
def get_officers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    officers = db.query(Officer).all()
    return [build_officer_detail(o) for o in officers]

@router.post("", response_model=OfficerDetailResponse, status_code=status.HTTP_201_CREATED)
def create_officer(
    officer_in: OfficerCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # Validate unique email
    existing_user = db.query(User).filter(User.email == officer_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )
    
    # Validate unique badge number
    # existing_badge = db.query(Officer).filter(Officer.badge_number == officer_in.badge_number).first()
    # if existing_badge:
    #     raise HTTPException(
    #         status_code=status.HTTP_400_BAD_REQUEST,
    #         detail="An officer with this badge number already exists.",
    #     )
    
    # Validate department exists
    dept = db.query(Department).filter(Department.id == officer_in.department_id).first()
    if not dept:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The specified department was not found.",
        )
    
    # Generate next badge number automatically
    last_officer = (
        db.query(Officer)
        .order_by(Officer.id.desc())
        .first()
    )

    next_id = 1 if last_officer is None else last_officer.id + 1

    badge_number = f"PW-{next_id:03d}"
    hashed_password = get_password_hash(officer_in.password)
    db_user = User(
        email=officer_in.email,
        password_hash=hashed_password,
        full_name=officer_in.full_name,
        role="officer",
        is_active=True,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Generate next badge number automatically
    last_officer = (
        db.query(Officer)
        .order_by(Officer.id.desc())
        .first()
    )

    if last_officer:
        next_number = last_officer.id + 1
    else:
        next_number = 1

    badge_number = f"OFC-{next_number:04d}"

    db_officer = Officer(
        user_id=db_user.id,
        department_id=officer_in.department_id,
        badge_number=badge_number,
    )
    db.add(db_officer)
    db.commit()
    db.refresh(db_officer)
    
    return build_officer_detail(db_officer)

@router.get("/{officer_id}", response_model=OfficerDetailResponse)
def get_officer(
    officer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found",
        )
    return build_officer_detail(officer)

@router.put("/{officer_id}", response_model=OfficerDetailResponse)
def update_officer(
    officer_id: int,
    officer_in: OfficerUpdate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found",
        )
    
    user = officer.user
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Associated user account not found",
        )
    
    if officer_in.email is not None and officer_in.email != user.email:
        existing_user = db.query(User).filter(User.email == officer_in.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this email address already exists.",
            )
        user.email = officer_in.email

    if officer_in.full_name is not None:
        user.full_name = officer_in.full_name

    if officer_in.is_active is not None:
        user.is_active = officer_in.is_active

    if officer_in.password is not None and officer_in.password.strip():
        user.password_hash = get_password_hash(officer_in.password)

    if officer_in.badge_number is not None and officer_in.badge_number != officer.badge_number:
        # existing_badge = db.query(Officer).filter(Officer.badge_number == officer_in.badge_number).first()
        # if existing_badge:
        #     raise HTTPException(
        #         status_code=status.HTTP_400_BAD_REQUEST,
        #         detail="An officer with this badge number already exists.",
        #     )
        officer.badge_number = officer_in.badge_number

    if officer_in.department_id is not None:
        dept = db.query(Department).filter(Department.id == officer_in.department_id).first()
        if not dept:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="The specified department was not found.",
            )
        officer.department_id = officer_in.department_id

    db.commit()
    db.refresh(user)
    db.refresh(officer)
    return build_officer_detail(officer)

@router.patch("/{officer_id}/toggle-status", response_model=OfficerDetailResponse)
def toggle_officer_status(
    officer_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer or not officer.user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found",
        )
    
    officer.user.is_active = not officer.user.is_active
    db.commit()
    db.refresh(officer.user)
    db.refresh(officer)
    return build_officer_detail(officer)

@router.delete("/{officer_id}")
def delete_officer(
    officer_id: int,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    officer = db.query(Officer).filter(Officer.id == officer_id).first()
    if not officer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Officer not found",
        )
    
    user = officer.user
    # Deactivate account instead of hard deleting to preserve historical record integrity
    if user:
        user.is_active = False
        db.commit()
    
    return {"message": "Officer deactivated successfully"}

