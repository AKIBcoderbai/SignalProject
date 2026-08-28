import { Link } from 'react-router-dom'

function AppHeader() {
  return (
    <header className="topbar">
      <Link className="brand-link" to="/" aria-label="Fourier Lab home"><span className="brand-mark">FT</span><span><span className="eyebrow">Frequency studio</span><strong>Fourier Transform Lab</strong></span></Link>
      <Link className="home-link" to="/">All features</Link>
      <span className="status-dot">Local workspace</span>
    </header>
  )
}

export default AppHeader
