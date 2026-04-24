<template>
  <div class="city-page">

    <!-- Breadcrumb -->
    <nav class="breadcrumb">
      <button class="bc-btn" @click="$router.push('/')">Mapa</button>
      <span class="bc-sep">/</span>
      <button class="bc-btn" @click="$router.push('/' + countrySlug)">{{ country?.name }}</button>
      <span class="bc-sep">/</span>
      <span class="bc-current">{{ city?.name }}</span>
    </nav>

    <!-- Header -->
    <div v-if="country && city" class="city-header">
      <img class="city-flag" :src="flagUrl(country.id)" :alt="country.name" />
      <div class="city-header-text">
        <h2 class="city-name">{{ city.name }}</h2>
        <p class="city-country-sub">{{ country.name }}</p>
      </div>
    </div>

    <div v-if="!city" class="not-found">Ciudad no encontrada.</div>

    <template v-else>

      <!-- Description textarea -->
      <div class="desc-section">
        <label class="desc-label">Descripción (texto introductorio del collage)</label>
        <textarea
          v-model="description"
          class="desc-textarea"
          placeholder="Escribe aquí una pequeña descripción de lo que hicisteis en esta ciudad..."
          rows="3"
          @input="saveDescription"
        />
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <span class="toolbar-count">{{ media.length }} elemento{{ media.length !== 1 ? 's' : '' }}</span>
        <div class="toolbar-actions">
          <button class="toolbar-btn toolbar-btn--primary" @click="$refs.fileInput.click()" :disabled="isUploading">
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
        <span class="video-row-label">Pon el archivo en <code>public/videos/</code> y escribe el nombre:</span>
        <div class="video-row-inputs">
          <input
            v-model="videoFilename"
            class="video-input"
            placeholder="Ej: paris-2024.mp4"
            @keydown.enter="addVideo"
            @keydown.esc="showVideoInput = false"
          />
          <button class="video-add-btn" :disabled="!videoFilename.trim()" @click="addVideo">Añadir</button>
          <button class="video-cancel-btn" @click="showVideoInput = false; videoFilename = ''">✕</button>
        </div>
      </div>

      <!-- Upload progress -->
      <div v-if="isUploading" class="upload-progress">
        <div class="upload-bar"></div>
        <span>Comprimiendo y guardando fotos...</span>
      </div>

      <!-- Error message -->
      <div v-if="storageError" class="storage-error">
        ⚠️ El almacenamiento local está lleno. Elimina alguna foto antes de añadir más.
        <button @click="storageError = false">✕</button>
      </div>

      <!-- Media grid -->
      <div v-if="media.length > 0">
        <p v-if="media.length > 1" class="drag-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:14px;height:14px;display:inline-block;vertical-align:middle"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>
          Arrastra las tarjetas para cambiar el orden del collage
        </p>
        <div class="media-grid">
          <div
            v-for="(item, index) in media"
            :key="item.id"
            class="media-card"
            :class="{
              'is-dragging': dragIndex === index,
              'is-over': dragOverIndex === index && dragIndex !== index,
            }"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent="onDragOver($event, index)"
            @dragend="onDragEnd"
            @drop.prevent
          >
            <!-- Top bar: handle + order + delete -->
            <div class="card-topbar">
              <div class="card-handle" title="Arrastra para reordenar">
                <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
              </div>
              <span class="card-order"># {{ index + 1 }}</span>
              <button class="card-delete" @click="removeMedia(index)" title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- Preview -->
            <div class="card-preview">
              <img v-if="item.type === 'photo'" :src="item.src" class="card-img" :alt="item.caption || ''" />
              <div v-else class="card-video-wrap">
                <video class="card-video" :src="item.src" controls preload="metadata" @error="item.videoMissing = true" />
                <div v-if="item.videoMissing" class="card-video-missing">
                  <span>🎬 {{ item.filename }}</span>
                  <small>Pon el archivo en <code>public/videos/</code></small>
                </div>
              </div>
            </div>

            <!-- Caption -->
            <div class="card-caption-wrap">
              <input
                class="card-caption"
                v-model="item.caption"
                placeholder="Texto o descripción de este momento..."
                @change="saveMedia"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="media-empty">
        <div class="media-empty-icon">📸</div>
        <p class="media-empty-title">Aún no hay fotos ni vídeos en {{ city.name }}</p>
        <p class="media-empty-sub">Pulsa "Añadir fotos" para empezar el collage</p>
      </div>

    </template>
  </div>
</template>

<script>
import { ALL_COUNTRIES } from '@/data/countries.js'
import { CITY_DATA } from '@/data/cityData.js'
import { toSlug } from '@/utils/slug.js'

export default {
  name: 'CityPage',
  data() {
    return {
      media: [],
      description: '',
      dragIndex: null,
      dragOverIndex: null,
      isUploading: false,
      showVideoInput: false,
      videoFilename: '',
      storageError: false,
    }
  },
  computed: {
    country() {
      const slug = this.$route.params.country
      return ALL_COUNTRIES.find(c => toSlug(c.name) === slug) || null
    },
    city() {
      if (!this.country) return null
      const citySlug = this.$route.params.city

      const lsStored = localStorage.getItem(`gorditos_cities_${this.country.id}`)
      if (lsStored) {
        const found = JSON.parse(lsStored).find(c => toSlug(c.name) === citySlug)
        if (found) return found
      }

      const staticCities = CITY_DATA[this.country.id]?.cities || []
      return staticCities.find(c => toSlug(c.name) === citySlug) || null
    },
    countrySlug() {
      return this.country ? toSlug(this.country.name) : ''
    },
    citySlug() {
      return this.$route.params.city
    },
    mediaKey() {
      return `gorditos_media_${this.country?.id}_${this.citySlug}`
    },
    descKey() {
      return `gorditos_desc_${this.country?.id}_${this.citySlug}`
    },
  },
  watch: {
    city: {
      immediate: true,
      handler(val) {
        if (val) this.loadAll()
      },
    },
  },
  methods: {
    flagUrl(code) {
      return `https://flagcdn.com/w80/${code.toLowerCase()}.png`
    },
    loadAll() {
      const mStored = localStorage.getItem(this.mediaKey)
      this.media = mStored ? JSON.parse(mStored) : []

      const dStored = localStorage.getItem(this.descKey)
      this.description = dStored || ''
    },
    saveMedia() {
      try {
        localStorage.setItem(this.mediaKey, JSON.stringify(this.media))
        this.storageError = false
      } catch {
        this.storageError = true
      }
    },
    saveDescription() {
      localStorage.setItem(this.descKey, this.description)
    },

    // ── Photos ───────────────────────────────────────────
    async handleFiles(event) {
      const files = Array.from(event.target.files).filter(f => f.type.startsWith('image/'))
      event.target.value = ''
      if (!files.length) return
      this.isUploading = true

      for (const file of files) {
        const src = await this.compressImage(file)
        this.media.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: 'photo',
          src,
          caption: '',
        })
      }

      this.isUploading = false
      this.saveMedia()
    },
    compressImage(file) {
      return new Promise(resolve => {
        const reader = new FileReader()
        reader.onload = e => {
          const img = new Image()
          img.onload = () => {
            const MAX = 900
            let w = img.width, h = img.height
            if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX } }
            else { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX } }
            const canvas = document.createElement('canvas')
            canvas.width = w
            canvas.height = h
            canvas.getContext('2d').drawImage(img, 0, 0, w, h)
            resolve(canvas.toDataURL('image/jpeg', 0.68))
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
        filename: name,
        caption: '',
        videoMissing: false,
      })
      this.videoFilename = ''
      this.showVideoInput = false
      this.saveMedia()
    },

    // ── Remove ───────────────────────────────────────────
    removeMedia(index) {
      this.media.splice(index, 1)
      this.saveMedia()
    },

    // ── Drag & drop reorder ───────────────────────────────
    onDragStart(e, index) {
      this.dragIndex = index
      e.dataTransfer.effectAllowed = 'move'
    },
    onDragOver(e, index) {
      this.dragOverIndex = index
      if (this.dragIndex === null || this.dragIndex === index) return
      const moved = this.media.splice(this.dragIndex, 1)[0]
      this.media.splice(index, 0, moved)
      this.dragIndex = index
    },
    onDragEnd() {
      this.dragIndex = null
      this.dragOverIndex = null
      this.saveMedia()
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
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 32px;
}
.bc-btn {
  background: none;
  border: none;
  color: rgba(255, 77, 157, 0.65);
  font-size: 0.84rem;
  font-weight: 500;
  font-family: 'Space Grotesk', Arial, sans-serif;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}
.bc-btn:hover { color: #ff4d9d; }
.bc-sep { color: rgba(255, 255, 255, 0.2); font-size: 0.84rem; }
.bc-current { color: rgba(255, 255, 255, 0.55); font-size: 0.84rem; font-weight: 500; }

/* ── Header ──────────────────────────────────────────── */
.city-header {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-bottom: 36px;
}
.city-flag { width: 68px; height: auto; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
.city-name {
  font-size: 2.1rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ff4d9d 0%, #ff9dd3 80%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1.1;
  margin-bottom: 3px;
}
.city-country-sub { font-size: 0.82rem; color: rgba(255,255,255,0.35); font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }

/* ── Description ─────────────────────────────────────── */
.desc-section { margin-bottom: 28px; }
.desc-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.3);
  margin-bottom: 8px;
}
.desc-textarea {
  width: 100%;
  max-width: 680px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,77,157,0.18);
  border-radius: 12px;
  padding: 12px 16px;
  color: rgba(255,255,255,0.8);
  font-size: 0.92rem;
  font-family: 'Space Grotesk', Arial, sans-serif;
  line-height: 1.6;
  resize: vertical;
  outline: none;
  transition: border-color 0.18s;
}
.desc-textarea:focus { border-color: rgba(255,77,157,0.45); }
.desc-textarea::placeholder { color: rgba(255,255,255,0.2); }

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.toolbar-count {
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255,255,255,0.28);
  flex: 1;
}
.toolbar-actions { display: flex; gap: 8px; }
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.75);
  border-radius: 10px;
  padding: 8px 16px;
  font-size: 0.84rem;
  font-weight: 600;
  font-family: 'Space Grotesk', Arial, sans-serif;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}
.toolbar-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
.toolbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.25); }
.toolbar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.toolbar-btn--primary {
  background: rgba(255,77,157,0.16);
  border-color: rgba(255,77,157,0.4);
  color: #ff9dd3;
}
.toolbar-btn--primary:hover:not(:disabled) { background: rgba(255,77,157,0.28); border-color: rgba(255,77,157,0.65); color: #fff; }

/* ── Video row ───────────────────────────────────────── */
.video-row {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 14px 18px;
  margin-bottom: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.video-row-label { font-size: 0.82rem; color: rgba(255,255,255,0.45); }
.video-row-label code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 0.78rem; }
.video-row-inputs { display: flex; gap: 8px; align-items: center; }
.video-input {
  flex: 1;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 0.88rem;
  font-family: 'Space Grotesk', Arial, sans-serif;
  outline: none;
}
.video-input:focus { border-color: rgba(255,77,157,0.4); }
.video-add-btn {
  background: rgba(255,77,157,0.16);
  border: 1px solid rgba(255,77,157,0.35);
  color: #ff9dd3;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.84rem;
  font-weight: 600;
  font-family: 'Space Grotesk', Arial, sans-serif;
  cursor: pointer;
  transition: background 0.18s;
}
.video-add-btn:hover:not(:disabled) { background: rgba(255,77,157,0.28); }
.video-add-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.video-cancel-btn {
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.35);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: color 0.15s;
}
.video-cancel-btn:hover { color: rgba(255,255,255,0.7); }

/* ── Upload progress ─────────────────────────────────── */
.upload-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255,77,157,0.08);
  border: 1px solid rgba(255,77,157,0.2);
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 0.84rem;
  color: rgba(255,77,157,0.8);
}
.upload-bar {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255,77,157,0.3);
  border-top-color: #ff4d9d;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Storage error ───────────────────────────────────── */
.storage-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255,80,80,0.1);
  border: 1px solid rgba(255,80,80,0.3);
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 0.84rem;
  color: #ff9d9d;
}
.storage-error button { background: none; border: none; color: inherit; cursor: pointer; font-size: 1rem; }

/* ── Drag hint ───────────────────────────────────────── */
.drag-hint {
  font-size: 0.75rem;
  color: rgba(255,255,255,0.25);
  margin-bottom: 14px;
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ── Media grid ──────────────────────────────────────── */
.media-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
}

/* ── Media card ──────────────────────────────────────── */
.media-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,77,157,0.15);
  border-radius: 14px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: border-color 0.18s, transform 0.15s, opacity 0.15s;
  cursor: grab;
}
.media-card:active { cursor: grabbing; }
.media-card.is-dragging { opacity: 0.45; transform: scale(0.97); border-color: rgba(255,77,157,0.5); }
.media-card.is-over { border-color: #ff4d9d; border-style: dashed; transform: scale(1.01); }
.media-card:hover:not(.is-dragging) { border-color: rgba(255,77,157,0.35); }

.card-topbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  background: rgba(0,0,0,0.2);
}
.card-handle {
  display: flex;
  align-items: center;
  color: rgba(255,255,255,0.25);
  cursor: grab;
  padding: 2px 4px;
  border-radius: 4px;
  transition: color 0.15s;
}
.card-handle:hover { color: rgba(255,77,157,0.7); }
.card-handle svg { width: 14px; height: 14px; }
.card-order {
  flex: 1;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(255,255,255,0.22);
  text-transform: uppercase;
}
.card-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: rgba(255,255,255,0.2);
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s;
  padding: 0;
}
.card-delete svg { width: 13px; height: 13px; }
.card-delete:hover { color: #ff7070; background: rgba(255,80,80,0.12); border-color: rgba(255,80,80,0.3); }

.card-preview { width: 100%; background: rgba(0,0,0,0.15); overflow: hidden; }
.card-img { width: 100%; height: 220px; object-fit: cover; display: block; }
.card-video-wrap { position: relative; }
.card-video { width: 100%; max-height: 220px; display: block; background: #000; }
.card-video-missing {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px;
  text-align: center;
}
.card-video-missing span { font-size: 0.85rem; color: rgba(255,255,255,0.7); word-break: break-all; }
.card-video-missing small { font-size: 0.72rem; color: rgba(255,255,255,0.4); }
.card-video-missing code { background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 3px; }

.card-caption-wrap { padding: 8px 10px 10px; }
.card-caption {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.65);
  font-size: 0.82rem;
  font-family: 'Space Grotesk', Arial, sans-serif;
  padding: 4px 2px;
  outline: none;
  transition: border-color 0.18s;
}
.card-caption:focus { border-bottom-color: rgba(255,77,157,0.5); }
.card-caption::placeholder { color: rgba(255,255,255,0.2); font-style: italic; }

/* ── Empty state ─────────────────────────────────────── */
.media-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  border: 1px dashed rgba(255,77,157,0.2);
  border-radius: 18px;
  gap: 10px;
  text-align: center;
  margin-top: 8px;
}
.media-empty-icon { font-size: 3rem; opacity: 0.45; line-height: 1; }
.media-empty-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.35); }
.media-empty-sub { font-size: 0.82rem; color: rgba(255,255,255,0.2); }

.not-found { color: rgba(255,255,255,0.4); font-size: 1rem; }
</style>
