import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app
from app.models.models import Department

# In-memory SQLite DB URL
SQLALCHEMY_DATABASE_URL = "sqlite://"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(name="db", scope="function")
def fixture_db():
    # Setup: create all tables in test database
    Base.metadata.create_all(bind=engine)
    
    db_session = TestingSessionLocal()
    
    # Seed default test departments
    departments = [
        Department(
            name="Public Works",
            description="Test Public Works",
            sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
        ),
        Department(
            name="Electrical Department",
            description="Test Electrical",
            sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
        ),
        Department(
            name="Water & Drainage",
            description="Test Water",
            sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
        ),
        Department(
            name="Sanitation Department",
            description="Test Sanitation",
            sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
        ),
        Department(
            name="General Civic Services",
            description="Test General",
            sla_hours_low=48, sla_hours_medium=24, sla_hours_high=12, sla_hours_critical=4
        ),
    ]
    db_session.add_all(departments)
    db_session.commit()
    
    try:
        yield db_session
    finally:
        db_session.close()
        # Teardown: drop all tables
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(name="client", scope="function")
def fixture_client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass
            
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
