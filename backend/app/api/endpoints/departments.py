from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Department
from app.schemas.schemas import DepartmentResponse

router = APIRouter()

@router.get("", response_model=List[DepartmentResponse])
def get_departments(
    db: Session = Depends(get_db)
):
    departments = db.query(Department).all()
    return departments
