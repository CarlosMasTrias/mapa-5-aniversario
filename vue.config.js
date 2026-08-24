const { defineConfig } = require('@vue/cli-service')
const path = require('path')
const fs = require('fs')
const os = require('os')
const multer = require('multer')
const sharp = require('sharp')
const heicDecode = require('heic-decode')
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3')

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
const PHOTO_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.avi', '.m4v', '.mkv'])

// ── Cloudflare R2 (S3-compatible) ────────────────────────
let _s3 = null
function getS3() {
  if (!_s3) {
    const id = process.env.R2_ACCOUNT_ID
    if (!id || id === 'your-cloudflare-account-id') {
      throw new Error('R2_ACCOUNT_ID no configurado. Añádelo a .env.local')
    }
    _s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${id}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })
  }
  return _s3
}

async function uploadToR2(key, body, contentType, contentLength) {
  await getS3().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
    ...(contentLength != null && { ContentLength: contentLength }),
  }))
  return `${process.env.R2_PUBLIC_URL || process.env.VUE_APP_R2_PUBLIC_URL}/${key}`
}

const MIME_TO_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif',
}
const IMAGE_EXTS_RE = /\.(jpe?g|png|webp|gif|heic|heif|tiff?|bmp|avif)$/i

function mimeToExt(mime, originalname) {
  if (MIME_TO_EXT[mime]) return MIME_TO_EXT[mime]
  // Browsers on Windows often send HEIC with empty/octet-stream MIME — fall back to filename
  const fromName = path.extname(originalname || '').slice(1).toLowerCase()
  return fromName || 'jpg'
}

// ── Photo upload: memory → R2 (receives original from browser, sharp generates versions) ─────
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  // Accept by MIME type OR by filename extension (Chrome/Windows sends HEIC with no MIME type)
  fileFilter(_req, file, cb) {
    cb(null, file.mimetype.startsWith('image/') || IMAGE_EXTS_RE.test(file.originalname))
  },
})

// ── Video upload: temp disk → R2 ────────────────────────
const videoUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) { cb(null, os.tmpdir()) },
    filename(_req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname.replace(/[^a-z0-9._-]/gi, '_')}`)
    },
  }),
  limits: { fileSize: 4 * 1024 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) { cb(null, file.mimetype.startsWith('video/')) },
})

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) }
      catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    setupMiddlewares(middlewares, devServer) {
      const app = devServer.app

      // POST /api/photo – receives original image from browser, generates 5 versions with sharp
      // Multipart fields: countryId, citySlug, file (any image/*, including HEIC/HEIF — sharp decodes natively)
      // Returns { src, displaySrc, displayFallbackSrc, thumbnailSrc, thumbnailFallbackSrc }
      app.post('/api/photo', (req, res) => {
        photoUpload.single('file')(req, res, async err => {
          if (err) return res.status(400).json({ error: err.message })
          if (!req.file) return res.status(400).json({ error: 'no file' })
          try {
            const originalBuf = req.file.buffer
            const ext         = mimeToExt(req.file.mimetype, req.file.originalname)
            const baseName    = `${Date.now()}_${Math.random().toString(36).slice(2)}`

            // HEIC/HEIF: Sharp's prebuilt Windows binary lacks the H.265 decoder.
            // Decode with heic-decode (WASM libheif) → raw RGBA → re-encode to JPEG for sharp.
            const isHeic = ext === 'heic' || ext === 'heif'
            let sharpBuf = originalBuf
            if (isHeic) {
              const { data, width, height } = await heicDecode({ buffer: originalBuf })
              sharpBuf = await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } })
                .jpeg({ quality: 95 })
                .toBuffer()
            }

            const resize = (px) => sharp(sharpBuf).resize({ width: px, height: px, fit: 'inside', withoutEnlargement: true })

            const [displayWebpBuf, displayJpgBuf, thumbWebpBuf, thumbJpgBuf] = await Promise.all([
              resize(1800).webp({ quality: 82 }).toBuffer(),
              resize(1800).jpeg({ quality: 85 }).toBuffer(),
              resize(400).webp({ quality: 75 }).toBuffer(),
              resize(400).jpeg({ quality: 80 }).toBuffer(),
            ])

            const [src, displaySrc, displayFallbackSrc, thumbnailSrc, thumbnailFallbackSrc] = await Promise.all([
              uploadToR2(`original/${baseName}.${ext}`, originalBuf, req.file.mimetype || `image/${ext}`),
              uploadToR2(`display/${baseName}.webp`, displayWebpBuf, 'image/webp'),
              uploadToR2(`display/${baseName}.jpg`, displayJpgBuf, 'image/jpeg'),
              uploadToR2(`thumb/${baseName}.webp`, thumbWebpBuf, 'image/webp'),
              uploadToR2(`thumb/${baseName}.jpg`, thumbJpgBuf, 'image/jpeg'),
            ])

            res.json({ src, displaySrc, displayFallbackSrc, thumbnailSrc, thumbnailFallbackSrc })
          } catch (e) { res.status(500).json({ error: e.message }) }
        })
      })

      // POST /api/video – streams video to temp disk then uploads to R2
      // Multipart fields: countryId, citySlug, file (video/*)
      app.post('/api/video', (req, res) => {
        videoUpload.single('file')(req, res, async err => {
          if (err) return res.status(400).json({ error: err.message })
          if (!req.file) return res.status(400).json({ error: 'no file' })
          const tmpPath = req.file.path
          try {
            const key = `videos/${req.file.filename}`
            const src = await uploadToR2(
              key,
              fs.createReadStream(tmpPath),
              req.file.mimetype || 'video/mp4',
              req.file.size
            )
            res.json({ src })
          } catch (e) {
            res.status(500).json({ error: e.message })
          } finally {
            try { fs.unlinkSync(tmpPath) } catch {}
          }
        })
      })

      // GET /api/local-media/:citySlug – list browser-displayable files from OneDrive
      app.get('/api/local-media/:citySlug', (req, res) => {
        const folder = CITY_SLUG_TO_FOLDER[req.params.citySlug]
        if (!folder) return res.json([])
        const dir = path.join(LOCAL_MEDIA_BASE, folder)
        let names
        try { names = fs.readdirSync(dir) } catch { return res.json([]) }
        const result = []
        for (const f of names.sort()) {
          const ext = path.extname(f).toLowerCase()
          if (PHOTO_EXTS.has(ext))
            result.push({ type: 'photo', src: `/local-media/${req.params.citySlug}/${encodeURIComponent(f)}` })
          else if (VIDEO_EXTS.has(ext))
            result.push({ type: 'video', src: `/local-media/${req.params.citySlug}/${encodeURIComponent(f)}` })
        }
        res.json(result)
      })

      // GET /local-media/:citySlug/:filename – stream a file from OneDrive
      app.get('/local-media/:citySlug/:filename', (req, res) => {
        const folder = CITY_SLUG_TO_FOLDER[req.params.citySlug]
        if (!folder) return res.status(404).end()
        const filename = req.params.filename
        if (filename.includes('..') || /[/\\]/.test(filename)) return res.status(400).end()
        const filePath = path.join(LOCAL_MEDIA_BASE, folder, filename)
        res.sendFile(filePath)
      })

      // POST /api/db – save db.json to disk (dev only)
      app.post('/api/db', async (req, res) => {
        try {
          const data = await readBody(req)
          const dbPath = path.join(__dirname, 'public', 'db.json')
          fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8')
          res.json({ ok: true })
        } catch (e) { res.status(500).json({ error: e.message }) }
      })

      // POST /api/photo/delete – delete a photo from R2 (or legacy local path)
      // Body: { src }
      app.post('/api/photo/delete', async (req, res) => {
        try {
          const { src } = await readBody(req)
          if (!src) return res.status(400).json({ error: 'invalid path' })

          const r2Base = (process.env.R2_PUBLIC_URL || process.env.VUE_APP_R2_PUBLIC_URL || '').replace(/\/$/, '')
          if (r2Base && src.startsWith(r2Base + '/')) {
            const key = src.slice(r2Base.length + 1)
            await getS3().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
          } else if (src.startsWith('/fotos/') && !src.includes('..')) {
            // Legacy: local file left over before R2 migration
            const filePath = path.join(__dirname, 'public', src)
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          }
          res.json({ ok: true })
        } catch (e) { res.status(500).json({ error: e.message }) }
      })

      return middlewares
    },
  },
})
