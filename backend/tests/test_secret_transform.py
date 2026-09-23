import io
import os
import sys

import pytest
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from secret_transform import analyze_pair, apply_attack, coefficient_bit_demo, difference_image, embed, embed_legacy, extract, image_metrics, spectrum_image


def make_image(size=(512, 512), color=(100, 150, 200)):
    buffer = io.BytesIO()
    Image.new("RGB", size, color).save(buffer, "PNG")
    return buffer.getvalue()


def test_legacy_extract_still_works_for_legacy_payload():
    password = "correcthorsebatterystaple"
    payload = "Meet me in the archive lobby at dawn."
    image = embed_legacy(make_image((512, 512)), payload, password)
    assert extract(image, password) == payload


def test_v2_password_keyed_order_round_trips_message():
    password = "correcthorsebatterystaple"
    message = "The encrypted signal survives a v2 keyed block order."
    protected, _ = embed(make_image((512, 512)), message, password)
    assert extract(protected, password) == message
    with pytest.raises(ValueError):
        extract(protected, "wrongpassword")


def test_analysis_helpers_return_images_and_metrics():
    original = make_image((512, 512), (10, 20, 30))
    protected, _ = embed(original, "Secret analysis payload", "correcthorsebatterystaple")
    metrics = image_metrics(original, protected)
    assert set(metrics).issuperset({"mse", "psnr", "ssim", "width", "height"})
    diff_png = difference_image(original, protected)
    assert diff_png.startswith(b"\x89PNG")
    spectrum_png, meta = spectrum_image(protected)
    assert spectrum_png.startswith(b"\x89PNG")
    assert meta["rows"] > 0 and meta["columns"] > 0
    bit0, bit1, bit_meta = coefficient_bit_demo(protected)
    assert bit0.startswith(b"\x89PNG")
    assert bit1.startswith(b"\x89PNG")
    assert "coefficient" in bit_meta
    pair = analyze_pair(original, protected)
    assert pair["metrics"]["width"] == 512


def test_attack_transform_requires_valid_settings():
    original = make_image((256, 256))
    with pytest.raises(ValueError):
        apply_attack(original, "unknown")
    with pytest.raises(ValueError):
        apply_attack(original, "jpeg", quality=0)
    with pytest.raises(ValueError):
        apply_attack(original, "crop", crop="0.2,0.2,0.1,0.8")
