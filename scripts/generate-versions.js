// Backfill script: generates missing display/thumbnail versions for photos already in R2.
// Only processes photos without displaySrc or thumbnailSrc that have an R2 URL as src.
// Updates public/db.json in-place.
//
// Usage: node scripts/generate-versions.js

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const fs = require('fs')
const sharp = require('sharp')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')

const {
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME, R2_PUBLIC_URL, VUE_APP_R2_PUBLIC_URL,
} = process.env

const R2_BASE = (R2_PUBLIC_URL || VUE_APP_R2_PUBLIC_URL || '').replace(/\/$/, '')

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !R2_BASE) {
  console.error('Faltan variables R2 en .env / .env.local')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

async function upload(key, buf, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buf, ContentType: contentType }))
  return `${R2_BASE}/${key}`
}

async function run() {
  const dbPath = path.join(__dirname, '..', 'public', 'db.json')
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  let processed = 0, skipped = 0

  for (const country of Object.values(db.countries || {})) {
    for (const city of country.cities || []) {
      for (const item of city.media || []) {
        if (item.type !== 'photo') continue
        if (item.displaySrc && item.thumbnailSrc) { skipped++; continue }

        const sourceSrc = item.src
        if (!sourceSrc || !sourceSrc.startsWith(R2_BASE + '/')) { skipped++; continue }

        const baseName = path.basename(sourceSrc.slice(R2_BASE.length + 1), path.extname(sourceSrc))
        console.log(`Processing ${baseName}...`)

        const res = await fetch(sourceSrc)
        if (!res.ok) { console.warn(`  Skip: HTTP ${res.status}`); skipped++; continue }
        const buf = Buffer.from(await res.arrayBuffer())

        const resize = (px) => sharp(buf).resize({ width: px, height: px, fit: 'inside', withoutEnlargement: true })

        const [dWebp, dJpg, tWebp, tJpg] = await Promise.all([
          item.displaySrc         ? null : resize(1800).webp({ quality: 82 }).toBuffer(),
          item.displayFallbackSrc ? null : resize(1800).jpeg({ quality: 85 }).toBuffer(),
          item.thumbnailSrc       ? null : resize(400).webp({ quality: 75 }).toBuffer(),
          item.thumbnailFallbackSrc ? null : resize(400).jpeg({ quality: 80 }).toBuffer(),
        ])

        const [displaySrc, displayFallbackSrc, thumbnailSrc, thumbnailFallbackSrc] = await Promise.all([
          dWebp ? upload(`display/${baseName}.webp`, dWebp, 'image/webp') : null,
          dJpg  ? upload(`display/${baseName}.jpg`,  dJpg,  'image/jpeg') : null,
          tWebp ? upload(`thumb/${baseName}.webp`,   tWebp, 'image/webp') : null,
          tJpg  ? upload(`thumb/${baseName}.jpg`,    tJpg,  'image/jpeg') : null,
        ])

        if (displaySrc)         item.displaySrc = displaySrc
        if (displayFallbackSrc) item.displayFallbackSrc = displayFallbackSrc
        if (thumbnailSrc)       item.thumbnailSrc = thumbnailSrc
        if (thumbnailFallbackSrc) item.thumbnailFallbackSrc = thumbnailFallbackSrc

        processed++
        console.log(`  ✓ thumb: ${thumbnailSrc}`)
        console.log(`  ✓ display: ${displaySrc}`)
      }
    }
  }

  if (processed > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8')
    console.log(`\n✓ ${processed} fotos procesadas, db.json actualizado (${skipped} omitidas)`)
  } else {
    console.log(`\nNada que procesar (${skipped} omitidas)`)
  }
}

run().catch(e => { console.error('Error:', e.message); process.exit(1) })
