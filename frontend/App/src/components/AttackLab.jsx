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
    <div className="panel-heading"><div><span className="eyebrow">Robustness test</span><h3>See if the message survives</h3></div></div>
    <p className="panel-copy">Try converting to JPEG, resizing, or cropping the image and check whether the hidden message can still be recovered. The original PNG is never overwritten.</p>
    <form className="attack-controls" onSubmit={submit}>
      <label>Transformation<select value={attack} onChange={(event) => { setAttack(event.target.value); setResult(null) }}><option value="png">PNG re-save (baseline)</option><option value="red_shift">Shift red channel (+20)</option><option value="jpeg">Convert to JPEG</option><option value="resize">Resize</option><option value="crop">Crop</option><option value="screenshot">Simulate screenshot</option></select></label>
      {attack === 'jpeg' && <label>Quality<input type="number" min="5" max="95" value={quality} onChange={(event) => setQuality(event.target.value)} /></label>}
      {attack === 'resize' && <label>Scale<input type="number" min="0.2" max="1" step="0.1" value={scale} onChange={(event) => setScale(event.target.value)} /></label>}
      {attack === 'crop' && <label>Crop (%)<input type="number" min="1" max="40" value={crop} onChange={(event) => setCrop(event.target.value)} /></label>}
      <button className="secondary-button" disabled={pending}>{pending ? 'Running…' : 'Run test'}</button>
    </form>
    {error && <p className="notice error">{error}</p>}
    {result && <div className="attack-result">
      <strong>{result.success ? 'Message recovered ✓' : 'Could not recover the message'}</strong>
      <p>{result.success ? result.recovery?.format === 'v3'
        ? `Robust recovery found a tile and corrected ${result.recovery.correctedBytes} byte(s). Detected scale: ${Number(result.recovery.scale).toFixed(3)}×, pilot match: ${result.recovery.pilotScore}/128.`
        : `The ${result.recovery?.format || 'original'} encoding survived this transformation.`
        : 'The hidden data did not survive this transformation. Try a larger image, shorter message, or a less aggressive setting.'}</p>
      {result.success && <p className="revealed-message">{result.message}</p>}
      {result.image && <a className="secondary-button" href={result.image} download={`test-${result.attack}.${result.image.startsWith('data:image/jpeg') ? 'jpg' : 'png'}`}>Download transformed image</a>}
      {result.image && <img src={result.image} alt="Transformed image" />}
    </div>}
  </section>
}
export default AttackLab
