import FeatureCard from '../components/FeatureCard'
import { features } from '../data/features'

function HomePage() {
  const completed = features.filter((feature) => feature.status === 'completed').length
  const progress = Math.round((completed / features.length) * 100)
  return <main className="workspace home-page"><section className="home-hero"><div><p className="eyebrow">Fourier transform applications</p><h1>Explore signals beyond the spatial domain.</h1><p>Interactive demonstrations showing how frequency analysis can filter, explain, and transform real signals.</p></div><aside className="progress-card"><span className="eyebrow">Project progress</span><strong>{completed}/{features.length}</strong><p>features completed</p><div className="progress-track" aria-label={`${progress}% complete`}><span style={{ width: `${progress}%` }} /></div><small>{progress}% of roadmap</small></aside></section><section className="feature-section"><div className="section-heading"><div><p className="eyebrow">Application roadmap</p><h2>Features</h2></div><p>Select any completed feature to open its interactive workspace.</p></div><div className="feature-grid">{features.map((feature) => <FeatureCard key={feature.id} feature={feature} />)}</div></section></main>
}

export default HomePage
