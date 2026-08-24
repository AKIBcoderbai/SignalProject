

function ImageUploader({ selectedFile, setSelectedFile }) {
  return (
    <div className="uploader">
      <div className="label-row"><label htmlFor="image-file">Source image</label><span className="file-type">PNG / JPG</span></div>
      <input
        id="image-file"
        type="file"
        accept="image/*"
        onChange={(event) => {
          setSelectedFile(event.target.files[0] || null);
        }}
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