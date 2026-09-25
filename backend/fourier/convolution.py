"""Small, readable spatial convolution primitives."""

import numpy as np


def pad_image(image: np.ndarray, padding: tuple[int, int], mode: str = "replicate") -> np.ndarray:
    """Pad HxW or HxWxC data without relying on a convolution library."""
    pad_y, pad_x = padding
    if pad_y < 0 or pad_x < 0:
        raise ValueError("padding cannot be negative")
    if mode not in {"zero", "replicate", "wrap"}:
        raise ValueError("padding mode must be zero, replicate, or wrap")
    np_mode = {"zero": "constant", "replicate": "edge", "wrap": "wrap"}[mode]
    extra = ((pad_y, pad_y), (pad_x, pad_x))
    if image.ndim == 3:
        extra += ((0, 0),)
    return np.pad(np.asarray(image), extra, mode=np_mode)


def convolve2d(image: np.ndarray, kernel: np.ndarray, padding: str = "replicate") -> np.ndarray:
    """Convolve an image with a kernel using vectorized pixel operations."""
    values = np.asarray(image, dtype=float)
    weights = np.asarray(kernel, dtype=float)
    if values.ndim not in (2, 3) or weights.ndim != 2:
        raise ValueError("image must be 2D/3D and kernel must be 2D")
    if weights.shape[0] % 2 == 0 or weights.shape[1] % 2 == 0:
        raise ValueError("kernel dimensions must be odd")
    radius = (weights.shape[0] // 2, weights.shape[1] // 2)
    padded = pad_image(values, radius, padding)
    flipped = weights[::-1, ::-1]
    height, width = values.shape[:2]
    output = np.zeros_like(values, dtype=float)
    for row in range(weights.shape[0]):
        for column in range(weights.shape[1]):
            weight = flipped[row, column]
            if weight:
                output += weight * padded[row:row + height, column:column + width]
    return output
