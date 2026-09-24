function ImageUploader({ file, onChange, inputId, mode }) {
  function select(event) {
    const nextFile = event.target.files?.[0] || null
    onChange(nextFile)
  }

  return (
    <div className="uploader">
      <div className="field-heading"><label htmlFor={inputId}>{mode === 'hide' ? 'Source image' : 'Protected or transformed image'}</label><span>PNG or JPG · max 10 MB</span></div>
      <input id={inputId} type="file" accept="image/png,image/jpeg" onChange={select} />
      <label htmlFor={inputId} className="drop-zone">
        <span className="upload-icon">↑</span>
        <strong>{file ? file.name : mode === 'hide' ? 'Choose an image' : 'Choose an image to read'}</strong>
        <small>{file ? `${(file.size / 1024).toFixed(0)} KB selected` : 'Click to browse your files'}</small>
      </label>
    </div>
  )
}

export default ImageUploader
