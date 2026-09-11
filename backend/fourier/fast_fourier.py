import numpy as np


class Radix2FFT:
    """Fast iterative Cooley-Tukey Radix-2 Butterfly FFT for N = 2^k."""

    @staticmethod
    def is_power_of_two(n: int) -> bool:
        return n > 0 and (n & (n - 1)) == 0

    @staticmethod
    def _bit_reverse(n: int) -> np.ndarray:
        bits = int(np.log2(n))
        indices = np.arange(n, dtype=np.uint32)
        reversed_indices = np.zeros(n, dtype=np.uint32)
        for i in range(bits):
            reversed_indices = (reversed_indices << 1) | ((indices >> i) & 1)
        return reversed_indices

    @classmethod
    def fft_1d(cls, x: np.ndarray) -> np.ndarray:
        x = np.asarray(x, dtype=complex)
        n = x.size
        if n <= 1:
            return x.copy()
        if not cls.is_power_of_two(n):
            raise ValueError(f"Radix2FFT length must be a power of 2, got {n}")

        rev = cls._bit_reverse(n)
        a = x[rev].copy()

        stage = 2
        while stage <= n:
            half = stage // 2
            w = np.exp(-2j * np.pi * np.arange(half) / stage)
            a_reshaped = a.reshape(n // stage, stage)
            u = a_reshaped[:, :half].copy()
            v = a_reshaped[:, half:] * w
            a_reshaped[:, :half] = u + v
            a_reshaped[:, half:] = u - v
            stage *= 2

        return a

    @classmethod
    def ifft_1d(cls, x: np.ndarray) -> np.ndarray:
        x = np.asarray(x, dtype=complex)
        n = x.size
        if n <= 1:
            return x.copy()
        return np.conjugate(cls.fft_1d(np.conjugate(x))) / n

    @classmethod
    def fft_2d_matrix(cls, x: np.ndarray) -> np.ndarray:
        """Vectorized 2D Radix-2 Butterfly FFT along both axes for H, W power of 2."""
        x = np.asarray(x, dtype=complex)
        rows, cols = x.shape
        if not cls.is_power_of_two(rows) or not cls.is_power_of_two(cols):
            raise ValueError("Dimensions must be power of 2 for Radix2FFT 2D")

        # Transform rows (axis 1)
        rev_c = cls._bit_reverse(cols)
        a = x[:, rev_c].copy()
        stage = 2
        while stage <= cols:
            half = stage // 2
            w = np.exp(-2j * np.pi * np.arange(half) / stage)
            a_reshaped = a.reshape(rows, cols // stage, stage)
            u = a_reshaped[:, :, :half].copy()
            v = a_reshaped[:, :, half:] * w
            a_reshaped[:, :, :half] = u + v
            a_reshaped[:, :, half:] = u - v
            stage *= 2

        # Transform columns (axis 0)
        rev_r = cls._bit_reverse(rows)
        b = a[rev_r, :].copy()
        stage = 2
        while stage <= rows:
            half = stage // 2
            w = np.exp(-2j * np.pi * np.arange(half) / stage)[:, None]
            b_reshaped = b.reshape(rows // stage, stage, cols)
            u = b_reshaped[:, :half, :].copy()
            v = b_reshaped[:, half:, :] * w
            b_reshaped[:, :half, :] = u + v
            b_reshaped[:, half:, :] = u - v
            stage *= 2

        return b

    @classmethod
    def ifft_2d_matrix(cls, x: np.ndarray) -> np.ndarray:
        x = np.asarray(x, dtype=complex)
        rows, cols = x.shape
        return np.conjugate(cls.fft_2d_matrix(np.conjugate(x))) / (rows * cols)


class BluesteinFFT:
    """Chirp Z-Transform Bluestein algorithm for arbitrary shape 1D/2D FFT in O(N log N). Uses vectorized Radix2FFT internally."""

    @classmethod
    def _next_power_of_two(cls, n: int) -> int:
        count = 1
        while count < n:
            count <<= 1
        return count

    @classmethod
    def fft_1d(cls, x: np.ndarray) -> np.ndarray:
        x = np.asarray(x, dtype=complex)
        n = x.size
        if n <= 1:
            return x.copy()
        if Radix2FFT.is_power_of_two(n):
            return Radix2FFT.fft_1d(x)

        m = cls._next_power_of_two(2 * n - 1)
        k = np.arange(n)
        chirp = np.exp(-1j * np.pi * (k ** 2) / n)

        a = np.zeros(m, dtype=complex)
        a[:n] = x * chirp

        b = np.zeros(m, dtype=complex)
        b[:n] = np.conjugate(chirp)
        b[m - n + 1:] = np.conjugate(chirp[1:n][::-1])

        a_fft = Radix2FFT.fft_1d(a)
        b_fft = Radix2FFT.fft_1d(b)
        conv = Radix2FFT.ifft_1d(a_fft * b_fft)

        return chirp * conv[:n]

    @classmethod
    def ifft_1d(cls, x: np.ndarray) -> np.ndarray:
        x = np.asarray(x, dtype=complex)
        n = x.size
        if n <= 1:
            return x.copy()
        return np.conjugate(cls.fft_1d(np.conjugate(x))) / n

    @classmethod
    def fft_2d(cls, x: np.ndarray) -> np.ndarray:
        """Computes 2D FFT for arbitrary matrix shape (H, W)."""
        x = np.asarray(x, dtype=complex)
        rows, cols = x.shape
        if Radix2FFT.is_power_of_two(rows) and Radix2FFT.is_power_of_two(cols):
            return Radix2FFT.fft_2d_matrix(x)

        row_transformed = np.zeros_like(x, dtype=complex)
        for r in range(rows):
            row_transformed[r] = cls.fft_1d(x[r])

        col_transformed = np.zeros_like(x, dtype=complex)
        for c in range(cols):
            col_transformed[:, c] = cls.fft_1d(row_transformed[:, c])

        return col_transformed

    @classmethod
    def ifft_2d(cls, x: np.ndarray) -> np.ndarray:
        x = np.asarray(x, dtype=complex)
        rows, cols = x.shape
        if Radix2FFT.is_power_of_two(rows) and Radix2FFT.is_power_of_two(cols):
            return Radix2FFT.ifft_2d_matrix(x)
        return np.conjugate(cls.fft_2d(np.conjugate(x))) / (rows * cols)
