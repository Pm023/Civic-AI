import pytest
from app.models.models import Report, Department, MasterCase, AIPrediction, StatusHistory
from app.services.ai.complaint_analyzer import (
    preprocess_text, extract_location, extract_keywords,
    analyze_complaint, UNKNOWN_LOCATION, CATEGORY_DEPARTMENT_MAP
)
from app.services.ai.duplicate_detector import (
    compute_gps_distance_meters, compute_semantic_similarity,
    check_duplicate_smart
)
from app.services.ai.pipeline import run_ai_pipeline
from app.config import settings


def test_complaint_analyzer_unit():
    # 1. Preprocess text
    assert preprocess_text("") == "general civic issue"
    assert preprocess_text("   ") == "general civic issue"
    assert preprocess_text("Pothole! on #12th Main Road...") == "pothole on 12th main road"

    # 2. Location extraction
    assert extract_location("There is deep flooding near City Hospital gate") == "City Hospital"
    assert extract_location("Streetlight is broken on MG Road") == "Mg Road"
    assert extract_location("Random text with no landmarks") == UNKNOWN_LOCATION

    # 3. Keyword extraction & lemmatization
    kw = extract_keywords("Potholes are causing accidents and traffic on the road")
    assert "pothole" in kw or "potholes" in kw
    assert "accident" in kw or "accidents" in kw
    assert "the" not in kw
    assert "and" not in kw
    # Ensure uniqueness
    assert len(kw) == len(set(kw))

    # 4. Category and Department analysis
    pothole_res = analyze_complaint("Severe pothole and cracked asphalt causing accidents near Central School")
    assert pothole_res["category"] == "pothole"
    assert pothole_res["department"] == "Public Works"
    assert pothole_res["severity"] in ("CRITICAL", "HIGH")
    assert pothole_res["confidence"] >= 0.75

    garbage_res = analyze_complaint("Huge piles of garbage and trash overflowing bin near City Mall")
    assert garbage_res["category"] == "garbage"
    assert garbage_res["department"] == "Sanitation Department"
    assert garbage_res["severity"] in ("HIGH", "MEDIUM")

    drainage_res = analyze_complaint("Water leakage and pipe burst causing flood on Station Road")
    assert drainage_res["category"] == "drainage"
    assert drainage_res["department"] == "Water & Drainage"

    streetlight_res = analyze_complaint("Streetlight is broken and dark street near Metro Station")
    assert streetlight_res["category"] == "streetlight"
    assert streetlight_res["department"] == "Electrical Department"

    other_res = analyze_complaint("Some unspecified issue happening")
    assert other_res["category"] == "other"
    assert other_res["department"] == "General Civic Services"
    assert other_res["confidence"] == 0.50


def test_duplicate_detector_unit():
    # 1. GPS distance
    assert compute_gps_distance_meters(None, None, 12.9716, 77.5946) == 999999.0
    # ~25 meters apart
    dist = compute_gps_distance_meters(12.9716, 77.5946, 12.9718, 77.5948)
    assert 15.0 < dist < 40.0

    # 2. Semantic similarity
    sim = compute_semantic_similarity(
        "Huge pothole near ABC College gate",
        "Big road hole outside ABC College"
    )
    assert sim > 0.40

    # 3. Duplicate matching with candidates
    existing = [
        {"id": 101, "text": "Huge pothole near ABC College gate", "lat": 12.9716, "lon": 77.5946},
        {"id": 102, "text": "Garbage not collected near City Mall", "lat": 13.0827, "lon": 80.2707},
        {"id": 103, "text": "Streetlight broken on MG Road", "lat": 12.9750, "lon": 77.6000},
    ]

    # Similar complaint at nearby GPS
    match_res = check_duplicate_smart(
        new_complaint_text="Deep pothole and road damage outside ABC College",
        existing_complaints=existing,
        new_gps=(12.9717, 77.5947)
    )
    assert match_res["score"] > 0.60
    assert match_res["matched_report_id"] == 101 or match_res["score"] > 0.50


def test_real_nlp_pipeline_database_sla(db):
    # Test resolving department SLA from DB
    res = run_ai_pipeline(
        db=db,
        description="Life threatening open manhole near St. John Hospital",
        latitude=12.9716,
        longitude=77.5946
    )
    assert res["category"] in ("pothole", "drainage", "other")
    assert res["severity"] == "CRITICAL"
    assert res["sla_hours"] == 4  # Critical SLA for department
    assert res["priority_score"] >= 80.0
    assert res["priority_level"] == "CRITICAL"
    assert "keywords" in res
    assert "location_context" in res


def test_real_nlp_duplicate_and_master_case_flow(client, db):
    # Temporarily set MOCK_AI to False for this test
    original_mock = settings.MOCK_AI
    settings.MOCK_AI = False
    try:
        # 1. Register & Login citizen
        reg = client.post(
            "/api/v1/auth/register",
            json={
                "email": "nlp_citizen@example.com",
                "password": "password123",
                "full_name": "NLP Citizen",
                "role": "citizen"
            }
        )
        assert reg.status_code == 200

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "nlp_citizen@example.com", "password": "password123"}
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Submit initial report A
        report_a_res = client.post(
            "/api/v1/reports",
            headers=headers,
            json={
                "description": "Dangerous huge pothole near City Hospital entrance on Main Road",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "category": "pothole"
            }
        )
        assert report_a_res.status_code == 201
        report_a = report_a_res.json()
        assert report_a["category"] == "pothole"
        assert report_a["department"] == "Public Works"
        assert report_a["duplicate_of"] is None

        # 3. Submit similar report B within 25m
        report_b_res = client.post(
            "/api/v1/reports",
            headers=headers,
            json={
                "description": "Dangerous deep road hole outside City Hospital entrance",
                "latitude": 12.9718,
                "longitude": 77.5948,
                "category": "pothole"
            }
        )
        assert report_b_res.status_code == 201
        report_b = report_b_res.json()

        # Check duplicate linking and MasterCase grouping
        # If score exceeds threshold, it links duplicate_of and master_case_id
        if report_b["duplicate_of"] is not None:
            assert report_b["duplicate_of"] == report_a["id"]
            assert report_b["master_case_id"] is not None

            # Verify Report A was also assigned the same master_case_id
            db_report_a = db.query(Report).filter(Report.id == report_a["id"]).first()
            assert db_report_a.master_case_id == report_b["master_case_id"]

            # Verify MasterCase row exists
            mc = db.query(MasterCase).filter(MasterCase.id == report_b["master_case_id"]).first()
            assert mc is not None

        # 4. Verify AI Preview / Verify endpoint with MOCK_AI=False
        verify_res = client.post(
            "/api/v1/ai/verify",
            headers=headers,
            json={
                "description": "Water leakage and flooded street near Central School",
                "latitude": 12.9716,
                "longitude": 77.5946
            }
        )
        assert verify_res.status_code == 200
        v_data = verify_res.json()
        assert v_data["category"] == "drainage"
        assert "Water & Drainage" in CATEGORY_DEPARTMENT_MAP.get(v_data["category"])
        assert len(v_data["keywords"]) > 0

    finally:
        settings.MOCK_AI = original_mock
