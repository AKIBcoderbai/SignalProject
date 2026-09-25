"""Small reproducible benchmark for spatial convolution versus manual FFT."""

import time
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fourier.brush_processing import _frequency_effect, _spatial_effect


for size in (64, 128, 256):
    image = np.random.default_rng(7).random((size, size, 3)) * 255
    for label, function in (("spatial", _spatial_effect), ("frequency", _frequency_effect)):
        started = time.perf_counter()
        function(image, "blur", 0.6)
        elapsed = time.perf_counter() - started
        print(f"{size}x{size} {label}: {elapsed:.4f}s")