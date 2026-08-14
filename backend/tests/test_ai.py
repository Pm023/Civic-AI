import io
from PIL import Image
from app.models.models import AIPrediction, Report

def test_ai_upload_and_route_flow(client):
    # 1. Register and Login a test citizen user to get headers
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "ai_citizen@example.com",
            "password": "securepassword123",
            "full_name": "AI Test Citizen",
            "role": "citizen"
        }
    )
    assert register_response.status_code == 200
    
    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "ai_citizen@example.com",
            "password": "securepassword123"
        }
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Generate a valid 224x224 test image using Pillow
    img = Image.new("RGB", (224, 224), color="red")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    # 3. Test File Upload Endpoint
    files = {"file": ("test_pothole.jpg", img_bytes, "image/jpeg")}
    upload_response = client.post(
        "/api/v1/reports/upload",
        headers=headers,
        files=files
    )
    assert upload_response.status_code == 200
    upload_data = upload_response.json()
    assert "image_url" in upload_data
    image_url = upload_data["image_url"]
    assert image_url.startswith("/uploads/")

    # 4. Test Report Submission with Image URL & Pothole Text
    report_response = client.post(
        "/api/v1/reports",
        headers=headers,
        json={
            "description": "A very large pothole is blocking traffic on Oak Street.",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "category": "other", # Initial guess
            "image_url": image_url
        }
    )
    assert report_response.status_code == 201
    report_data = report_response.json()
    
    # Assert classification and auto-routing worked
    assert report_data["category"] == "pothole"
    assert report_data["status"] == "assigned"
    assert report_data["department"] == "Public Works"
    assert report_data["severity"] == "MEDIUM"
    assert report_data["priority_level"] == "MEDIUM"
    assert report_data["priority_score"] > 0.0

    # 5. Test AI Verify Complaint Endpoint directly
    verify_response = client.post(
        "/api/v1/ai/verify",
        headers=headers,
        json={
            "description": "Litter and garbage bins overflowing on the sidewalk.",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "image_url": None
        }
    )
    assert verify_response.status_code == 200
    verify_data = verify_response.json()
    assert verify_data["category"] == "garbage"
    assert verify_data["severity"] == "MEDIUM"
    assert "garbage" in verify_data["keywords"]

def test_image_rejection_ood_flow(client, monkeypatch):
    # 1. Register and Login a test citizen user
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "ood_citizen@example.com",
            "password": "securepassword123",
            "full_name": "OOD Test Citizen",
            "role": "citizen"
        }
    )
    assert register_response.status_code == 200
    
    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "ood_citizen@example.com",
            "password": "securepassword123"
        }
    )
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Generate a valid image and upload
    img = Image.new("RGB", (224, 224), color="blue")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()

    files = {"file": ("flower.jpg", img_bytes, "image/jpeg")}
    upload_response = client.post(
        "/api/v1/reports/upload",
        headers=headers,
        files=files
    )
    assert upload_response.status_code == 200
    image_url = upload_response.json()["image_url"]

    # Mock the validate_image_distribution method to return False (OOD detected)
    from app.services.ai_service import ai_service
    monkeypatch.setattr(ai_service, "validate_image_distribution", lambda x: (False, "bell pepper"))

    # 3. Submit report and assert it gets rejected with HTTP 400
    report_response = client.post(
        "/api/v1/reports",
        headers=headers,
        json={
            "description": "Report with an unrelated flower image.",
            "latitude": 37.7749,
            "longitude": -122.4194,
            "category": "pothole",
            "image_url": image_url
        }
    )
    assert report_response.status_code == 400
    detail = report_response.json()["detail"]
    assert "Application rejected: Uploaded image contains an unrelated or forbidden category" in detail
    assert "bell pepper" in detail

