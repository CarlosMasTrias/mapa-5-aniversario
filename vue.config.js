const { defineConfig } = require('@vue/cli-service')
const path = require('path')
const fs = require('fs')

const DB_PATH = path.join(__dirname, 'public', 'db.json')
const FOTOS_DIR = path.join(__dirname, 'public', 'fotos')

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

      // POST /api/photo  ─ save a compressed photo to public/fotos/
      // Body: { countryId, citySlug, filename, dataUrl }
      app.post('/api/photo', async (req, res) => {
        try {
          const { countryId, citySlug, filename, dataUrl } = await readBody(req)
          if (!countryId || !citySlug || !filename || !dataUrl) {
            return res.status(400).json({ error: 'missing fields' })
          }
          // Sanitize path components (no traversal)
          const safeCountry = countryId.replace(/[^A-Z]/g, '')
          const safeSlug = citySlug.replace(/[^a-z0-9-]/g, '')
          const safeFile = filename.replace(/[^a-z0-9._-]/gi, '')
          const dir = path.join(FOTOS_DIR, safeCountry, safeSlug)
          fs.mkdirSync(dir, { recursive: true })
          const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '')
          fs.writeFileSync(path.join(dir, safeFile), Buffer.from(base64, 'base64'))
          res.json({ src: `/fotos/${safeCountry}/${safeSlug}/${safeFile}` })
        } catch (e) { res.status(500).json({ error: e.message }) }
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
