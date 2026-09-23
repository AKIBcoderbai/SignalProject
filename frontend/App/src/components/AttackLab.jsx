import { useState } from 'react'
import { runAttack } from '../api'

function AttackLab({ image, password, token }) {
  const [attack, setAttack] = useState('png')
  const [quality, setQuality] = useState('55')
  const [scale, setScale] = useState('0.6')
  const [crop, setCrop] = useState('10')
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  async function submit(event) {
    event.preventDefault(); setPending(true); setError(''); setResult(null)
    try { setResult(await runAttack({ image, password, attack, quality, scale, crop, token })) }
    catch (requestError) { setError(requestError.message) }
    finally { setPending(false) }
  }
  if (!image) return null
  return <section className="card attack-lab">
    <div className="panel-heading"><div><span className="eyebrow">Attack lab</span><h3>Stress-test the protected PNG</h3></div></div>
    <p className="panel-copy">Compare lossless changes with JPEG, resizing and cropping. The protected PNG is never overwritten.</p>
    <form className="attack-controls" onSubmit={submit}>
      <label>Transformation<select value={attack} onChange={(event) => { setAttack(event.target.value); setResult(null) }}><option value="png">PNG re-save (control)</option><option value="red_shift">Change red channel (+20)</option><option value="jpeg">JPEG conversion</option><option value="resize">Resize</option><option value="crop">Crop</option><option value="screenshot">Screenshot-like</option></select></label>
      {attack === 'jpeg' && <label>Quality<input type="number" min="5" max="95" value={quality} onChange={(event) => setQuality(event.target.value)} /></label>}
      {attack === 'resize' && <label>Scale<input type="number" min="0.2" max="1" step="0.1" value={scale} onChange={(event) => setScale(event.target.value)} /></label>}
      {attack === 'crop' && <label>Crop (%)<input type="number" min="1" max="40" value={crop} onChange={(event) => setCrop(event.target.value)} /></label>}
      <button className="secondary-button" disabled={pending}>{pending ? 'Testing…' : 'Run attack'}</button>
    </form>
    {error && <p className="notice error">{error}</p>}
    {result && <div className="attack-result"><strong>{result.success ? 'Message recovered' : 'Extraction failed'}</strong><p>{result.success ? result.attack === 'png' ? 'PNG re-saving preserved the pixel values and hidden bits.' : 'This change left the blue channel carrying the bits intact.' : 'This transformation changed Fourier bits or their block positions. Authenticated decryption rejects even one corrupted bit.'}</p>{result.success && <p className="revealed-message">{result.message}</p>}{result.image && <img src={result.image} alt="Transformed image" />}</div>}
  </section>
}
export default AttackLab
