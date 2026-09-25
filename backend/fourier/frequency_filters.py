"""Frequency-domain filtering built on the local manual FFT implementation."""

import numpy as np

from fourier.manual_fft import fft_2d, ifft_2d, next_power_of_two


def centered_frequency_grid(shape: tuple[int, int]) -> tuple[np.ndarray, np.ndarray]:
    height, width = shape
    y = np.arange(height, dtype=float) - height / 2
    x = np.arange(width, dtype=float) - width / 2
    return np.meshgrid(y, x, indexing="ij")


def gaussian_low_pass(shape: tuple[int, int], sigma: float) -> np.ndarray:
    if sigma <= 0:
        raise ValueError("sigma must be positive")
    y, x = centered_frequency_grid(shape)
    return np.exp(-(x * x + y * y) / (2 * sigma * sigma))


def frequency_filter(image: np.ndarray, kind: str, strength: float) -> np.ndarray:
    """Pad, transform, multiply by a low/high-pass response, then crop back."""
    values = np.asarray(image, dtype=float)
    if values.ndim != 2:
        raise ValueError("frequency filtering expects a 2D channel")
    if not 0 < strength <= 1:
        raise ValueError("strength must be between 0 and 1")
    height, width = values.shape
    padded_shape = (next_power_of_two(height), next_power_of_two(width))
    padded = np.zeros(padded_shape, dtype=float)
    padded[:height, :width] = values
    spectrum = fft_2d(padded, pad=False)
    y, x = centered_frequency_grid(padded_shape)
    distance_squared = x * x + y * y
    cutoff = max(1.0, min(padded_shape) * (0.08 + 0.35 * strength))
    low_pass = np.exp(-distance_squared / (2 * cutoff * cutoff))
    centered = np.roll(np.roll(spectrum, padded_shape[0] // 2, axis=0), padded_shape[1] // 2, axis=1)
    if kind == "blur":
        response = low_pass
    elif kind == "sharpen":
        response = 1.0 + strength * (1.0 - low_pass)
    else:
        raise ValueError("frequency filter kind must be blur or sharpen")
    filtered = centered * response
    uncentered = np.roll(np.roll(filtered, -padded_shape[0] // 2, axis=0), -padded_shape[1] // 2, axis=1)
    return ifft_2d(uncentered).real[:height, :width]


def spectrum_preview(image: np.ndarray, size: int = 256) -> np.ndarray:
    """Return a normalized centered magnitude spectrum for visual comparison."""
    values = np.asarray(image, dtype=float)
    if values.ndim != 2 or 0 in values.shape:
        raise ValueError("spectrum input must be a non-empty 2D array")
    height = min(values.shape[0], size)
    width = min(values.shape[1], size)
    block = values[:height, :width]
    spectrum = fft_2d(block, pad=True)
    centered = np.roll(np.roll(spectrum, spectrum.shape[0] // 2, axis=0), spectrum.shape[1] // 2, axis=1)
    magnitude = np.log1p(np.abs(centered))
    peak = float(magnitude.max())
    return np.zeros_like(magnitude) if peak == 0 else magnitude / peak