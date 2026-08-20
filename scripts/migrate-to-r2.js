// One-time migration: uploads all existing photos & videos to Cloudflare R2,
// converts JPG photos to WebP, then updates public/db.json and Supabase.
//
// Sources:
//   /local-media/{city-slug}/{file}  →  read from OneDrive (LOCAL_MEDIA_BASE)
//   /fotos/{CC}/{city}/{file}.jpg    →  read from public/fotos/
//
// Requires .env.local:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
//   R2_PUBLIC_URL  (or VUE_APP_R2_PUBLIC_URL)
//   SUPABASE_SERVICE_ROLE_KEY + SEED_EMAIL  (optional, to also update Supabase)
//
// Usage: node scripts/migrate-to-r2.js

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const fs   = require('fs')
const sharp = require('sharp')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { createClient } = require('@supabase/supabase-js')

// ── Config ────────────────────────────────────────────────
const R2_ACCOUNT_ID       = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID    = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY= process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME      = process.env.R2_BUCKET_NAME
const R2_PUBLIC_URL       = (process.env.R2_PUBLIC_URL || process.env.VUE_APP_R2_PUBLIC_URL || '').replace(/\/$/, '')

const LOCAL_MEDIA_BASE = 'C:\\Users\\carlo\\OneDrive\\Imágenes\\Aniversario 5'

const CITY_SLUG_TO_FOLDER = {
  'nueva-york':    'Nueva York',
  'san-francisco': 'San Francisco',
  'florida':       'Florida',
  'los-angeles':   'Los Angeles',
  'inari':         'Inari',
  'helsinki':      'Helsinki',
  'cancun':        'Cancun',
  'san-jose':      'San Jose',
  'oporto':        'Oporto',
  'dublin':        'Dublin',
  'cardiff':       'Cardiff',
  'liverpool':     'Liverpool',
  'paris':         'Paris',
  'roma':          'Roma',
  'milan':         'Milan',
  'zurich':        'Zurich',
  'viena':         'Viena',
  'bratislava':    'Bratislava',
  'estocolmo':     'Estocolmo',
  'lulea':         'Lulea',
  'budapest':      'Budapest',
  'ciudad-del-vaticano': 'Ciudad del Vaticano',
}

const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.m4v', '.mkv'])

// ── Validate ──────────────────────────────────────────────
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
  console.error('Faltan variables R2 en .env.local:')
  console.error('  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL')
  process.exit(1)
}

// ── S3/R2 client ──────────────────────────────────────────
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

async function uploadToR2(key, body, contentType, contentLength) {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(contentLength != null && { ContentLength: contentLength }),
  }))
  return `${R2_PUBLIC_URL}/${key}`
}

// ── Migrate a single src path ─────────────────────────────
// mapping:  localSrc → r2Url  (cache to avoid re-uploading the same file)
// uploaded: Set of R2 keys already sent this run
async function migrateSrc(src, countryId, mapping, uploaded) {
  if (!src || src.startsWith('http')) return null  // skip: already R2 or empty
  if (src in mapping) return mapping[src]           // already processed

  let localPath, key, contentType

  if (src.startsWith('/local-media/')) {
    // /local-media/{citySlug}/{filename}
    const [, , citySlug, ...rest] = src.split('/')
    const filename = rest.join('/')
    const folder   = CITY_SLUG_TO_FOLDER[citySlug]
    if (!folder) {
      console.warn(`  ⚠  slug desconocido: ${citySlug}`)
      return (mapping[src] = null)
    }
    localPath = path.join(LOCAL_MEDIA_BASE, folder, filename)
    const ext = path.extname(filename).toLowerCase()

    if (PHOTO_EXTS.has(ext)) {
      const stem = path.basename(filename, path.extname(filename))
      key         = `fotos/${countryId}/${citySlug}/${stem}.webp`
      contentType = 'image/webp'
    } else if (VIDEO_EXTS.has(ext)) {
      key         = `videos/${filename}`
      contentType = 'video/mp4'
    } else {
      return (mapping[src] = null)
    }

  } else if (src.startsWith('/fotos/')) {
    // /fotos/{CC}/{city}/{filename}.jpg  (cropped versions in public/fotos/)
    localPath = path.join(__dirname, '..', 'public', src)
    const ext  = path.extname(src)
    const stem = path.basename(src, ext)
    const dir  = path.dirname(src.slice(1)) // fotos/CC/city
    key         = `${dir}/${stem}.webp`
    contentType = 'image/webp'

  } else {
    return (mapping[src] = null)
  }

  if (!fs.existsSync(localPath)) {
    console.warn(`  ⚠  no encontrado: ${localPath}`)
    return (mapping[src] = null)
  }

  // If same R2 key already uploaded this run (e.g. shared original),
  // just return the URL without re-uploading
  if (uploaded.has(key)) {
    return (mapping[src] = `${R2_PUBLIC_URL}/${key}`)
  }

  try {
    let r2Url
    if (contentType === 'image/webp') {
      const buf = await sharp(localPath).webp({ quality: 85 }).toBuffer()
      r2Url = await uploadToR2(key, buf, 'image/webp')
    } else {
      const stat = fs.statSync(localPath)
      r2Url = await uploadToR2(key, fs.createReadStream(localPath), contentType, stat.size)
    }
    uploaded.add(key)
    mapping[src] = r2Url
    const sizeMB = (fs.statSync(localPath).size / 1024 / 1024).toFixed(1)
    console.log(`  ✓  [${sizeMB} MB] ${path.basename(localPath)} → ${key}`)
    return r2Url
  } catch (e) {
    console.error(`  ✗  ${localPath}: ${e.message}`)
    return (mapping[src] = null)
  }
}

// ── Update a single media item with mapped URLs ───────────
function applyMapping(item, mapping) {
  const out = { ...item }
  if (item.src        && mapping[item.src]         != null) out.src         = mapping[item.src]
  if (item.croppedSrc && mapping[item.croppedSrc]  != null) out.croppedSrc  = mapping[item.croppedSrc]
  if (item.thumbnailSrc && mapping[item.thumbnailSrc] != null) out.thumbnailSrc = mapping[item.thumbnailSrc]
  return out
}

// ── Main ──────────────────────────────────────────────────
async function run() {
  const dbPath = path.join(__dirname, '..', 'public', 'db.json')
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'))

  const mapping  = {}   // old local path → new R2 URL
  const uploaded = new Set()
  let totalFiles = 0, errors = 0

  // Walk the database
  for (const [countryId, countryData] of Object.entries(dbData.countries || {})) {
    for (const city of countryData.cities || []) {
      const cityHeader = `\n${countryId} / ${city.name}`
      let printedHeader = false

      for (let i = 0; i < city.media.length; i++) {
        const item = city.media[i]
        if (item.type !== 'photo' && item.type !== 'video') continue

        const srcs = [item.src, item.croppedSrc, item.thumbnailSrc].filter(s => s && !s.startsWith('http'))
        if (!srcs.length) continue

        if (!printedHeader) { console.log(cityHeader); printedHeader = true }

        for (const src of srcs) {
          totalFiles++
          const r2Url = await migrateSrc(src, countryId, mapping, uploaded)
          if (!r2Url) errors++
        }

        city.media[i] = applyMapping(item, mapping)
      }
    }
  }

  console.log(`\n──────────────────────────────────────────`)
  console.log(`Archivos subidos:  ${uploaded.size}`)
  console.log(`Errores:           ${errors}`)
  console.log(`Total referencias: ${totalFiles}`)

  // Write updated db.json
  fs.writeFileSync(dbPath, JSON.stringify(dbData, null, 2), 'utf8')
  console.log('✓ public/db.json actualizado con URLs de R2')

  // Update Supabase if credentials available
  const supabaseUrl = process.env.VUE_APP_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  const seedEmail   = process.env.SEED_EMAIL

  if (supabaseUrl && serviceKey && seedEmail) {
    console.log('\nActualizando Supabase...')
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) throw listErr
    const user = users.find(u => u.email === seedEmail)

    if (user) {
      const { error } = await admin
        .from('user_map_data')
        .upsert(
          { user_id: user.id, data: dbData, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
      if (error) throw error
      console.log(`✓ Supabase actualizado para ${seedEmail}`)
    } else {
      console.log(`  Aviso: ${seedEmail} no encontrado en Supabase. Ejecuta seed.js primero, luego re-ejecuta este script.`)
    }
  } else {
    console.log('\nAviso: Supabase no actualizado (faltan SUPABASE_SERVICE_ROLE_KEY o SEED_EMAIL).')
    console.log('  Ejecuta seed.js después de esta migración para propagar las URLs de R2 a Supabase.')
  }

  if (errors > 0) {
    console.log(`\n⚠  ${errors} archivo(s) no se pudieron migrar. Revisa los avisos arriba.`)
    console.log('   El script es idempotente: vuelve a ejecutarlo para reintentar los fallidos.')
  }

  console.log('\n✓ Migración completada.')
}

run().catch(e => {
  console.error('\nError fatal en migración:', e.message)
  process.exit(1)
})
