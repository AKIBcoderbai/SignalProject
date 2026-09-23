import io
import os
import sys

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import create_app


def image_bytes():
    buffer = io.BytesIO()
    from PIL import Image
    Image.new("RGB", (8, 8), (100, 150, 200)).save(buffer, "PNG")
    return buffer.getvalue()


def rotated_jpeg_bytes():
    buffer = io.BytesIO()
    from PIL import Image
    image = Image.new("RGB", (12, 6), (100, 150, 200))
    exif = Image.Exif()
    exif[274] = 6
    image.save(buffer, "JPEG", exif=exif)
    return buffer.getvalue()


def test_health():
    client = TestClient(create_app())
    assert client.get("/api/health").json() == {"status": "ok"}


def test_process_image():
    client = TestClient(create_app())
    response = client.post("/api/process", data={"image": (io.BytesIO(image_bytes()), "sample.png"), "filter": "gaussian", "cutoff": "3"})
    payload = response.json()
    assert response.status_code == 200
    assert payload["processedImage"].startswith("data:image/png;base64,")
    assert payload["spectrumImage"].startswith("data:image/png;base64,")
    assert payload["metadata"]["width"] == 8


def test_process_image_preserves_color_channels():
    client = TestClient(create_app())
    response = client.post("/api/process", data={"image": (io.BytesIO(image_bytes()), "sample.png"), "filter": "gaussian", "cutoff": "3"})
    encoded = response.json()["processedImage"].split(",", 1)[1]
    from PIL import Image
    import base64
    processed = Image.open(io.BytesIO(base64.b64decode(encoded)))
    assert processed.mode == "RGB"
    assert processed.getpixel((0, 0)) == (100, 150, 200)


def test_process_rejects_invalid_upload_and_settings():
    client = TestClient(create_app())
    assert client.post("/api/process", data={}).status_code == 400
    response = client.post("/api/process", data={"image": (io.BytesIO(b"bad"), "bad.png")})
    assert response.status_code == 400


def test_process_applies_exif_orientation_before_transform():
    client = TestClient(create_app())
    response = client.post("/api/process", data={"image": (io.BytesIO(rotated_jpeg_bytes()), "rotated.jpg")})
    metadata = response.json()["metadata"]
    assert response.status_code == 200
    assert (metadata["width"], metadata["height"]) == (6, 12)
    response = client.post("/api/process", data={"image": (io.BytesIO(image_bytes()), "sample.png"), "cutoff": "0"})
    assert response.status_code == 400


def test_decompose_shape_endpoint():
    client = TestClient(create_app())
    payload = {"points": [[0, 0], [10, 0], [10, 10], [0, 10]], "harmonics": 2}
    response = client.post("/api/decompose_shape", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["totalPoints"] == 4
    assert data["harmonicsCount"] == 2
    assert len(data["reconstructedPoints"]) == 4
    assert client.post("/api/decompose_shape", json={}).status_code == 400
