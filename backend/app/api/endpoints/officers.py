from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Officer
from app.schemas.schemas import OfficerResponse

router = APIRouter()

@router.get("", response_model=List[OfficerResponse])
def get_officers(
    db: Session = Depends(get_db)
):
    officers = db.query(Officer).all()
    results = []
    for o in officers:
        results.append(
            OfficerResponse(
                id=o.id,
                user_id=o.user_id,
                department_id=o.department_id,
                badge_number=o.badge_number,
                full_name=o.user.full_name
            )
        )
    return results
