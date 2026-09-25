function FeatureMenu({ activeFeature, onSelect }) {
  const features = [
    ['encrypt', 'Hide a Secret'],
    ['blur', 'Blur Region'],
    ['sharpen', 'Sharpen Region'],
  ]

  return <section className="feature-menu" aria-label="Image tools">
    <div className="feature-menu-heading"><span className="eyebrow">What do you want to do?</span><h2>Pick a tool</h2></div>
    <div className="feature-options">{features.map(([id, title]) => <button key={id} type="button" className={`feature-option ${activeFeature === id ? 'selected' : ''}`} onClick={() => onSelect(id)}><span className="feature-number">0{id === 'encrypt' ? 1 : id === 'blur' ? 2 : 3}</span><strong>{title}</strong><span className="feature-arrow" aria-hidden="true">→</span></button>)}</div>
  </section>
}

export default FeatureMenu