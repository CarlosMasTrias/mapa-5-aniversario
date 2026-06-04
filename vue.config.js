const { defineConfig } = require('@vue/cli-service')
const path = require('path')
const fs = require('fs')
const multer = require('multer')

const DB_PATH    = path.join(__dirname, 'public', 'db.json')
const FOTOS_DIR  = path.join(__dirname, 'public', 'fotos')
const VIDEOS_DIR = path.join(__dirname, 'public', 'videos')

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

// multer: fields sent before the file field are already in req.body by the
// time the destination callback fires, so countryId/citySlug are available.
const photoUpload = multer({
  storage: multer.diskStorage({
    destination(req, _file, cb) {
      const safeCountry = (req.body.countryId || '').replace(/[^A-Z]/g, '')
      const safeSlug    = (req.body.citySlug   || '').replace(/[^a-z0-9-]/g, '')
      const dir = path.join(FOTOS_DIR, safeCountry, safeSlug)
      fs.mkdirSync(dir, { recursive: true })
      cb(null, dir)
    },
    filename(_req, _file, cb) {
      cb(null, `${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`)
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter(_req, file, cb) { cb(null, file.mimetype.startsWith('image/')) },
})

const videoUpload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, cb) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true })
      cb(null, VIDEOS_DIR)
    },
    filename(_req, file, cb) {
      cb(null, `${Date.now()}_${file.originalname.replace(/[^a-z0-9._-]/gi, '')}`)
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

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const init = { countries: {} }
    fs.writeFileSync(DB_PATH, JSON.stringify(init, null, 2), 'utf8')
    return init
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8')
}

module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    // Evita que webpack-dev-server recargue la página cuando se escribe db.json
    // o cuando se suben nuevas fotos/vídeos a public/fotos y public/videos
    static: {
      watch: {
        ignored: [
          path.join(__dirname, 'public', 'db.json'),
          path.join(__dirname, 'public', 'fotos', '**'),
          path.join(__dirname, 'public', 'videos', '**'),
        ],
      },
    },
    setupMiddlewares(middlewares, devServer) {
      const app = devServer.app

      // GET /api/db  ─ read full database
      app.get('/api/db', (_req, res) => {
        try { res.json(readDb()) }
        catch (e) { res.status(500).json({ error: e.message }) }
      })

      // POST /api/db  ─ overwrite full database (metadata only, no binary)
      app.post('/api/db', async (req, res) => {
        try {
          const body = await readBody(req)
          writeDb(body)
          res.json({ ok: true })
        } catch (e) { res.status(500).json({ error: e.message }) }
      })

      // POST /api/photo  ─ stream a compressed photo to public/fotos/
      // Multipart fields: countryId, citySlug, file (image/jpeg)
      app.post('/api/photo', (req, res) => {
        photoUpload.single('file')(req, res, err => {
          if (err) return res.status(400).json({ error: err.message })
          if (!req.file) return res.status(400).json({ error: 'no file' })
          const safeCountry = (req.body.countryId || '').replace(/[^A-Z]/g, '')
          const safeSlug    = (req.body.citySlug   || '').replace(/[^a-z0-9-]/g, '')
          res.json({ src: `/fotos/${safeCountry}/${safeSlug}/${req.file.filename}` })
        })
      })

      // POST /api/video  ─ stream a video file to public/videos/
      // Multipart fields: countryId, citySlug, file (video/*)
      app.post('/api/video', (req, res) => {
        videoUpload.single('file')(req, res, err => {
          if (err) return res.status(400).json({ error: err.message })
          if (!req.file) return res.status(400).json({ error: 'no file' })
          res.json({ src: `/videos/${req.file.filename}` })
        })
      })

      // GET /api/local-media/:citySlug  ─ list browser-displayable files from OneDrive
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

      // GET /local-media/:citySlug/:filename  ─ stream a file from the OneDrive folder
      app.get('/local-media/:citySlug/:filename', (req, res) => {
        const folder = CITY_SLUG_TO_FOLDER[req.params.citySlug]
        if (!folder) return res.status(404).end()
        // Express already URL-decodes route params; no second decode needed
        const filename = req.params.filename
        if (filename.includes('..') || /[/\\]/.test(filename)) return res.status(400).end()
        const filePath = path.join(LOCAL_MEDIA_BASE, folder, filename)
        res.sendFile(filePath)
      })

      // POST /api/photo/delete  ─ remove a photo file from disk
      // Body: { src }
      app.post('/api/photo/delete', async (req, res) => {
        try {
          const { src } = await readBody(req)
          if (!src || !src.startsWith('/fotos/') || src.includes('..')) {
            return res.status(400).json({ error: 'invalid path' })
          }
          const filePath = path.join(__dirname, 'public', src)
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
          res.json({ ok: true })
        } catch (e) { res.status(500).json({ error: e.message }) }
      })

      return middlewares
    },
  },
})
