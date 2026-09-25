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
      <section className="card work-card" aria-label="Hidden message workspace">
        {onBack && <button type="button" className="back-button workspace-back" onClick={onBack}>← All features</button>}
        <div className="work-heading"><div><span className="eyebrow">Workspace</span><h2>Work with an image</h2></div><span className="local-pill">PNG output</span></div>
        <div className="segment-control mode-tabs" role="group" aria-label="Choose an action">
          <button type="button" className={mode === 'hide' ? 'selected' : ''} onClick={() => switchMode('hide')}>Hide a message</button>
          <button type="button" className={mode === 'read' ? 'selected' : ''} onClick={() => switchMode('read')}>Read a message</button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <ImageUploader key={mode} file={file} onChange={pickFile} inputId={`upload-${mode}`} mode={mode} />
          {preview && <div className="image-preview"><img src={preview} alt="Selected image preview" /><span>{dimensions ? `${dimensions.width} × ${dimensions.height} pixels` : 'Reading image…'}</span></div>}
          {mode === 'hide' && <><div className="segment-control" role="group" aria-label="Choose message protection mode">
            <button type="button" className={robust ? 'selected' : ''} onClick={() => setRobust(true)}>Robust short message</button>
            <button type="button" className={!robust ? 'selected' : ''} onClick={() => setRobust(false)}>Larger PNG message</button>
          </div><small className="field-help">{robust ? 'Up to 23 UTF-8 bytes. May recover after some JPEG, crop and resize attacks.' : 'Higher capacity using the original method. Keep the PNG unchanged.'}</small></>}
          {mode === 'read' && <><div className="segment-control" role="group" aria-label="Choose image reading mode">
            <button type="button" className={readMode === 'robust' ? 'selected' : ''} onClick={() => { setReadMode('robust'); setError(''); setResult(null) }}>Robust</button>
            <button type="button" className={readMode === 'normal' ? 'selected' : ''} onClick={() => { setReadMode('normal'); setError(''); setResult(null) }}>Normal</button>
          </div><small className="field-help">{readMode === 'robust' ? 'For short robust messages, including attacked images.' : 'For larger PNG messages and older protected images.'}</small></>}
          {mode === 'hide' && <label>Secret message<textarea rows="4" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tomorrow is CT." maxLength={3000} required />
            <small className={capacity !== null && messageBytes > capacity ? 'capacity over' : 'capacity'}>{capacity === null ? 'Choose an image to check capacity.' : `${messageBytes} / ${capacity} UTF-8 bytes available`}</small></label>}
          <label>Image passphrase<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></span><small className="field-help">This is separate from your account password. Save it: it cannot be recovered.</small></label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending || !file || password.length < 8 || (mode === 'hide' && (!messageBytes || (capacity !== null && messageBytes > capacity)))}>{pending ? 'Working on image…' : mode === 'hide' ? 'Hide message and save PNG' : 'Read hidden message'}</button>
        </form>
        {result?.type === 'hidden' && <div className="result-panel" role="status"><span className="eyebrow">Message hidden · {result.format === 'v3' ? 'Robust' : 'Larger PNG'}</span><h3>Your protected image is ready.</h3><p>The saved PNG holds {result.messageBytes} message bytes. Download it before changing or sharing the image.</p><a className="secondary-button" href={result.protectedImage} download={`protected-${result.imageId}.png`}>Download protected PNG ↓</a><button type="button" className="text-button analysis-trigger" onClick={runAnalysis} disabled={analysisPending}>{analysisPending ? 'Measuring…' : 'Analyze image changes'}</button></div>}
        {result?.type === 'read' && <div className="result-panel" role="status"><span className="eyebrow">Message recovered</span><h3>Hidden message</h3><p className="revealed-message">{result.message}</p></div>}
        {analysisError && <p className="notice error">{analysisError}</p>}
        <AnalysisPanel analysis={analysis} />
        {result?.type === 'hidden' && <AttackLab image={lastProtectedFile} password={lastPassword} token={token} />}
      </section>
      <aside className="gallery-column">
        <div className="card gallery-card"><div className="gallery-heading"><span className="eyebrow">Your gallery</span><h2>Protected images</h2><p>Images saved under your account. You still need each image passphrase to read its message.</p></div>
          {galleryError && <p className="notice error" role="alert">{galleryError}</p>}
          {!galleryError && images.length === 0 && <p className="empty-gallery">Your protected images will appear here after you hide a message.</p>}
          <ul className="gallery-list">{images.map((image) => <li key={image.id}><div><strong>{image.width} × {image.height} image</strong><small>{new Date(image.created_at).toLocaleDateString()} · {image.message_bytes} message bytes</small></div><div className="gallery-actions"><button type="button" onClick={() => getStoredImage(image.id, true)}>Read</button><button type="button" onClick={() => getStoredImage(image.id)}>Download</button></div></li>)}</ul>
        </div>
        <div className="method-note"><span className="eyebrow">How it works</span><p>Robust mode uses repeated Fourier tiles with error correction. Short messages may survive JPEG, cropping or resizing. Use images at least 512 × 512 for crop tests; download the original PNG for the best quality.</p></div>
      </aside>
    </div>
  )
}

export default SecretWorkspace
