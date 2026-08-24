import { supabase } from '@/lib/supabase.js'

const IS_DEV = process.env.NODE_ENV === 'development'
const WORKER_URL = (process.env.VUE_APP_R2_WORKER_URL || '').replace(/\/$/, '')
const UPLOAD_SECRET = process.env.VUE_APP_R2_UPLOAD_SECRET

// ── Read ──────────────────────────────────────────────────
export async function loadDb() {
  if (IS_DEV) {
    const res = await fetch('/db.json')
    return res.json()
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { countries: {} }

  const { data, error } = await supabase
    .from('user_map_data')
    .select('data')
    .eq('user_id', user.id)
    .single()

  // PGRST116 = row not found (new user with no data yet)
  if (error && error.code !== 'PGRST116') {
    console.error('loadDb:', error.message)
  }
  return data?.data ?? { countries: {} }
}

// ── Write ─────────────────────────────────────────────────
export async function saveDb(mapData) {
  if (IS_DEV) {
    await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mapData),
    })
    return
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('user_map_data')
    .upsert(
      { user_id: user.id, data: mapData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (error) throw new Error(error.message)
}

// ── Upload photo ──────────────────────────────────────────
// originalFile: File (original image, HEIC already converted client-side)
// displayBlob / displayFallback: 1800px WebP and JPEG (generated client-side, used in prod only)
// thumbBlob / thumbFallback: 400px WebP and JPEG (generated client-side, used in prod only)
// Returns { src, displaySrc, displayFallbackSrc, thumbnailSrc, thumbnailFallbackSrc }
export async function uploadPhoto({ countryId, citySlug, originalFile, displayBlob, displayFallback, thumbBlob, thumbFallback }) {
  if (IS_DEV) {
    // Dev: server generates all versions with sharp — only send original
    const form = new FormData()
    form.append('countryId', countryId)
    form.append('citySlug', citySlug)
    form.append('file', originalFile)
    const res = await fetch('/api/photo', { method: 'POST', body: form })
    return res.json()
  }

  // Production: upload all 5 versions to Cloudflare Worker in parallel
  const baseName = `${Date.now()}_${Math.random().toString(36).slice(2)}`
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[originalFile.type] || 'jpg'

  const put = (key, body, type) =>
    fetch(`${WORKER_URL}/${key}`, {
      method: 'PUT',
      headers: { 'Content-Type': type, 'X-Upload-Secret': UPLOAD_SECRET },
      body,
    }).then(r => r.json()).then(d => d.src)

  const [src, displaySrc, displayFallbackSrc, thumbnailSrc, thumbnailFallbackSrc] = await Promise.all([
    put(`original/${baseName}.${ext}`, originalFile, originalFile.type),
    put(`display/${baseName}.webp`, displayBlob, 'image/webp'),
    put(`display/${baseName}.jpg`, displayFallback, 'image/jpeg'),
    put(`thumb/${baseName}.webp`, thumbBlob, 'image/webp'),
    put(`thumb/${baseName}.jpg`, thumbFallback, 'image/jpeg'),
  ])

  return { src, displaySrc, displayFallbackSrc, thumbnailSrc, thumbnailFallbackSrc }
}

// ── Upload video ──────────────────────────────────────────
// file: File object (raw, no conversion)
// Returns { src: 'https://r2.../videos/file.mp4' }
export async function uploadVideo({ countryId, citySlug, file }) {
  if (IS_DEV) {
    // Dev: POST multipart to local dev server → server uploads to R2
    const form = new FormData()
    form.append('countryId', countryId)
    form.append('citySlug', citySlug)
    form.append('file', file, file.name)
    const res = await fetch('/api/video', { method: 'POST', body: form })
    return res.json()
  }

  // Production: PUT directly to Cloudflare Worker
  const safeFilename = file.name.replace(/[^a-z0-9._-]/gi, '_')
  const key = `videos/${Date.now()}_${safeFilename}`
  const res = await fetch(`${WORKER_URL}/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'video/mp4', 'X-Upload-Secret': UPLOAD_SECRET },
    body: file,
  })
  return res.json()
}

// ── Delete photo ──────────────────────────────────────────
// src: full R2 URL or legacy /fotos/ path
export async function deletePhoto(src) {
  if (!src || src.startsWith('/local-media/')) return

  if (IS_DEV) {
    await fetch('/api/photo/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ src }),
    })
    return
  }

  // Production: DELETE via Cloudflare Worker
  if (!WORKER_URL || !src.startsWith('http')) return
  try {
    const key = new URL(src).pathname.slice(1) // remove leading /
    await fetch(`${WORKER_URL}/${key}`, {
      method: 'DELETE',
      headers: { 'X-Upload-Secret': UPLOAD_SECRET },
    })
  } catch { /* ignore delete errors */ }
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
