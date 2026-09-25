import { useState } from 'react'
import BrushEditor from './BrushEditor'
import ImageUploader from './ImageUploader'

function BrushWorkspace({ token, operation, onBack }) {
  const [file, setFile] = useState(null)
  const [error, setError] = useState('')
  const title = operation === 'blur' ? 'Image blur' : 'Image sharpening'

  function selectFile(nextFile) {
    if (nextFile && (!['image/png', 'image/jpeg'].includes(nextFile.type) || nextFile.size > 10 * 1024 * 1024)) {
      setFile(null)
      setError('Choose a PNG or JPEG image under 10 MB.')
      return
    }
    setError('')
    setFile(nextFile)
  }

  return <section className="feature-workspace">
    <button type="button" className="back-button" onClick={onBack}>← All features</button>
    <div className="feature-page-heading"><div><span className="eyebrow">Local signal lab</span><h2>{title}</h2></div><span className="local-pill">Independent workspace</span></div>
    <div className="card feature-upload-card"><ImageUploader file={file} onChange={selectFile} inputId={`${operation}-upload`} mode="hide" />{error && <p className="notice error" role="alert">{error}</p>}</div>
    <BrushEditor key={file?.name || operation} file={file} token={token} fixedOperation={operation} />
  </section>
}

export default BrushWorkspace