<template>
  <div v-if="rows.length > 0">
    <div class="album-divider">
      <div class="album-divider-line"></div>
      <span class="album-divider-text">Álbum de viaje</span>
      <div class="album-divider-line"></div>
    </div>
    <div class="album" ref="albumEl">
      <div class="album-canvas" :style="{ height: layout.totalH + 'px' }">
        <template v-for="p in layout.placed" :key="p.item.id">

          <div v-if="p.item.type === 'photo'"
            class="album-photo"
            :style="{ left: p.x + 'px', top: p.y + 'px', '--rot': photoRotation(p.item) + 'deg' }"
            @click="openLightbox(p.item)">
            <img :src="imgSrc(p.item)" class="album-photo-img"
              :style="{ width: p.imgW + 'px', height: p.imgH + 'px' }" />
            <p v-if="p.item.caption" class="album-photo-caption">{{ p.item.caption }}</p>
          </div>

          <div v-else-if="p.item.type === 'text'"
            class="album-text"
            :style="{ left: p.x + 'px', top: p.y + 'px', width: p.w + 'px' }">
            {{ p.item.content }}
          </div>

          <div v-else
            class="album-video"
            :style="{ left: p.x + 'px', top: p.y + 'px', width: p.w + 'px' }"
            @click="openLightbox(p.item)">
            <video :src="p.item.src" class="album-video-el" preload="metadata" />
            <div class="album-video-play">
              <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
            <p v-if="p.item.caption" class="album-video-caption">{{ p.item.caption }}</p>
          </div>

        </template>
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
// Frame padding constants (must match CSS)
const FPH = 16 // horizontal frame padding: 8px left + 8px right
const FPV = 40 // vertical frame padding: 8px top + 32px bottom
const GAP = 20 // gap between items

export default {
  name: 'AlbumSection',
  data() {
    return {
      rows: [],
      lightboxItem: null,
      aspectRatios: {},   // { [itemId]: naturalWidth/naturalHeight }
      containerWidth: 0,
    }
  },
  computed: {
    layout() {
      const W = this.containerWidth || Math.max(400, window.innerWidth - 160)
      if (!this.rows.length) return { placed: [], totalH: 0 }

      const vh = window.innerHeight
      const sizeH = {
        large:  Math.round(vh * 0.88),
        medium: Math.round(vh * 0.44),
        small:  Math.round(vh * 0.29),
      }

      const items = this.rows.flat().map(c => c.item)

      // Compute frame dimensions for each item
      const dims = items.map(item => {
        if (item.type === 'photo') {
          const imgH = sizeH[item.size || 'medium']
          const ratio = this.aspectRatios[item.id] ?? 1.33 // default 4:3 while loading
          const imgW = Math.min(Math.round(ratio * imgH), W - FPH)
          return { item, w: imgW + FPH, h: imgH + FPV, imgW, imgH }
        }
        if (item.type === 'video') {
          const h = Math.round(W * 9 / 16)
          return { item, w: W, h, imgW: W, imgH: h }
        }
        // text: full width, height estimated from content length
        const lines = Math.ceil((item.content?.length || 60) / 55)
        const h = Math.max(100, lines * 30 + 48)
        return { item, w: W, h, imgW: W, imgH: h }
      })

      // Skyline bin-packing algorithm
      // sky = sorted array of non-overlapping segments { x1, x2, y }
      // y = current "floor" (top of available space) at each x position
      let sky = [{ x1: 0, x2: W, y: 0 }]
      const placed = []

      for (const d of dims) {
        const { w, h } = d

        // Find best position: minimum y, leftmost x among ties
        let bestX = 0, bestY = Infinity

        for (const seg of sky) {
          const x = seg.x1
          if (x + w > W) continue  // item doesn't fit from here

          // Find the maximum floor in the range [x, x+w]
          let maxY = 0
          for (const s of sky) {
            if (s.x2 <= x || s.x1 >= x + w) continue
            if (s.y > maxY) maxY = s.y
          }

          if (maxY < bestY || (maxY === bestY && x < bestX)) {
            bestY = maxY
            bestX = x
          }
        }

        if (bestY === Infinity) {
          // No valid position: start fresh row at current maximum floor
          bestY = Math.max(...sky.map(s => s.y))
          bestX = 0
          sky = [{ x1: 0, x2: W, y: bestY }]
        }

        // Add vertical gap only when stacking below something
        const placeY = bestY > 0 ? bestY + GAP : 0

        placed.push({ item: d.item, x: bestX, y: placeY, w: d.w, h: d.h, imgW: d.imgW, imgH: d.imgH })

        // Update skyline: frame occupies [bestX, min(bestX+w+GAP, W)]
        // The +GAP on x2 reserves horizontal gap space for the next neighbour
        const updateX2 = Math.min(bestX + w + GAP, W)
        sky = this.skyUpdate(sky, bestX, updateX2, placeY + h)
      }

      // Center each visual row (group items by their top-y, then shift to center)
      const rowMap = new Map()
      for (const p of placed) {
        if (!rowMap.has(p.y)) rowMap.set(p.y, [])
        rowMap.get(p.y).push(p)
      }
      for (const rowItems of rowMap.values()) {
        const minX = Math.min(...rowItems.map(p => p.x))
        const maxX = Math.max(...rowItems.map(p => p.x + p.w))
        const offset = Math.round((W - (maxX - minX)) / 2) - minX
        for (const p of rowItems) p.x += offset
      }

      const totalH = Math.max(...sky.map(s => s.y)) + GAP * 2
      return { placed, totalH }
    },
  },
  watch: {
    rows(newRows) {
      this.$nextTick(() => this.measureContainer())
      this.loadAspectRatios(newRows.flat().map(c => c.item))
    },
  },
  mounted() {
    window.addEventListener('keydown', this.onKeydown)
    window.addEventListener('resize', this.onResize)
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.onKeydown)
    window.removeEventListener('resize', this.onResize)
  },
  methods: {
    update(rows) {
      this.rows = rows
    },

    measureContainer() {
      if (this.$refs.albumEl) {
        // albumEl clientWidth includes its own 32px*2 padding
        this.containerWidth = this.$refs.albumEl.clientWidth - 64
      }
    },

    onResize() { this.measureContainer() },

    onKeydown(e) {
      if (e.key === 'Escape' && this.lightboxItem) this.lightboxItem = null
    },

    openLightbox(item) { this.lightboxItem = item },

    imgSrc(item) {
      return item.crop !== false && item.croppedSrc ? item.croppedSrc : item.src
    },

    loadAspectRatios(items) {
      for (const item of items) {
        if (item.type !== 'photo' || this.aspectRatios[item.id] !== undefined) continue
        const img = new Image()
        img.onload = () => {
          this.aspectRatios[item.id] = img.naturalWidth / img.naturalHeight
        }
        img.src = this.imgSrc(item)
      }
    },

    photoRotation(item) {
      const id = item.id || ''
      let h = 0
      for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) | 0
      const maxRot = { small: 3.5, medium: 2, large: 0.7 }[item.size || 'medium']
      return (((((h >>> 0) % 1000) / 1000) * 2 - 1) * maxRot).toFixed(2)
    },

    // Update the skyline: raise floor to newY in range [x1, x2]
    skyUpdate(sky, x1, x2, newY) {
      const result = []
      for (const s of sky) {
        if (s.x2 <= x1 || s.x1 >= x2) {
          result.push({ ...s })
        } else {
          if (s.x1 < x1) result.push({ x1: s.x1, x2: x1, y: s.y })
          result.push({ x1: Math.max(s.x1, x1), x2: Math.min(s.x2, x2), y: newY })
          if (s.x2 > x2) result.push({ x1: x2, x2: s.x2, y: s.y })
        }
      }
      result.sort((a, b) => a.x1 - b.x1)
      // Merge adjacent segments with same y
      const merged = []
      for (const s of result) {
        const last = merged[merged.length - 1]
        if (last && last.y === s.y && last.x2 === s.x1) last.x2 = s.x2
        else merged.push({ ...s })
      }
      return merged
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

.album-canvas { position: relative; }

.album-photo { position: absolute; background: #fff; padding: 8px 8px 32px; box-shadow: 2px 5px 18px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.08); transform: rotate(var(--rot, 0deg)); transform-origin: center; transition: transform 0.3s ease, box-shadow 0.3s ease; z-index: 1; cursor: zoom-in; }
.album-photo:hover { transform: rotate(0deg) scale(1.05) !important; box-shadow: 4px 10px 40px rgba(0,0,0,0.26); z-index: 20; }
.album-photo::before { content: ''; position: absolute; top: -10px; left: 50%; transform: translateX(-50%) rotate(-1.5deg); width: 50px; height: 16px; background: rgba(255,232,100,0.68); border-radius: 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
.album-photo-img { display: block; }
.album-photo-caption { text-align: center; padding-top: 5px; font-size: 0.7rem; color: #7a6555; font-style: italic; line-height: 1.4; font-family: Georgia, serif; }

.album-text { position: absolute; background: #fffdf4; border: 1px solid rgba(180,155,120,0.28); border-radius: 3px; padding: 16px 18px; box-shadow: 1px 3px 10px rgba(0,0,0,0.07); font-family: Georgia, 'Times New Roman', serif; font-size: 0.92rem; line-height: 1.85; color: #4a3828; font-style: italic; white-space: pre-wrap; word-break: break-word; box-sizing: border-box; background-image: repeating-linear-gradient(transparent, transparent 28px, rgba(160,135,110,0.11) 28px, rgba(160,135,110,0.11) 29px); background-size: 100% 29px; background-position: 0 18px; }

.album-video { position: absolute; background: #111; border-radius: 6px; overflow: hidden; box-shadow: 2px 5px 20px rgba(0,0,0,0.28); cursor: zoom-in; }
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
