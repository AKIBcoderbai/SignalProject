"""Local brush compositing for spatial and manual-FFT image filters."""

import io
import json

import numpy as np
from PIL import Image

from fourier.convolution import convolve2d
from fourier.frequency_filters import frequency_filter, spectrum_preview


def _gaussian_kernel(radius: int, sigma: float) -> np.ndarray:
    size = radius * 2 + 1
    axis = np.arange(-radius, radius + 1, dtype=float)
    kernel = np.exp(-(axis[:, None] ** 2 + axis[None, :] ** 2) / (2 * sigma * sigma))
    return kernel / np.sum(kernel)


def brush_mask(shape: tuple[int, int], strokes: list[dict], brush_size: float, feather: float = 0.35) -> np.ndarray:
    """Rasterize normalized brush points with a soft edge using linear falloff."""
    if brush_size <= 0 or not 0 <= feather <= 1:
        raise ValueError("brush size must be positive and feather must be between 0 and 1")
    height, width = shape
    mask = np.zeros((height, width), dtype=float)
    radius = max(1.0, brush_size * min(height, width) / 2)
    inner = radius * (1.0 - feather)
    for stroke in strokes:
        points = stroke.get("points", []) if isinstance(stroke, dict) else []
        for point in points:
            if len(point) != 2:
                continue
            center_x = float(point[0]) * (width - 1)
            center_y = float(point[1]) * (height - 1)
            top = max(0, int(center_y - radius - 1))
            bottom = min(height, int(center_y + radius + 2))
            left = max(0, int(center_x - radius - 1))
            right = min(width, int(center_x + radius + 2))
            rows = np.arange(top, bottom, dtype=float)[:, None]
            columns = np.arange(left, right, dtype=float)[None, :]
            distance = np.hypot(rows - center_y, columns - center_x)
            value = np.clip((radius - distance) / max(radius - inner, 1e-9), 0, 1)
            np.maximum(mask[top:bottom, left:right], value, out=mask[top:bottom, left:right])
    return mask


def _spatial_effect(image: np.ndarray, operation: str, strength: float) -> np.ndarray:
    radius = max(1, min(15, int(round(1 + strength * 10))))
    if operation == "blur":
        # A 2D Gaussian is separable: two 1D passes give the same filter
        # with work proportional to kernel width instead of its area.
        sigma = max(0.8, radius / 2)
        axis = np.arange(-radius, radius + 1, dtype=float)
        weights = np.exp(-(axis ** 2) / (2 * sigma * sigma))
        weights /= weights.sum()
        height, width = image.shape[:2]
        padded_x = np.pad(image, ((0, 0), (radius, radius), (0, 0)), mode="edge")
        horizontal = np.zeros_like(image, dtype=float)
        for index, weight in enumerate(weights):
            horizontal += weight * padded_x[:, index:index + width]
        padded_y = np.pad(horizontal, ((radius, radius), (0, 0), (0, 0)), mode="edge")
        filtered = np.zeros_like(image, dtype=float)
        for index, weight in enumerate(weights):
            filtered += weight * padded_y[index:index + height]
    elif operation == "sharpen":
        laplacian = np.array([[0, -1, 0], [-1, 4, -1], [0, -1, 0]], dtype=float)
        filtered = image + strength * convolve2d(image, laplacian, "replicate")
    else:
        raise ValueError("operation must be blur or sharpen")
    return np.clip(filtered, 0, 255)


def _frequency_effect(image: np.ndarray, operation: str, strength: float) -> np.ndarray:
    channels = []
    for channel in range(image.shape[2]):
        filtered = frequency_filter(image[:, :, channel], operation, strength)
        channels.append(filtered)
    return np.clip(np.stack(channels, axis=2), 0, 255)


def process_image(image_bytes: bytes, operation: str, mode: str, brush_size: float,
                  strength: float, strokes_json: str, channel_mode: str = "rgb") -> tuple[bytes, bytes, dict]:
    if operation not in {"blur", "sharpen"} or mode not in {"spatial", "frequency"}:
        raise ValueError("operation must be blur/sharpen and mode must be spatial/frequency")
    if not 0 < strength <= 1:
        raise ValueError("strength must be between 0 and 1")
    try:
        strokes = json.loads(strokes_json)
    except (TypeError, json.JSONDecodeError) as exc:
        raise ValueError("strokes must be valid JSON") from exc
    if not isinstance(strokes, list) or not strokes:
        raise ValueError("paint at least one brush stroke")
    with Image.open(io.BytesIO(image_bytes)) as source:
        image = np.asarray(source.convert("RGB"), dtype=float)
    mask = brush_mask(image.shape[:2], strokes, brush_size)
    if not np.any(mask):
        raise ValueError("brush strokes do not intersect the image")
    if mode == "spatial":
        filtered = _spatial_effect(image, operation, strength)
    else:
        filtered = _frequency_effect(image, operation, strength)
    if channel_mode == "luminance":
        original_luma = np.mean(image, axis=2)
        filtered_luma = np.mean(filtered, axis=2)
        delta = filtered_luma - original_luma
        filtered = np.clip(image + delta[:, :, None], 0, 255)
    elif channel_mode != "rgb":
        raise ValueError("channel mode must be rgb or luminance")
    amount = np.clip(mask * strength, 0, 1)[:, :, None]
    result = np.rint(image * (1 - amount) + filtered * amount).astype(np.uint8)
    output = io.BytesIO()
    Image.fromarray(result, "RGB").save(output, format="PNG")
    mask_output = io.BytesIO()
    Image.fromarray(np.rint(mask * 255).astype(np.uint8), "L").save(mask_output, format="PNG")
    luminance = np.mean(image, axis=2)
    spectrum = np.rint(spectrum_preview(luminance) * 255).astype(np.uint8)
    spectrum_output = io.BytesIO()
    Image.fromarray(spectrum, "L").resize((256, 256), Image.Resampling.NEAREST).save(spectrum_output, format="PNG")
    return output.getvalue(), mask_output.getvalue(), {
        "operation": operation, "mode": mode, "channel": channel_mode,
        "width": int(image.shape[1]), "height": int(image.shape[0]),
        "coveredPixels": int(np.count_nonzero(mask > 0)),
        "spectrum": "data:image/png;base64," + __import__("base64").b64encode(spectrum_output.getvalue()).decode("ascii"),
    }
