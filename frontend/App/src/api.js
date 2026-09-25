const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')

async function parseError(response) {
  const payload = await response.json().catch(() => ({}))
  const detail = payload.detail || payload.error
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join('; ')
  return typeof detail === 'string' ? detail : `Request failed (${response.status}).`
}

async function callApi(path, token, options = {}) {
  if (!token) throw new Error('Your sign-in has expired. Please sign in again.')
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${token}`, ...options.headers },
    })
  } catch {
    throw new Error(
    'The browser could not complete the API request. Check the API URL, network, and CORS settings; FastAPI may still be running.'
  )
  }
  if (!response.ok) throw new Error(await parseError(response))
  return response
}

async function callPublicApi(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, options)
  } catch {
throw new Error(
    'The browser could not complete the API request. Check the API URL, network, and CORS settings; FastAPI may still be running.'
  )  }
  if (!response.ok) throw new Error(await parseError(response))
  return response
}

export async function hideMessage({ image, message, password, robust, token }) {
  const body = new FormData()
  body.append('image', image)
  body.append('message', message)
  body.append('password', password)
  body.append('robust', robust ? 'true' : 'false')
  return (await callApi('/api/secret/embed', token, { method: 'POST', body })).json()
}

export async function readMessage({ image, password, mode = 'auto', token }) {
  const body = new FormData()
  body.append('image', image)
  body.append('password', password)
  body.append('mode', mode)

  const request = token
    ? callApi('/api/secret/extract', token, { method: 'POST', body })
    : callPublicApi('/api/secret/extract', { method: 'POST', body })

  return (await request).json()
}

export async function analyzeImages({ original, protectedImage, token }) {
  const body = new FormData()
  body.append('original', original)
  body.append('protected', protectedImage)
  return (await callApi('/api/secret/analyze', token, { method: 'POST', body })).json()
}

export async function runAttack({ image, password, attack, quality, scale, crop, token }) {
  const body = new FormData()
  body.append('image', image)
  body.append('password', password)
  body.append('attack', attack)
  if (attack === 'jpeg' && quality) body.append('quality', quality)
  if (attack === 'screenshot' && quality) body.append('quality', quality)
  if (attack === 'resize' && scale) body.append('scale', scale)
  if (attack === 'crop' && crop) {
    const fraction = Number(crop) / 100
    body.append('crop', `${fraction},${fraction},${1 - fraction},${1 - fraction}`)
  }
  return (await callApi('/api/secret/attack', token, { method: 'POST', body })).json()
}

export async function listImages(token) {
  return (await callApi('/api/secret/images', token)).json()
}

export async function downloadImage(id, token) {
  return (await callApi(`/api/secret/images/${encodeURIComponent(id)}`, token)).blob()
}

export async function applyBrushEdit({ image, operation, mode, brushSize, strength, strokes, channel, token }) {
  const body = new FormData()
  body.append('image', image)
  body.append('operation', operation)
  body.append('mode', mode)
  body.append('brush_size', brushSize)
  body.append('strength', strength)
  body.append('strokes', JSON.stringify(strokes))
  body.append('channel', channel)
  return (await callApi('/api/image-edit/brush', token, { method: 'POST', body })).json()
}