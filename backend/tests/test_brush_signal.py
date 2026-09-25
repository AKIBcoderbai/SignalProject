import io

import numpy as np
from PIL import Image

from fourier.brush_processing import brush_mask, process_image
from fourier.convolution import convolve2d
from fourier.dft import dft_1d
from fourier.manual_fft import fft_1d


def test_dft_known_impulse_and_constant_signals():
    assert np.allclose(dft_1d([1, 0, 0, 0]), [1, 1, 1, 1])
    assert np.allclose(dft_1d([2, 2, 2, 2]), [8, 0, 0, 0])


def test_fft_matches_dft_for_sinusoid_and_round_trips():
    signal = np.sin(2 * np.pi * np.arange(8) / 8)
    assert np.allclose(fft_1d(signal), dft_1d(signal), atol=1e-10)
    assert np.allclose(fft_1d(fft_1d(signal), inverse=True), signal, atol=1e-10)


def test_fft_pads_non_power_of_two_length():
    transformed = fft_1d([1, 2, 3, 4, 5], pad=True)
    assert transformed.shape == (8,)


def test_convolution_matches_manual_two_by_two_example():
    image = np.array([[1, 2], [3, 4]], dtype=float)
    kernel = np.array([[1, 2, 1], [0, 0, 0], [-1, -2, -1]], dtype=float)
    expected = np.array([[8, 8], [8, 8]], dtype=float)
    assert np.allclose(convolve2d(image, kernel, padding="replicate"), expected)


def test_brush_mask_handles_boundary_and_overlapping_strokes():
    mask = brush_mask((20, 20), [
        {"points": [[0, 0], [0.5, 0.5]]},
        {"points": [[0.5, 0.5], [1, 1]]},
    ], brush_size=0.25)
    assert mask[0, 0] == 1
    assert mask[10, 10] == 1
    assert mask[-1, -1] == 1
    assert mask[0, -1] == 0


def test_rgb_png_and_jpeg_processing_is_local_and_selectable():
    source = np.zeros((16, 16, 3), dtype=np.uint8)
    source[6:10, 6:10] = [255, 100, 20]
    image = Image.fromarray(source, "RGB")
    png = io.BytesIO(); image.save(png, format="PNG")
    jpeg = io.BytesIO(); image.save(jpeg, format="JPEG", quality=90)
    strokes = '[{"points": [[0.5, 0.5]]}]'
    edited, mask, metadata = process_image(png.getvalue(), "blur", "spatial", 0.4, 0.8, strokes)
    assert Image.open(io.BytesIO(edited)).size == (16, 16)
    assert Image.open(io.BytesIO(mask)).mode == "L"
    assert metadata["coveredPixels"] > 0
    edited_fft, _, _ = process_image(jpeg.getvalue(), "sharpen", "frequency", 0.3, 0.5, strokes, "luminance")
    assert Image.open(io.BytesIO(edited_fft)).size == (16, 16)