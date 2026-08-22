import numpy as np


class FourierTransform:

    def __init__(self, image: np.ndarray):
        """
        Initialize the Fourier Transform.

        Parameters:
            image: 2D grayscale image matrix.

        TODO:
        - Store the image.
        - Store the image height.
        - Store the image width.
        - Validate that the input is actually 2D.

        Think about:
            What should happen if someone accidentally
            passes an RGB image with shape (H, W, 3)?
        """
        if len(image.shape)==3:
            raise TypeError("Image should be 2D")
        self.image=image
        self.height=image.shape[0]
        self.width=image.shape[1]

    def _dft_1d(self, signal: np.ndarray) -> np.ndarray:
        """
        Calculate the 1D Discrete Fourier Transform.

        TODO:

        Implement the 1D DFT:

            X[k] = sum(n=0 to N-1)
                x[n] * exp(-j * 2πkn/N)

        Parameters:
            signal:
                One-dimensional input signal.

        Returns:
            Complex-valued 1D spectrum.
        """
        X=np.zeros_like(signal,dtype=complex)
        N=len(signal)
        for k in range(N):
            for n in range(N):
                X[k]+=signal[n]* np.exp(-1j* 2*np.pi* k*n /N )
        return X

        

    def forward(self) -> np.ndarray:
        """
        Calculate the 2D Discrete Fourier Transform.

        TODO:

        Implement the 2D DFT from its mathematical definition.

        DO NOT use:
            np.fft
            scipy.fft
            scipy.fftpack

        The result should be a 2D complex-valued array.

        Think about:

            Input:
                f(x, y)

            Output:
                F(u, v)

        Questions you need to answer:

        1. What are u and v?

        2. What are x and y?

        3. What are the dimensions of the output?

        4. What complex exponential is used?

        5. What normalization, if any, is required
           for the forward transform?

        6. How do you handle the complex numbers?

        Return:
            2D array containing the Fourier coefficients.
        """
        Ny, Nx = self.image.shape
        spectrum = np.zeros((Ny, Nx), dtype=complex)

        for y in range(Ny):
            signal=self.image[y,:]
            spectrum[y,:]=self._dft_1d(signal)

        for u in range(Nx):
                    signal=spectrum[:,u]
                    spectrum[:,u]=self._dft_1d(signal)
        return spectrum


    def inverse(self, spectrum: np.ndarray) -> np.ndarray:
        """
        Calculate the inverse 2D Discrete Fourier Transform.

        Parameters:
            spectrum:
                2D array containing Fourier coefficients.

        TODO:

        Implement the inverse DFT from its mathematical
        definition.

        DO NOT use:
            np.fft
            scipy.fft
            scipy.fftpack

        Think about:

            F(u, v)
                ↓
            f(x, y)

        Questions you need to answer:

        1. What changes between the forward and inverse
           transform?

        2. Where does the normalization factor go?

        3. What happens to the imaginary component when
           reconstructing the image?

        4. What should the reconstructed image's shape be?

        Return:
            Reconstructed 2D image.
        """
        Ny, Nx = spectrum.shape
        intermediate = np.zeros((Ny, Nx), dtype=complex)

        for u in range(Nx):
            signal = spectrum[:, u]
            N = len(signal)
            result = np.zeros(N, dtype=complex)
            for y in range(N):
                for v in range(N):
                    angle = 2 * np.pi * v * y / N
                    exponential = (
                        np.cos(angle)
                        + 1j * np.sin(angle)
                    )
                    result[y] += signal[v] * exponential
                result[y] /= N
            intermediate[:, u] = result

        image = np.zeros((Ny, Nx), dtype=complex)
        for y in range(Ny):
            signal = intermediate[y, :]
            N = len(signal)
            result = np.zeros(N, dtype=complex)
            for x in range(N):
                for u in range(N):
                    angle = 2 * np.pi * u * x / N
                    exponential = (
                        np.cos(angle)
                        + 1j * np.sin(angle)
                    )
                    result[x] += signal[u] * exponential
                result[x] /= N
            image[y, :] = result
        return np.real(image)
        




def main():
    test_image = np.array([
        [1, 2],
        [3, 4]
    ], dtype=float)

    fourier = FourierTransform(test_image)

    spectrum = fourier.forward()

    print(spectrum)

if __name__=="__main__":
     main()