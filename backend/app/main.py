from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import engine, SessionLocal, Base
from app.api.api import api_router
from app.models.models import Department

# Create Database tables
Base.metadata.create_all(bind=engine)

# Seed initial departments if empty
db = SessionLocal()
try:
    if db.query(Department).count() == 0:
        departments = [
            Department(
                name="Public Works",
                description="Handles potholes, road damage, and general city infrastructure repairs.",
                sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
            ),
            Department(
                name="Electrical Department",
                description="Handles streetlight repairs, outages, and city power infrastructure issues.",
                sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
            ),
            Department(
                name="Water & Drainage",
                description="Handles drainage, storm sewer blockages, flooding, and water leaks.",
                sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
            ),
            Department(
                name="Sanitation Department",
                description="Handles garbage collection, illegal dumping, and civic cleanliness issues.",
                sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
            ),
            Department(
                name="General Civic Services",
                description="Handles other uncategorized civic issues and manual routing cases.",
                sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
            ),
        ]
        db.add_all(departments)
        db.commit()
finally:
    db.close()

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve uploaded files static directory
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "api_docs": "/docs"
    }
