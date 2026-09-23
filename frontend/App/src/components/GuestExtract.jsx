import { useState } from 'react'
import { readMessage } from '../api'
import ImageUploader from './ImageUploader'

function GuestExtract() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setPending(true); setError(''); setResult(null)
    try { setResult((await readMessage({ image: file, password })).message) }
    catch (requestError) { setError(requestError.message) }
    finally { setPending(false) }
  }

  return <section className="card guest-panel">
    <span className="eyebrow">Guest extraction</span>
    <h2>Read a protected PNG</h2>
    <p>No account is needed. Your PNG and passphrase are sent to the Python server for extraction and are not saved there.</p>
    <form className="form-stack" onSubmit={submit}>
      <ImageUploader file={file} onChange={(next) => { setFile(null); setResult(null); setError(''); if (next && (next.type !== 'image/png' || next.size > 10 * 1024 * 1024)) setError('Choose a protected PNG under 10 MB.'); else setFile(next) }} inputId="guest-upload" mode="guest" />
      <label>Image passphrase<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="At least 8 characters" /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary-button" disabled={pending || !file || password.length < 8}>{pending ? 'Reading…' : 'Read hidden message'}</button>
    </form>
    {result !== null && <div className="result-panel" role="status"><span className="eyebrow">Message recovered</span><p className="revealed-message">{result}</p></div>}
  </section>
}

export default GuestExtract
