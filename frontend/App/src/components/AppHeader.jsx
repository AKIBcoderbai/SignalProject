import { Link, useLocation } from 'react-router-dom'

function AppHeader() {
  const location = useLocation()
  return (
    <header className="topbar">
      <Link className="brand-link" to="/" aria-label="Fourier Lab home">
        <span className="brand-mark">FT</span>
        <span>
          <span className="eyebrow">Frequency studio</span>
          <strong>Fourier Transform Lab</strong>
        </span>
      </Link>
      <nav className="header-nav">
        <Link className={location.pathname === '/' ? 'nav-item active' : 'nav-item'} to="/">Home</Link>
        <Link className={location.pathname === '/features/image-filtering' ? 'nav-item active' : 'nav-item'} to="/features/image-filtering">Image Filter</Link>
        <Link className={location.pathname === '/features/shape-drawer' ? 'nav-item active' : 'nav-item'} to="/features/shape-drawer">Shape Drawer</Link>
      </nav>
      <span className="status-dot">Local workspace</span>
    </header>
  )
}

export default AppHeader

