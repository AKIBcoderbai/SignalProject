import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { processImage } from '../api'
import ImageUploader from '../components/ImageUploader'

function ImageFilteringPage({ spectrumMode = false }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [filter, setFilter] = useState('Gaussian')
  const [cutoff, setCutoff] = useState(35)
  const [result, setResult] = useState(null)
  const [view, setView] = useState('original')
  const [message, setMessage] = useState('Choose an image to begin.')
  const [processing, setProcessing] = useState(false)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  function handleFileChange(file) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(file); setPreviewUrl(file ? URL.createObjectURL(file) : '')
    setResult(null); setView('original'); setMessage(file ? 'Ready to process.' : 'Choose an image to begin.')
  }

  async function handleProcess() {
    if (!selectedFile) { setMessage('Choose an image before processing.'); return }
    setProcessing(true); setMessage('Computing Fourier transform…')
    try {
      const payload = await processImage({ file: selectedFile, filter, cutoff })
      setResult(payload); setView(spectrumMode ? 'spectrum' : 'processed'); setMessage('Processing complete.')
    } catch (error) { setMessage(error.message) } finally { setProcessing(false) }
  }

  const displayedImage = view === 'processed' ? result?.processedImage : view === 'spectrum' ? result?.spectrumImage : previewUrl
  const title = spectrumMode ? 'Reveal the frequency spectrum.' : 'Shape the image in frequency space.'
  return <main className="workspace feature-page"><Link className="breadcrumb" to="/">← All features</Link><section className="intro"><p className="eyebrow">{spectrumMode ? 'Frequency spectrum viewer' : 'Image low-pass filtering'}</p><h2>{title}</h2><p>{spectrumMode ? 'Upload an image and calculate its centered logarithmic magnitude spectrum.' : 'Load an image, choose a low-pass filter, then compare spatial output with its frequency spectrum.'}</p></section><section className="studio-grid"><aside className="control-panel"><ImageUploader selectedFile={selectedFile} setSelectedFile={handleFileChange} /><div className="control-block"><label htmlFor="filter">Filter family</label><select id="filter" value={filter} onChange={(event) => setFilter(event.target.value)} disabled={processing}><option>Gaussian</option><option>Ideal</option><option>Butterworth</option></select></div><div className="control-block"><div className="label-row"><label htmlFor="cutoff">Cutoff radius</label><output htmlFor="cutoff">{cutoff}</output></div><input id="cutoff" type="range" min="1" max="64" value={cutoff} onChange={(event) => setCutoff(Number(event.target.value))} disabled={processing} /><div className="range-labels"><span>Fine</span><span>Wide</span></div></div><button className="process-button" type="button" onClick={handleProcess} disabled={processing || !selectedFile}>{processing ? 'Processing…' : spectrumMode ? 'Generate spectrum' : 'Apply filter'} <span aria-hidden="true">→</span></button><p className={`message ${message.includes('failed') || message.includes('unavailable') ? 'error' : ''}`} role="status">{message}</p></aside><section className="preview-panel"><div className="panel-heading"><div><p className="eyebrow">Signal viewer</p><h3>{view === 'spectrum' ? 'Frequency spectrum' : view === 'processed' ? 'Filtered output' : 'Original image'}</h3></div><span className="panel-tag">{processing ? 'WORKING' : selectedFile ? 'READY' : 'WAITING'}</span></div>{result && <div className="view-tabs" role="tablist" aria-label="Image views">{['original', 'processed', 'spectrum'].map((name) => <button key={name} type="button" className={view === name ? 'active' : ''} onClick={() => setView(name)}>{name}</button>)}</div>}<div className={`preview-stage ${processing ? 'loading' : ''}`}>{displayedImage ? <img src={displayedImage} alt={`${view} image view`} /> : <div className="empty-preview"><span className="crosshair">+</span><p>No image loaded</p><small>Your selected image will appear here.</small></div>}</div><div className="result-strip"><div><span>Method</span><strong>{filter} low-pass</strong></div><div><span>Cutoff</span><strong>{cutoff} px</strong></div><div><span>Output</span><strong>{result ? `${result.metadata.width} × ${result.metadata.height} px` : 'Awaiting pipeline'}</strong></div></div></section></section></main>
}

export default ImageFilteringPage
