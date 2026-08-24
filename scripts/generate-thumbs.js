// Backfill script: generates missing thumbnails for photos already in R2.
// Only processes photos without thumbnailSrc that have an R2 URL.
// Updates public/db.json in-place.
//
// Usage: node scripts/generate-thumbs.js

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

async function run() {
  const dbPath = path.join(__dirname, '..', 'public', 'db.json')
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  let processed = 0, skipped = 0

  for (const country of Object.values(db.countries || {})) {
    for (const city of country.cities || []) {
      for (const item of city.media || []) {
        if (item.type !== 'photo') continue
        if (item.thumbnailSrc) { skipped++; continue }
        if (!item.src || !item.src.startsWith(R2_BASE + '/')) { skipped++; continue }

        const originalKey = item.src.slice(R2_BASE.length + 1)
        if (!originalKey.startsWith('fotos/')) { skipped++; continue }

        const thumbKey = originalKey.replace('fotos/', 'thumbs/')
        console.log(`Procesando ${originalKey}...`)

        const res = await fetch(item.src)
        if (!res.ok) { console.warn(`  Skip: HTTP ${res.status}`); skipped++; continue }

        const buffer = Buffer.from(await res.arrayBuffer())
        const thumbBuffer = await sharp(buffer)
          .resize({ width: 400, withoutEnlargement: true })
          .webp({ quality: 72 })
          .toBuffer()

        await s3.send(new PutObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: 'image/webp',
        }))

        item.thumbnailSrc = `${R2_BASE}/${thumbKey}`
        processed++
        console.log(`  ✓ ${item.thumbnailSrc}`)
      }
    }
  }

  if (processed > 0) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8')
    console.log(`\n✓ ${processed} thumbnails generados, db.json actualizado (${skipped} omitidas)`)
  } else {
    console.log(`\nNada que procesar (${skipped} fotos ya tenían thumbnail o no son de R2)`)
  }
}

run().catch(e => { console.error('Error:', e.message); process.exit(1) })
