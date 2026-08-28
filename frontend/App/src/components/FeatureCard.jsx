import { Link } from 'react-router-dom'

function CardContent({ feature }) {
  return <><div className="feature-card-top"><span className="feature-number">{feature.number}</span><span className={`feature-status ${feature.status}`}>{feature.status}</span></div><p className="eyebrow">{feature.category}</p><h3>{feature.title}</h3><p className="feature-description">{feature.description}</p><span className="feature-action">{feature.status === 'completed' ? 'Open feature →' : 'Coming next'}</span></>
}

function FeatureCard({ feature }) {
  return feature.status === 'completed'
    ? <Link className="feature-card completed-card" to={feature.path}><CardContent feature={feature} /></Link>
    : <article className="feature-card planned-card" aria-disabled="true"><CardContent feature={feature} /></article>
}

export default FeatureCard
