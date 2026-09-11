import numpy as np
from fourier.fast_fourier import BluesteinFFT, Radix2FFT


class FourierTransform:
    """Educational 2D DFT implementation and frequency-domain filters powered by O(N log N) Bluestein FFT."""

    def __init__(self, image: np.ndarray):
        image = np.asarray(image)
        if image.ndim != 2 or image.size == 0:
            raise ValueError("image must be a non-empty 2D array")
        if not np.issubdtype(image.dtype, np.number):
            raise ValueError("image must contain numeric values")
        self.image = image.astype(float)
        self.height, self.width = self.image.shape

    def _dft_1d(self, signal: np.ndarray) -> np.ndarray:
        signal = np.asarray(signal)
        if signal.ndim != 1 or signal.size == 0:
            raise ValueError("signal must be a non-empty 1D array")
        return BluesteinFFT.fft_1d(signal)

    def _idft_1d(self, spectrum: np.ndarray) -> np.ndarray:
        spectrum = np.asarray(spectrum)
        if spectrum.ndim != 1 or spectrum.size == 0:
            raise ValueError("spectrum must be a non-empty 1D array")
        return BluesteinFFT.ifft_1d(spectrum)

    def forward(self) -> np.ndarray:
        return BluesteinFFT.fft_2d(self.image)

    def inverse(self, spectrum: np.ndarray) -> np.ndarray:
        spectrum = np.asarray(spectrum)
        if spectrum.ndim != 2 or spectrum.shape != (self.height, self.width):
            raise ValueError("spectrum shape must match the source image")
        reconstructed = BluesteinFFT.ifft_2d(spectrum)
        return np.real_if_close(reconstructed, tol=1000).real # type: ignore


    @staticmethod
    def decompose_shape_contour(points, num_harmonics=None):
        """Decomposes 2D shape points [[x0, y0], ...] into complex Fourier descriptors and reconstructs contour."""
        pts = np.asarray(points, dtype=float)
        if pts.ndim != 2 or pts.shape[1] != 2 or pts.shape[0] == 0:
            raise ValueError("points must be a non-empty array of shape (N, 2)")
        N = pts.shape[0]
        complex_signal = pts[:, 0] + 1j * pts[:, 1]
        fft_coeffs = BluesteinFFT.fft_1d(complex_signal) / N
        freqs = np.fft.fftfreq(N)

        indices = np.arange(N)
        sorted_indices = sorted(indices, key=lambda i: np.abs(fft_coeffs[i]), reverse=True)

        max_k = N if num_harmonics is None else max(1, min(int(num_harmonics), N))
        selected_indices = set(sorted_indices[:max_k])

        filtered_coeffs = np.zeros_like(fft_coeffs)
        for i in selected_indices:
            filtered_coeffs[i] = fft_coeffs[i]

        reconstructed_signal = BluesteinFFT.ifft_1d(filtered_coeffs * N)
        reconstructed_points = np.column_stack([reconstructed_signal.real, reconstructed_signal.imag]).tolist() # pyright: ignore[reportAttributeAccessIssue]

        harmonics = []
        for idx in sorted_indices:
            coeff = fft_coeffs[idx]
            mag = float(np.abs(coeff))
            phase = float(np.angle(coeff))
            freq = int(round(freqs[idx] * N))
            harmonics.append({
                "freq": freq,
                "magnitude": mag,
                "phase": phase,
                "re": float(coeff.real),
                "im": float(coeff.imag),
                "active": idx in selected_indices
            })

        return {
            "totalPoints": N,
            "harmonicsCount": max_k,
            "reconstructedPoints": reconstructed_points,
            "harmonics": harmonics,
        }

    def create_filter_mask(self, filter_name, cutoff, order=2, high_pass=False, brush=None):
        try:
            cutoff = float(cutoff)
            order = int(order)
        except (TypeError, ValueError) as exc:
            raise ValueError("cutoff and order must be numeric") from exc
        if cutoff <= 0:
            raise ValueError("cutoff must be greater than zero")
        if order <= 0:
            raise ValueError("order must be a positive integer")
        name = str(filter_name).strip().lower()
        y = np.arange(self.height) - self.height // 2
        x = np.arange(self.width) - self.width // 2
        distance = np.sqrt(y[:, None] ** 2 + x[None, :] ** 2)
        if name == "ideal":
            mask = (distance <= cutoff).astype(float)
        elif name == "gaussian":
            mask = np.exp(-(distance ** 2) / (2 * cutoff ** 2))
        elif name == "butterworth":
            mask = 1 / (1 + (distance / cutoff) ** (2 * order))
        else:
            raise ValueError("filter must be ideal, gaussian, or butterworth")
        if brush is not None:
            brush_x, brush_y, brush_radius = (float(value) for value in brush)
            if not 0 <= brush_x <= 1 or not 0 <= brush_y <= 1 or brush_radius <= 0:
                raise ValueError("brush coordinates must be normalized and radius must be greater than zero")
            brush_distance = np.sqrt((x[None, :] - (brush_x * (self.width - 1) - self.width / 2)) ** 2 + (y[:, None] - (brush_y * (self.height - 1) - self.height / 2)) ** 2)
            brush_mask = (brush_distance <= brush_radius * max(self.width, self.height)).astype(float)
            mask = mask * (1 - brush_mask) if high_pass else np.maximum(mask, brush_mask)
        return 1 - mask if high_pass else mask

    @staticmethod
    def _to_uint8(image: np.ndarray) -> np.ndarray:
        return np.clip(np.rint(image), 0, 255).astype(np.uint8)

    def _raw_filter(self, filter_name, cutoff, order=2, high_pass=False, brush=None):

        centered = np.fft.fftshift(self.forward())
        filtered = centered * self.create_filter_mask(filter_name, cutoff, order, high_pass, brush)
        return self.inverse(np.fft.ifftshift(filtered))

    def apply_filter(self, filter_name, cutoff, order=2, high_pass=False, brush=None):
        return self._to_uint8(self._raw_filter(filter_name, cutoff, order, high_pass, brush))

    def high_boost(self, cutoff, boost_factor=1.5, order=2, brush=None):
        if float(boost_factor) <= 0:
            raise ValueError("boost factor must be greater than zero")
        high_frequency = self._raw_filter("butterworth", cutoff, order, True, brush)
        boosted = self.image + float(boost_factor) * high_frequency
        return self._to_uint8(boosted)

    def spectrum_image(self):
        magnitude = np.log1p(np.abs(np.fft.fftshift(self.forward())))
        peak = magnitude.max()
        return np.zeros_like(self.image, dtype=np.uint8) if peak == 0 else np.rint(magnitude * 255 / peak).astype(np.uint8)



if __name__ == "__main__":
    sample = np.array([[1, 2], [3, 4]], dtype=float)
    transform = FourierTransform(sample)
    print(f"maximum reconstruction error: {np.max(np.abs(sample - transform.inverse(transform.forward()))):.3e}")

