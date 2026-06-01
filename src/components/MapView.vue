<template>
  <div class="map-wrapper">
    <div id="chartdiv"></div>

    <!-- Popup: marcar país como visitado -->
    <div v-if="popup.visible" class="visit-popup-overlay" @click.self="closePopup">
      <div class="visit-popup">
        <p class="popup-country-name">{{ popup.countryName }}</p>
        <p class="popup-question">¿Has visitado este país?</p>
        <div class="popup-buttons">
          <button class="popup-btn popup-btn-no" @click="closePopup">No</button>
          <button class="popup-btn popup-btn-yes" @click="confirmVisit">Sí</button>
        </div>
      </div>
    </div>

    <div class="country-counter">
      <div class="counter-icon">✈️</div>
      <div class="counter-nums">
        <span class="visited-num">{{ displayCountries.length }}</span>
        <span class="slash">/</span>
        <span class="total-num">195</span>
      </div>
      <p class="counter-label">países visitados</p>
      <div class="progress-row">
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: progressPct + '%' }"></div>
        </div>
        <span class="progress-text">{{ progressPct }}%</span>
      </div>
    </div>
    <FlagPanel :countries="displayCountries" />
  </div>
</template>

<script>
import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import worldHigh from "@amcharts/amcharts5-geodata/worldHigh";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import FlagPanel from './FlagPanel.vue';
import { COUNTRY_NAMES } from '@/data/countries.js';
import { toSlug } from '@/utils/slug.js';
import { secretStore } from '@/store/secret.js';

// Países no visitados: gris apagado para que parezcan "bloqueados"
const LOCKED_FILL   = 0x37474F;
const LOCKED_STROKE = 0x455A64;
const LOCKED_HOVER  = 0x546E7A;

// Color único por país visitado (paleta Material Design 500).
// Restricción verificada: ningún par de países con frontera comparte color.
const COUNTRY_COLORS = {
  US: 0xFF5722, // Deep Orange
  MX: 0xCDDC39, // Lime
  CR: 0x009688, // Teal
  ES: 0xFFC107, // Amber
  PT: 0x673AB7, // Deep Purple
  FR: 0xF44336, // Red
  GB: 0x8BC34A, // Light Green
  IE: 0x3F51B5, // Indigo
  IT: 0x9C27B0, // Purple
  SK: 0xE91E63, // Pink
  CH: 0x4CAF50, // Green
  AT: 0x2196F3, // Blue
  SE: 0x03A9F4, // Light Blue
  FI: 0xFDD835, // Yellow
  VA: 0xFF9800, // Orange
  AD: 0x00BCD4, // Cyan
  HU: 0x43A047, // Green 600 — secreto
};

const COUNTRY_HOVER_COLORS = {
  US: 0xBF360C,
  MX: 0x827717,
  CR: 0x004D40,
  ES: 0xFF6F00,
  PT: 0x311B92,
  FR: 0xC62828,
  GB: 0x33691E,
  IE: 0x1A237E,
  IT: 0x6A1B9A,
  SK: 0x880E4F,
  CH: 0x2E7D32,
  AT: 0x1565C0,
  SE: 0x01579B,
  FI: 0xF57F17,
  VA: 0xE65100,
  AD: 0x006064,
  HU: 0x2E7D32, // Green 800
};

// Paleta de colores para países desbloqueados que no tienen color asignado
const DEFAULT_COLOR_POOL = [
  0x26A69A, 0x66BB6A, 0xFF7043, 0xAB47BC, 0x42A5F5,
  0xEC407A, 0xFFA726, 0x26C6DA, 0xD4E157, 0x8D6E63,
  0x78909C, 0xEF5350, 0x29B6F6, 0x9CCC65, 0xFFCA28,
  0x5C6BC0, 0xF06292, 0x4DB6AC, 0xFFB74D, 0x80CBC4,
];
const DEFAULT_HOVER_POOL = [
  0x00695C, 0x2E7D32, 0xBF360C, 0x6A1B9A, 0x0D47A1,
  0x880E4F, 0xE65100, 0x006064, 0x827717, 0x4E342E,
  0x37474F, 0xC62828, 0x01579B, 0x33691E, 0xFF8F00,
  0x283593, 0xAD1457, 0x00695C, 0xEF6C00, 0x004D40,
];

function hashId(id) {
  return id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}
function getVisitedColor(id) {
  if (COUNTRY_COLORS[id] !== undefined) return COUNTRY_COLORS[id];
  return DEFAULT_COLOR_POOL[hashId(id) % DEFAULT_COLOR_POOL.length];
}
function getHoverColor(id) {
  if (COUNTRY_HOVER_COLORS[id] !== undefined) return COUNTRY_HOVER_COLORS[id];
  return DEFAULT_HOVER_POOL[hashId(id) % DEFAULT_HOVER_POOL.length];
}

const MICRO_STATES_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'VA',
      properties: { name: 'Ciudad del Vaticano' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [12.4534, 41.9279],
          [12.4767, 41.9206],
          [12.4864, 41.9029],
          [12.4767, 41.8852],
          [12.4534, 41.8779],
          [12.4301, 41.8852],
          [12.4204, 41.9029],
          [12.4301, 41.9206],
          [12.4534, 41.9279],
        ]],
      },
    },
  ],
};

export default {
  name: 'MapView',
  components: { FlagPanel },
  props: {
    countries: {
      type: Array,
      required: true,
    },
  },
  emits: ['country-unlocked'],
  data() {
    return {
      root: null,
      polygonSeries: null,
      tinySeries: null,
      popup: { visible: false, countryId: null, countryName: null },
    };
  },
  computed: {
    hungaryRevealed() {
      return secretStore.hungaryRevealed;
    },
    displayCountries() {
      if (!secretStore.hungaryRevealed) {
        return this.countries.filter(id => id !== 'HU');
      }
      return this.countries;
    },
    progressPct() {
      return Math.round(this.displayCountries.length / 195 * 1000) / 10;
    },
  },
  watch: {
    countries: {
      deep: true,
      handler(newVal) {
        const visitedSet = new Set(newVal);
        const applyFills = (series) => {
          if (!series) return;
          series.mapPolygons.each(polygon => {
            const ctx = polygon.dataItem?.dataContext;
            if (!ctx) return;
            const id = ctx.id;
            const isVisited = visitedSet.has(id);
            ctx.visited = isVisited;
            if (id === 'HU' && !secretStore.hungaryRevealed) {
              polygon.set('fill', am5.color(LOCKED_FILL));
            } else {
              polygon.set('fill', am5.color(isVisited ? getVisitedColor(id) : LOCKED_FILL));
            }
          });
        };
        applyFills(this.polygonSeries);
        applyFills(this.tinySeries);
      },
    },
    hungaryRevealed(revealed) {
      this.updateHungaryVisuals(revealed);
    },
  },
  mounted() {
    const root = am5.Root.new("chartdiv");
    root.setThemes([am5themes_Animated.new(root)]);

    const chart = root.container.children.push(
      am5map.MapChart.new(root, {
        panX: "translateX",
        panY: "translateY",
        projection: am5map.geoMercator(),
      })
    );

    const polygonSeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: worldHigh,
        exclude: ["AQ", "VA"],
      })
    );

    polygonSeries.mapPolygons.template.setAll({
      fill: am5.color(LOCKED_FILL),
      stroke: am5.color(LOCKED_STROKE),
      strokeWidth: 0.5,
      tooltipText: "{name}",
      toggleKey: "active",
      interactive: true,
      templateField: "polygonSettings",
    });

    polygonSeries.mapPolygons.template.states.create("active", {
      fill: am5.color(LOCKED_HOVER),
    });

    polygonSeries.mapPolygons.template.events.on("pointerover", (ev) => {
      const ctx = ev.target.dataItem?.dataContext;
      if (ctx?.id === 'HU' && !secretStore.hungaryRevealed) {
        ev.target.set("fill", am5.color(LOCKED_HOVER));
        return;
      }
      const color = ctx?.visited ? getHoverColor(ctx.id) : LOCKED_HOVER;
      ev.target.set("fill", am5.color(color));
    });

    polygonSeries.mapPolygons.template.events.on("pointerout", (ev) => {
      const ctx = ev.target.dataItem?.dataContext;
      if (ctx?.id === 'HU' && !secretStore.hungaryRevealed) {
        ev.target.set("fill", am5.color(LOCKED_FILL));
        return;
      }
      const color = ctx?.visited ? getVisitedColor(ctx.id) : LOCKED_FILL;
      ev.target.set("fill", am5.color(color));
    });

    polygonSeries.mapPolygons.template.events.on("click", (event) => {
      const ctx = event.target.dataItem.dataContext;
      if (ctx.id === 'HU' && !secretStore.hungaryRevealed) return;
      const name = COUNTRY_NAMES[ctx.id] || ctx.id;
      if (ctx.visited) {
        this.$router.push('/' + toSlug(name));
      } else {
        this.showPopup(ctx.id, name);
      }
    });

    let previousPolygon;
    polygonSeries.mapPolygons.template.on("active", function (_active, target) {
      if (previousPolygon && previousPolygon !== target) {
        previousPolygon.set("active", false);
      }
      previousPolygon = target;
    });

    const zoomControl = chart.set("zoomControl", am5map.ZoomControl.new(root, {}));
    zoomControl.homeButton.set("visible", true);

    chart.chartContainer.get("background").events.on("click", function () {
      chart.goHome();
    });

    polygonSeries.data.setAll(this.buildData(this.countries));

    const tinySeries = chart.series.push(
      am5map.MapPolygonSeries.new(root, {
        geoJSON: MICRO_STATES_GEOJSON,
      })
    );

    tinySeries.mapPolygons.template.setAll({
      fill: am5.color(LOCKED_FILL),
      stroke: am5.color(LOCKED_STROKE),
      strokeWidth: 0.5,
      tooltipText: "{name}",
      toggleKey: "active",
      interactive: true,
      templateField: "polygonSettings",
    });

    tinySeries.mapPolygons.template.states.create("active", {
      fill: am5.color(LOCKED_HOVER),
    });

    tinySeries.mapPolygons.template.events.on("pointerover", (ev) => {
      const ctx = ev.target.dataItem?.dataContext;
      if (ctx?.id === 'HU' && !secretStore.hungaryRevealed) {
        ev.target.set("fill", am5.color(LOCKED_HOVER));
        return;
      }
      const color = ctx?.visited ? getHoverColor(ctx.id) : LOCKED_HOVER;
      ev.target.set("fill", am5.color(color));
    });

    tinySeries.mapPolygons.template.events.on("pointerout", (ev) => {
      const ctx = ev.target.dataItem?.dataContext;
      if (ctx?.id === 'HU' && !secretStore.hungaryRevealed) {
        ev.target.set("fill", am5.color(LOCKED_FILL));
        return;
      }
      const color = ctx?.visited ? getVisitedColor(ctx.id) : LOCKED_FILL;
      ev.target.set("fill", am5.color(color));
    });

    tinySeries.mapPolygons.template.events.on("click", (event) => {
      const ctx = event.target.dataItem.dataContext;
      if (ctx.id === 'HU' && !secretStore.hungaryRevealed) return;
      const name = COUNTRY_NAMES[ctx.id] || ctx.id;
      if (ctx.visited) {
        this.$router.push('/' + toSlug(name));
      } else {
        this.showPopup(ctx.id, name);
      }
    });

    tinySeries.data.setAll(this.buildTinyData(this.countries));

    chart.appear(1000, 100);

    this.root = root;
    this.polygonSeries = polygonSeries;
    this.tinySeries = tinySeries;

    // Aplicar estado inicial de Hungría
    this.updateHungaryVisuals(secretStore.hungaryRevealed);
  },
  beforeUnmount() {
    if (this.root) {
      this.root.dispose();
    }
  },
  methods: {
    buildData(countries) {
      return countries.map(id => ({
        id,
        visited: true,
        polygonSettings: { fill: am5.color(getVisitedColor(id)) },
      }));
    },
    buildTinyData(countries) {
      const microIds = new Set(MICRO_STATES_GEOJSON.features.map(f => f.id));
      return countries
        .filter(id => microIds.has(id))
        .map(id => ({
          id,
          visited: true,
          polygonSettings: { fill: am5.color(getVisitedColor(id)) },
        }));
    },
    updateHungaryVisuals(revealed) {
      const fill = am5.color(revealed ? getVisitedColor('HU') : LOCKED_FILL);
      for (const series of [this.polygonSeries, this.tinySeries]) {
        if (!series) continue;
        series.mapPolygons.each(polygon => {
          if (polygon.dataItem?.dataContext?.id === 'HU') {
            polygon.set('fill', fill);
          }
        });
      }
    },
    showPopup(id, name) {
      this.popup = { visible: true, countryId: id, countryName: name };
    },
    closePopup() {
      this.popup = { visible: false, countryId: null, countryName: null };
    },
    confirmVisit() {
      this.$emit('country-unlocked', this.popup.countryId);
      this.closePopup();
    },
  },
};
</script>

<style>
.map-wrapper {
  position: relative;
  width: 100%;
}

#chartdiv {
  width: 100%;
  height: calc(100vh - 68px - 44px);
}

/* ── Counter ─────────────────────────────────────────── */
.country-counter {
  position: absolute;
  bottom: 28px;
  left: 20px;
  background: rgba(13, 17, 23, 0.82);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(168, 85, 247, 0.28);
  border-radius: 18px;
  padding: 18px 22px 16px;
  min-width: 175px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  z-index: 100;
  font-family: 'Space Grotesk', Arial, sans-serif;
}

.counter-icon {
  font-size: 1.4rem;
  margin-bottom: 6px;
  line-height: 1;
}

.counter-nums {
  display: flex;
  align-items: baseline;
  gap: 3px;
  line-height: 1;
  margin-bottom: 5px;
}

.visited-num {
  font-size: 2.4rem;
  font-weight: 700;
  background: linear-gradient(135deg, #e879a0, #a855f7);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.slash {
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.3);
  font-weight: 300;
  margin: 0 2px;
}

.total-num {
  font-size: 1.3rem;
  color: rgba(255, 255, 255, 0.45);
  font-weight: 500;
}

.counter-label {
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 12px;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-track {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 99px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #e879a0, #c084fc);
  border-radius: 99px;
  transition: width 0.6s ease;
}

.progress-text {
  font-size: 0.72rem;
  font-weight: 600;
  color: #e879a0;
  letter-spacing: 0.3px;
  min-width: 36px;
  text-align: right;
}

/* ── Popup visitar país ───────────────────────────────── */
.visit-popup-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.visit-popup {
  background: rgba(13, 17, 23, 0.96);
  border: 1px solid rgba(168, 85, 247, 0.35);
  border-radius: 22px;
  padding: 36px 40px 32px;
  text-align: center;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.7),
    0 0 0 1px rgba(255, 255, 255, 0.04) inset;
  max-width: 340px;
  width: 90%;
  font-family: 'Space Grotesk', Arial, sans-serif;
  animation: popup-in 0.2s ease;
}

@keyframes popup-in {
  from { opacity: 0; transform: scale(0.92) translateY(8px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
}

.popup-country-name {
  font-size: 1.6rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 6px;
}

.popup-question {
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.55);
  margin: 0 0 28px;
}

.popup-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.popup-btn {
  padding: 12px 34px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  border: none;
  font-family: 'Space Grotesk', Arial, sans-serif;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.popup-btn:hover {
  transform: scale(1.05);
}

.popup-btn-no {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.popup-btn-yes {
  background: linear-gradient(135deg, #e879a0, #a855f7);
  color: #fff;
  box-shadow: 0 4px 20px rgba(168, 85, 247, 0.45);
}
</style>
