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
          <button class="toolbar-btn toolbar-btn--amber" @click="addText">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
            Añadir texto
          </button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" multiple style="display:none" @change="handleFiles" />
      </div>

      <div v-if="showVideoInput" class="video-row">
        <span class="video-label">Pon el archivo en <code>public/videos/</code> y escribe el nombre:</span>
        <div class="video-inputs">
          <input v-model="videoFilename" class="video-input" placeholder="Ej: paris-2024.mp4"
            @keydown.enter="addVideo" @keydown.esc="showVideoInput = false" />
          <button class="video-add-btn" :disabled="!videoFilename.trim()" @click="addVideo">Añadir</button>
          <button class="video-cancel" @click="showVideoInput = false; videoFilename = ''">✕</button>
        </div>
      </div>

      <div v-if="isUploading" class="upload-indicator">
        <span class="upload-spinner"></span>
        Comprimiendo y guardando {{ uploadProgress }}...
      </div>

      <div v-if="saveError" class="save-error">
        ⚠️ Error al guardar: {{ saveError }}
        <button @click="saveError = ''">✕</button>
      </div>

      <!-- Elements editor -->
      <div v-if="media.length > 0" class="elements-section">
        <div class="section-header-row">
          <span class="section-label">Elementos</span>
          <span v-if="media.length > 1" class="drag-hint">Arrastra para cambiar el orden</span>
        </div>
        <div class="media-grid">
          <div
            v-for="(item, index) in media"
            :key="item.id"
            class="media-card"
            :class="{
              'is-dragging': dragIndex === index,
              'is-over': dragOverIndex === index && dragIndex !== index,
              'card--text': item.type === 'text'
            }"
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
              <span class="card-type-badge" :class="'badge--' + item.type">
                {{ item.type === 'photo' ? 'Foto' : item.type === 'video' ? 'Vídeo' : 'Texto' }}
              </span>
              <span class="card-order">#{{ index + 1 }}</span>
              <button class="card-delete" @click="removeMedia(index)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <template v-if="item.type === 'photo'">
              <div class="card-preview card-preview--photo" @click="openCropModal(item)">
                <img :src="item.croppedSrc || item.src" class="card-img" />
                <div class="crop-edit-overlay">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 2 3 2 3 22 21 22 21 16"/><line x1="15" y1="9" x2="20" y2="4"/>
                    <polyline points="20 9 20 4 15 4"/>
                  </svg>
                  {{ item.croppedSrc ? 'Editar recorte' : 'Recortar foto' }}
                </div>
              </div>
              <div class="card-controls-row">
                <div class="card-ctrl-group">
                  <span class="ctrl-label">Tamaño</span>
                  <div class="ctrl-buttons">
                    <button v-for="sz in photoSizes" :key="sz.val"
                      class="ctrl-btn" :class="{ active: (item.size || 'medium') === sz.val }"
                      @click="setSize(item, sz.val)">{{ sz.label }}</button>
                  </div>
                </div>
                <div class="card-ctrl-group">
                  <span class="ctrl-label">Vista</span>
                  <div class="ctrl-buttons">
                    <button class="ctrl-btn ctrl-btn--rose"
                      :class="{ active: item.crop !== false }"
                      @click="setCrop(item, true)">Recortar</button>
                    <button class="ctrl-btn"
                      :class="{ active: item.crop === false }"
                      @click="setCrop(item, false)">Completa</button>
                  </div>
                </div>
              </div>
              <div class="card-caption-wrap">
                <input class="card-caption" v-model="item.caption"
                  placeholder="Pie de foto..." @change="saveAll" />
              </div>
            </template>

            <template v-else-if="item.type === 'text'">
              <div class="card-text-body">
                <textarea class="card-text-input" v-model="item.content"
                  placeholder="Escribe algo aquí..." rows="5" @change="saveAll" />
              </div>
            </template>

            <template v-else>
              <div class="card-preview">
                <div class="card-video-wrap">
                  <video class="card-video" :src="item.src" controls preload="metadata" />
                </div>
              </div>
              <div class="card-caption-wrap">
                <input class="card-caption" v-model="item.caption"
                  placeholder="Descripción del vídeo..." @change="saveAll" />
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-else class="media-empty">
        <div class="media-empty-icon">📸</div>
        <p class="media-empty-title">Aún no hay fotos ni vídeos</p>
        <p class="media-empty-sub">Pulsa "Añadir fotos" para empezar el álbum de {{ cityData.name }}</p>
      </div>

      <!-- Refresh album button -->
      <div v-if="media.length > 0" class="refresh-row">
        <button class="refresh-btn" @click="refreshAlbum">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg>
          Actualizar álbum
        </button>
      </div>

      <!-- Travel album: isolated component, only updates when refreshAlbum() calls update() -->
      <AlbumSection ref="albumSection" />

      <!-- Crop editor modal -->
      <div v-if="cropModal" class="crop-modal-overlay" @click.self="closeCropModal">
        <div class="crop-modal">
          <div class="crop-modal-header">
            <span class="crop-modal-title">Recortar foto</span>
            <button class="crop-modal-x" @click="closeCropModal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="crop-modal-body">
            <img ref="cropperImage" :src="cropModal.src" class="crop-source-img" />
          </div>
          <div class="crop-modal-footer">
            <span class="crop-modal-hint">Arrastra para seleccionar el área a recortar</span>
            <div class="crop-modal-actions">
              <button class="crop-btn-cancel" @click="closeCropModal" :disabled="isCropping">Cancelar</button>
              <button class="crop-btn-apply" @click="applyCrop" :disabled="isCropping">
                <span v-if="isCropping" class="upload-spinner upload-spinner--small"></span>
                {{ isCropping ? 'Guardando...' : 'Aplicar recorte' }}
              </button>
            </div>
          </div>
        </div>
      </div>

    </template>
  </div>
</template>

<script>
import Cropper from 'cropperjs'
import AlbumSection from './AlbumSection.vue'
import { ALL_COUNTRIES } from '@/data/countries.js'
import { loadDb, saveDb, ensureCountry } from '@/services/db.js'
import { uploadPhoto, deletePhoto } from '@/services/db.js'
import { toSlug } from '@/utils/slug.js'
import heic2any from 'heic2any'

export default {
  name: 'CityPage',
  components: { AlbumSection },
  data() {
    return {
      db: null,
      cityData: null,
      description: '',
      media: [],
      cropModal: null,
      cropper: null,
      isCropping: false,
      loading: true,
      isUploading: false,
      uploadProgress: '',
      showVideoInput: false,
      videoFilename: '',
      dragIndex: null,
      dragOverIndex: null,
      saveError: '',
      photoSizes: [
        { val: 'small', label: 'S' },
        { val: 'medium', label: 'M' },
        { val: 'large', label: 'L' },
      ],
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
  mounted() {
    window.addEventListener('keydown', this.onKeydown)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown)
    if (this.cropper) this.cropper.destroy()
  },
  methods: {
    flagUrl(code) {
      return `https://flagcdn.com/w80/${code.toLowerCase()}.png`
    },

    onKeydown(e) {
      if (e.key === 'Escape' && this.cropModal) this.closeCropModal()
    },

    // ── Crop editor ───────────────────────────────────────
    async openCropModal(item) {
      this.cropModal = item
      await this.$nextTick()
      if (this.cropper) { this.cropper.destroy(); this.cropper = null }
      this.cropper = new Cropper(this.$refs.cropperImage, {
        viewMode: 1,
        zoomOnWheel: true,
        background: true,
        autoCropArea: 0.85,
        movable: true,
        rotatable: false,
        scalable: false,
      })
    },

    closeCropModal() {
      if (this.cropper) { this.cropper.destroy(); this.cropper = null }
      this.cropModal = null
      this.isCropping = false
    },

    async applyCrop() {
      if (!this.cropper || !this.cropModal || this.isCropping) return
      this.isCropping = true
      try {
        const canvas = this.cropper.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200, imageSmoothingQuality: 'high' })
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        const result = await uploadPhoto({
          countryId: this.country.id,
          citySlug: this.citySlug,
          dataUrl,
        })
        if (result?.src) {
          this.cropModal.croppedSrc = result.src
          this.cropModal.crop = true
          await this.saveAll()
        }
      } catch (e) {
        this.saveError = e.message || 'Error al guardar el recorte'
      }
      this.isCropping = false
      this.closeCropModal()
    },

    // ── Album ─────────────────────────────────────────────
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

    refreshAlbum() {
      const rows = this.buildAlbumRows(JSON.parse(JSON.stringify(this.media)))
      this.$refs.albumSection.update(rows)
    },

    // ── Load ─────────────────────────────────────────────
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
      // AlbumSection is mounted by now (loadData is async, mount happens before awaits resolve)
      await this.$nextTick()
      if (this.$refs.albumSection) {
        const rows = this.buildAlbumRows(JSON.parse(JSON.stringify(this.media)))
        this.$refs.albumSection.update(rows)
      }
    },

    // ── Save ──────────────────────────────────────────────
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
      const all = Array.from(event.target.files)
      event.target.value = ''
      this.isUploading = true
      const files = []
      for (const f of all) {
        if (/\.heic$/i.test(f.name) || f.type === 'image/heic' || f.type === 'image/heif') {
          try {
            const blob = await heic2any({ blob: f, toType: 'image/jpeg', quality: 0.9 })
            files.push(new File([blob], f.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' }))
          } catch {
            this.saveError = `No se pudo convertir ${f.name}`
          }
        } else if (f.type.startsWith('image/')) {
          files.push(f)
        }
      }
      if (!files.length) { this.isUploading = false; return }
      for (let i = 0; i < files.length; i++) {
        this.uploadProgress = `${i + 1} / ${files.length}`
        const dataUrl = await this.compressImage(files[i])
        const result = await uploadPhoto({ countryId: this.country.id, citySlug: this.citySlug, dataUrl })
        if (result?.src) {
          this.media.push({
            id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
            type: 'photo', size: 'medium', crop: true, croppedSrc: null,
            src: result.src, caption: '',
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

    setSize(item, sz) { item.size = sz; this.saveAll() },
    setCrop(item, val) { item.crop = val; this.saveAll() },

    addVideo() {
      const name = this.videoFilename.trim()
      if (!name) return
      this.media.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, type: 'video', src: `/videos/${name}`, caption: '' })
      this.videoFilename = ''; this.showVideoInput = false; this.saveAll()
    },

    addText() {
      this.media.push({ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, type: 'text', content: '' })
      this.saveAll()
    },

    async removeMedia(index) {
      const item = this.media[index]
      if (item.type === 'photo') {
        await deletePhoto(item.src)
        if (item.croppedSrc) await deletePhoto(item.croppedSrc)
      }
      this.media.splice(index, 1)
      await this.saveAll()
    },

    onDragStart(e, index) { this.dragIndex = index; e.dataTransfer.effectAllowed = 'move' },
    onDragOver(_e, index) {
      this.dragOverIndex = index
      if (this.dragIndex === null || this.dragIndex === index) return
      const item = this.media.splice(this.dragIndex, 1)[0]
      this.media.splice(index, 0, item)
      this.dragIndex = index
    },
    onDragEnd() { this.dragIndex = null; this.dragOverIndex = null; this.saveAll() },
  },
}
</script>

<!-- Cropper.js global styles (must not be scoped) -->
<style>
@import 'cropperjs/dist/cropper.css';
</style>

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

/* ── Toolbar ─────────────────────────────────────────── */
.toolbar { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; flex-wrap: wrap; }
.toolbar-count { font-size: 0.75rem; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,0.25); flex: 1; }
.toolbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.toolbar-btn { display: inline-flex; align-items: center; gap: 7px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); border-radius: 10px; padding: 8px 16px; font-size: 0.84rem; font-weight: 600; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; transition: background 0.18s, border-color 0.18s, color 0.18s; }
.toolbar-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
.toolbar-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); color: #fff; border-color: rgba(255,255,255,0.22); }
.toolbar-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.toolbar-btn--rose { background: rgba(232,121,160,0.14); border-color: rgba(232,121,160,0.38); color: #f9a8d4; }
.toolbar-btn--rose:hover:not(:disabled) { background: rgba(232,121,160,0.26); border-color: rgba(232,121,160,0.6); color: #fff; }
.toolbar-btn--amber { background: rgba(245,158,11,0.13); border-color: rgba(245,158,11,0.34); color: #fcd34d; }
.toolbar-btn--amber:hover:not(:disabled) { background: rgba(245,158,11,0.24); border-color: rgba(245,158,11,0.58); color: #fef3c7; }

/* ── Video row ───────────────────────────────────────── */
.video-row { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 18px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 10px; }
.video-label { font-size: 0.82rem; color: rgba(255,255,255,0.42); }
.video-label code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 0.78rem; }
.video-inputs { display: flex; gap: 8px; align-items: center; }
.video-input { flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: #fff; font-size: 0.88rem; font-family: 'Space Grotesk', Arial, sans-serif; outline: none; }
.video-input:focus { border-color: rgba(168,85,247,0.4); }
.video-add-btn { background: rgba(168,85,247,0.15); border: 1px solid rgba(168,85,247,0.35); color: #c084fc; border-radius: 8px; padding: 8px 16px; font-size: 0.84rem; font-weight: 600; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; }
.video-add-btn:hover:not(:disabled) { background: rgba(168,85,247,0.26); }
.video-add-btn:disabled { opacity: 0.38; cursor: not-allowed; }
.video-cancel { background: transparent; border: none; color: rgba(255,255,255,0.3); font-size: 1rem; cursor: pointer; padding: 4px 8px; border-radius: 6px; }
.video-cancel:hover { color: rgba(255,255,255,0.65); }

/* ── Upload indicator ────────────────────────────────── */
.upload-indicator { display: flex; align-items: center; gap: 10px; padding: 10px 14px; margin-bottom: 14px; background: rgba(232,121,160,0.07); border: 1px solid rgba(232,121,160,0.18); border-radius: 10px; font-size: 0.84rem; color: rgba(232,121,160,0.8); }
.upload-spinner { width: 16px; height: 16px; border: 2px solid rgba(232,121,160,0.28); border-top-color: #e879a0; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
.upload-spinner--small { width: 12px; height: 12px; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Save error ──────────────────────────────────────── */
.save-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 14px; margin-bottom: 14px; background: rgba(248,113,113,0.09); border: 1px solid rgba(248,113,113,0.28); border-radius: 10px; font-size: 0.84rem; color: #fca5a5; }
.save-error button { background: none; border: none; color: inherit; cursor: pointer; }

/* ── Elements section ────────────────────────────────── */
.elements-section { margin-top: 4px; }
.section-header-row { display: flex; align-items: baseline; gap: 14px; margin-bottom: 14px; }
.section-label { font-size: 0.7rem; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: rgba(255,255,255,0.3); }
.drag-hint { font-size: 0.74rem; color: rgba(255,255,255,0.22); }

/* ── Media grid ──────────────────────────────────────── */
.media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }

/* ── Media card ──────────────────────────────────────── */
.media-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(168,85,247,0.13); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; transition: border-color 0.18s, transform 0.15s, opacity 0.15s; cursor: grab; }
.media-card:active { cursor: grabbing; }
.media-card.is-dragging { opacity: 0.4; transform: scale(0.97); border-color: rgba(232,121,160,0.5); }
.media-card.is-over { border-color: #e879a0; border-style: dashed; transform: scale(1.015); }
.media-card:hover:not(.is-dragging) { border-color: rgba(168,85,247,0.3); }
.card--text { border-color: rgba(245,158,11,0.18); }
.card--text:hover:not(.is-dragging) { border-color: rgba(245,158,11,0.38); }

.card-topbar { display: flex; align-items: center; gap: 6px; padding: 7px 10px; background: rgba(0,0,0,0.22); }
.card-handle { display: flex; align-items: center; color: rgba(255,255,255,0.2); cursor: grab; padding: 2px 4px; border-radius: 4px; transition: color 0.15s; }
.card-handle:hover { color: rgba(168,85,247,0.7); }
.card-handle svg { width: 14px; height: 14px; }
.card-type-badge { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; padding: 1px 6px; border-radius: 4px; }
.badge--photo { background: rgba(232,121,160,0.15); color: #f9a8d4; }
.badge--video { background: rgba(168,85,247,0.15); color: #c084fc; }
.badge--text { background: rgba(245,158,11,0.15); color: #fcd34d; }
.card-order { flex: 1; font-size: 0.68rem; font-weight: 700; letter-spacing: 1px; color: rgba(255,255,255,0.18); text-transform: uppercase; }
.card-delete { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; background: transparent; border: 1px solid transparent; border-radius: 6px; color: rgba(255,255,255,0.18); cursor: pointer; transition: color 0.15s, background 0.15s, border-color 0.15s; padding: 0; }
.card-delete svg { width: 13px; height: 13px; }
.card-delete:hover { color: #f87171; background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.3); }

/* ── Card preview ────────────────────────────────────── */
.card-preview { width: 100%; background: rgba(0,0,0,0.15); overflow: hidden; }
.card-preview--photo { position: relative; cursor: pointer; }
.card-img { width: 100%; height: 150px; object-fit: cover; display: block; transition: filter 0.2s; }
.card-preview--photo:hover .card-img { filter: brightness(0.65); }
.crop-edit-overlay {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 6px;
  color: #fff; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.5px;
  opacity: 0; transition: opacity 0.2s;
  font-family: 'Space Grotesk', Arial, sans-serif;
}
.crop-edit-overlay svg { width: 22px; height: 22px; }
.card-preview--photo:hover .crop-edit-overlay { opacity: 1; }
.card-video-wrap { width: 100%; }
.card-video { width: 100%; max-height: 150px; display: block; background: #000; }

/* ── Card controls ───────────────────────────────────── */
.card-controls-row { display: flex; background: rgba(0,0,0,0.14); border-top: 1px solid rgba(255,255,255,0.04); }
.card-ctrl-group { flex: 1; display: flex; flex-direction: column; gap: 4px; padding: 6px 10px; }
.card-ctrl-group + .card-ctrl-group { border-left: 1px solid rgba(255,255,255,0.05); }
.ctrl-label { font-size: 0.6rem; font-weight: 700; letter-spacing: 0.6px; color: rgba(255,255,255,0.26); text-transform: uppercase; }
.ctrl-buttons { display: flex; gap: 3px; }
.ctrl-btn { flex: 1; height: 22px; border-radius: 5px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09); color: rgba(255,255,255,0.35); font-size: 0.65rem; font-weight: 700; cursor: pointer; transition: all 0.15s; font-family: 'Space Grotesk', Arial, sans-serif; display: flex; align-items: center; justify-content: center; }
.ctrl-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); }
.ctrl-btn.active { background: rgba(168,85,247,0.22); border-color: rgba(168,85,247,0.55); color: #c084fc; }
.ctrl-btn--rose.active { background: rgba(232,121,160,0.18); border-color: rgba(232,121,160,0.45); color: #f9a8d4; }

.card-caption-wrap { padding: 7px 10px 9px; }
.card-caption { width: 100%; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.07); color: rgba(255,255,255,0.6); font-size: 0.82rem; font-family: 'Space Grotesk', Arial, sans-serif; padding: 4px 2px; outline: none; transition: border-color 0.18s; }
.card-caption:focus { border-bottom-color: rgba(232,121,160,0.45); }
.card-caption::placeholder { color: rgba(255,255,255,0.18); font-style: italic; }

/* ── Text card ───────────────────────────────────────── */
.card-text-body { padding: 10px; flex: 1; }
.card-text-input { width: 100%; box-sizing: border-box; background: rgba(245,158,11,0.05); border: 1px solid rgba(245,158,11,0.15); border-radius: 8px; padding: 10px 12px; color: rgba(255,255,255,0.75); font-size: 0.88rem; font-family: 'Space Grotesk', Arial, sans-serif; line-height: 1.6; resize: vertical; outline: none; transition: border-color 0.18s; }
.card-text-input:focus { border-color: rgba(245,158,11,0.42); }
.card-text-input::placeholder { color: rgba(255,255,255,0.2); font-style: italic; }

/* ── Empty state ─────────────────────────────────────── */
.media-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 260px; border: 1px dashed rgba(168,85,247,0.18); border-radius: 18px; gap: 10px; text-align: center; margin-top: 8px; }
.media-empty-icon { font-size: 3rem; opacity: 0.4; line-height: 1; }
.media-empty-title { font-size: 1rem; font-weight: 600; color: rgba(255,255,255,0.32); }
.media-empty-sub { font-size: 0.82rem; color: rgba(255,255,255,0.18); }
.not-found, .loading { color: rgba(255,255,255,0.35); font-size: 0.95rem; }

/* ── Refresh button ──────────────────────────────────── */
.refresh-row { display: flex; justify-content: center; margin: 36px 0 0; }
.refresh-btn { display: inline-flex; align-items: center; gap: 9px; background: rgba(168,85,247,0.14); border: 1px solid rgba(168,85,247,0.38); color: #c084fc; border-radius: 12px; padding: 11px 28px; font-size: 0.9rem; font-weight: 700; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px; }
.refresh-btn svg { width: 16px; height: 16px; flex-shrink: 0; }
.refresh-btn:hover { background: rgba(168,85,247,0.26); border-color: rgba(168,85,247,0.65); color: #e9d5ff; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(168,85,247,0.25); }

/* ── Crop modal ──────────────────────────────────────── */
.crop-modal-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fadeIn 0.18s ease; }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.crop-modal { background: #1a1a2e; border: 1px solid rgba(168,85,247,0.25); border-radius: 16px; display: flex; flex-direction: column; width: min(860px, 94vw); max-height: 92vh; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.6); }
.crop-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
.crop-modal-title { font-size: 0.9rem; font-weight: 700; color: rgba(255,255,255,0.8); letter-spacing: 0.5px; }
.crop-modal-x { background: transparent; border: none; color: rgba(255,255,255,0.4); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: color 0.15s, background 0.15s; }
.crop-modal-x:hover { color: #fff; background: rgba(255,255,255,0.08); }
.crop-modal-x svg { width: 16px; height: 16px; }
.crop-modal-body { flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center; background: #111; min-height: 0; }
.crop-source-img { display: block; max-width: 100%; max-height: 65vh; }
.crop-modal-footer { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; gap: 12px; }
.crop-modal-hint { font-size: 0.76rem; color: rgba(255,255,255,0.3); flex: 1; }
.crop-modal-actions { display: flex; gap: 8px; }
.crop-btn-cancel { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.55); border-radius: 9px; padding: 8px 18px; font-size: 0.84rem; font-weight: 600; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; transition: all 0.15s; }
.crop-btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.8); }
.crop-btn-cancel:disabled { opacity: 0.4; cursor: not-allowed; }
.crop-btn-apply { display: inline-flex; align-items: center; gap: 7px; background: rgba(168,85,247,0.2); border: 1px solid rgba(168,85,247,0.5); color: #e9d5ff; border-radius: 9px; padding: 8px 20px; font-size: 0.84rem; font-weight: 700; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; transition: all 0.15s; }
.crop-btn-apply:hover:not(:disabled) { background: rgba(168,85,247,0.35); border-color: rgba(168,85,247,0.7); }
.crop-btn-apply:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
