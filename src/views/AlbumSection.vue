<template>
  <div v-if="rows.length > 0">
    <div class="album-divider">
      <div class="album-divider-line"></div>
      <span class="album-divider-text">Álbum de viaje</span>
      <div class="album-divider-line"></div>
    </div>
    <div class="album">
      <div v-for="(row, ri) in rows" :key="ri" class="album-row">
        <div v-for="cell in row" :key="cell.item.id" class="album-cell"
          :style="cell.item.type !== 'photo' ? { flex: cell.w } : {}">

          <div v-if="cell.item.type === 'photo'" class="album-photo"
            :style="{ '--rot': photoRotation(cell.item) + 'deg' }"
            @click="openLightbox(cell.item)">
            <img
              :src="cell.item.crop !== false && cell.item.croppedSrc ? cell.item.croppedSrc : cell.item.src"
              class="album-photo-img"
              :style="photoImgStyle(cell.item)" />
            <p v-if="cell.item.caption" class="album-photo-caption">{{ cell.item.caption }}</p>
          </div>

          <div v-else-if="cell.item.type === 'text'" class="album-text">{{ cell.item.content }}</div>

          <div v-else class="album-video" @click="openLightbox(cell.item)">
            <video :src="cell.item.src" class="album-video-el" preload="metadata" />
            <div class="album-video-play">
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <p v-if="cell.item.caption" class="album-video-caption">{{ cell.item.caption }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="lightboxItem" class="lightbox" @click.self="lightboxItem = null">
      <button class="lightbox-close" @click="lightboxItem = null">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="lightbox-content" @click.stop>
        <img v-if="lightboxItem.type === 'photo'" :src="lightboxItem.src" class="lightbox-img" />
        <video v-else :src="lightboxItem.src" controls autoplay class="lightbox-video" />
        <p v-if="lightboxItem.caption" class="lightbox-caption">{{ lightboxItem.caption }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AlbumSection',
  data() {
    return {
      rows: [],
      lightboxItem: null,
    }
  },
  mounted() {
    window.addEventListener('keydown', this.onKeydown)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown)
  },
  methods: {
    update(rows) {
      this.rows = rows
    },
    onKeydown(e) {
      if (e.key === 'Escape' && this.lightboxItem) this.lightboxItem = null
    },
    openLightbox(item) {
      this.lightboxItem = item
    },
    photoRotation(item) {
      const id = item.id || ''
      let h = 0
      for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) | 0
      const maxRot = { small: 3.5, medium: 2, large: 0.7 }[item.size || 'medium']
      const norm = ((h >>> 0) % 1000) / 1000
      return ((norm * 2 - 1) * maxRot).toFixed(2)
    },
    photoImgStyle(item) {
      const h = { large: '90vh', medium: '45vh', small: '30vh' }[item.size || 'medium']
      return { height: h, width: 'auto', display: 'block' }
    },
  },
}
</script>

<style scoped>
.album-divider { display: flex; align-items: center; gap: 16px; margin-bottom: 28px; margin-top: 32px; }
.album-divider-line { flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
.album-divider-text { font-size: 0.68rem; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.22); white-space: nowrap; }

.album { background: #f4efe6; border-radius: 20px; padding: 36px 32px; box-shadow: 0 12px 70px rgba(0,0,0,0.4), 0 2px 12px rgba(0,0,0,0.2); position: relative; }
.album::before { content: ''; position: absolute; inset: 0; border-radius: 20px; pointer-events: none; background: radial-gradient(ellipse at 15% 15%, rgba(255,255,255,0.45) 0%, transparent 55%), radial-gradient(ellipse at 85% 85%, rgba(210,190,165,0.3) 0%, transparent 55%); }

.album-row { display: flex; gap: 24px; margin-bottom: 36px; align-items: flex-start; position: relative; flex-wrap: wrap; }
.album-row:last-child { margin-bottom: 0; }
.album-cell { display: flex; flex-direction: column; align-items: flex-start; }

.album-photo { background: #fff; padding: 8px 8px 32px; box-shadow: 2px 5px 18px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08); transform: rotate(var(--rot, 0deg)); transform-origin: center; transition: transform 0.3s ease, box-shadow 0.3s ease; position: relative; z-index: 1; cursor: zoom-in; width: fit-content; overflow: visible; }
.album-photo:hover { transform: rotate(0deg) scale(1.05) !important; box-shadow: 4px 10px 40px rgba(0,0,0,0.26); z-index: 20; }
.album-photo::before { content: ''; position: absolute; top: -10px; left: 50%; transform: translateX(-50%) rotate(-1.5deg); width: 50px; height: 16px; background: rgba(255,232,100,0.68); border-radius: 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
.album-photo-img { display: block; }
.album-photo-caption { text-align: center; padding-top: 5px; font-size: 0.7rem; color: #7a6555; font-style: italic; line-height: 1.4; font-family: Georgia, serif; }

.album-text { background: #fffdf4; border: 1px solid rgba(180,155,120,0.28); border-radius: 3px; padding: 16px 18px; box-shadow: 1px 3px 10px rgba(0,0,0,0.07); font-family: Georgia, 'Times New Roman', serif; font-size: 0.92rem; line-height: 1.85; color: #4a3828; font-style: italic; min-height: 60px; white-space: pre-wrap; word-break: break-word; background-image: repeating-linear-gradient(transparent, transparent 28px, rgba(160,135,110,0.11) 28px, rgba(160,135,110,0.11) 29px); background-size: 100% 29px; background-position: 0 18px; }

.album-video { background: #111; border-radius: 6px; overflow: hidden; box-shadow: 2px 5px 20px rgba(0,0,0,0.28); position: relative; cursor: zoom-in; }
.album-video-el { width: 100%; aspect-ratio: 16/9; display: block; }
.album-video-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.35); transition: background 0.2s; }
.album-video:hover .album-video-play { background: rgba(0,0,0,0.18); }
.album-video-play svg { width: 36px; height: 36px; color: rgba(255,255,255,0.9); filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5)); }
.album-video-caption { margin: 0; padding: 6px 10px 8px; background: #111; text-align: center; font-size: 0.7rem; color: rgba(255,255,255,0.4); font-style: italic; font-family: Georgia, serif; }

.lightbox { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.92); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fadeIn 0.18s ease; }
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
.lightbox-close { position: fixed; top: 20px; right: 24px; width: 42px; height: 42px; border-radius: 50%; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.8); cursor: pointer; z-index: 1001; display: flex; align-items: center; justify-content: center; transition: background 0.18s; }
.lightbox-close:hover { background: rgba(255,255,255,0.2); color: #fff; }
.lightbox-close svg { width: 18px; height: 18px; }
.lightbox-content { max-width: 90vw; max-height: 90vh; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.lightbox-img { max-width: 100%; max-height: 82vh; object-fit: contain; border-radius: 4px; box-shadow: 0 8px 60px rgba(0,0,0,0.6); }
.lightbox-video { max-width: 100%; max-height: 82vh; border-radius: 4px; box-shadow: 0 8px 60px rgba(0,0,0,0.6); }
.lightbox-caption { font-size: 0.85rem; color: rgba(255,255,255,0.5); font-style: italic; text-align: center; }
</style>
