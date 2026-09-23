function ImageUploader({ file, onChange, inputId, mode }) {
  function select(event) {
    const nextFile = event.target.files?.[0] || null
    onChange(nextFile)
  }

  return (
    <div className="uploader">
      <div className="field-heading"><label htmlFor={inputId}>{mode === 'hide' ? 'Source image' : mode === 'guest' ? 'Protected PNG for guest extraction' : 'Protected PNG'}</label><span>{mode === 'hide' ? 'PNG or JPG' : 'PNG only'} · max 10 MB</span></div>
      <input id={inputId} type="file" accept={mode === 'hide' ? 'image/png,image/jpeg' : 'image/png'} onChange={select} />
      <label htmlFor={inputId} className="drop-zone">
        <span className="upload-icon">↑</span>
        <strong>{file ? file.name : mode === 'hide' ? 'Choose an image' : 'Choose a protected PNG'}</strong>
        <small>{file ? `${(file.size / 1024).toFixed(0)} KB selected` : 'Click to browse your files'}</small>
      </label>
    </div>
  )
}

export default ImageUploader
