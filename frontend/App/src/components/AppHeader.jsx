function AppHeader({ email, onSignOut, onChangePassword }) {
  return (
    <header className="topbar">
      <div className="brand" aria-label="Frequency Seal">
        <span className="brand-mark">F<span>·</span></span>
        <div><strong>Frequency Seal</strong><small>Hidden messages in images</small></div>
      </div>
      {email && <div className="account"><span title={email}>{email}</span><button className="text-button" type="button" onClick={onChangePassword}>Change password</button><button className="text-button" type="button" onClick={onSignOut}>Sign out</button></div>}
    </header>
  )
}

export default AppHeader
