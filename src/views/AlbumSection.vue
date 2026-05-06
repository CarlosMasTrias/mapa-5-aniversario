<template>
  <div v-if="layout.placed.length > 0">
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
            class="album-postit"
            :style="{ left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', '--rot': photoRotation(p.item) + 'deg' }">
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
const FPH = 16
const FPV = 40
const GAP = 20

export default {
  name: 'AlbumSection',
  data() {
    return {
      rows: [],
      layout: { placed: [], totalH: 0 },
      lightboxItem: null,
      aspectRatios: {},
      containerWidth: 0,
    }
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
      this.$nextTick(() => {
        this.measureContainer()
        this.layout = this._buildLayout(rows)
        this._loadMissingRatios(rows.flat().map(c => c.item))
      })
    },

    measureContainer() {
      if (this.$refs.albumEl) {
        this.containerWidth = this.$refs.albumEl.clientWidth - 64
      }
    },

    onResize() {
      this.measureContainer()
      if (this.rows.length) {
        this.layout = this._buildLayout(this.rows)
      }
    },

    onKeydown(e) {
      if (e.key === 'Escape' && this.lightboxItem) this.lightboxItem = null
    },

    openLightbox(item) { this.lightboxItem = item },

    imgSrc(item) {
      return item.crop !== false && item.croppedSrc ? item.croppedSrc : item.src
    },

    _loadMissingRatios(items) {
      const toLoad = items.filter(
        item => item.type === 'photo' && this.aspectRatios[item.id] === undefined
      )
      if (!toLoad.length) return

      const promises = toLoad.map(item => new Promise(resolve => {
        const img = new Image()
        img.onload = () => {
          this.aspectRatios[item.id] = img.naturalWidth / img.naturalHeight
          resolve()
        }
        img.onerror = () => resolve()
        img.src = this.imgSrc(item)
      }))

      // One single recompute after ALL missing ratios are loaded
      Promise.all(promises).then(() => {
        this.layout = this._buildLayout(this.rows)
      })
    },

    _buildLayout(rows) {
      const W = this.containerWidth || Math.max(400, window.innerWidth - 160)
      if (!rows.length) return { placed: [], totalH: 0 }

      const vh = window.innerHeight
      const sizeH = {
        large:  Math.round(vh * 0.88),
        medium: Math.round(vh * 0.44),
        small:  Math.round(vh * 0.29),
      }

      const items = rows.flat().map(c => c.item)

      const dims = items.map(item => {
        if (item.type === 'photo') {
          const imgH = sizeH[item.size || 'medium']
          const ratio = this.aspectRatios[item.id] ?? 1.33
          const imgW = Math.min(Math.round(ratio * imgH), W - FPH)
          return { item, w: imgW + FPH, h: imgH + FPV, imgW, imgH }
        }
        if (item.type === 'video') {
          const h = Math.round(W * 9 / 16)
          return { item, w: W, h, imgW: W, imgH: h }
        }
        const vw = window.innerWidth
        const textW = Math.min(
          { l: Math.round(vw / 3), m: Math.round(vw / 4), s: Math.round(vw / 5) }[item.size || 'm'],
          W
        )
        const content = item.content || ''
        const charsPerLine = Math.max(1, Math.floor((textW - 28) / 8))
        const lines = content.split('\n').reduce((acc, line) => {
          return acc + Math.max(1, Math.ceil((line.length || 1) / charsPerLine))
        }, 0) || 1
        const h = 32 + lines * 24
        return { item, w: textW, h, imgW: textW, imgH: h }
      })

      let sky = [{ x1: 0, x2: W, y: 0 }]
      const placed = []

      for (const d of dims) {
        const { w, h } = d
        let bestX = 0, bestY = Infinity

        for (const seg of sky) {
          const x = seg.x1
          if (x + w > W) continue
          let maxY = 0
          for (const s of sky) {
            if (s.x2 <= x || s.x1 >= x + w) continue
            if (s.y > maxY) maxY = s.y
          }
          if (maxY < bestY || (maxY === bestY && x < bestX)) {
            bestY = maxY; bestX = x
          }
        }

        if (bestY === Infinity) {
          bestY = Math.max(...sky.map(s => s.y))
          bestX = 0
          sky = [{ x1: 0, x2: W, y: bestY }]
        }

        const placeY = bestY > 0 ? bestY + GAP : 0
        placed.push({ item: d.item, x: bestX, y: placeY, w: d.w, h: d.h, imgW: d.imgW, imgH: d.imgH })

        const updateX2 = Math.min(bestX + w + GAP, W)
        sky = this._skyUpdate(sky, bestX, updateX2, placeY + h)
      }

      // Center each visual row — only if centering won't cause overlaps with other items
      const rowMap = new Map()
      for (const p of placed) {
        if (!rowMap.has(p.y)) rowMap.set(p.y, [])
        rowMap.get(p.y).push(p)
      }
      const rowList = [...rowMap.values()].sort((a, b) => a[0].y - b[0].y)
      for (const rowItems of rowList) {
        const minX = Math.min(...rowItems.map(p => p.x))
        const maxX = Math.max(...rowItems.map(p => p.x + p.w))
        const offset = Math.round((W - (maxX - minX)) / 2) - minX
        if (!offset) continue
        const wouldOverlap = placed.some(other => {
          if (rowItems.includes(other)) return false
          return rowItems.some(item => {
            if (item.y + item.h <= other.y || other.y + other.h <= item.y) return false
            const nx = item.x + offset
            return nx < other.x + other.w && nx + item.w > other.x
          })
        })
        if (!wouldOverlap) {
          for (const p of rowItems) p.x += offset
        }
      }

      const totalH = Math.max(...sky.map(s => s.y)) + GAP * 2
      return { placed, totalH }
    },

    photoRotation(item) {
      const id = item.id || ''
      let h = 0
      for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) | 0
      const maxRot = item.type === 'text'
        ? 2.5
        : { small: 3.5, medium: 2, large: 0.7 }[item.size || 'medium']
      return (((((h >>> 0) % 1000) / 1000) * 2 - 1) * maxRot).toFixed(2)
    },

    _skyUpdate(sky, x1, x2, newY) {
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

.album-postit { position: absolute; background: #fef08a; padding: 14px 14px 16px; box-shadow: 3px 6px 16px rgba(0,0,0,0.18), 0 1px 4px rgba(0,0,0,0.1); transform: rotate(var(--rot, 0deg)); transform-origin: center; transition: transform 0.3s ease, box-shadow 0.3s ease; z-index: 2; font-family: Georgia, 'Times New Roman', serif; font-size: 0.88rem; line-height: 1.65; color: #3d2e00; font-style: italic; white-space: pre-wrap; word-break: break-word; box-sizing: border-box; }
.album-postit::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 5px; background: rgba(0,0,0,0.07); }
.album-postit:hover { transform: rotate(0deg) scale(1.04) !important; box-shadow: 5px 10px 32px rgba(0,0,0,0.24); z-index: 20; }

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
