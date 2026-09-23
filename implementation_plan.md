# Feature implementation plan

## Goal

Add the five requested presentation and workflow features without changing the
existing encrypted Fourier embedding format or the authenticated image gallery:

1. Before/after image analysis with a magnified difference image and PSNR/SSIM.
2. Fourier spectrum and coefficient bit 0/1 visualization.
3. Guest extraction without account authentication.
4. Password-keyed block ordering with a backward-compatible embedded header.
5. An attack lab for JPEG conversion, resizing, cropping, and screenshot-like
   degradation.

## Files

- `[MODIFY] backend/secret_transform.py`
  - Preserve version 1 extraction.
  - Add version 2 payload/header handling and deterministic password-derived
    block ordering after the header.
  - Expose analysis helpers for image metrics, difference images, spectra, and
    coefficient bit demonstrations.
  - Add attack transformation helpers with explicit validation.
- `[MODIFY] backend/app.py`
  - Make only extraction available to guests; keep embedding, gallery listing,
    and downloads authenticated.
  - Add authenticated analysis and attack-lab endpoints that return JSON-safe
    image data and measured extraction results.
- `[MODIFY] backend/requirements.txt`
  - Add the pinned-compatible scikit-image dependency for PSNR/SSIM metrics.
- `[MODIFY] backend/tests/test_secret_transform.py`
  - Cover legacy extraction, keyed ordering, metrics, spectrum data, and attack
    transformations.
- `[MODIFY] frontend/App/src/api.js`
  - Add guest extraction and analysis/attack API calls while retaining the
    authenticated request helper.
- `[MODIFY] frontend/App/src/components/SecretWorkspace.jsx`
  - Add before/after analysis, spectrum/bit visualization, attack-lab controls,
    and guest extraction entry point.
- `[MODIFY] frontend/App/src/components/ImageUploader.jsx`
  - Support the guest protected-PNG extraction flow without account state.
- `[MODIFY] frontend/App/src/App.jsx`
  - Keep the signed-in workspace unchanged as the primary experience and add a
    guest extraction route/panel when no session is available.
- `[MODIFY] frontend/App/src/App.css`
  - Style the new analysis, spectrum, attack-lab, and guest panels responsively.
- `[NEW] backend/tests/test_app.py`
  - Verify guest extraction does not depend on Supabase authentication and
    authenticated-only endpoints remain protected.
- `[NEW] frontend/App/src/components/AnalysisPanel.jsx`
  - Present measurable image comparison, magnified differences, and Fourier
    visualizations.
- `[NEW] frontend/App/src/components/AttackLab.jsx`
  - Provide destructive-copy attack experiments and extraction outcomes.
- `[NEW] frontend/App/src/components/GuestExtract.jsx`
  - Provide a standalone upload/passphrase form for unauthenticated extraction.
- `[NEW] system_architecture.md`
  - Record the versioned payload/header and compatibility boundaries for future
    changes.

## Compatibility constraints

- Existing version 1 PNGs remain extractable with their current predictable
  block order.
- New embeds use a version 2 payload and keyed order only after a fixed,
  readable header; extraction tries no silent fallback for malformed data.
- The PNG output and AES-GCM/password requirements remain unchanged.
- Guest access is limited to local extraction of an uploaded PNG; it does not
  expose Supabase storage or image metadata.
- Attack-lab operations work on in-memory copies and never overwrite the
  original upload or saved gallery image.

## Verification

- Run the targeted backend test suite with `pytest`.
- Run frontend lint and production build with `npm run lint` and `npm run build`.
