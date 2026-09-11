# 🌌 Fourier Transform Lab — Signals & Systems Project

An interactive, high-performance web studio for exploring **2D Discrete Fourier Transforms (DFT/FFT)**, frequency-domain image filtering, high-boost sharpening, and complex contour **Shape Drawer & Fourier Epicycles Decomposition**.

---

## ✨ Features

### ⚡ 1. $O(N \log N)$ Radix-2 & Bluestein FFT Engine
- **Decimation-in-Time Radix-2 Butterfly FFT**: Non-recursive, in-place $O(N \log N)$ algorithm for power-of-2 sequence lengths.
- **Bluestein's FFT Algorithm (Chirp Z-Transform)**: Computes exact DFT for arbitrary sequence length $N$ (including prime dimensions) via zero-padded Radix-2 FFT convolutions in sub-2 milliseconds.
- **Vectorized 2D Matrix Transforms**: Transforms 2D image rows and columns in parallel NumPy memory blocks.

### 🖼️ 2. Frequency-Domain Image Filtering & High-Boost Sharpening
- **Filter Profiles**:
  - **Ideal Low-Pass**: Sharp frequency cutoff ($D_0$).
  - **Gaussian Low-Pass**: Smooth attenuation without ringing artifacts.
  - **Butterworth Low-Pass**: Adjustable filter order $n$.
- **High-Boost Sharpening**: Preserves unclipped floating-point spatial residuals ($\text{Image} + A \times \text{HighPass}$) for crisp edge enhancement.
- **Synchronized Range Slider & Numeric Input**: Drag the slider or directly type exact values into numeric `<input type="number">` text boxes.

### 🖌️ 3. Centered Magnitude Spectrum & Interactive Mask Brush
- Displays centered log-magnitude spectrum ($\log(1 + |F(u, v)|)$).
- Interactive HTML5 canvas allows drawing custom circular frequency masks to selectively mute or boost frequency bands.

### 💖 4. Shape Drawer & Revolving Fourier Epicycles
- **Freehand Mouse Drawing Canvas**: Draw any continuous 2D path or closed curve with your mouse/touch.
- **Live Epicycles Animation**: Animates revolving complex Fourier vector circles ($\sum C_k e^{i \omega_k t}$) tracing the reconstructed curve.
- **Parametric Waveforms**: Renders 1D component signals $x(t)$ and $y(t)$ over normalized time.
- **Presets**: Quick-load preset shapes including Heart 💖, Star ⭐, Treble Clef 🎼, Square 🔲, and Circle ⭕.

### 💾 5. Automatic React localStorage State Persistence
- Preserves uploaded images, filter selections, Cutoff Radius $D_0$, and Boost Factor $A$ across page refreshes.
- Preserves drawn shapes, harmonics count $K$, and animation speed settings automatically.

---

## 🏗️ System Architecture

```
SignalProject/
├── backend/
│   ├── app.py                      # Flask REST API boundary & startup command header
│   ├── fourier/
│   │   ├── fast_fourier.py         # Iterative Butterfly Radix2FFT & 2D BluesteinFFT
│   │   └── fourier_transform.py    # 2D image filtering & shape decomposition
│   ├── image/
│   │   └── image_loader.py         # EXIF orientation & RGB image loader
│   └── tests/
│       ├── test_api.py             # Endpoint tests
│       └── test_fourier_transform.py# Mathematical FFT accuracy tests
└── frontend/App/
    ├── src/
    │   ├── pages/
    │   │   ├── HomePage.jsx        # Feature catalog & roadmap dashboard
    │   │   ├── ImageFilteringPage.jsx # Image workspace & spectrum viewer
    │   │   └── ShapeDrawerPage.jsx # Interactive mouse Shape Drawer & Epicycles
    │   ├── api.js                  # AbortController-ready API client
    │   ├── App.css                 # Modern dark glassmorphism design system
    │   └── main.jsx                # React SPA entry point
    └── package.json
```

---

## 🚀 Quick Start Guide

### 1. Start Backend (Flask API)

#### **Windows (PowerShell)**
```powershell
backend\venv\Scripts\python.exe backend\app.py
```

#### **Linux / macOS**
```bash
python3 -m venv backend/venv
source backend/venv/bin/activate
pip install -r backend/requirements.txt
python backend/app.py
```
*(Server starts at `http://127.0.0.1:5000`)*

---

### 2. Start Frontend (Vite + React)

```powershell
cd frontend/App
npm run dev
```
*(Dev server starts at `http://localhost:5173/`)*

---

### 🧪 Running Unit Tests

To run the backend pytest suite:
```powershell
backend\venv\Scripts\python.exe -m pytest backend/tests
```
*(14/14 tests passing)*

---

## 📜 License
Academic & Educational Project — Signal & Systems Lab.
