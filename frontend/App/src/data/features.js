export const features = [
  { id: 'image-filtering', number: '01', title: 'Image Low-Pass Filtering', category: 'Image processing', description: 'Blur images using Ideal, Gaussian, and Butterworth masks in frequency space.', status: 'completed', path: '/features/image-filtering' },
  { id: 'spectrum-viewer', number: '02', title: 'Frequency Spectrum Viewer', category: 'Visualization', description: 'Reveal centered Fourier magnitude and inspect where image frequencies live.', status: 'completed', path: '/features/spectrum-viewer' },
  { id: 'high-pass', number: '03', title: 'High-Pass Sharpening', category: 'Image processing', description: 'Enhance fine detail with high-pass and high-boost frequency filters.', status: 'planned' },
  { id: 'edge-detection', number: '04', title: 'Edge Detection', category: 'Image analysis', description: 'Extract strong spatial transitions through frequency-domain filtering.', status: 'planned' },
  { id: 'compression', number: '05', title: 'Frequency-Domain Compression', category: 'Compression', description: 'Discard low-energy coefficients and compare size against visual quality.', status: 'planned' },
  { id: 'audio-filtering', number: '06', title: 'Audio Noise Filtering', category: 'Audio processing', description: 'Inspect an audio spectrum and suppress unwanted frequency bands.', status: 'planned' },
]
