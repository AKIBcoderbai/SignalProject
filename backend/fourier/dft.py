"""Direct, from-first-principles discrete Fourier transforms.

The implementation intentionally uses the definition of the DFT rather than
numpy.fft so that the mathematical operation is visible and testable.
"""

import numpy as np


def dft_1d(signal: np.ndarray, inverse: bool = False) -> np.ndarray:
    """Compute X[k] = sum_n x[n] exp(+/- 2 pi i k n / N) directly."""
    values = np.asarray(signal, dtype=complex).reshape(-1)
    if values.size == 0:
        raise ValueError("signal must contain at least one sample")
    n = values.size
    indices = np.arange(n, dtype=float)
    sign = 1.0 if inverse else -1.0
    kernel = np.exp(sign * 2j * np.pi * np.outer(indices, indices) / n)
    result = kernel @ values
    return result / n if inverse else result


def dft_2d(image: np.ndarray, inverse: bool = False) -> np.ndarray:
    """Apply the separable 2D DFT: transform every row, then every column."""
    values = np.asarray(image, dtype=complex)
    if values.ndim != 2 or 0 in values.shape:
        raise ValueError("image must be a non-empty 2D array")
    rows = np.stack([dft_1d(row, inverse) for row in values], axis=0)
    return np.stack([dft_1d(rows[:, column], inverse) for column in range(values.shape[1])], axis=1)