from fastapi import APIRouter
from app.api.endpoints import auth, reports, ai, dashboard, departments, officers

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai-verification"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(officers.router, prefix="/officers", tags=["officers"])
