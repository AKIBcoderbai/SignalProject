function AppHeader({ email, onSignOut, onChangePassword }) {
  return (
    <header className="topbar">
      <div className="brand" aria-label="Fourier Image Lab">
        <img src="/shrek.jpg" alt="Logo" className="brand-logo-img" />
        <div><strong>Fourier Image Lab</strong><small>Explore images through Fourier transforms</small></div>
      </div>
      {email && <div className="account"><span title={email}>{email}</span><button className="text-button" type="button" onClick={onChangePassword}>Change password</button><button className="text-button" type="button" onClick={onSignOut}>Sign out</button></div>}
    </header>
  )
}

export default AppHeader
