import io
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import create_app


def image_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (100, 150, 200)).save(buffer, "PNG")
    return buffer.getvalue()


def test_health():
    client = create_app().test_client()
    assert client.get("/api/health").get_json() == {"status": "ok"}


def test_process_image():
    client = create_app().test_client()
    response = client.post("/api/process", data={"image": (io.BytesIO(image_bytes()), "sample.png"), "filter": "gaussian", "cutoff": "3"})
    payload = response.get_json()
    assert response.status_code == 200
    assert payload["processedImage"].startswith("data:image/png;base64,")
    assert payload["spectrumImage"].startswith("data:image/png;base64,")
    assert payload["metadata"]["width"] == 8


def test_process_rejects_invalid_upload_and_settings():
    client = create_app().test_client()
    assert client.post("/api/process", data={}).status_code == 400
    response = client.post("/api/process", data={"image": (io.BytesIO(b"bad"), "bad.png")})
    assert response.status_code == 400
    response = client.post("/api/process", data={"image": (io.BytesIO(image_bytes()), "sample.png"), "cutoff": "0"})
    assert response.status_code == 400
