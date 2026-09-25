function ImageUploader({ file, onChange, inputId, mode }) {
  function select(event) {
    const nextFile = event.target.files?.[0] || null
    onChange(nextFile)
  }

  return (
    <div className="uploader">
      <div className="field-heading"><label htmlFor={inputId}>{mode === 'hide' ? 'Pick an image' : 'Upload the image to read'}</label><span>PNG or JPG · max 10 MB</span></div>
      <input id={inputId} type="file" accept="image/png,image/jpeg" onChange={select} />
      <label htmlFor={inputId} className="drop-zone">
        <span className="upload-icon">↑</span>
        <strong>{file ? file.name : mode === 'hide' ? 'Browse files…' : 'Browse files to read…'}</strong>
        <small>{file ? `${(file.size / 1024).toFixed(0)} KB selected` : 'Click here to choose a file'}</small>
      </label>
    </div>
  )
}

export default ImageUploader
