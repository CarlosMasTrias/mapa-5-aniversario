// Migration script: imports public/db.json into Supabase for the initial user.
// Requires .env.local with: VUE_APP_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                            SEED_EMAIL, SEED_PASSWORD
//
// Usage: node scripts/seed.js

const path = require('path')

// Load .env.local first (takes precedence), then .env as fallback
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')
const ws = require('ws')

const {
  VUE_APP_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SEED_EMAIL,
  SEED_PASSWORD,
} = process.env

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SEED_EMAIL || !SEED_PASSWORD) {
  console.error('Faltan variables de entorno. Añade en .env.local:')
  console.error('  VUE_APP_SUPABASE_URL       (o en .env)')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  console.error('  SEED_EMAIL')
  console.error('  SEED_PASSWORD')
  process.exit(1)
}

// Admin client uses the service role key – bypasses RLS
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: ws },
})

async function run() {
  // ── 1. Load db.json ──────────────────────────────────────
  const dbPath = path.join(__dirname, '..', 'public', 'db.json')
  if (!fs.existsSync(dbPath)) {
    console.error('No se encontró public/db.json')
    process.exit(1)
  }
  const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  const countryCount = Object.keys(dbData.countries || {}).length
  const visitedCount = (dbData.visitedCountries || []).length
  console.log(`Datos cargados: ${countryCount} países con datos, ${visitedCount} visitados`)

  // Warn if db.json still has local paths instead of R2 URLs
  if (process.env.R2_BUCKET_NAME) {
    const hasLocalPaths = Object.values(dbData.countries || {}).some(c =>
      (c.cities || []).some(city =>
        (city.media || []).some(item =>
          (item.src || '').startsWith('/') ||
          (item.croppedSrc || '').startsWith('/') ||
          (item.thumbnailSrc || '').startsWith('/')
        )
      )
    )
    if (hasLocalPaths) {
      console.warn('\n⚠  AVISO: db.json contiene rutas locales (/fotos/, /local-media/).')
      console.warn('   Ejecuta primero: node scripts/migrate-to-r2.js')
      console.warn('   Luego vuelve a ejecutar: node scripts/seed.js\n')
    }
  }

  // ── 2. Create or find user ───────────────────────────────
  let userId
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: SEED_EMAIL,
    password: SEED_PASSWORD,
    email_confirm: true,  // skip confirmation email for the seed user
  })

  if (createErr) {
    const msg = createErr.message.toLowerCase()
    if (!msg.includes('already') && !msg.includes('exists')) throw createErr

    // User already registered — find by listing (admin can list up to 1000 users)
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
    if (listErr) throw listErr
    const existing = users.find(u => u.email === SEED_EMAIL)
    if (!existing) throw new Error('El usuario existe pero no se encontró en la lista')
    userId = existing.id
    console.log(`Usuario ya existía: ${SEED_EMAIL} (${userId})`)
  } else {
    userId = created.user.id
    console.log(`Usuario creado: ${SEED_EMAIL} (${userId})`)
  }

  // ── 3. Upsert map data ───────────────────────────────────
  const { error: upsertErr } = await admin
    .from('user_map_data')
    .upsert(
      { user_id: userId, data: dbData, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )

  if (upsertErr) throw upsertErr

  console.log('✓ Migración completada.')
  console.log(`  Usuario:     ${SEED_EMAIL}`)
  console.log(`  Contraseña:  la que pusiste en SEED_PASSWORD`)
  console.log(`  Datos:       ${countryCount} países, ${visitedCount} visitados`)
}

run().catch(e => {
  console.error('Error en seed:', e.message)
  process.exit(1)
})
