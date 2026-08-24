import { useEffect, useState } from 'react'
import ImageUploader from './components/ImageUploader'
import './App.css'

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [filter, setFilter] = useState('Gaussian')
  const [cutoff, setCutoff] = useState(35)
  const [message, setMessage] = useState('Choose an image to begin.')

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('')
      return undefined
    }

    const objectUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [selectedFile])

  function handleProcess() {
    if (!selectedFile) {
      setMessage('Choose an image before processing.')
      return
    }

    // TODO: Send the image and settings to your Fourier/filter pipeline.
    // Instruction: call the backend, then replace the preview with its result.
    setMessage(`${filter} filter is selected at cutoff ${cutoff}. Processing logic is your task.`)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">FT</div>
        <div>
          <p className="eyebrow">Frequency studio</p>
          <h1>Image Blur &amp; Sharpen</h1>
        </div>
        <span className="status-dot">Local workspace</span>
      </header>

      <main className="workspace">
        <section className="intro">
          <p className="eyebrow">2D Fourier transform lab</p>
          <h2>Shape the image in frequency space.</h2>
          <p>Load an image, choose a filter, and inspect the result when your processing pipeline is connected.</p>
        </section>

        <section className="studio-grid">
          <aside className="control-panel">
            <ImageUploader selectedFile={selectedFile} setSelectedFile={setSelectedFile} />

            <div className="control-block">
              <label htmlFor="filter">Filter family</label>
              <select id="filter" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option>Gaussian</option>
                <option>Ideal</option>
                <option>Butterworth</option>
              </select>
            </div>

            <div className="control-block">
              <div className="label-row">
                <label htmlFor="cutoff">Cutoff radius</label>
                <output htmlFor="cutoff">{cutoff}</output>
              </div>
              <input id="cutoff" type="range" min="1" max="100" value={cutoff} onChange={(event) => setCutoff(event.target.value)} />
              <div className="range-labels"><span>Fine</span><span>Wide</span></div>
            </div>

            <button className="process-button" type="button" onClick={handleProcess}>
              Apply filter <span aria-hidden="true">-&gt;</span>
            </button>
            <p className="message" role="status">{message}</p>
          </aside>

          <section className="preview-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Input signal</p><h3>Image preview</h3></div>
              <span className="panel-tag">{selectedFile ? 'READY' : 'WAITING'}</span>
            </div>
            <div className="preview-stage">
              {previewUrl ? <img src={previewUrl} alt="Selected image preview" /> : <div className="empty-preview"><span className="crosshair">+</span><p>No image loaded</p><small>Your selected image will appear here.</small></div>}
            </div>
            <div className="result-strip">
              <div><span>Method</span><strong>{filter} low-pass</strong></div>
              <div><span>Cutoff</span><strong>{cutoff} px</strong></div>
              <div><span>Output</span><strong>Awaiting pipeline</strong></div>
            </div>
          </section>
        </section>

        <section className="todo-note">
          <span className="todo-index">01</span>
          <div><p className="eyebrow">Your implementation area</p><h3>Fourier transform, filters, and frequency spectrum</h3><p>Complete the TODO blocks in the backend. Keep the UI contract: return a processed image and, optionally, a spectrum image.</p></div>
        </section>
      </main>
    </div>
  )
}

export default App
