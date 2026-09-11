import os
import sys

import numpy as np
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from fourier.fourier_transform import FourierTransform


def test_forward_inverse_reconstructs_source():
    source = np.arange(12, dtype=float).reshape(3, 4)
    transform = FourierTransform(source)
    np.testing.assert_allclose(transform.inverse(transform.forward()), source, atol=1e-10)


@pytest.mark.parametrize("name", ["ideal", "gaussian", "butterworth"])
def test_filter_masks_are_bounded_and_centered(name):
    transform = FourierTransform(np.ones((5, 5)))
    mask = transform.create_filter_mask(name, 2)
    assert mask.shape == (5, 5)
    assert np.all((mask >= 0) & (mask <= 1))
    assert mask[2, 2] == pytest.approx(1)


def test_filter_and_spectrum_return_display_images():
    transform = FourierTransform(np.arange(64).reshape(8, 8))
    assert transform.apply_filter("gaussian", 3).dtype == np.uint8
    assert transform.spectrum_image().dtype == np.uint8


def test_invalid_inputs_fail_cleanly():
    with pytest.raises(ValueError):
        FourierTransform(np.zeros((2, 2, 3)))
    with pytest.raises(ValueError):
        FourierTransform(np.ones((2, 2))).create_filter_mask("unknown", 2)
    with pytest.raises(ValueError):
        FourierTransform(np.ones((2, 2))).create_filter_mask("ideal", 0)


def test_radix2_and_bluestein_fft_accuracy():
    from fourier.fast_fourier import Radix2FFT, BluesteinFFT
    # Power of two test (N = 8)
    signal_pow2 = np.array([1, 2, 3, 4, 5, 6, 7, 8], dtype=complex)
    expected_pow2 = np.fft.fft(signal_pow2)
    np.testing.assert_allclose(Radix2FFT.fft_1d(signal_pow2), expected_pow2, atol=1e-10)
    np.testing.assert_allclose(Radix2FFT.ifft_1d(expected_pow2), signal_pow2, atol=1e-10)

    # Arbitrary length prime test (N = 7)
    signal_prime = np.array([3, 1, 4, 1, 5, 9, 2], dtype=complex)
    expected_prime = np.fft.fft(signal_prime)
    np.testing.assert_allclose(BluesteinFFT.fft_1d(signal_prime), expected_prime, atol=1e-10)
    np.testing.assert_allclose(BluesteinFFT.ifft_1d(expected_prime), signal_prime, atol=1e-10)


def test_decompose_shape_contour():
    points = [[0, 0], [10, 0], [10, 10], [0, 10]]
    result = FourierTransform.decompose_shape_contour(points, num_harmonics=2)
    assert result["totalPoints"] == 4
    assert result["harmonicsCount"] == 2
    assert len(result["reconstructedPoints"]) == 4
    assert len(result["harmonics"]) == 4

