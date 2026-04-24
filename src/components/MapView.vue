<template>
  <div class="map-wrapper">
    <div id="chartdiv"></div>
    <div class="country-counter">
      <div class="counter-icon">✈️</div>
      <div class="counter-nums">
        <span class="visited-num">{{ countries.length }}</span>
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
    <FlagPanel :countries="countries" />
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

const ORANGE = 0xff7b00;
const ORANGE_HOVER = 0xd66700;

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
  data() {
    return {
      root: null,
      polygonSeries: null,
      tinySeries: null,
    };
  },
  computed: {
    progressPct() {
      return Math.round(this.countries.length / 195 * 1000) / 10;
    },
  },
  watch: {
    countries(newVal) {
      if (this.polygonSeries) {
        this.polygonSeries.data.setAll(this.buildData(newVal));
      }
      if (this.tinySeries) {
        this.tinySeries.data.setAll(this.buildTinyData(newVal));
      }
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
      tooltipText: "{name}",
      toggleKey: "active",
      interactive: true,
      templateField: "polygonSettings",
    });

    polygonSeries.mapPolygons.template.states.create("hover", {
      fill: am5.color(ORANGE_HOVER),
    });

    polygonSeries.mapPolygons.template.states.create("active", {
      fill: am5.color(ORANGE_HOVER),
    });

    polygonSeries.mapPolygons.template.events.on("click", (event) => {
      const ctx = event.target.dataItem.dataContext;
      if (ctx.visited) {
        const name = COUNTRY_NAMES[ctx.id] || ctx.id;
        this.$router.push('/' + toSlug(name));
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
      tooltipText: "{name}",
      toggleKey: "active",
      interactive: true,
      templateField: "polygonSettings",
    });

    tinySeries.mapPolygons.template.states.create("hover", {
      fill: am5.color(ORANGE_HOVER),
    });

    tinySeries.mapPolygons.template.states.create("active", {
      fill: am5.color(ORANGE_HOVER),
    });

    tinySeries.mapPolygons.template.events.on("click", (event) => {
      const ctx = event.target.dataItem.dataContext;
      if (ctx.visited) {
        const name = COUNTRY_NAMES[ctx.id] || ctx.id;
        this.$router.push('/' + toSlug(name));
      }
    });

    tinySeries.data.setAll(this.buildTinyData(this.countries));

    chart.appear(1000, 100);

    this.root = root;
    this.polygonSeries = polygonSeries;
    this.tinySeries = tinySeries;
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
        polygonSettings: { fill: am5.color(ORANGE) },
      }));
    },
    buildTinyData(countries) {
      const microIds = new Set(MICRO_STATES_GEOJSON.features.map(f => f.id));
      return countries
        .filter(id => microIds.has(id))
        .map(id => ({
          id,
          visited: true,
          polygonSettings: { fill: am5.color(ORANGE) },
        }));
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
  border: 1px solid rgba(255, 123, 0, 0.3);
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
  background: linear-gradient(135deg, #ff7b00, #ffb347);
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
  background: linear-gradient(90deg, #ff7b00, #ffb347);
  border-radius: 99px;
  transition: width 0.6s ease;
}

.progress-text {
  font-size: 0.72rem;
  font-weight: 600;
  color: #ff7b00;
  letter-spacing: 0.3px;
  min-width: 36px;
  text-align: right;
}
</style>
