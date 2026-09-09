import { Route, Routes } from 'react-router-dom'
import AppHeader from './components/AppHeader'
import ImageFilteringPage from './pages/ImageFilteringPage'
import NotFoundPage from './pages/NotFoundPage'
import './App.css'

function App() {
  return <div className="app-shell"><AppHeader /><Routes><Route path="/" element={<ImageFilteringPage />} /><Route path="/features/image-filtering" element={<ImageFilteringPage />} /><Route path="/features/spectrum-viewer" element={<ImageFilteringPage />} /><Route path="*" element={<NotFoundPage />} /></Routes></div>
}

export default App
