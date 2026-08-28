# System Architecture

## Boundaries

- `frontend/App`: React/Vite client. Owns upload controls, processing state, view selection, and user-facing errors.
- `backend/app.py`: Flask HTTP boundary. Validates multipart settings, limits uploads to 10 MB, encodes output PNGs, and returns metadata.
- `backend/image`: image decoding, RGB conversion, and resize to 128 px maximum dimension.
- `backend/fourier`: NumPy-based mathematical separable DFT/IDFT plus frequency masks. `np.fft` is used only for spectrum quadrant shift/unshift, never transform calculation.

## API

`POST /api/process` accepts `image`, `filter`, `cutoff`, and `order`. It returns `processedImage` and `spectrumImage` as PNG data URLs plus dimensions/settings under `metadata`. Failures return `{ "error": string }`.

During local development, Vite proxies `/api` to Flask at `127.0.0.1:5000`.

## Processing Constraint

Manual DFT has high computational cost. Uploaded images are resized to fit within 128 × 128 while preserving aspect ratio. Keep this constraint until transform computation moves to FFT or an asynchronous job system.
