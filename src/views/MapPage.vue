<template>
  <MapView :countries="visitedCountries" @country-unlocked="onCountryUnlocked" />
</template>

<script>
import MapView from '@/components/MapView.vue';
import { VISITED_COUNTRIES, ALL_COUNTRIES } from '@/data/countries.js';
import { loadDb, saveDb } from '@/services/db.js';

const KNOWN_COUNTRY_IDS = new Set(ALL_COUNTRIES.map(c => c.id));

export default {
  name: 'MapPage',
  components: { MapView },
  data() {
    return {
      visitedCountries: [...VISITED_COUNTRIES],
      db: null,
    };
  },
  async mounted() {
    this.db = await loadDb();
    const extra = this.db.visitedCountries || [];
    const removed = new Set(this.db.removedCountries || []);
    // Partir de la lista base, quitar eliminados, añadir extras
    const merged = VISITED_COUNTRIES.filter(id => !removed.has(id));
    for (const id of extra) {
      if (!merged.includes(id)) merged.push(id);
    }
    this.visitedCountries = merged;
  },
  methods: {
    async onCountryUnlocked({ id: countryId, name: countryName }) {
      if (this.visitedCountries.includes(countryId)) return;
      // Reemplazar el array (no mutar) para que el watcher del hijo detecte el cambio
      this.visitedCountries = [...this.visitedCountries, countryId];
      if (this.db) {
        if (!this.db.visitedCountries) this.db.visitedCountries = [];
        if (!this.db.visitedCountries.includes(countryId)) {
          this.db.visitedCountries.push(countryId);
        }
        // Territorios fuera de la lista curada de ~195 países (islas, dependencias...)
        // no tienen traducción propia — guardamos el nombre para poder mostrar su
        // página de país correctamente más adelante.
        if (!KNOWN_COUNTRY_IDS.has(countryId) && countryName) {
          if (!this.db.countryNames) this.db.countryNames = {};
          this.db.countryNames[countryId] = countryName;
        }
        await saveDb(this.db);
      }
    },
  },
};
</script>
