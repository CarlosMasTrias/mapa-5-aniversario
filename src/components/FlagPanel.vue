<template>
  <div class="fp" :class="{ 'fp--open': isOpen }">
    <!-- Tooltip fijo (evita clipping del scroll) -->
    <div v-if="tooltip.name" class="fp-tooltip" :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }">
      {{ tooltip.name }}
    </div>

    <!-- Barra superior / toggle -->
    <button class="fp-handle" @click="isOpen = !isOpen">
      <svg class="fp-chevron" :class="{ 'fp-chevron--up': !isOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <span class="fp-handle-title">Países del mundo</span>
      <span class="fp-handle-stats">
        <span class="fp-stats-visited">{{ visitedCount }}</span>
        <span class="fp-stats-sep"> / {{ ALL_COUNTRIES.length }}</span>
        <span class="fp-stats-label"> visitados</span>
      </span>
    </button>

    <!-- Barra de redimensionado (solo visible cuando está abierto) -->
    <div
      v-show="isOpen"
      class="fp-resize-handle"
      @mousedown.prevent="startDrag"
    >
      <span class="fp-resize-dots">⋯</span>
    </div>

    <!-- Contenido desplegable -->
    <div
      class="fp-body"
      :class="{ 'fp-body--dragging': isDragging }"
      :style="{ height: isOpen ? panelHeight + 'px' : '0' }"
    >
      <div class="fp-grid">
        <div
          v-for="c in sortedCountries"
          :key="c.id"
          class="fp-item"
          :class="{
            'fp-item--visited': visitedSet.has(c.id),
            'fp-item--locked': !visitedSet.has(c.id),
            'fp-item--clickable': visitedSet.has(c.id),
          }"
          @mouseenter="showTooltip($event, c.name)"
          @mouseleave="hideTooltip"
          @click="handleClick(c)"
        >
          <img class="fp-flag" :src="flagUrl(c.id)" :alt="c.name" loading="lazy" />
          <span v-if="!visitedSet.has(c.id)" class="fp-lock">🔒</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ALL_COUNTRIES } from '@/data/countries.js';
import { toSlug } from '@/utils/slug.js';

export default {
  name: 'FlagPanel',
  props: {
    countries: {
      type: Array,
      required: true,
    },
  },
  data() {
    return {
      ALL_COUNTRIES,
      isOpen: false,
      tooltip: { name: '', x: 0, y: 0 },
      panelHeight: 210,
      isDragging: false,
    };
  },
  beforeUnmount() {
    window.removeEventListener('mousemove', this.onDragMove);
    window.removeEventListener('mouseup', this.onDragStop);
  },
  computed: {
    visitedSet() {
      return new Set(this.countries);
    },
    visitedCount() {
      return this.countries.length;
    },
    sortedCountries() {
      return [...ALL_COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    },
  },
  methods: {
    flagUrl(code) {
      return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
    },
    showTooltip(event, name) {
      const rect = event.currentTarget.getBoundingClientRect();
      this.tooltip = {
        name,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      };
    },
    hideTooltip() {
      this.tooltip.name = '';
    },
    startDrag(e) {
      this.isDragging = true;
      this.dragStartY = e.clientY;
      this.dragStartHeight = this.panelHeight;
      window.addEventListener('mousemove', this.onDragMove);
      window.addEventListener('mouseup', this.onDragStop);
    },
    onDragMove(e) {
      const delta = this.dragStartY - e.clientY;
      const maxH = Math.round(window.innerHeight * 0.75);
      this.panelHeight = Math.max(60, Math.min(maxH, this.dragStartHeight + delta));
    },
    onDragStop() {
      this.isDragging = false;
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragStop);
    },
    handleClick(country) {
      if (!this.visitedSet.has(country.id)) return;
      this.$router.push('/' + toSlug(country.name));
    },
  },
};
</script>

<style scoped>
/* ── Panel contenedor ────────────────────────────────── */
.fp {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 300;
  font-family: 'Space Grotesk', Arial, sans-serif;
}

/* ── Tooltip fijo ────────────────────────────────────── */
.fp-tooltip {
  position: fixed;
  transform: translate(-50%, -100%);
  background: rgba(13, 17, 23, 0.95);
  color: #fff;
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  z-index: 9999;
  border: 1px solid rgba(168, 85, 247, 0.35);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

/* ── Barra toggle ────────────────────────────────────── */
.fp-handle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 20px;
  height: 44px;
  background: rgba(13, 17, 23, 0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: none;
  border-top: 1px solid rgba(168, 85, 247, 0.2);
  cursor: pointer;
  color: #fff;
  font-family: 'Space Grotesk', Arial, sans-serif;
  transition: background 0.2s;
}

.fp-handle:hover {
  background: rgba(20, 25, 35, 0.96);
}

.fp-chevron {
  width: 18px;
  height: 18px;
  color: #a855f7;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.fp-chevron--up {
  transform: rotate(180deg);
}

.fp-handle-title {
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.85);
  flex: 1;
  text-align: left;
}

.fp-handle-stats {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.4);
}

.fp-stats-visited {
  color: #a855f7;
  font-weight: 700;
}

.fp-stats-sep {
  color: rgba(255, 255, 255, 0.25);
}

/* ── Handle de redimensionado ────────────────────────── */
.fp-resize-handle {
  width: 100%;
  height: 12px;
  cursor: ns-resize;
  background: rgba(10, 14, 22, 0.97);
  border-top: 1px solid rgba(168, 85, 247, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  transition: border-color 0.18s;
}

.fp-resize-handle:hover {
  border-top-color: rgba(168, 85, 247, 0.6);
}

.fp-resize-handle:hover .fp-resize-dots {
  color: rgba(168, 85, 247, 0.9);
}

.fp-resize-dots {
  color: rgba(168, 85, 247, 0.35);
  font-size: 0.85rem;
  letter-spacing: 3px;
  line-height: 1;
  pointer-events: none;
  transition: color 0.18s;
}

/* ── Cuerpo desplegable ──────────────────────────────── */
.fp-body {
  height: 0;
  overflow: hidden;
  background: rgba(10, 14, 22, 0.97);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: height 0.3s ease;
  overflow-y: auto;
}

.fp-body--dragging {
  transition: none;
}

.fp-body::-webkit-scrollbar {
  height: 4px;
  width: 4px;
}

.fp-body::-webkit-scrollbar-track {
  background: transparent;
}

.fp-body::-webkit-scrollbar-thumb {
  background: rgba(168, 85, 247, 0.3);
  border-radius: 99px;
}

/* ── Grid de banderas ────────────────────────────────── */
.fp-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 14px 18px;
}

/* ── Ítem bandera ────────────────────────────────────── */
.fp-item {
  position: relative;
  width: 52px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: border-color 0.18s, background 0.18s, transform 0.15s;
  user-select: none;
  overflow: hidden;
}

.fp-item--visited {
  border-color: rgba(168, 85, 247, 0.25);
  background: rgba(168, 85, 247, 0.06);
}

.fp-item--locked {
  filter: grayscale(1);
  opacity: 0.28;
}

.fp-item--clickable {
  cursor: pointer;
}

.fp-item--clickable:hover {
  border-color: rgba(168, 85, 247, 0.8);
  background: rgba(168, 85, 247, 0.12);
  transform: scale(1.15);
  filter: none;
  opacity: 1;
  z-index: 1;
  overflow: visible;
}

.fp-item--locked:hover {
  opacity: 0.42;
}

.fp-flag {
  width: 40px;
  height: 27px;
  object-fit: cover;
  border-radius: 3px;
  display: block;
}

.fp-lock {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 0.52rem;
  line-height: 1;
  opacity: 0.8;
}
</style>
