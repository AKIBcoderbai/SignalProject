import { useState } from 'react'
import { readMessage } from '../api'
import ImageUploader from './ImageUploader'

function GuestExtract() {
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [readMode, setReadMode] = useState('robust')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setPending(true); setError(''); setResult(null)
    try { setResult((await readMessage({ image: file, password, mode: readMode })).message) }
    catch (requestError) { setError(requestError.message) }
    finally { setPending(false) }
  }

  return <section className="card guest-panel">
    <span className="eyebrow">Quick extract</span>
    <h2>Read a hidden message</h2>
    <form className="form-stack" onSubmit={submit}>
      <ImageUploader file={file} onChange={(next) => { setFile(null); setResult(null); setError(''); if (next && (!['image/png', 'image/jpeg'].includes(next.type) || next.size > 10 * 1024 * 1024)) setError('Choose a PNG or JPEG under 10 MB.'); else setFile(next) }} inputId="guest-upload" mode="guest" />
      <div className="segment-control" role="group" aria-label="Decoding method">
        <button type="button" className={readMode === 'robust' ? 'selected' : ''} onClick={() => { setReadMode('robust'); setResult(null); setError('') }}>Robust</button>
        <button type="button" className={readMode === 'normal' ? 'selected' : ''} onClick={() => { setReadMode('normal'); setResult(null); setError('') }}>Normal</button>
      </div>
      <label>Passphrase<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required placeholder="The passphrase used to hide the message" /></label>
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary-button" disabled={pending || !file || password.length < 8}>{pending ? 'Reading…' : 'Extract message'}</button>
    </form>
    {result !== null && <div className="result-panel" role="status"><span className="eyebrow">Found it</span><p className="revealed-message">{result}</p></div>}
  </section>
}

export default GuestExtract
