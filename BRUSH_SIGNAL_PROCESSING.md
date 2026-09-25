# Brush Signal Processing

The local editor is implemented in `backend/fourier/` and is exposed through
`POST /api/image-edit/brush`. It never writes over the uploaded source image.
The React canvas records normalized brush points, while the backend rasterizes
them into a soft mask and composites only the painted region.

## Signal paths

- `dft.py`: direct DFT/IDFT from the definition, useful for small educational inputs.
- `manual_fft.py`: iterative radix-2 Cooley-Tukey FFT with explicit bit reversal.
  Non-power-of-two rows and columns are zero-padded to the next power of two.
- `convolution.py`: explicit 2D kernel loops with zero, replicate, or wrap padding.
- `frequency_filters.py`: manual 2D FFT, centered low-pass response, complex
  multiplication, inverse FFT, and crop back to the original dimensions.
- `brush_processing.py`: Gaussian blur and Laplacian sharpening, RGB or luminance
  processing, feathered mask generation, and local alpha compositing.

Spatial blur uses a normalized Gaussian kernel. Spatial sharpening adds a scaled
four-neighbor Laplacian high-pass response. The frequency path uses a Gaussian
low-pass response; sharpening boosts its complementary high-frequency response.
The brush mask uses full coverage in the inner radius and linear falloff through
the feather band, so boundary strokes, overlaps, and partial strokes remain stable.

## Complexity

For an $N$-sample 1D signal, direct DFT is $O(N^2)$ time and $O(N^2)$ kernel
space. Radix-2 FFT is $O(N \log N)$ time and $O(N)$ working space per row or
column. A $K \times K$ spatial convolution over an $H \times W$ image is
$O(HWK^2)$; the explicit implementation favors clarity and is best for local
kernels. Frequency filtering pads to $P \times Q$ powers of two and costs
$O(PQ(\log P + \log Q))$ time and $O(PQ)$ space.

## Usage

1. Sign in and choose an image in the existing workspace.
2. In **Brush blur or sharpen**, choose the operation, channel mode, brush size,
   strength, and either spatial convolution or manual FFT frequency processing.
3. Paint over one or more regions on the canvas, then select **Preview local edit**.
4. Compare the result and feathered mask, then download the edited PNG if it is ready.
   Use **Clear mask** to repaint. The original upload remains unchanged.

## Validation and benchmark

Run the unit tests from `backend`:

```powershell
.\.venv\Scripts\Activate.ps1
pytest tests/test_brush_signal.py
python benchmarks/brush_benchmark.py
```

The tests cover impulse and constant DFTs, sinusoidal FFT behavior, inverse
round-trip, non-power-of-two padding, a hand-computed convolution, boundary and
overlapping masks, RGB PNG/JPEG inputs, luminance processing, and both filter paths.