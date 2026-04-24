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
// Returns { src: '/fotos/XX/city/file.jpg' }
export async function uploadPhoto({ countryId, citySlug, dataUrl }) {
  if (!IS_DEV) return null
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`
  const res = await fetch('/api/photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ countryId, citySlug, filename, dataUrl }),
  })
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
