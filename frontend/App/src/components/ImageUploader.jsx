

function ImageUploader({ selectedFile, setSelectedFile, message, setMessage }) {
  async function uploadImage() {
    if (!selectedFile) {
      setMessage("Please select an image first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      setMessage(
        `Received ${data.filename} (${data.size} bytes)`
      );
    } catch (error) {
      setMessage("Failed to upload image.");
      console.error(error);
    }
  }

  return (
    <div>
      <h2>Upload Image</h2>

      <input
        type="file"
        accept="image/*"
        onChange={(event) => {
          setSelectedFile(event.target.files[0]);
        }}
      />

      {selectedFile && (
        <p>
          Selected: {selectedFile.name}
        </p>
      )}

      <button onClick={uploadImage}>
        Upload Image
      </button>

      {message && (
        <p>{message}</p>
      )}
    </div>
  );
}

export default ImageUploader;