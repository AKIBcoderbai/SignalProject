import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import ImageUploader from './components/ImageUploader'
import './App.css'
function App() {
  const features = [
    "Interactive Radius/Cutoff Slider",
    "Ideal Filter",
    "Gaussian Filter",
    "Butterworth Filter",
    "Side-by-Side Comparison",
    "Heavy Blur Preset",
    "Mild Sharpen Preset",
    "Live 2D Frequency Spectrum",
    "High-Boost Sharpening",
    "Interactive Frequency Brush Masking",
  ];

  const [selectedFile, setSelectedFile] = useState(null);
  const [message, setMessage] = useState("");

  async function uploadImage() {
    if (!selectedFile) {
      setMessage("Please select an image first.");
      return;
    }

    const baseLink = "http://127.0.0.1:8000"

    const formData = new FormData();

    formData.append("file", selectedFile);

    const response = await fetch(baseLink + "/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    setMessage(
      `Received ${data.filename} (${data.size} bytes)`
    );
  }




  return (
    <div>
      <h1>Image Blur & Sharpen</h1>

      <p>
        Interactive image processing using 2D Fourier Transform techniques.
      </p>

      <h2>Project Features</h2>

      <ul>
        {features.map((feature, index) => (
          <li key={index}>{feature}</li>
        ))}
      </ul>

      <ImageUploader
        selectedFile={selectedFile}
        setSelectedFile={setSelectedFile}
        message={message}
        setMessage={setMessage}
      />
    </div>
  );
}

export default App;
