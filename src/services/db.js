const IS_DEV = process.env.NODE_ENV === 'development'

// ── Read ──────────────────────────────────────────────────
export async function loadDb() {
  const url = IS_DEV ? '/api/db' : '/db.json'
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(res.statusText)
    return await res.json()
  } catch {
    return { countries: {} }
  }
}

// ── Write (dev only) ──────────────────────────────────────
export async function saveDb(data) {
  if (!IS_DEV) return
  await fetch('/api/db', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// ── Upload photo (dev only) ───────────────────────────────
// blob: Blob (compressed JPEG from canvas.toBlob)
// Returns { src: '/fotos/XX/city/file.jpg' }
export async function uploadPhoto({ countryId, citySlug, blob }) {
  if (!IS_DEV) return null
  const form = new FormData()
  form.append('countryId', countryId)
  form.append('citySlug', citySlug)
  form.append('file', blob, 'photo.jpg')
  const res = await fetch('/api/photo', { method: 'POST', body: form })
  return res.json()
}

// ── Upload video (dev only) ───────────────────────────────
// file: File object (raw, no base64 encoding)
// Returns { src: '/videos/file.mp4' }
export async function uploadVideo({ countryId, citySlug, file }) {
  if (!IS_DEV) return null
  const form = new FormData()
  form.append('countryId', countryId)
  form.append('citySlug', citySlug)
  form.append('file', file, file.name)
  const res = await fetch('/api/video', { method: 'POST', body: form })
  return res.json()
}

// ── Delete photo file (dev only) ──────────────────────────
export async function deletePhoto(src) {
  if (!IS_DEV || !src) return
  await fetch('/api/photo/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ src }),
  })
}

// ── Helpers to navigate the DB tree safely ────────────────
export function ensureCountry(db, countryId) {
  if (!db.countries) db.countries = {}
  if (!db.countries[countryId]) db.countries[countryId] = { cities: [] }
  return db.countries[countryId]
}

export function findCity(db, countryId, citySlug, toSlugFn) {
  const cities = db.countries?.[countryId]?.cities || []
  return cities.find(c => toSlugFn(c.name) === citySlug) || null
}
