import { useEffect, useState } from 'react'
import { analyzeImages, downloadImage, hideMessage, listImages, readMessage } from '../api'
import ImageUploader from './ImageUploader'
import AnalysisPanel from './AnalysisPanel'
import AttackLab from './AttackLab'

const utf8Size = (value) => new TextEncoder().encode(value).length

function SecretWorkspace({ session, onBack }) {
  const [mode, setMode] = useState('hide')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [dimensions, setDimensions] = useState(null)
  const [message, setMessage] = useState('')
  const [robust, setRobust] = useState(true)
  const [readMode, setReadMode] = useState('robust')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [images, setImages] = useState([])
  const [galleryError, setGalleryError] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [analysisPending, setAnalysisPending] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [lastProtectedFile, setLastProtectedFile] = useState(null)
  const [lastPassword, setLastPassword] = useState('')

  const token = session.access_token
  const capacity = dimensions
    ? robust && Math.min(dimensions.width, dimensions.height) >= 256
      ? 23
      : Math.max(0, Math.floor(Math.floor(dimensions.width / 16) * Math.floor(dimensions.height / 16) / 8) - 51)
    : null
  const messageBytes = utf8Size(message)

  useEffect(() => {
    if (!file) {
      setPreview('')
      setDimensions(null)
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    setDimensions(null)
    const image = new Image()
    image.onload = () => setDimensions({ width: image.naturalWidth, height: image.naturalHeight })
    image.src = url
    return () => { image.onload = null; URL.revokeObjectURL(url) }
  }, [file])

  useEffect(() => {
    let active = true
    listImages(token).then(({ images: saved }) => {
      if (active) { setImages(saved); setGalleryError('') }
    }).catch((requestError) => {
      if (active) setGalleryError(requestError.message)
    })
    return () => { active = false }
  }, [token])

  function pickFile(nextFile) {
    setResult(null)
    setError('')
    setAnalysis(null)
    setAnalysisError('')
    setLastProtectedFile(null)
    setLastPassword('')
    if (nextFile && (!['image/png', 'image/jpeg'].includes(nextFile.type) || nextFile.size > 10 * 1024 * 1024)) {
      setFile(null)
      setError('Choose a PNG or JPEG image under 10 MB.')
      return
    }
    setFile(nextFile)
  }

  function switchMode(nextMode) {
    setMode(nextMode)
    setFile(null)
    setPassword('')
    setResult(null)
    setError('')
    setAnalysis(null)
    setLastProtectedFile(null)
    setLastPassword('')
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    setPending(true)
    try {
      const response = mode === 'hide'
        ? await hideMessage({ image: file, message, password, robust, token })
        : await readMessage({ image: file, password, mode: readMode, token })
      setResult(mode === 'hide' ? { type: 'hidden', ...response } : { type: 'read', ...response })
      if (mode === 'hide') {
        setLastPassword(password)
        const protectedBlob = await (await fetch(response.protectedImage)).blob()
        setLastProtectedFile(new File([protectedBlob], 'protected.png', { type: 'image/png' }))
      }
      setPassword('')
      if (mode === 'hide') {
        setMessage('')
        try {
          const gallery = await listImages(token)
          setImages(gallery.images)
          setGalleryError('')
        } catch (requestError) {
          setGalleryError(requestError.message)
        }

      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setPending(false)
    }
  }

  async function runAnalysis() {
    if (!file || !lastProtectedFile) return
    setAnalysisPending(true); setAnalysisError('')
    try {
      const report = await analyzeImages({ original: file, protectedImage: lastProtectedFile, token })
      setAnalysis({ ...report, before: preview, after: result.protectedImage })
    }
    catch (requestError) { setAnalysisError(requestError.message) }
    finally { setAnalysisPending(false) }
  }

  async function getStoredImage(imageId, useForReading = false) {
    setGalleryError('')
    try {
      const blob = await downloadImage(imageId, token)
      if (useForReading) {
        switchMode('read')
        setFile(new File([blob], `${imageId}.png`, { type: 'image/png' }))
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${imageId}.png`
        link.click()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    } catch (requestError) {
      setGalleryError(requestError.message)
    }
  }

  return (
    <div className="workspace-grid">
      <section className="card work-card" aria-label="Secret message workspace">
        {onBack && <button type="button" className="back-button workspace-back" onClick={onBack}>← Back to tools</button>}
        <div className="work-heading"><div><span className="eyebrow">Steganography</span><h2>Hide or read a secret</h2></div><span className="local-pill">PNG output</span></div>
        <div className="segment-control mode-tabs" role="group" aria-label="Choose an action">
          <button type="button" className={mode === 'hide' ? 'selected' : ''} onClick={() => switchMode('hide')}>Hide a message</button>
          <button type="button" className={mode === 'read' ? 'selected' : ''} onClick={() => switchMode('read')}>Read a message</button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <ImageUploader key={mode} file={file} onChange={pickFile} inputId={`upload-${mode}`} mode={mode} />
          {preview && <div className="image-preview"><img src={preview} alt="Selected image preview" /><span>{dimensions ? `${dimensions.width} × ${dimensions.height} px` : 'Loading image…'}</span></div>}
          {mode === 'hide' && <><div className="segment-control" role="group" aria-label="Encoding method">
            <button type="button" className={robust ? 'selected' : ''} onClick={() => setRobust(true)}>Robust (short text)</button>
            <button type="button" className={!robust ? 'selected' : ''} onClick={() => setRobust(false)}>Full capacity (PNG only)</button>
          </div><small className="field-help">{robust ? 'Up to 23 bytes. Can survive JPEG compression, cropping, and resizing.' : 'Fits longer messages but only works if the PNG stays untouched.'}</small></>}
          {mode === 'read' && <><div className="segment-control" role="group" aria-label="Decoding method">
            <button type="button" className={readMode === 'robust' ? 'selected' : ''} onClick={() => { setReadMode('robust'); setError(''); setResult(null) }}>Robust</button>
            <button type="button" className={readMode === 'normal' ? 'selected' : ''} onClick={() => { setReadMode('normal'); setError(''); setResult(null) }}>Normal</button>
          </div><small className="field-help">{readMode === 'robust' ? 'Use this for short messages or images that have been re-saved or cropped.' : 'Use this for longer messages embedded in untouched PNGs.'}</small></>}
          {mode === 'hide' && <label>Your secret message<textarea rows="4" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Type the message you want to hide…" maxLength={3000} required />
            <small className={capacity !== null && messageBytes > capacity ? 'capacity over' : 'capacity'}>{capacity === null ? 'Pick an image first to see how much text fits.' : `${messageBytes} / ${capacity} bytes used`}</small></label>}
          <label>Passphrase<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></span><small className="field-help">This is not your account password — it locks the image. Keep it safe, there is no way to recover it.</small></label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending || !file || password.length < 8 || (mode === 'hide' && (!messageBytes || (capacity !== null && messageBytes > capacity)))}>{pending ? 'Processing…' : mode === 'hide' ? 'Hide message in image' : 'Extract hidden message'}</button>
        </form>
        {result?.type === 'hidden' && <div className="result-panel" role="status"><span className="eyebrow">Done — {result.format === 'v3' ? 'Robust mode' : 'Full capacity mode'}</span><h3>Your image is ready.</h3><p>The PNG now contains {result.messageBytes} hidden bytes. Download it before making any changes.</p><a className="secondary-button" href={result.protectedImage} download={`protected-${result.imageId}.png`}>Download PNG ↓</a><button type="button" className="text-button analysis-trigger" onClick={runAnalysis} disabled={analysisPending}>{analysisPending ? 'Comparing…' : 'Compare before & after'}</button></div>}
        {result?.type === 'read' && <div className="result-panel" role="status"><span className="eyebrow">Found it</span><h3>Hidden message</h3><p className="revealed-message">{result.message}</p></div>}
        {analysisError && <p className="notice error">{analysisError}</p>}
        <AnalysisPanel analysis={analysis} />
        {result?.type === 'hidden' && <AttackLab image={lastProtectedFile} password={lastPassword} token={token} />}
      </section>
      <aside className="gallery-column">
        <div className="card gallery-card"><div className="gallery-heading"><span className="eyebrow">Saved images</span><h2>Your images</h2><p>Images stored under your account. You still need the passphrase to read the hidden message in each one.</p></div>
          {galleryError && <p className="notice error" role="alert">{galleryError}</p>}
          {!galleryError && images.length === 0 && <p className="empty-gallery">Nothing here yet — hide a message in an image and it will show up here.</p>}
          <ul className="gallery-list">{images.map((image) => <li key={image.id}><div><strong>{image.width} × {image.height}</strong><small>{new Date(image.created_at).toLocaleDateString()} · {image.message_bytes} bytes hidden</small></div><div className="gallery-actions"><button type="button" onClick={() => getStoredImage(image.id, true)}>Read</button><button type="button" onClick={() => getStoredImage(image.id)}>Download</button></div></li>)}</ul>
        </div>
      </aside>
    </div>
  )
}

export default SecretWorkspace
