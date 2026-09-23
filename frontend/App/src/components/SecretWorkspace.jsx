import { useEffect, useState } from 'react'
import { downloadImage, hideMessage, listImages, readMessage } from '../api'
import ImageUploader from './ImageUploader'

const utf8Size = (value) => new TextEncoder().encode(value).length

function SecretWorkspace({ session }) {
  const [mode, setMode] = useState('hide')
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [dimensions, setDimensions] = useState(null)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [images, setImages] = useState([])
  const [galleryError, setGalleryError] = useState('')

  const token = session.access_token
  const capacity = dimensions
    ? Math.max(0, Math.floor(Math.floor(dimensions.width / 16) * Math.floor(dimensions.height / 16) / 8) - 47)
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
    if (nextFile && (!['image/png', 'image/jpeg'].includes(nextFile.type) || nextFile.size > 10 * 1024 * 1024 || (mode === 'read' && nextFile.type !== 'image/png'))) {
      setFile(null)
      setError('Choose a valid image under 10 MB. Reading a message requires the protected PNG.')
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
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setResult(null)
    setPending(true)
    try {
      const response = mode === 'hide'
        ? await hideMessage({ image: file, message, password, token })
        : await readMessage({ image: file, password, token })
      setResult(mode === 'hide' ? { type: 'hidden', ...response } : { type: 'read', ...response })
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
        <div className="work-heading"><div><span className="eyebrow">Workspace</span><h2>Work with an image</h2></div><span className="local-pill">PNG output</span></div>
        <div className="segment-control mode-tabs" role="group" aria-label="Choose an action">
          <button type="button" className={mode === 'hide' ? 'selected' : ''} onClick={() => switchMode('hide')}>Hide a message</button>
          <button type="button" className={mode === 'read' ? 'selected' : ''} onClick={() => switchMode('read')}>Read a message</button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <ImageUploader key={mode} file={file} onChange={pickFile} inputId={`upload-${mode}`} mode={mode} />
          {preview && <div className="image-preview"><img src={preview} alt="Selected image preview" /><span>{dimensions ? `${dimensions.width} × ${dimensions.height} pixels` : 'Reading image…'}</span></div>}
          {mode === 'hide' && <label>Secret message<textarea rows="4" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tomorrow is CT." maxLength={3000} required />
            <small className={capacity !== null && messageBytes > capacity ? 'capacity over' : 'capacity'}>{capacity === null ? 'Choose an image to check capacity.' : `${messageBytes} / ${capacity} UTF-8 bytes available`}</small></label>}
          <label>Image passphrase<span className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" placeholder="At least 8 characters" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></span><small className="field-help">This is separate from your account password. Save it: it cannot be recovered.</small></label>
          {error && <p className="notice error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={pending || !file || password.length < 8 || (mode === 'hide' && (!messageBytes || (capacity !== null && messageBytes > capacity)))}>{pending ? 'Working on image…' : mode === 'hide' ? 'Hide message and save PNG' : 'Read hidden message'}</button>
        </form>
        {result?.type === 'hidden' && <div className="result-panel" role="status"><span className="eyebrow">Message hidden</span><h3>Your protected image is ready.</h3><p>The saved PNG holds {result.messageBytes} message bytes. Download it before changing or sharing the image.</p><a className="secondary-button" href={result.protectedImage} download={`protected-${result.imageId}.png`}>Download protected PNG ↓</a></div>}
        {result?.type === 'read' && <div className="result-panel" role="status"><span className="eyebrow">Message recovered</span><h3>Hidden message</h3><p className="revealed-message">{result.message}</p></div>}
      </section>
      <aside className="gallery-column">
        <div className="card gallery-card"><div className="gallery-heading"><span className="eyebrow">Your gallery</span><h2>Protected images</h2><p>Images saved under your account. You still need each image passphrase to read its message.</p></div>
          {galleryError && <p className="notice error" role="alert">{galleryError}</p>}
          {!galleryError && images.length === 0 && <p className="empty-gallery">Your protected images will appear here after you hide a message.</p>}
          <ul className="gallery-list">{images.map((image) => <li key={image.id}><div><strong>{image.width} × {image.height} image</strong><small>{new Date(image.created_at).toLocaleDateString()} · {image.message_bytes} message bytes</small></div><div className="gallery-actions"><button type="button" onClick={() => getStoredImage(image.id, true)}>Read</button><button type="button" onClick={() => getStoredImage(image.id)}>Download</button></div></li>)}</ul>
        </div>
        <div className="method-note"><span className="eyebrow">How it works</span><p>Small changes to Fourier coefficients carry encrypted bits. Your image stays recognizable; the saved file must stay in PNG format for reliable recovery.</p></div>
      </aside>
    </div>
  )
}

export default SecretWorkspace
