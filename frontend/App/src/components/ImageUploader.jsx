

function ImageUploader({ selectedFile, setSelectedFile }) {
  function handleChange(event) {
    const file = event.target.files[0] || null
    if (file && !['image/png', 'image/jpeg'].includes(file.type)) {
      event.target.value = ''
      setSelectedFile(null)
      return
    }
    setSelectedFile(file)
  }

  return (
    <div className="uploader">
      <div className="label-row"><label htmlFor="image-file">Source image</label><span className="file-type">PNG / JPG</span></div>
      <input
        id="image-file"
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleChange}
      />
      <label className="drop-zone" htmlFor="image-file">
        <span className="upload-icon">+</span>
        <strong>{selectedFile ? selectedFile.name : 'Choose an image'}</strong>
        <small>{selectedFile ? `${Math.round(selectedFile.size / 1024)} KB selected` : 'Click to browse your files'}</small>
      </label>
    </div>
  );
}

export default ImageUploader;
