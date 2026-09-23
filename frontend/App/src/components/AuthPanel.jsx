import { useState } from 'react'
import { supabase } from '../supabaseClient'

function AuthPanel({ initialMode = 'signin' }) {
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setPending(true)
    try {
      if (mode === 'reset') {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/?recovery=1`,
        })
        if (resetError) throw resetError
        setNotice('If this email has an account, you will receive a reset link. Check your inbox.')
        return
      }
      if (mode === 'signup' && password !== confirmPassword) {
        setError('The two account passwords do not match.')
        return
      }
      const { data, error: authError } = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        })
      if (authError?.code === 'user_already_exists' || /already registered/i.test(authError?.message || '')) {
        setError('An account with this email already exists. Sign in or reset your password.')
        return
      }
      if (authError) throw authError
      if (mode === 'signup' && !data.session) {
        setNotice('If this is a new account, check your email for a confirmation link. Already registered? Sign in or reset your password.')
      }
    } catch (authError) {
      const emailLimitReached =
        authError?.code === 'over_email_send_rate_limit' ||
        /email rate limit exceeded/i.test(authError?.message || '')

      setError(
        emailLimitReached
          ? 'Email sending is temporarily rate limited. Wait a little before requesting another link.'
          : authError?.message || 'Could not complete sign-in. Try again.'
      )
    } finally {
      setPending(false)
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setError('')
    setNotice('')
    setPassword('')
    setConfirmPassword('')
    setShowPassword(false)
  }

  return (
    <section className="auth-layout" aria-label="Account access">
      <div className="auth-context">
        <span className="eyebrow">Your workspace</span>
        <h2>Make the image yours.</h2>
        <p>Sign in to store protected images in your private gallery. Your image passphrase is separate from this account password.</p>
        <div className="process-steps"><span>01 · Choose an image</span><span>02 · Hide your text</span><span>03 · Download the PNG</span></div>
      </div>
      <div className="card auth-card">
        <div className="segment-control" role="group" aria-label="Account action">
          <button type="button" className={mode === 'signin' ? 'selected' : ''} onClick={() => changeMode('signin')}>Sign in</button>
          <button type="button" className={mode === 'signup' ? 'selected' : ''} onClick={() => changeMode('signup')}>Create account</button>
        </div>
        <h3>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}</h3>
        <form onSubmit={submit} className="form-stack">
          <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" /></label>
          {mode !== 'reset' && <label>Account password<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide account password' : 'Show account password'}>{showPassword ? 'Hide' : 'Show'}</button></span></label>}
          {mode === 'signup' && <label>Confirm account password<input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></label>}
          {mode === 'signin' && <button className="inline-link" type="button" onClick={() => changeMode('reset')}>Forgot password?</button>}
          {error && <p className="notice error" role="alert">{error}</p>}
          {notice && <p className="notice success" role="status">{notice}</p>}
          <button className="primary-button" disabled={pending} type="submit">{pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</button>
          {mode === 'reset' && <button className="inline-link" type="button" onClick={() => changeMode('signin')}>Back to sign in</button>}
        </form>
      </div>
    </section>
  )
}

export default AuthPanel
