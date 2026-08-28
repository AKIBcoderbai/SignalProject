import numpy as np


class FourierTransform:
    """Educational 2D DFT implementation and frequency-domain filters."""

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
        length = signal.size
        indices = np.arange(length)
        kernel = np.exp(-2j * np.pi * np.outer(indices, indices) / length)
        return kernel @ signal.astype(complex)

    def _idft_1d(self, spectrum: np.ndarray) -> np.ndarray:
        length = spectrum.size
        indices = np.arange(length)
        kernel = np.exp(2j * np.pi * np.outer(indices, indices) / length)
        return (kernel @ spectrum) / length

    def forward(self) -> np.ndarray:
        rows = np.apply_along_axis(self._dft_1d, 1, self.image)
        return np.apply_along_axis(self._dft_1d, 0, rows)

    def inverse(self, spectrum: np.ndarray) -> np.ndarray:
        spectrum = np.asarray(spectrum)
        if spectrum.ndim != 2 or spectrum.shape != (self.height, self.width):
            raise ValueError("spectrum shape must match the source image")
        columns = np.apply_along_axis(self._idft_1d, 0, spectrum.astype(complex))
        reconstructed = np.apply_along_axis(self._idft_1d, 1, columns)
        return np.real_if_close(reconstructed, tol=1000).real

    def create_filter_mask(self, filter_name, cutoff, order=2, high_pass=False):
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
        return 1 - mask if high_pass else mask

    @staticmethod
    def _to_uint8(image: np.ndarray) -> np.ndarray:
        return np.clip(np.rint(image), 0, 255).astype(np.uint8)

    def apply_filter(self, filter_name, cutoff, order=2, high_pass=False):
        centered = np.fft.fftshift(self.forward())
        filtered = centered * self.create_filter_mask(filter_name, cutoff, order, high_pass)
        return self._to_uint8(self.inverse(np.fft.ifftshift(filtered)))

    def high_boost(self, cutoff, boost_factor=1.5, order=2):
        if float(boost_factor) <= 0:
            raise ValueError("boost factor must be greater than zero")
        high_frequency = self.apply_filter("butterworth", cutoff, order, True).astype(float)
        return self._to_uint8(self.image + float(boost_factor) * high_frequency)

    def spectrum_image(self):
        magnitude = np.log1p(np.abs(np.fft.fftshift(self.forward())))
        peak = magnitude.max()
        return np.zeros_like(self.image, dtype=np.uint8) if peak == 0 else np.rint(magnitude * 255 / peak).astype(np.uint8)


if __name__ == "__main__":
    sample = np.array([[1, 2], [3, 4]], dtype=float)
    transform = FourierTransform(sample)
    print(f"maximum reconstruction error: {np.max(np.abs(sample - transform.inverse(transform.forward()))):.3e}")
