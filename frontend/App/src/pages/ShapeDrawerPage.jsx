import { useEffect, useRef, useState } from 'react'
import { decomposeShape } from '../api'

function generatePresetPoints(type, numPoints = 128) {
  const points = []
  const cx = 250
  const cy = 250
  const r = 160
  for (let i = 0; i < numPoints; i++) {
    const t = (i / numPoints) * 2 * Math.PI
    let x = cx
    let y = cy
    if (type === 'star') {
      const R = (i % 2 === 0) ? r : r * 0.4
      const angle = (i / numPoints) * 2 * Math.PI - Math.PI / 2
      x = cx + R * Math.cos(angle)
      y = cy + R * Math.sin(angle)
    } else if (type === 'heart') {
      x = cx + 12 * 16 * Math.pow(Math.sin(t), 3)
      y = cy - 12 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))
    } else if (type === 'clef') {
      const rad = r * (0.3 + 0.6 * (t / (2 * Math.PI)))
      x = cx + rad * Math.cos(3 * t)
      y = cy + rad * Math.sin(3 * t)
    } else if (type === 'square') {
      const side = (i / numPoints) * 4
      if (side < 1) { x = cx - r + side * 2 * r; y = cy - r }
      else if (side < 2) { x = cx + r; y = cy - r + (side - 1) * 2 * r }
      else if (side < 3) { x = cx + r - (side - 2) * 2 * r; y = cy + r }
      else { x = cx - r; y = cy + r - (side - 3) * 2 * r }
    } else {
      // Circle default
      x = cx + r * Math.cos(t)
      y = cy + r * Math.sin(t)
    }
    points.push([x, y])
  }
  return points
}

export default function ShapeDrawerPage() {
  const [points, setPoints] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_shape_points')
      return saved ? JSON.parse(saved) : generatePresetPoints('heart')
    } catch { return generatePresetPoints('heart') }
  })
  const [harmonics, setHarmonics] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_shape_harmonics')
      return saved ? Number(saved) || 15 : 15
    } catch { return 15 }
  })
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentDraw, setCurrentDraw] = useState([])
  const [decomposition, setDecomposition] = useState(null)
  const [isPlaying, setIsPlaying] = useState(true)
  const [speed, setSpeed] = useState(() => {
    try {
      const saved = localStorage.getItem('ft_shape_speed')
      return saved ? Number(saved) || 1 : 1
    } catch { return 1 }
  })
  const [statusMessage, setStatusMessage] = useState('Draw a shape or choose a preset.')

  const drawCanvasRef = useRef(null)
  const epicycleCanvasRef = useRef(null)
  const waveCanvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const timeRef = useRef(0)
  const traceRef = useRef([])

  useEffect(() => {
    try {
      localStorage.setItem('ft_shape_points', JSON.stringify(points))
    } catch { /* ignore */ }
  }, [points])

  useEffect(() => {
    try {
      localStorage.setItem('ft_shape_harmonics', String(harmonics))
    } catch { /* ignore */ }
  }, [harmonics])

  useEffect(() => {
    try {
      localStorage.setItem('ft_shape_speed', String(speed))
    } catch { /* ignore */ }
  }, [speed])


  // Render raw drawing canvas
  useEffect(() => {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Background grid
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 1
    for (let x = 0; x < canvas.width; x += 25) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.height)
      ctx.stroke()
    }
    for (let y = 0; y < canvas.height; y += 25) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }

    const activePoints = isDrawing ? currentDraw : points
    if (activePoints && activePoints.length > 0) {
      ctx.beginPath()
      ctx.strokeStyle = '#38bdf8'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.moveTo(activePoints[0][0], activePoints[0][1])
      for (let i = 1; i < activePoints.length; i++) {
        ctx.lineTo(activePoints[i][0], activePoints[i][1])
      }
      if (!isDrawing && activePoints.length > 2) ctx.closePath()
      ctx.stroke()
    }
  }, [points, currentDraw, isDrawing])

  // Request Fourier decomposition from backend
  useEffect(() => {
    if (points.length < 3 || isDrawing) return
    let isCancelled = false
    setStatusMessage('Decomposing signal with Bluestein FFT...')

    decomposeShape({ points, harmonics })
      .then((res) => {
        if (!isCancelled) {
          setDecomposition(res)
          setStatusMessage(`Signal decomposed into ${res.harmonicsCount} Fourier harmonics.`)
        }
      })
      .catch((err) => {
        if (!isCancelled) {
          setStatusMessage(`Using local decomposition: ${err.message}`)
          // Fallback client-side DFT calculation
          const N = points.length
          const coeffs = []
          for (let k = 0; k < N; k++) {
            let re = 0, im = 0
            for (let n = 0; n < N; n++) {
              const phi = (2 * Math.PI * k * n) / N
              re += points[n][0] * Math.cos(phi) + points[n][1] * Math.sin(phi)
              im += -points[n][0] * Math.sin(phi) + points[n][1] * Math.cos(phi)
            }
            coeffs.push({ re: re / N, im: im / N, magnitude: Math.hypot(re, im) / N, phase: Math.atan2(im, re), freq: k <= N / 2 ? k : k - N })
          }
          coeffs.sort((a, b) => b.magnitude - a.magnitude)
          const kMax = Math.min(harmonics, N)
          setDecomposition({ totalPoints: N, harmonicsCount: kMax, harmonics: coeffs.slice(0, kMax) })
        }
      })

    return () => { isCancelled = true }
  }, [points, harmonics, isDrawing])

  // Epicycles animation loop
  useEffect(() => {
    if (!decomposition || !decomposition.harmonics || decomposition.harmonics.length === 0) return

    const canvas = epicycleCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const sortedHarmonics = [...decomposition.harmonics].sort((a, b) => b.magnitude - a.magnitude)

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // Background grid
      ctx.strokeStyle = '#0f172a'
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, canvas.width, canvas.height)

      let x = canvas.width / 2
      let y = canvas.height / 2

      // Draw DC / center shift
      if (sortedHarmonics[0] && sortedHarmonics[0].freq === 0) {
        // DC offset is mean position
        x = sortedHarmonics[0].re
        y = sortedHarmonics[0].im
      }

      ctx.save()
      for (let i = 0; i < sortedHarmonics.length; i++) {
        const h = sortedHarmonics[i]
        if (h.freq === 0) continue // Skip DC offset for revolving circle rendering
        const prevX = x
        const prevY = y
        const radius = h.magnitude
        const angle = h.freq * timeRef.current + h.phase

        x += radius * Math.cos(angle)
        y += radius * Math.sin(angle)

        // Draw epicycle circle
        ctx.beginPath()
        ctx.arc(prevX, prevY, radius, 0, 2 * Math.PI)
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)'
        ctx.lineWidth = 1.5
        ctx.stroke()

        // Draw rotating radius vector
        ctx.beginPath()
        ctx.moveTo(prevX, prevY)
        ctx.lineTo(x, y)
        ctx.strokeStyle = '#f43f5e'
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.restore()

      // Record point path
      traceRef.current.unshift({ x, y })
      if (traceRef.current.length > 500) traceRef.current.pop()

      // Draw reconstructed curve path
      if (traceRef.current.length > 1) {
        ctx.beginPath()
        ctx.moveTo(traceRef.current[0].x, traceRef.current[0].y)
        for (let i = 1; i < traceRef.current.length; i++) {
          ctx.lineTo(traceRef.current[i].x, traceRef.current[i].y)
        }
        ctx.strokeStyle = '#a855f7'
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.stroke()
      }

      // Draw active pen tip
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, 2 * Math.PI)
      ctx.fillStyle = '#ec4899'
      ctx.fill()

      if (isPlaying) {
        timeRef.current += (2 * Math.PI / 300) * speed
        if (timeRef.current > 2 * Math.PI) timeRef.current -= 2 * Math.PI
      }

      animFrameRef.current = requestAnimationFrame(animate)
    }

    animFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [decomposition, isPlaying, speed])

  // Waveform canvas rendering (x(t) and y(t))
  useEffect(() => {
    const canvas = waveCanvasRef.current
    if (!canvas || !points || points.length === 0) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Axes
    const midY1 = canvas.height * 0.28
    const midY2 = canvas.height * 0.75
    ctx.strokeStyle = '#334155'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, midY1); ctx.lineTo(canvas.width, midY1)
    ctx.moveTo(0, midY2); ctx.lineTo(canvas.width, midY2)
    ctx.stroke()

    ctx.fillStyle = '#94a3b8'
    ctx.font = '12px Inter, sans-serif'
    ctx.fillText('x(t) Signal Waveform', 10, 20)
    ctx.fillText('y(t) Signal Waveform', 10, midY1 + 30)

    const n = points.length
    // Draw x(t) wave
    ctx.beginPath()
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    for (let i = 0; i < n; i++) {
      const px = (i / (n - 1)) * canvas.width
      const val = (points[i][0] - 250) / 200
      const py = midY1 - val * 45
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.stroke()

    // Draw y(t) wave
    ctx.beginPath()
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    for (let i = 0; i < n; i++) {
      const px = (i / (n - 1)) * canvas.width
      const val = (points[i][1] - 250) / 200
      const py = midY2 - val * 45
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }, [points])

  // Canvas Mouse / Touch Handlers
  function startDraw(e) {
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setIsDrawing(true)
    setCurrentDraw([[x, y]])
    traceRef.current = []
    timeRef.current = 0
  }

  function moveDraw(e) {
    if (!isDrawing) return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setCurrentDraw((prev) => [...prev, [x, y]])
  }

  function endDraw() {
    if (!isDrawing) return
    setIsDrawing(false)
    if (currentDraw.length > 5) {
      setPoints(currentDraw)
    }
    setCurrentDraw([])
  }

  function loadPreset(name) {
    traceRef.current = []
    timeRef.current = 0
    setPoints(generatePresetPoints(name))
  }

  const maxHarmonics = Math.max(1, points.length)

  return (
    <main className="workspace shape-workspace">
      <header className="studio-topbar">
        <div>
          <p className="eyebrow">Interactive Fourier Decomposition</p>
          <h2>Shape Drawer & Fourier Epicycles</h2>
        </div>
        <div className="preset-group" aria-label="Preset shapes">
          <span className="eyebrow">Presets</span>
          <button type="button" onClick={() => loadPreset('heart')}>💖 Heart</button>
          <button type="button" onClick={() => loadPreset('star')}>⭐ Star</button>
          <button type="button" onClick={() => loadPreset('clef')}>🎼 Clef</button>
          <button type="button" onClick={() => loadPreset('square')}>🔲 Square</button>
          <button type="button" onClick={() => loadPreset('circle')}>⭕ Circle</button>
        </div>
      </header>

      <section className="studio-zones">
        <aside className="control-panel zone-sidebar">
          <h3>Harmonics Control</h3>
          <p className="control-desc">Select the number of Fourier harmonics K to reconstruct your drawn shape.</p>

          <div className="control-block">
            <div className="label-row">
              <label htmlFor="harmonics-num">Harmonics K</label>
              <div className="number-input-wrap">
                <input
                  id="harmonics-num"
                  type="number"
                  min="1"
                  max={maxHarmonics}
                  className="num-input"
                  value={harmonics}
                  onChange={(e) => setHarmonics(Math.max(1, Math.min(maxHarmonics, Number(e.target.value) || 1)))}
                />
              </div>
            </div>
            <input
              id="harmonics-range"
              type="range"
              min="1"
              max={Math.min(100, maxHarmonics)}
              value={harmonics}
              onChange={(e) => setHarmonics(Number(e.target.value))}
            />
            <div className="range-labels">
              <span>Coarse (1)</span>
              <span>Detailed ({Math.min(100, maxHarmonics)})</span>
            </div>
          </div>

          <div className="control-block">
            <div className="label-row">
              <label htmlFor="speed-range">Animation Speed</label>
              <span className="unit-label">{speed.toFixed(1)}x</span>
            </div>
            <input
              id="speed-range"
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
          </div>

          <div className="mode-toggle">
            <button
              type="button"
              className={isPlaying ? 'active' : ''}
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? 'Pause Epicycles' : 'Play Epicycles'}
            </button>
            <button
              type="button"
              onClick={() => {
                traceRef.current = []
                timeRef.current = 0
              }}
            >
              Reset Trace
            </button>
          </div>

          <p className="message status-box">{statusMessage}</p>
        </aside>

        <section className="display-area shape-display">
          <div className="canvas-grid-row">
            <div className="canvas-card">
              <div className="card-header">
                <p className="eyebrow">Input Canvas</p>
                <h4>Draw Freehand Shape with Mouse</h4>
              </div>
              <canvas
                ref={drawCanvasRef}
                width={500}
                height={500}
                className="drawing-canvas"
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
              />
              <p className="canvas-hint">Click and drag inside this canvas to draw any shape.</p>
            </div>

            <div className="canvas-card">
              <div className="card-header">
                <p className="eyebrow">Fourier Reconstruction</p>
                <h4>Live Rotating Epicycles</h4>
              </div>
              <canvas
                ref={epicycleCanvasRef}
                width={500}
                height={500}
                className="epicycle-canvas"
              />
              <p className="canvas-hint">Purple path = Fourier sum of rotating epicycle vectors.</p>
            </div>
          </div>

          <div className="wave-card">
            <div className="card-header">
              <p className="eyebrow">1D Component Signals</p>
              <h4>Parametric Waveforms x(t) and y(t)</h4>
            </div>
            <canvas
              ref={waveCanvasRef}
              width={1020}
              height={140}
              className="wave-canvas"
            />
          </div>
        </section>

      </section>
    </main>
  )
}
