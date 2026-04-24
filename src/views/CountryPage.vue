<template>
  <div class="country-page">
    <button class="back-btn" @click="$router.push('/')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Volver al mapa
    </button>

    <div v-if="country" class="country-header">
      <img class="country-flag" :src="flagUrl(country.id)" :alt="country.name" />
      <h2 class="country-name">{{ country.name }}</h2>
    </div>

    <div v-else class="country-not-found">
      <p>País no encontrado.</p>
    </div>

    <!-- Aquí irán las fotos cuando las añadas -->
    <div class="photos-placeholder">
      <p>Fotos próximamente...</p>
    </div>
  </div>
</template>

<script>
import { ALL_COUNTRIES } from '@/data/countries.js';
import { toSlug } from '@/utils/slug.js';

export default {
  name: 'CountryPage',
  computed: {
    country() {
      const slug = this.$route.params.country;
      return ALL_COUNTRIES.find(c => toSlug(c.name) === slug) || null;
    },
  },
  methods: {
    flagUrl(code) {
      return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
    },
  },
};
</script>

<style scoped>
.country-page {
  padding: 40px 48px;
  min-height: calc(100vh - 68px);
  font-family: 'Space Grotesk', Arial, sans-serif;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  border-radius: 10px;
  padding: 8px 18px;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  font-family: 'Space Grotesk', Arial, sans-serif;
  transition: background 0.18s, color 0.18s, border-color 0.18s;
  margin-bottom: 40px;
}

.back-btn svg {
  width: 16px;
  height: 16px;
}

.back-btn:hover {
  background: rgba(255, 123, 0, 0.15);
  border-color: rgba(255, 123, 0, 0.4);
  color: #fff;
}

.country-header {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 48px;
}

.country-flag {
  width: 80px;
  height: auto;
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.country-name {
  font-size: 2.4rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ff7b00 0%, #ffb347 80%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.country-not-found {
  color: rgba(255, 255, 255, 0.5);
  font-size: 1.1rem;
}

.photos-placeholder {
  color: rgba(255, 255, 255, 0.3);
  font-size: 1rem;
  letter-spacing: 0.5px;
}
</style>
