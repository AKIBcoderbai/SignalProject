import { useEffect, useState } from 'react'
import AppHeader from './components/AppHeader'
import AuthPanel from './components/AuthPanel'
import PasswordPanel from './components/PasswordPanel'
import SecretWorkspace from './components/SecretWorkspace'
import GuestExtract from './components/GuestExtract'
import FeatureMenu from './components/FeatureMenu'
import BrushWorkspace from './components/BrushWorkspace'
import { setupError, supabase } from './supabaseClient'
import './App.css'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signOutError, setSignOutError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(() => new URLSearchParams(window.location.search).has('recovery'))
  const [activeFeature, setActiveFeature] = useState(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (active) {
        setSession(nextSession)
        if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      }
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setSignOutError(error.message)
      setSession(data.session)
    }).catch((error) => {
      if (active) setSignOutError(error.message)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setSignOutError(error.message)
    else {
      setSignOutError('')
      setSettingsOpen(false)
      setRecoveryMode(false)
      setActiveFeature(null)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }

  function finishRecovery() {
    setRecoveryMode(false)
    window.history.replaceState({}, '', window.location.pathname)
  }

  return (
    <div className="app-shell">
      <AppHeader email={session?.user?.email} onSignOut={signOut} onChangePassword={() => setSettingsOpen(true)} />
      <main className="page-wrap">
        <section className="intro" aria-labelledby="page-title">
          <div className="intro-copy">
            <span className="eyebrow">A Fourier image experiment</span>
            <h1 id="page-title">A message in the image.<br /><em>Only with the passphrase.</em></h1>
            <p>Place encrypted text inside a picture you can still recognize. Keep the resulting PNG and the image passphrase to read it later.</p>
          </div>
          <div className="signal-art" aria-hidden="true">
            <div className="signal-orbit orbit-one" /><div className="signal-orbit orbit-two" />
            <div className="signal-orbit orbit-three" /><span className="signal-core">F</span>
            <span className="signal-tag">IMAGE + SECRET</span>
          </div>
        </section>

        {setupError && <p className="notice error" role="alert">{setupError}</p>}
        {signOutError && <p className="notice error" role="alert">{signOutError}</p>}
        {supabase && loading && <p className="notice">Checking your session…</p>}
        {!supabase && <GuestExtract />}
        {supabase && !loading && (session
          ? recoveryMode
            ? <PasswordPanel mode="recovery" onDone={finishRecovery} />
            : settingsOpen
              ? <PasswordPanel mode="change" onDone={() => setSettingsOpen(false)} />
              : <>
                {!activeFeature && <FeatureMenu activeFeature={activeFeature} onSelect={setActiveFeature} />}
                {activeFeature === 'encrypt' && <SecretWorkspace key={`${session.user.id}-encrypt`} session={session} onBack={() => setActiveFeature(null)} />}
                {(activeFeature === 'blur' || activeFeature === 'sharpen') && <BrushWorkspace token={session.access_token} operation={activeFeature} onBack={() => setActiveFeature(null)} />}
              </>
          : <><AuthPanel initialMode={recoveryMode ? 'reset' : 'signin'} /><GuestExtract /></>)}

        <footer className="footer-note">The image changes slightly to hold encrypted text. New short-message images may survive some JPEG compression, cropping, and resizing; recovery is not guaranteed after severe changes.</footer>
      </main>
    </div>
  )
}

export default App
