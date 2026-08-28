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
