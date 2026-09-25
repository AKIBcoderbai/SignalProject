function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value ?? '—'}</strong></div>
}

function AnalysisPanel({ analysis }) {
  if (!analysis) return null
  const before = analysis.before || analysis.original
  const after = analysis.after || analysis.protected
  return <section className="analysis-panel" aria-label="Quality comparison">
    <div className="panel-heading"><div><span className="eyebrow">Quality report</span><h3>Before vs. after</h3></div><span className="local-pill">Measured</span></div>
    <div className="metric-grid"><Metric label="PSNR" value={analysis.metrics?.psnr == null ? 'Identical' : `${Number(analysis.metrics.psnr).toFixed(2)} dB`} /><Metric label="SSIM" value={analysis.metrics?.ssim == null ? null : Number(analysis.metrics.ssim).toFixed(4)} /><Metric label="Pixels changed" value={analysis.changedPixels} /></div>
    {(before || after || analysis.differenceImage) && <div className="analysis-images">
      {before && <figure><img src={before} alt="Original" /><figcaption>Original</figcaption></figure>}
      {after && <figure><img src={after} alt="With hidden data" /><figcaption>With hidden data</figcaption></figure>}
      {analysis.differenceImage && <figure><img src={analysis.differenceImage} alt="Difference (amplified 4×)" /><figcaption>Difference ×4</figcaption></figure>}
    </div>}
    {(analysis.spectrumImage || analysis.coefficientBit0) && <div className="visualization-grid">
      {analysis.spectrumImage && <figure><img src={analysis.spectrumImage} alt="Fourier magnitude spectrum" /><figcaption>{analysis.spectrumMetadata?.blockSize}×{analysis.spectrumMetadata?.blockSize} block spectrum ({analysis.spectrumMetadata?.channel})</figcaption></figure>}
      {analysis.coefficientBit0 && <figure><img src={analysis.coefficientBit0} alt="Block encoding bit 0" /><figcaption>Block with bit 0</figcaption></figure>}
      {analysis.coefficientBit1 && <figure><img src={analysis.coefficientBit1} alt="Block encoding bit 1" /><figcaption>Block with bit 1</figcaption></figure>}
    </div>}
  </section>
}

export default AnalysisPanel
