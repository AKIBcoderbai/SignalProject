function FeatureMenu({ activeFeature, onSelect }) {
  const features = [
    ['blur', 'Image blur', 'Paint a soft local blur with spatial convolution or manual FFT.'],
    ['sharpen', 'Image sharpening', 'Paint local high-frequency detail with a Laplacian or FFT boost.'],
    ['encrypt', 'Encrypt message', 'Hide and recover protected messages inside images.'],
  ]

  return <section className="feature-menu" aria-label="Choose an image feature">
    <div className="feature-menu-heading"><span className="eyebrow">Signal tools</span><h2>Choose a workspace</h2><p>Each tool has its own focused workflow. Your source images remain unchanged.</p></div>
    <div className="feature-options">{features.map(([id, title, description]) => <button key={id} type="button" className={`feature-option ${activeFeature === id ? 'selected' : ''}`} onClick={() => onSelect(id)}><span className="feature-number">0{id === 'blur' ? 1 : id === 'sharpen' ? 2 : 3}</span><strong>{title}</strong><small>{description}</small><span className="feature-arrow" aria-hidden="true">→</span></button>)}</div>
  </section>
}

export default FeatureMenu