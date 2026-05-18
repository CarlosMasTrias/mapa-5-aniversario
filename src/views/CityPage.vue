<template>
  <div class="city-page">

    <nav class="breadcrumb">
      <button class="bc-btn" @click="$router.push('/')">Mapa</button>
      <span class="bc-sep">/</span>
      <button class="bc-btn" @click="$router.push('/' + countrySlug)">{{ country?.name }}</button>
      <span class="bc-sep">/</span>
      <span class="bc-current">{{ cityName }}</span>
    </nav>

    <div v-if="loading" class="loading">Cargando...</div>

    <template v-else-if="!cityData">
      <p class="not-found">Ciudad no encontrada.</p>
    </template>

    <template v-else>
      <div class="city-header">
        <img class="city-flag" :src="flagUrl(country.id)" :alt="country.name" />
        <div class="city-header-text">
          <h2 class="city-name">{{ cityData.name }}</h2>
          <p class="city-country-sub">{{ country.name }}</p>
        </div>
      </div>

      <div class="desc-section">
        <label class="desc-label">Descripción</label>
        <textarea v-model="description" class="desc-textarea"
          placeholder="Escribe aquí qué hicisteis en esta ciudad..."
          rows="3" @change="saveAll" />
      </div>

      <div class="edit-bar">
        <button class="edit-btn" @click="$router.push('/' + countrySlug + '/' + citySlug + '/editar')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
          </svg>
          Editar elementos
        </button>
      </div>

      <div v-if="media.length === 0" class="media-empty">
        <div class="media-empty-icon">📸</div>
        <p class="media-empty-title">Aún no hay fotos ni vídeos</p>
        <p class="media-empty-sub">Pulsa "Editar elementos" para empezar el álbum de {{ cityData.name }}</p>
      </div>

      <AlbumSection v-if="media.length > 0" ref="albumSection" />

    </template>
  </div>
</template>

<script>
import AlbumSection from './AlbumSection.vue'
import { ALL_COUNTRIES } from '@/data/countries.js'
import { loadDb, saveDb, ensureCountry } from '@/services/db.js'
import { toSlug } from '@/utils/slug.js'

export default {
  name: 'CityPage',
  components: { AlbumSection },
  data() {
    return {
      db: null,
      cityData: null,
      description: '',
      media: [],
      loading: true,
    }
  },
  computed: {
    country() {
      const slug = this.$route.params.country
      return ALL_COUNTRIES.find(c => toSlug(c.name) === slug) || null
    },
    countrySlug() {
      return this.country ? toSlug(this.country.name) : ''
    },
    citySlug() {
      return this.$route.params.city
    },
    cityName() {
      return this.cityData?.name || this.citySlug
    },
  },
  watch: {
    '$route.params': {
      immediate: true,
      async handler() {
        if (this.country) await this.loadData()
      },
    },
  },
  methods: {
    flagUrl(code) {
      return `https://flagcdn.com/w80/${code.toLowerCase()}.png`
    },

    buildAlbumRows(data) {
      const rows = []
      let row = []
      let w = 0
      for (const item of data) {
        const sz = item.size || 'medium'
        let iw
        if (item.type === 'photo') iw = { small: 1, medium: 2, large: 3 }[sz]
        else if (item.type === 'video') iw = 3
        else iw = w === 0 ? 3 : Math.max(1, 3 - w)

        if (w + iw > 3 && row.length) {
          rows.push(row); row = []; w = 0
          if (item.type === 'text') iw = 3
        }
        row.push({ item, w: iw })
        w += iw
        if (w >= 3) { rows.push(row); row = []; w = 0 }
      }
      if (row.length) rows.push(row)
      return rows
    },

    async loadData() {
      this.loading = true
      this.db = await loadDb()
      const cities = this.db.countries?.[this.country.id]?.cities || []
      const city = cities.find(c => toSlug(c.name) === this.citySlug) || null
      this.cityData = city
      this.description = city?.description || ''
      this.media = (city?.media || []).map(item => {
        if (item.type === 'photo') {
          return {
            ...item,
            size: item.size || 'medium',
            crop: item.crop !== undefined ? item.crop : true,
            croppedSrc: item.croppedSrc || null,
          }
        }
        return item
      })
      this.loading = false
      await this.$nextTick()
      if (this.$refs.albumSection) {
        const rows = this.buildAlbumRows(JSON.parse(JSON.stringify(this.media)))
        this.$refs.albumSection.update(rows)
      }
    },

    async saveAll() {
      if (!this.db || !this.cityData) return
      try {
        const countryEntry = ensureCountry(this.db, this.country.id)
        const idx = countryEntry.cities.findIndex(c => toSlug(c.name) === this.citySlug)
        const updated = { name: this.cityData.name, description: this.description, media: this.media }
        if (idx >= 0) countryEntry.cities[idx] = updated
        else countryEntry.cities.push(updated)
        this.cityData = updated
        await saveDb(this.db)
      } catch (e) {
        console.error('Error guardando:', e)
      }
    },
  },
}
</script>

<style scoped>
.city-page {
  padding: 32px 48px 72px;
  min-height: calc(100vh - 68px);
  font-family: 'Space Grotesk', Arial, sans-serif;
}

/* ── Breadcrumb ──────────────────────────────────────── */
.breadcrumb { display: flex; align-items: center; gap: 6px; margin-bottom: 32px; }
.bc-btn { background: none; border: none; color: rgba(232,121,160,0.65); font-size: 0.84rem; font-weight: 500; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; padding: 0; transition: color 0.15s; }
.bc-btn:hover { color: #e879a0; }
.bc-sep { color: rgba(255,255,255,0.18); font-size: 0.84rem; }
.bc-current { color: rgba(255,255,255,0.5); font-size: 0.84rem; font-weight: 500; }

/* ── Header ──────────────────────────────────────────── */
.city-header { display: flex; align-items: center; gap: 22px; margin-bottom: 36px; }
.city-flag { width: 68px; height: auto; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
.city-name { font-size: 2.1rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; background: linear-gradient(135deg, #e879a0 0%, #a855f7 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; line-height: 1.1; margin-bottom: 3px; }
.city-country-sub { font-size: 0.8rem; color: rgba(255,255,255,0.32); font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }

/* ── Description ─────────────────────────────────────── */
.desc-section { margin-bottom: 28px; }
.desc-label { display: block; font-size: 0.7rem; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.28); margin-bottom: 8px; }
.desc-textarea { width: 100%; max-width: 680px; background: rgba(255,255,255,0.03); border: 1px solid rgba(168,85,247,0.16); border-radius: 12px; padding: 12px 16px; color: rgba(255,255,255,0.8); font-size: 0.92rem; font-family: 'Space Grotesk', Arial, sans-serif; line-height: 1.6; resize: vertical; outline: none; transition: border-color 0.18s; }
.desc-textarea:focus { border-color: rgba(168,85,247,0.42); }
.desc-textarea::placeholder { color: rgba(255,255,255,0.18); }

/* ── Edit bar ────────────────────────────────────────── */
.edit-bar { display: flex; justify-content: flex-end; margin-bottom: 20px; }
.edit-btn { display: inline-flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.45); border-radius: 10px; padding: 8px 16px; font-size: 0.82rem; font-weight: 600; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; transition: all 0.18s; }
.edit-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.edit-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.2); }

/* ── Empty state ─────────────────────────────────────── */
.media-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; border: 1px dashed rgba(168,85,247,0.18); border-radius: 18px; gap: 10px; text-align: center; margin-top: 8px; }
.media-empty-icon { font-size: 3rem; opacity: 0.4; line-height: 1; }
.media-empty-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.32); }
.media-empty-sub { font-size: 0.82rem; color: rgba(255,255,255,0.18); }
.not-found, .loading { color: rgba(255,255,255,0.35); font-size: 0.95rem; }
</style>
