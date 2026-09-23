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
    throw new Error('Cannot reach the Python server. Start FastAPI on port 5000.')
  }
  if (!response.ok) throw new Error(await parseError(response))
  return response
}

export async function hideMessage({ image, message, password, token }) {
  const body = new FormData()
  body.append('image', image)
  body.append('message', message)
  body.append('password', password)
  return (await callApi('/api/secret/embed', token, { method: 'POST', body })).json()
}

export async function readMessage({ image, password, token }) {
  const body = new FormData()
  body.append('image', image)
  body.append('password', password)
  return (await callApi('/api/secret/extract', token, { method: 'POST', body })).json()
}

export async function listImages(token) {
  return (await callApi('/api/secret/images', token)).json()
}

export async function downloadImage(id, token) {
  return (await callApi(`/api/secret/images/${encodeURIComponent(id)}`, token)).blob()
}
