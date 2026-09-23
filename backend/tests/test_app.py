import io
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import create_app
from secret_transform import embed


def make_image(size=(512, 512), color=(100, 150, 200)):
    buffer = io.BytesIO()
    from PIL import Image
    Image.new("RGB", size, color).save(buffer, "PNG")
    return buffer.getvalue()


def test_guest_extraction_is_unauthenticated():
    client = TestClient(create_app())
    protected = embed(make_image((512, 512)), "hello from guest", "correcthorsebatterystaple")[0]
    response = client.post(
        "/api/secret/guest/extract",
        files={"image": (io.BytesIO(protected), "sample.png")},
        data={"password": "correcthorsebatterystaple"},
    )
    assert response.status_code == 200
    assert response.json()["message"] == "hello from guest"


def test_authenticated_routes_require_auth():
    client = TestClient(create_app())
    protected = client.post(
        "/api/secret/embed",
        files={"image": (io.BytesIO(make_image((512, 512))), "sample.png")},
        data={"message": "hi", "password": "correcthorsebatterystaple"},
    )
    assert protected.status_code == 401
    analyze = client.post(
        "/api/secret/analyze",
        files={"image": (io.BytesIO(make_image((512, 512))), "sample.png")},
        data={"password": "correcthorsebatterystaple", "attack": "jpeg"},
    )
    assert analyze.status_code == 401
