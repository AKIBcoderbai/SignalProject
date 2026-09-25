function FeatureMenu({ activeFeature, onSelect }) {
  const features = [
    ['blur', 'Image blur'],
    ['sharpen', 'Image sharpening'],
    ['encrypt', 'Encrypt message'],
  ]

  return <section className="feature-menu" aria-label="Image features">
    <div className="feature-menu-heading"><span className="eyebrow">Signal tools</span><h2>Choose a workspace</h2></div>
    <div className="feature-options">{features.map(([id, title]) => <button key={id} type="button" className={`feature-option ${activeFeature === id ? 'selected' : ''}`} onClick={() => onSelect(id)}><span className="feature-number">0{id === 'blur' ? 1 : id === 'sharpen' ? 2 : 3}</span><strong>{title}</strong><span className="feature-arrow" aria-hidden="true">→</span></button>)}</div>
  </section>
}

export default FeatureMenu