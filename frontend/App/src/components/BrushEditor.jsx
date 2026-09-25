import { useEffect, useRef, useState } from 'react'
import { applyBrushEdit } from '../api'

function BrushEditor({ file, token }) {
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const drawingRef = useRef(false)
  const [operation, setOperation] = useState('blur')
  const [mode, setMode] = useState('spatial')
  const [channel, setChannel] = useState('rgb')
  const [brushSize, setBrushSize] = useState(0.12)
  const [strength, setStrength] = useState(0.7)
  const [strokes, setStrokes] = useState([])
  const [preview, setPreview] = useState('')
  const [maskPreview, setMaskPreview] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  function drawCanvas() {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d')
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    context.fillStyle = operation === 'blur' ? 'rgba(27, 112, 128, .28)' : 'rgba(205, 104, 53, .28)'
    for (const stroke of strokes) {
      for (const point of stroke.points) {
        context.beginPath()
        context.arc(point[0] * canvas.width, point[1] * canvas.height, brushSize * Math.min(canvas.width, canvas.height) / 2, 0, Math.PI * 2)
        context.fill()
      }
    }
  }

  useEffect(() => {
    if (!file || !canvasRef.current) return undefined
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      const canvas = canvasRef.current
      const scale = Math.min(1, 900 / image.naturalWidth, 620 / image.naturalHeight)
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
      drawCanvas()
    }
    image.src = url
    return () => { image.onload = null; URL.revokeObjectURL(url) }
  }, [file])

  useEffect(() => { drawCanvas() }, [strokes, brushSize, operation])

  function pointFromEvent(event) {
    const bounds = canvasRef.current.getBoundingClientRect()
    return [Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))]
  }

  function startStroke(event) {
    if (!file) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    setStrokes((current) => [...current, { points: [pointFromEvent(event)] }])
  }

  function continueStroke(event) {
    if (!drawingRef.current) return
    const point = pointFromEvent(event)
    setStrokes((current) => {
      if (!current.length) return current
      const next = [...current]
      const last = next[next.length - 1]
      next[next.length - 1] = { points: [...last.points, point] }
      return next
    })
  }

  function endStroke() { drawingRef.current = false }

  async function previewEdit() {
    if (!file || !strokes.length) return
    setPending(true); setError('')
    try {
      const result = await applyBrushEdit({ image: file, operation, mode, brushSize, strength, strokes, channel, token })
      setPreview(result.image); setMaskPreview(result.mask)
    } catch (requestError) { setError(requestError.message) }
    finally { setPending(false) }
  }

  function clearStrokes() { setStrokes([]); setPreview(''); setMaskPreview(''); setError('') }

  if (!file) return null
  return <section className="card brush-editor" aria-label="Brush based local image editing">
    <div className="panel-heading"><div><span className="eyebrow">Local signal lab</span><h3>Brush blur or sharpen</h3></div><span className="local-pill">Non-destructive</span></div>
    <p className="panel-copy">Paint only the area to process. The feathered mask keeps the untouched image unchanged and blends the filter at the edge.</p>
    <div className="brush-controls">
      <div className="segment-control" role="group" aria-label="Choose brush operation">
        <button type="button" className={operation === 'blur' ? 'selected' : ''} onClick={() => setOperation('blur')}>Blur</button>
        <button type="button" className={operation === 'sharpen' ? 'selected' : ''} onClick={() => setOperation('sharpen')}>Sharpen</button>
      </div>
      <label>Processing path<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="spatial">Spatial convolution</option><option value="frequency">Manual FFT frequency domain</option></select></label>
      <label>Channels<select value={channel} onChange={(event) => setChannel(event.target.value)}><option value="rgb">RGB per channel</option><option value="luminance">Luminance only</option></select></label>
      <label>Brush size <output>{Math.round(brushSize * 100)}%</output><input type="range" min="0.03" max="0.45" step="0.01" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} /></label>
      <label>Strength <output>{Math.round(strength * 100)}%</output><input type="range" min="0.1" max="1" step="0.05" value={strength} onChange={(event) => setStrength(Number(event.target.value))} /></label>
    </div>
    <div className="brush-stage"><canvas ref={canvasRef} onPointerDown={startStroke} onPointerMove={continueStroke} onPointerUp={endStroke} onPointerCancel={endStroke} aria-label="Paint a local edit mask" /><span>Paint on the image</span></div>
    <div className="brush-actions"><button type="button" className="secondary-button" onClick={clearStrokes} disabled={!strokes.length}>Clear mask</button><button type="button" className="primary-button" onClick={previewEdit} disabled={pending || !strokes.length}>{pending ? 'Processing…' : 'Preview local edit'}</button></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    {preview && <div className="brush-result"><figure><img src={preview} alt={`${operation} result preview`} /><figcaption>{operation} preview ({mode})</figcaption></figure><figure><img src={maskPreview} alt="Soft brush mask preview" /><figcaption>Feathered mask</figcaption></figure><a className="secondary-button" href={preview} download={`signal-${operation}.png`}>Download edited PNG</a></div>}
  </section>
}

export default BrushEditor