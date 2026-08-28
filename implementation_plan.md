# Fourier Transform Application — First Feature Slice

## Scope

Deliver usable end-to-end image processing: upload one PNG/JPEG, apply a low-pass Fourier filter, view processed image and frequency spectrum, and handle validation/loading/errors in both API and UI.

## Files

- `[MODIFY] backend/fourier/fourier_transform.py`
  - Validate non-empty 2D input.
  - Implement mathematical 1D/2D DFT and inverse DFT without `np.fft` for transform computation.
  - Implement centered Ideal, Gaussian, and Butterworth low/high-pass masks.
  - Implement filtering, high-boost sharpening, spectrum rendering, normalization, and parameter validation.
- `[MODIFY] backend/image/image_loader.py`
  - Remove stray/debug code.
  - Validate uploaded bytes and decode images safely.
  - Convert RGB/RGBA inputs to grayscale using vectorized luminance weights.
- `[NEW] backend/app.py`
  - Add Flask API with health and image-processing endpoints.
  - Accept multipart upload plus filter settings.
  - Limit upload size, reject bad files/settings, resize oversized images for manual DFT practicality.
  - Return processed image and spectrum as PNG data URLs with metadata.
- `[NEW] backend/requirements.txt`
  - Declare Flask, Flask-CORS, NumPy, Pillow.
- `[NEW] backend/tests/test_fourier_transform.py`
  - Verify forward/inverse reconstruction, masks, filtering output, spectrum, and invalid inputs.
- `[NEW] backend/tests/test_api.py`
  - Verify health, successful multipart processing, bad settings, and invalid uploads.
- `[NEW] frontend/App/src/api.js`
  - Centralize backend request, response parsing, and useful error messages.
- `[MODIFY] frontend/App/src/App.jsx`
  - Connect Apply button to API.
  - Add processing state, error recovery, original/processed/spectrum result selection, and returned metadata.
- `[MODIFY] frontend/App/src/components/ImageUploader.jsx`
  - Enforce PNG/JPEG selection, reset results when source changes, expose accessible validation cues.
- `[MODIFY] frontend/App/src/App.css`
  - Style loading/disabled/error states and result tabs while retaining current design.
- `[MODIFY] frontend/App/src/index.css`
  - Remove leftover Vite starter styles conflicting with app layout/theme.
- `[MODIFY] frontend/App/vite.config.js`
  - Proxy `/api` to local Flask server during development.
- `[NEW] system_architecture.md`
  - Record API contract, processing constraints, and frontend/backend boundaries after implementation.
- `[NEW] task.md`
  - Track execution and verification checklist after plan approval.

## API Contract

`POST /api/process` using multipart form data:

- `image`: PNG or JPEG file
- `filter`: `gaussian`, `ideal`, or `butterworth`
- `cutoff`: positive number
- `order`: positive integer (Butterworth; default 2)

Success JSON contains `processedImage`, `spectrumImage`, and `metadata`. Errors use `{ "error": "..." }` with suitable 4xx/5xx status.

## Verification

1. Run backend unit/API tests.
2. Run frontend lint and production build.
3. Smoke-test API health and one generated in-memory image request.

## Constraint

Direct mathematical DFT is intentionally slow for large images. First version resizes input to a conservative maximum dimension before processing and reports resulting dimensions in metadata.
