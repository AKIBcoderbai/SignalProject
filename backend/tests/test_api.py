import io
import os
import sys
import base64

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from app import create_app


def image_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8), (100, 150, 200)).save(buffer, "PNG")
    return buffer.getvalue()


def rotated_jpeg_bytes():
    buffer = io.BytesIO()
    image = Image.new("RGB", (12, 6), (100, 150, 200))
    exif = Image.Exif()
    exif[274] = 6
    image.save(buffer, "JPEG", exif=exif)
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


def test_process_image_preserves_color_channels():
    client = create_app().test_client()
    response = client.post("/api/process", data={"image": (io.BytesIO(image_bytes()), "sample.png"), "filter": "gaussian", "cutoff": "3"})
    encoded = response.get_json()["processedImage"].split(",", 1)[1]
    processed = Image.open(io.BytesIO(base64.b64decode(encoded)))
    assert processed.mode == "RGB"
    assert processed.getpixel((0, 0)) == (100, 150, 200)


def test_process_rejects_invalid_upload_and_settings():
    client = create_app().test_client()
    assert client.post("/api/process", data={}).status_code == 400
    response = client.post("/api/process", data={"image": (io.BytesIO(b"bad"), "bad.png")})
    assert response.status_code == 400


def test_process_applies_exif_orientation_before_transform():
    client = create_app().test_client()
    response = client.post("/api/process", data={"image": (io.BytesIO(rotated_jpeg_bytes()), "rotated.jpg")})
    metadata = response.get_json()["metadata"]
    assert response.status_code == 200
    assert (metadata["width"], metadata["height"]) == (6, 12)
    response = client.post("/api/process", data={"image": (io.BytesIO(image_bytes()), "sample.png"), "cutoff": "0"})
    assert response.status_code == 400


def test_decompose_shape_endpoint():
    client = create_app().test_client()
    payload = {"points": [[0, 0], [10, 0], [10, 10], [0, 10]], "harmonics": 2}
    response = client.post("/api/decompose_shape", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert data["totalPoints"] == 4
    assert data["harmonicsCount"] == 2
    assert len(data["reconstructedPoints"]) == 4

    # Invalid input handling
    assert client.post("/api/decompose_shape", json={}).status_code == 400

