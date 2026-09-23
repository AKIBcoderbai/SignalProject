import { useState } from 'react'
import { supabase } from '../supabaseClient'

function PasswordPanel({ mode, onDone }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [updated, setUpdated] = useState(false)
  const [error, setError] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [code, setCode] = useState('')

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (nextPassword !== confirmation) {
      setError('The new passwords do not match.')
      return
    }
    if (mode === 'change' && currentPassword === nextPassword) {
      setError('Choose a new password different from the current one.')
      return
    }
    setPending(true)
    try {
      const attributes = mode === 'change'
        ? { current_password: currentPassword, password: nextPassword }
        : { password: nextPassword }
      if (needsCode) attributes.nonce = code.trim()
      const { error: updateError } = await supabase.auth.updateUser(attributes)
      if (updateError?.code === 'reauthentication_needed' && !needsCode) {
        const { error: reauthError } = await supabase.auth.reauthenticate()
        if (reauthError) throw reauthError
        setNeedsCode(true)
        setError('Check your email for a verification code, then enter it below.')
        return
      }
      if (updateError) throw updateError
      setCurrentPassword('')
      setNextPassword('')
      setConfirmation('')
      setCode('')
      setNeedsCode(false)
      setUpdated(true)
    } catch (updateError) {
      setError(updateError.message || 'Could not update the account password.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="password-layout card">
      <span className="eyebrow">Account settings</span>
      <h2>{mode === 'recovery' ? 'Set a new password' : 'Change account password'}</h2>
      <p className="password-intro">{mode === 'recovery' ? 'Your reset link opened the account. Choose a new password to keep using it.' : 'This changes your sign-in password. Image passphrases stay as they are.'}</p>
      {updated ? <div className="form-stack"><p className="notice success" role="status">Account password updated.</p><button className="primary-button" type="button" onClick={onDone}>Return to images</button></div> :
        <form className="form-stack" onSubmit={submit}>
          {mode === 'change' && <label>Current account password<input type={showPassword ? 'text' : 'password'} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" /></label>}
          <label>New account password<input type={showPassword ? 'text' : 'password'} value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} required minLength={8} autoComplete="new-password" /></label>
          <label>Confirm new password<input type={showPassword ? 'text' : 'password'} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} autoComplete="new-password" /></label>
          {needsCode && <label>Email verification code<input type="text" value={code} onChange={(event) => setCode(event.target.value)} required autoComplete="one-time-code" placeholder="Code from your email" /></label>}
          <label className="checkbox-line"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} /> Show passwords</label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending}>{pending ? 'Updating…' : 'Update password'}</button>
          {mode === 'change' && <button className="inline-link" type="button" onClick={onDone}>Back to images</button>}
        </form>}
    </section>
  )
}

export default PasswordPanel
