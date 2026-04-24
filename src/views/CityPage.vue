<template>
  <div class="city-page">

    <!-- Breadcrumb -->
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
      <!-- Header -->
      <div class="city-header">
        <img class="city-flag" :src="flagUrl(country.id)" :alt="country.name" />
        <div class="city-header-text">
          <h2 class="city-name">{{ cityData.name }}</h2>
          <p class="city-country-sub">{{ country.name }}</p>
        </div>
      </div>

      <!-- Description -->
      <div class="desc-section">
        <label class="desc-label">Descripción</label>
        <textarea
          v-model="description"
          class="desc-textarea"
          placeholder="Escribe aquí qué hicisteis en esta ciudad..."
          rows="3"
          @change="saveAll"
        />
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <span class="toolbar-count">{{ media.length }} elemento{{ media.length !== 1 ? 's' : '' }}</span>
        <div class="toolbar-actions">
          <button class="toolbar-btn toolbar-btn--rose" @click="$refs.fileInput.click()" :disabled="isUploading">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            {{ isUploading ? 'Procesando...' : 'Añadir fotos' }}
          </button>
          <button class="toolbar-btn" @click="showVideoInput = !showVideoInput">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            Añadir vídeo
          </button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" multiple style="display:none" @change="handleFiles" />
      </div>

      <!-- Video input row -->
      <div v-if="showVideoInput" class="video-row">
        <span class="video-label">Pon el archivo en <code>public/videos/</code> y escribe el nombre:</span>
        <div class="video-inputs">
          <input v-model="videoFilename" class="video-input" placeholder="Ej: paris-2024.mp4"
            @keydown.enter="addVideo" @keydown.esc="showVideoInput = false" />
          <button class="video-add-btn" :disabled="!videoFilename.trim()" @click="addVideo">Añadir</button>
          <button class="video-cancel" @click="showVideoInput = false; videoFilename = ''">✕</button>
        </div>
      </div>

      <!-- Upload indicator -->
      <div v-if="isUploading" class="upload-indicator">
        <span class="upload-spinner"></span>
        Comprimiendo y guardando {{ uploadProgress }}...
      </div>

      <!-- Error -->
      <div v-if="saveError" class="save-error">
        ⚠️ Error al guardar: {{ saveError }}
        <button @click="saveError = ''">✕</button>
      </div>

      <!-- Media grid -->
      <div v-if="media.length > 0">
        <p v-if="media.length > 1" class="drag-hint">
          Arrastra las tarjetas para cambiar el orden
        </p>
        <div class="media-grid">
          <div
            v-for="(item, index) in media"
            :key="item.id"
            class="media-card"
            :class="{ 'is-dragging': dragIndex === index, 'is-over': dragOverIndex === index && dragIndex !== index }"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="onDragOver($event, index)"
            @dragend="onDragEnd"
            @drop.prevent
          >
            <div class="card-topbar">
              <div class="card-handle">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
              </div>
              <span class="card-order">#{{ index + 1 }}</span>
              <button class="card-delete" @click="removeMedia(index)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div class="card-preview">
              <img v-if="item.type === 'photo'" :src="item.src" class="card-img" />
              <div v-else class="card-video-wrap">
                <video class="card-video" :src="item.src" controls preload="metadata" />
              </div>
            </div>

            <div class="card-caption-wrap">
              <input class="card-caption" v-model="item.caption"
                placeholder="Texto o descripción de este momento..." @change="saveAll" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="media-empty">
        <div class="media-empty-icon">📸</div>
        <p class="media-empty-title">Aún no hay fotos ni vídeos</p>
        <p class="media-empty-sub">Pulsa "Añadir fotos" para empezar el collage de {{ cityData.name }}</p>
      </div>
    </template>
  </div>
</template>

<script>
import { ALL_COUNTRIES } from '@/data/countries.js'
import { loadDb, saveDb, ensureCountry } from '@/services/db.js'
import { uploadPhoto, deletePhoto } from '@/services/db.js'
import { toSlug } from '@/utils/slug.js'

export default {
  name: 'CityPage',
  data() {
    return {
      db: null,
      cityData: null,
      description: '',
      media: [],
      loading: true,
      isUploading: false,
      uploadProgress: '',
      showVideoInput: false,
      videoFilename: '',
      dragIndex: null,
      dragOverIndex: null,
      saveError: '',
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

    // ── Load ─────────────────────────────────────────────
    async loadData() {
      this.loading = true
      this.db = await loadDb()
      const cities = this.db.countries?.[this.country.id]?.cities || []
      const city = cities.find(c => toSlug(c.name) === this.citySlug) || null
      this.cityData = city
      this.description = city?.description || ''
      this.media = city ? JSON.parse(JSON.stringify(city.media || [])) : []
      this.loading = false
    },

    // ── Save all ─────────────────────────────────────────
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
        this.saveError = ''
      } catch (e) {
        this.saveError = e.message || 'Error desconocido'
      }
    },

    // ── Photos ───────────────────────────────────────────
    async handleFiles(event) {
      const files = Array.from(event.target.files).filter(f => f.type.startsWith('image/'))
      event.target.value = ''
      if (!files.length) return
      this.isUploading = true

      for (let i = 0; i < files.length; i++) {
        this.uploadProgress = `${i + 1} / ${files.length}`
        const dataUrl = await this.compressImage(files[i])
        const result = await uploadPhoto({
          countryId: this.country.id,
          citySlug: this.citySlug,
          dataUrl,
        })
        if (result?.src) {
          this.media.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            type: 'photo',
            src: result.src,
            caption: '',
          })
        }
      }

      this.isUploading = false
      this.uploadProgress = ''
      await this.saveAll()
    },

    compressImage(file) {
      return new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => {
          const img = new Image()
          img.onload = () => {
            const MAX = 1200
            let w = img.width, h = img.height
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } }
            else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
            const canvas = document.createElement('canvas')
            canvas.width = w; canvas.height = h
            canvas.getContext('2d').drawImage(img, 0, 0, w, h)
            resolve(canvas.toDataURL('image/jpeg', 0.82))
          }
          img.src = e.target.result
        }
        reader.readAsDataURL(file)
      })
    },

    // ── Videos ───────────────────────────────────────────
    addVideo() {
      const name = this.videoFilename.trim()
      if (!name) return
      this.media.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'video',
        src: `/videos/${name}`,
        caption: '',
      })
      this.videoFilename = ''
      this.showVideoInput = false
      this.saveAll()
    },

    // ── Remove ───────────────────────────────────────────
    async removeMedia(index) {
      const item = this.media[index]
      if (item.type === 'photo') await deletePhoto(item.src)
      this.media.splice(index, 1)
      await this.saveAll()
    },

    // ── Drag reorder ─────────────────────────────────────
    onDragStart(e, index) {
      this.dragIndex = index
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver(e, index) {
      this.dragOverIndex = index
      if (this.dragIndex === null || this.dragIndex === index) return
      const item = this.media.splice(this.dragIndex, 1)[0]
      this.media.splice(index, 0, item)
      this.dragIndex = index
    },
    onDragEnd() {
      this.dragIndex = null
      this.dragOverIndex = null
      this.saveAll()
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
.bc-btn {
  background: none; border: none; color: rgba(232, 121, 160, 0.65);
  font-size: 0.84rem; font-weight: 500; font-family: 'Space Grotesk', Arial, sans-serif;
  cursor: pointer; padding: 0; transition: color 0.15s;
}
.bc-btn:hover { color: #e879a0; }
.bc-sep { color: rgba(255,255,255,0.18); font-size: 0.84rem; }
.bc-current { color: rgba(255,255,255,0.5); font-size: 0.84rem; font-weight: 500; }

/* ── Header ──────────────────────────────────────────── */
.city-header { display: flex; align-items: center; gap: 22px; margin-bottom: 36px; }
.city-flag { width: 68px; height: auto; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
.city-name {
  font-size: 2.1rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;
  background: linear-gradient(135deg, #e879a0 0%, #a855f7 100%);
  -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  line-height: 1.1; margin-bottom: 3px;
}
.city-country-sub { font-size: 0.8rem; color: rgba(255,255,255,0.32); font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }

/* ── Description ─────────────────────────────────────── */
.desc-section { margin-bottom: 28px; }
.desc-label { display: block; font-size: 0.7rem; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.28); margin-bottom: 8px; }
.desc-textarea {
  width: 100%; max-width: 680px;
  background: rgba(255,255,255,0.03); border: 1px solid rgba(168,85,247,0.16);
  border-radius: 12px; padding: 12px 16px; color: rgba(255,255,255,0.8);
  font-size: 0.92rem; font-family: 'Space Grotesk', Arial, sans-serif;
  line-height: 1.6; resize: vertical; outline: none; transition: border-color 0.18s;
}
.desc-textarea:focus { border-color: rgba(168,85,247,0.42); }
.desc-textarea::placeholder { color: rgba(255,255,255,0.18); }

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.toolbar-count { font-size: 0.75rem; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.25); flex: 1; }
.toolbar-actions { display: flex; gap: 8px; }
.toolbar-btn {
  display: inline-flex; align-items: center; gap: 7px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.7); border-radius: 10px; padding: 8px 16px;
  font-size: 0.84rem; font-weight: 600; font-family: 'Space Grotesk', Arial, sans-serif;
  cursor: pointer; transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.toolbar-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
.toolbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); color: #fff; border-color: rgba(255,255,255,0.22); }
.toolbar-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.toolbar-btn--rose { background: rgba(232,121,160,0.14); border-color: rgba(232,121,160,0.38); color: #f9a8d4; }
.toolbar-btn--rose:hover:not(:disabled) { background: rgba(232,121,160,0.26); border-color: rgba(232,121,160,0.6); color: #fff; }

/* ── Video row ───────────────────────────────────────── */
.video-row {
  background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px; padding: 14px 18px; margin-bottom: 16px;
  display: flex; flex-direction: column; gap: 10px;
}
.video-label { font-size: 0.82rem; color: rgba(255,255,255,0.42); }
.video-label code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 0.78rem; }
.video-inputs { display: flex; gap: 8px; align-items: center; }
.video-input {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 0.88rem;
  font-family: 'Space Grotesk', Arial, sans-serif; outline: none;
}
.video-input:focus { border-color: rgba(168,85,247,0.4); }
.video-add-btn {
  background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.35);
  color: #c084fc; border-radius: 8px; padding: 8px 16px; font-size: 0.84rem;
  font-weight: 600; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer;
}
.video-add-btn:hover:not(:disabled) { background: rgba(168,85,247,0.26); }
.video-add-btn:disabled { opacity: 0.38; cursor: not-allowed; }
.video-cancel { background: transparent; border: none; color: rgba(255,255,255,0.3); font-size: 1rem; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.video-cancel:hover { color: rgba(255,255,255,0.65); }

/* ── Upload indicator ────────────────────────────────── */
.upload-indicator {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; margin-bottom: 14px;
  background: rgba(232,121,160,0.07); border: 1px solid rgba(232,121,160,0.18);
  border-radius: 10px; font-size: 0.84rem; color: rgba(232,121,160,0.8);
}
.upload-spinner {
  width: 16px; height: 16px; border: 2px solid rgba(232,121,160,0.28);
  border-top-color: #e879a0; border-radius: 50%;
  animation: spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Save error ──────────────────────────────────────── */
.save-error {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 10px 14px; margin-bottom: 14px;
  background: rgba(248,113,113,0.09); border: 1px solid rgba(248,113,113,0.28);
  border-radius: 10px; font-size: 0.84rem; color: #fca5a5;
}
.save-error button { background: none; border: none; color: inherit; cursor: pointer; }

/* ── Drag hint ───────────────────────────────────────── */
.drag-hint { font-size: 0.74rem; color: rgba(255,255,255,0.22); margin-bottom: 14px; letter-spacing: 0.3px; }

/* ── Media grid ──────────────────────────────────────── */
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }

/* ── Media card ──────────────────────────────────────── */
.media-card {
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(168,85,247,0.13);
  border-radius: 14px; overflow: hidden;
  display: flex; flex-direction: column;
  transition: border-color 0.18s, transform 0.15s, opacity 0.15s;
  cursor: grab;
}
.media-card:active { cursor: grabbing; }
.media-card.is-dragging { opacity: 0.4; transform: scale(0.97); border-color: rgba(232,121,160,0.5); }
.media-card.is-over { border-color: #e879a0; border-style: dashed; transform: scale(1.015); }
.media-card:hover:not(.is-dragging) { border-color: rgba(168,85,247,0.3); }

.card-topbar { display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: rgba(0,0,0,0.22); }
.card-handle { display: flex; align-items: center; color: rgba(255,255,255,0.2); cursor: grab; padding: 2px 4px; border-radius: 4px; transition: color 0.15s; }
.card-handle:hover { color: rgba(168,85,247,0.7); }
.card-handle svg { width: 14px; height: 14px; }
.card-order { flex: 1; font-size: 0.68rem; font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,0.18); text-transform: uppercase; }
.card-delete {
  display: flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; background: transparent;
  border: 1px solid transparent; border-radius: 6px;
  color: rgba(255,255,255,0.18); cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s; padding: 0;
}
.card-delete svg { width: 13px; height: 13px; }
.card-delete:hover { color: #f87171; background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.3); }

.card-preview { width: 100%; background: rgba(0,0,0,0.15); overflow: hidden; }
.card-img { width: 100%; height: 220px; object-fit: cover; display: block; }
.card-video-wrap { width: 100%; }
.card-video { width: 100%; max-height: 220px; display: block; background: #000; }

.card-caption-wrap { padding: 8px 10px 10px; }
.card-caption {
  width: 100%; background: transparent; border: none;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.6); font-size: 0.82rem;
  font-family: 'Space Grotesk', Arial, sans-serif;
  padding: 4px 2px; outline: none; transition: border-color 0.18s;
}
.card-caption:focus { border-bottom-color: rgba(232,121,160,0.45); }
.card-caption::placeholder { color: rgba(255,255,255,0.18); font-style: italic; }

/* ── Empty state ─────────────────────────────────────── */
.media-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  min-height: 260px; border: 1px dashed rgba(168,85,247,0.18);
  border-radius: 18px; gap: 10px; text-align: center; margin-top: 8px;
}
.media-empty-icon { font-size: 3rem; opacity: 0.4; line-height: 1; }
.media-empty-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.32); }
.media-empty-sub { font-size: 0.82rem; color: rgba(255,255,255,0.18); }

.not-found, .loading { color: rgba(255,255,255,0.35); font-size: 0.95rem; }
</style>
