# Feature Dashboard and Routed Pages

## Goal

Make `/` a project home page listing Fourier-transform applications and completion status. Completed feature cards navigate to working feature pages; planned cards remain visible but disabled.

## Initial Feature Catalog

1. **Image Low-Pass Filtering** — Completed — `/features/image-filtering`
   - Existing Ideal, Gaussian, and Butterworth blur workflow.
2. **Frequency Spectrum Viewer** — Completed — `/features/spectrum-viewer`
   - Existing upload and magnitude-spectrum workflow, presented as a focused page.
3. **High-Pass Sharpening** — Planned
4. **Edge Detection** — Planned
5. **Frequency-Domain Compression** — Planned
6. **Audio Noise Filtering** — Planned

Catalog lives in one data module so later implementation only changes status/path and adds page component.

## Files

- `[MODIFY] frontend/App/package.json`
  - Add `react-router-dom` for URL-backed navigation and direct page loading.
- `[MODIFY] frontend/App/package-lock.json`
  - Record router dependency.
- `[MODIFY] frontend/App/src/main.jsx`
  - Wrap app with `BrowserRouter`.
- `[MODIFY] frontend/App/src/App.jsx`
  - Replace single-page body with route definitions and shared application shell.
- `[NEW] frontend/App/src/data/features.js`
  - Define feature title, description, status, number, category, and route.
- `[NEW] frontend/App/src/components/AppHeader.jsx`
  - Shared header with clickable home branding and current section context.
- `[NEW] frontend/App/src/components/FeatureCard.jsx`
  - Accessible completed/planned card behavior; only completed cards become links.
- `[NEW] frontend/App/src/pages/HomePage.jsx`
  - Hero, progress summary, completed/planned counters, and feature grid.
- `[NEW] frontend/App/src/pages/ImageFilteringPage.jsx`
  - Move existing filtering workflow into routed page with home breadcrumb.
- `[NEW] frontend/App/src/pages/SpectrumViewerPage.jsx`
  - Focused spectrum page using same processing API and upload experience.
- `[NEW] frontend/App/src/pages/NotFoundPage.jsx`
  - Friendly fallback with home navigation.
- `[MODIFY] frontend/App/src/App.css`
  - Add dashboard, cards, progress, navigation, and responsive page styling.
- `[MODIFY] task.md`
  - Replace completed checklist with dashboard execution checklist.
- `[MODIFY] system_architecture.md`
  - Record route map and feature-catalog convention.

## Behavior

- Home route shows all six features with `Completed` or `Planned` badge.
- Completed cards support mouse and keyboard navigation.
- Planned cards explain they are unavailable and cannot navigate.
- Header logo/title returns home from every page.
- Browser back/forward and direct URLs work.
- Existing filter feature keeps API behavior and EXIF orientation fix.
- Spectrum viewer uploads/processes independently and opens spectrum result automatically.

## Verification

1. Install router dependency.
2. Run frontend lint.
3. Run production build.
4. Run backend test suite to protect existing processing.
5. Do not commit yet; user requested commit only after all project work is over.
