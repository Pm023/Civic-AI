import io
from PIL import Image

def test_read_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_auth_and_report_flow(client):
    # 1. Register a test citizen user
    register_response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "citizen@example.com",
            "password": "securepassword123",
            "full_name": "Test Citizen",
            "role": "citizen"
        }
    )
    assert register_response.status_code == 200
    assert register_response.json()["email"] == "citizen@example.com"
    assert register_response.json()["role"] == "citizen"
    assert "id" in register_response.json()

    # 2. Login as the citizen to obtain a JWT token
    login_response = client.post(
        "/api/v1/auth/login",
        json={
            "email": "citizen@example.com",
            "password": "securepassword123"
        }
    )
    assert login_response.status_code == 200
    assert "access_token" in login_response.json()
    assert login_response.json()["token_type"] == "bearer"
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Fetch departments (public endpoint/authenticated in routing)
    dept_response = client.get("/api/v1/departments")
    assert dept_response.status_code == 200
    assert len(dept_response.json()) >= 5
    assert dept_response.json()[0]["name"] == "Public Works"

    # Generate a valid 224x224 test image using Pillow and upload
    img = Image.new("RGB", (224, 224), color="blue")
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format="JPEG")
    img_bytes = img_byte_arr.getvalue()
    files = {"file": ("test_pothole_main.jpg", img_bytes, "image/jpeg")}
    upload_response = client.post(
        "/api/v1/reports/upload",
        headers=headers,
        files=files
    )
    assert upload_response.status_code == 200
    image_url = upload_response.json()["image_url"]

    # 4. Submit a report
    report_response = client.post(
        "/api/v1/reports",
        headers=headers,
        json={
            "description": "Large pothole in the middle of Main St.",
            "latitude": 47.6062,
            "longitude": -122.3321,
            "category": "pothole",
            "image_url": image_url
        }
    )
    assert report_response.status_code == 201
    report_data = report_response.json()
    assert report_data["description"] == "Large pothole in the middle of Main St."
    assert report_data["category"] == "pothole"
    assert report_data["status"] in ("submitted", "assigned")
    assert "ticket_id" in report_data
    report_id = report_data["id"]

    # 5. Get all reports for this citizen
    get_reports_response = client.get("/api/v1/reports", headers=headers)
    assert get_reports_response.status_code == 200
    assert len(get_reports_response.json()) == 1
    assert get_reports_response.json()[0]["id"] == report_id

    # 6. Read specific report by ticket_id or id
    get_single_report = client.get(f"/api/v1/reports/{report_data['ticket_id']}", headers=headers)
    assert get_single_report.status_code == 200
    assert get_single_report.json()["id"] == report_id
