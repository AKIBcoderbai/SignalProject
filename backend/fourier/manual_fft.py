"""Iterative radix-2 FFT with explicit padding for arbitrary dimensions."""

import numpy as np


def next_power_of_two(value: int) -> int:
    if value <= 0:
        raise ValueError("value must be positive")
    result = 1
    while result < value:
        result <<= 1
    return result


def _bit_reversed_indices(size: int) -> np.ndarray:
    bits = size.bit_length() - 1
    reversed_indices = np.zeros(size, dtype=np.int64)
    for index in range(size):
        value = index
        reversed_value = 0
        for _ in range(bits):
            reversed_value = (reversed_value << 1) | (value & 1)
            value >>= 1
        reversed_indices[index] = reversed_value
    return reversed_indices


def fft_1d(signal: np.ndarray, inverse: bool = False, pad: bool = False) -> np.ndarray:
    """Run Cooley-Tukey butterflies after iterative bit-reversal permutation."""
    values = np.asarray(signal, dtype=complex).reshape(-1)
    if values.size == 0:
        raise ValueError("signal must contain at least one sample")
    original_size = values.size
    size = next_power_of_two(original_size)
    if size != original_size:
        if not pad:
            raise ValueError("FFT length must be a power of two unless pad=True")
        padded = np.zeros(size, dtype=complex)
        padded[:original_size] = values
        values = padded
    result = values[_bit_reversed_indices(size)].copy()
    sign = 1.0 if inverse else -1.0
    stage = 2
    while stage <= size:
        half = stage // 2
        roots = np.exp(sign * 2j * np.pi * np.arange(half) / stage)
        for start in range(0, size, stage):
            for offset in range(half):
                even = result[start + offset]
                odd = result[start + offset + half] * roots[offset]
                result[start + offset] = even + odd
                result[start + offset + half] = even - odd
        stage <<= 1
    if inverse:
        result /= size
    return result


def fft_2d(image: np.ndarray, inverse: bool = False, pad: bool = False) -> np.ndarray:
    """Separable 2D FFT; optional zero padding makes both axes radix-2 sized."""
    values = np.asarray(image, dtype=complex)
    if values.ndim != 2 or 0 in values.shape:
        raise ValueError("image must be a non-empty 2D array")
    rows, columns = values.shape
    padded_rows = next_power_of_two(rows)
    padded_columns = next_power_of_two(columns)
    if not pad and (rows != padded_rows or columns != padded_columns):
        raise ValueError("FFT dimensions must be powers of two unless pad=True")
    working = np.zeros((padded_rows, padded_columns), dtype=complex)
    working[:rows, :columns] = values
    transformed_rows = np.stack([fft_1d(row, inverse) for row in working], axis=0)
    transformed = np.stack([fft_1d(transformed_rows[:, column], inverse) for column in range(padded_columns)], axis=1)
    return transformed


def ifft_2d(spectrum: np.ndarray) -> np.ndarray:
    return fft_2d(np.asarray(spectrum), inverse=True, pad=False)