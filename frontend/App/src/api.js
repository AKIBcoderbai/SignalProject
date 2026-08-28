export async function processImage({ file, filter, cutoff, order = 2 }) {
  const form = new FormData()
  form.append('image', file)
  form.append('filter', filter.toLowerCase())
  form.append('cutoff', String(cutoff))
  form.append('order', String(order))

  let response
  try {
    response = await fetch('/api/process', { method: 'POST', body: form })
  } catch {
    throw new Error('Backend is unavailable. Start the Flask server and try again.')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || 'Image processing failed.')
  return payload
}
