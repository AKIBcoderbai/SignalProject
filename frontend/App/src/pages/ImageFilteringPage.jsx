import { useEffect, useRef, useState } from 'react'
import { processImage } from '../api'
import ImageUploader from '../components/ImageUploader'

function SpectrumCanvas({ image, brush, onBrushChange }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const context = canvas.getContext('2d')
    const source = new Image()
    source.onload = () => {
      canvas.width = source.naturalWidth
      canvas.height = source.naturalHeight
      context.drawImage(source, 0, 0)
      if (!brush) return
      context.beginPath()
      context.arc(brush.x * canvas.width, brush.y * canvas.height, brush.radius * canvas.width, 0, Math.PI * 2)
      context.fillStyle = 'rgba(230, 93, 61, .2)'
      context.fill()
      context.strokeStyle = '#f2a27f'
      context.lineWidth = Math.max(2, canvas.width / 180)
      context.stroke()
    }
    source.src = image
  }, [image, brush])

  function paint(event) {
    if (!drawing && event.type !== 'pointerdown') return
    const bounds = canvasRef.current.getBoundingClientRect()
    onBrushChange({ x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)), y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)), radius: brush?.radius || 0.08 })
  }

  return <canvas ref={canvasRef} className="spectrum-canvas" onPointerDown={(event) => { setDrawing(true); paint(event); event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={paint} onPointerUp={() => setDrawing(false)} onPointerCancel={() => setDrawing(false)} aria-label="Interactive frequency spectrum brush" />
}

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',')
  const mime = arr[0].match(/:(.*?);/)[1]
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new File([u8arr], filename, { type: mime })
}

function ImageFilteringPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [filter, setFilter] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_image_filter_settings')
      return saved ? JSON.parse(saved).filter || 'Gaussian' : 'Gaussian'
    } catch { return 'Gaussian' }
  })
  const [cutoff, setCutoff] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_image_filter_settings')
      return saved ? JSON.parse(saved).cutoff || 12 : 12
    } catch { return 12 }
  })
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_image_filter_settings')
      return saved ? JSON.parse(saved).mode || 'blur' : 'blur'
    } catch { return 'blur' }
  })
  const [boost, setBoost] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_image_filter_settings')
      return saved ? JSON.parse(saved).boost || 1.5 : 1.5
    } catch { return 1.5 }
  })

  const [brush, setBrush] = useState(null)
  const [result, setResult] = useState(null)
  const [spectrumOpen, setSpectrumOpen] = useState(true)
  const [message, setMessage] = useState('Choose an image to begin.')
  const [processing, setProcessing] = useState(false)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  useEffect(() => {
    const savedImage = localStorage.getItem('ft_image_data')
    if (savedImage) {
      try {
        const file = dataURLtoFile(savedImage, 'saved_upload.png')
        setSelectedFile(file)
        setPreviewUrl(URL.createObjectURL(file))
        setMessage('Ready for live preview (restored from local storage).')
      } catch {
        localStorage.removeItem('ft_image_data')
      }
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('ft_image_filter_settings', JSON.stringify({ filter, cutoff, mode, boost }))
    } catch { /* ignore */ }
  }, [filter, cutoff, mode, boost])

  function handleFileChange(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file)
    setPreviewUrl(file ? URL.createObjectURL(file) : '')
    setResult(null)
    setBrush(null)
    setMessage(file ? 'Ready for live preview.' : 'Choose an image to begin.')

    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          localStorage.setItem('ft_image_data', e.target.result)
        } catch { /* ignore if quota exceeded */ }
      }
      reader.readAsDataURL(file)
    } else {
      localStorage.removeItem('ft_image_data')
    }
  }


  async function handleProcess(signal) {
    if (!selectedFile) return
    setProcessing(true)
    try {
      const payload = await processImage({ file: selectedFile, filter, cutoff, mode, boost, brush, signal })
      setResult(payload)
      setMessage('Live preview updated.')
    } catch (error) {
      if (error.name !== 'AbortError') {
        setMessage(error.message)
      }
    } finally {
      setProcessing(false)
    }
  }

  useEffect(() => {
    if (!selectedFile) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => handleProcess(controller.signal), 150)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [selectedFile, filter, cutoff, mode, boost, brush])

  function applyPreset(name) {
    const next = name === 'heavy' ? { filter: 'Gaussian', cutoff: 10, mode: 'blur', boost: 1.5 } : { filter: 'Butterworth', cutoff: 18, mode: 'sharpen', boost: 2.2 }
    setFilter(next.filter)
    setCutoff(next.cutoff)
    setMode(next.mode)
    setBoost(next.boost)
    setBrush(null)
  }

  return <main className="workspace studio-workspace">
    <header className="studio-topbar"><div><p className="eyebrow">Fourier workspace</p><h2>Shape the image in frequency space.</h2></div><div className="preset-group" aria-label="One-click presets"><button type="button" onClick={() => applyPreset('heavy')}>Heavy blur</button><button type="button" onClick={() => applyPreset('mild')}>Mild sharpen</button></div><div className="segmented-control" aria-label="Filter type"><span className="eyebrow">Profile</span>{['Ideal', 'Gaussian', 'Butterworth'].map((name) => <button key={name} className={filter === name ? 'active' : ''} type="button" onClick={() => setFilter(name)}>{name}</button>)}</div></header>
    <section className="studio-zones"><aside className="control-panel zone-sidebar"><ImageUploader selectedFile={selectedFile} setSelectedFile={handleFileChange} /><div className="mode-toggle"><button className={mode === 'blur' ? 'active' : ''} type="button" onClick={() => setMode('blur')}>Blur</button><button className={mode === 'sharpen' ? 'active' : ''} type="button" onClick={() => setMode('sharpen')}>High-boost sharpen</button></div><div className="control-block"><div className="label-row"><label htmlFor="cutoff">Cutoff radius D0</label><div className="number-input-wrap"><input id="cutoff-number" type="number" min="1" max="64" className="num-input" value={cutoff} onChange={(e) => setCutoff(Math.max(1, Math.min(64, Number(e.target.value) || 1)))} /><span className="unit-label">px</span></div></div><input id="cutoff" type="range" min="1" max="64" value={cutoff} onChange={(event) => setCutoff(Number(event.target.value))} /><div className="range-labels"><span>Fine (1 px)</span><span>Wide (64 px)</span></div></div>{mode === 'sharpen' && <div className="control-block"><div className="label-row"><label htmlFor="boost">Blend factor A</label><div className="number-input-wrap"><input id="boost-number" type="number" step="0.1" min="0.5" max="4.0" className="num-input" value={boost} onChange={(e) => setBoost(Math.max(0.5, Math.min(4, Number(e.target.value) || 0.5)))} /></div></div><input id="boost" type="range" min="0.5" max="4" step="0.1" value={boost} onChange={(event) => setBoost(Number(event.target.value))} /><div className="range-labels"><span>Subtle (0.5)</span><span>Strong (4.0)</span></div></div>}<button type="button" className="process-button" disabled={!selectedFile || processing} onClick={() => handleProcess()}>Apply Filter <span>⚡</span></button><p className={`message ${message.includes('failed') || message.includes('unavailable') ? 'error' : ''}`} role="status">{processing ? 'Updating live preview...' : message}</p></aside>
      <section className="display-area"><div className="comparison-heading"><div><p className="eyebrow">Main display</p><h3>Original / filtered comparison</h3></div><span className="panel-tag">{selectedFile ? 'LIVE' : 'WAITING'}</span></div><div className={`comparison-view ${processing ? 'loading' : ''}`}><figure><div className="image-frame">{previewUrl ? <img src={previewUrl} alt="Uploaded original" /> : <div className="empty-preview"><span className="crosshair">+</span><small>Upload a PNG or JPG to begin.</small></div>}</div><figcaption>Original</figcaption></figure><figure><div className="image-frame">{result?.processedImage ? <img src={result.processedImage} alt="Filtered result" /> : <div className="empty-preview"><span className="crosshair">+</span><small>Filtered output appears here.</small></div>}</div><figcaption>{mode === 'sharpen' ? 'High-boost output' : 'Filtered output'}</figcaption></figure></div><section className={`spectrum-panel ${spectrumOpen ? 'open' : ''}`}><button className="spectrum-toggle" type="button" onClick={() => setSpectrumOpen(!spectrumOpen)}><span><span className="eyebrow">Advanced view</span><strong>Live frequency spectrum</strong></span><span aria-hidden="true">{spectrumOpen ? '-' : '+'}</span></button>{spectrumOpen && <div className="spectrum-content">{result?.spectrumImage ? <><SpectrumCanvas image={result.spectrumImage} brush={brush} onBrushChange={setBrush} /><p className="spectrum-hint">Click or drag on the spectrum to place a circular frequency mask. Radius {Math.round((brush?.radius || 0.08) * 100)}%.</p></> : <p className="spectrum-empty">Process an image to explore its centered magnitude spectrum.</p>}</div>}</section></section></section>
  </main>

}

export default ImageFilteringPage