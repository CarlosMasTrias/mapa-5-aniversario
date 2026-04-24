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

    <div v-if="!country" class="not-found">País no encontrado.</div>

    <template v-else-if="loading">
      <div class="loading">Cargando...</div>
    </template>

    <template v-else>
      <template v-if="cities.length > 0">
        <div class="section-header">
          <h3 class="section-title">Ciudades visitadas</h3>
          <button class="add-btn" @click="openSelector">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Añadir ciudad
          </button>
        </div>

        <div class="cities-list">
          <div
            v-for="(city, index) in cities"
            :key="city.name"
            class="city-card"
            @click="goToCity(city)"
          >
            <div class="city-card-info">
              <span class="city-card-name">{{ city.name }}</span>
              <span v-if="city.media && city.media.length > 0" class="city-badge city-badge--media">
                {{ city.media.length }} {{ city.media.length === 1 ? 'elemento' : 'elementos' }}
              </span>
              <span v-else class="city-badge city-badge--empty">Sin contenido aún</span>
            </div>
            <div class="city-card-right" @click.stop>
              <button class="city-delete" @click="removeCity(index)" title="Eliminar ciudad">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
              <svg class="city-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </div>
        </div>

        <button class="add-btn add-btn--ghost" @click="openSelector" style="margin-top:14px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Añadir otra ciudad
        </button>
      </template>

      <div v-else class="empty-state">
        <div class="empty-icon">🗺️</div>
        <p class="empty-title">Aún no hay ciudades en {{ country.name }}</p>
        <p class="empty-sub">Añade las ciudades donde estuvisteis</p>
        <button class="add-btn add-btn--large" @click="openSelector">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Añadir primera ciudad
        </button>
      </div>
    </template>

    <!-- ── City selector modal ──────────────────────────── -->
    <Transition name="modal">
      <div v-if="showSelector" class="modal-overlay" @click.self="closeSelector">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Añadir ciudad en {{ country?.name }}</h3>
            <button class="modal-x" @click="closeSelector">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <input
            ref="searchInput"
            v-model="citySearch"
            class="modal-search"
            placeholder="Buscar ciudad o región..."
            @keydown.enter="confirmSearch"
            @keydown.esc="closeSelector"
          />

          <div class="modal-list">
            <button
              v-for="c in filteredOptions"
              :key="c"
              class="modal-option"
              @click="addCity(c)"
            >{{ c }}</button>

            <div v-if="filteredOptions.length === 0 && citySearch.trim()" class="modal-no-results">
              <p>"{{ citySearch }}" no está en la lista</p>
              <button class="modal-add-custom" @click="addCity(citySearch.trim())">
                Añadir "{{ citySearch.trim() }}" igualmente
              </button>
            </div>

            <p v-if="!citySearch" class="modal-hint">
              Escribe para filtrar las ciudades de {{ country?.name }}
            </p>
          </div>

          <div class="modal-divider"><span>o escribe tú mismo</span></div>

          <div class="modal-custom-row">
            <input
              v-model="customCity"
              class="modal-custom-input"
              placeholder="Nombre personalizado..."
              @keydown.enter="customCity.trim() && addCity(customCity.trim())"
              @keydown.esc="closeSelector"
            />
            <button
              class="modal-custom-add"
              :disabled="!customCity.trim() || saving"
              @click="addCity(customCity.trim())"
            >{{ saving ? '...' : 'Añadir' }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script>
import { ALL_COUNTRIES } from '@/data/countries.js'
import { COUNTRY_CITIES } from '@/data/countryCities.js'
import { loadDb, saveDb, ensureCountry } from '@/services/db.js'
import { toSlug } from '@/utils/slug.js'

export default {
  name: 'CountryPage',
  data() {
    return {
      db: null,
      cities: [],
      loading: true,
      saving: false,
      showSelector: false,
      citySearch: '',
      customCity: '',
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
    filteredOptions() {
      if (!this.country) return []
      const all = COUNTRY_CITIES[this.country.id] || []
      const existing = new Set(this.cities.map(c => c.name.toLowerCase()))
      const available = all.filter(c => !existing.has(c.toLowerCase()))
      if (!this.citySearch.trim()) return available
      const q = this.citySearch.trim().toLowerCase()
      return available.filter(c => c.toLowerCase().includes(q))
    },
  },
  watch: {
    country: {
      immediate: true,
      async handler(val) {
        if (val) await this.loadData()
      },
    },
  },
  methods: {
    flagUrl(code) {
      return `https://flagcdn.com/w80/${code.toLowerCase()}.png`
    },
    async loadData() {
      this.loading = true
      this.db = await loadDb()
      this.cities = this.db.countries?.[this.country.id]?.cities || []
      this.loading = false
    },
    async persist() {
      this.saving = true
      ensureCountry(this.db, this.country.id).cities = this.cities
      await saveDb(this.db)
      this.saving = false
    },
    openSelector() {
      this.showSelector = true
      this.citySearch = ''
      this.customCity = ''
      this.$nextTick(() => this.$refs.searchInput?.focus())
    },
    closeSelector() {
      this.showSelector = false
      this.citySearch = ''
      this.customCity = ''
    },
    async addCity(name) {
      const trimmed = name?.trim()
      if (!trimmed) return
      if (this.cities.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
        this.closeSelector()
        return
      }
      this.cities.push({ name: trimmed, description: '', media: [] })
      await this.persist()
      this.closeSelector()
    },
    confirmSearch() {
      if (this.filteredOptions.length === 1) {
        this.addCity(this.filteredOptions[0])
      } else if (this.filteredOptions.length === 0 && this.citySearch.trim()) {
        this.addCity(this.citySearch.trim())
      }
    },
    async removeCity(index) {
      const city = this.cities[index]
      if (!window.confirm(`¿Eliminar "${city.name}"? Se borrarán sus fotos del servidor.`)) return
      this.cities.splice(index, 1)
      await this.persist()
    },
    goToCity(city) {
      this.$router.push(`/${this.countrySlug}/${toSlug(city.name)}`)
    },
  },
}
</script>

<style scoped>
.country-page {
  padding: 40px 48px;
  min-height: calc(100vh - 68px);
  font-family: 'Space Grotesk', Arial, sans-serif;
  max-width: 860px;
}

.back-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.6);
  border-radius: 10px;
  padding: 8px 18px;
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  font-family: 'Space Grotesk', Arial, sans-serif;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
  margin-bottom: 40px;
}
.back-btn svg { width: 16px; height: 16px; }
.back-btn:hover { background: rgba(168, 85, 247, 0.12); border-color: rgba(168, 85, 247, 0.35); color: #fff; }

.country-header { display: flex; align-items: center; gap: 24px; margin-bottom: 48px; }
.country-flag { width: 80px; height: auto; border-radius: 6px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
.country-name {
  font-size: 2.4rem;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  background: linear-gradient(135deg, #e879a0 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-title { font-size: 0.72rem; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.28); }

.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: rgba(168, 85, 247, 0.14);
  border: 1px solid rgba(168, 85, 247, 0.38);
  color: #c084fc;
  border-radius: 10px;
  padding: 7px 16px;
  font-size: 0.84rem;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Space Grotesk', Arial, sans-serif;
  transition: background 0.18s, border-color 0.18s;
}
.add-btn svg { width: 14px; height: 14px; flex-shrink: 0; }
.add-btn:hover { background: rgba(168, 85, 247, 0.24); border-color: rgba(168, 85, 247, 0.6); color: #fff; }
.add-btn--ghost { background: transparent; border-color: rgba(168, 85, 247, 0.18); color: rgba(168, 85, 247, 0.55); }
.add-btn--ghost:hover { background: rgba(168, 85, 247, 0.09); border-color: rgba(168, 85, 247, 0.4); color: #c084fc; }
.add-btn--large { padding: 12px 24px; font-size: 0.95rem; margin-top: 16px; }

.cities-list { display: flex; flex-direction: column; gap: 10px; }
.city-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(168, 85, 247, 0.14);
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, transform 0.15s;
}
.city-card:hover { background: rgba(168, 85, 247, 0.07); border-color: rgba(168, 85, 247, 0.38); transform: translateX(4px); }
.city-card-info { display: flex; align-items: center; gap: 12px; }
.city-card-name { font-size: 1.1rem; font-weight: 600; color: #fff; }
.city-badge { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.7px; text-transform: uppercase; padding: 3px 9px; border-radius: 99px; }
.city-badge--media { background: rgba(232, 121, 160, 0.13); color: #f9a8d4; border: 1px solid rgba(232, 121, 160, 0.26); }
.city-badge--empty { background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.07); }
.city-card-right { display: flex; align-items: center; gap: 6px; }
.city-delete {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: transparent; border: 1px solid transparent;
  border-radius: 8px; color: rgba(255,255,255,0.18); cursor: pointer;
  transition: color 0.18s, background 0.18s, border-color 0.18s; padding: 0;
}
.city-delete svg { width: 14px; height: 14px; }
.city-delete:hover { color: #f87171; background: rgba(248,113,113,0.12); border-color: rgba(248,113,113,0.3); }
.city-arrow { width: 18px; height: 18px; color: rgba(168,85,247,0.38); transition: color 0.18s, transform 0.15s; }
.city-card:hover .city-arrow { color: #a855f7; transform: translateX(2px); }

.empty-state { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 40px 0; }
.empty-icon { font-size: 2.2rem; line-height: 1; margin-bottom: 6px; }
.empty-title { font-size: 1.05rem; font-weight: 600; color: rgba(255,255,255,0.55); }
.empty-sub { font-size: 0.88rem; color: rgba(255,255,255,0.28); }
.not-found, .loading { color: rgba(255,255,255,0.35); font-size: 0.95rem; margin-top: 20px; }

/* ── Modal ───────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(5, 5, 12, 0.78);
  backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 20px;
}
.modal {
  background: #13111e;
  border: 1px solid rgba(168, 85, 247, 0.24);
  border-radius: 20px;
  padding: 28px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset;
}
.modal-header { display: flex; align-items: center; justify-content: space-between; }
.modal-title { font-size: 1rem; font-weight: 700; color: #fff; }
.modal-x {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; background: transparent; border: none;
  color: rgba(255,255,255,0.38); cursor: pointer; border-radius: 8px;
  transition: color 0.15s, background 0.15s;
}
.modal-x svg { width: 16px; height: 16px; }
.modal-x:hover { color: #fff; background: rgba(255,255,255,0.08); }
.modal-search {
  width: 100%; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(168,85,247,0.24); border-radius: 10px;
  padding: 10px 14px; color: #fff; font-size: 0.92rem;
  font-family: 'Space Grotesk', Arial, sans-serif; outline: none;
  transition: border-color 0.18s;
}
.modal-search:focus { border-color: rgba(168,85,247,0.55); }
.modal-search::placeholder { color: rgba(255,255,255,0.28); }
.modal-list {
  flex: 1; overflow-y: auto; display: flex; flex-direction: column;
  gap: 3px; min-height: 0; max-height: 250px;
}
.modal-list::-webkit-scrollbar { width: 4px; }
.modal-list::-webkit-scrollbar-thumb { background: rgba(168,85,247,0.3); border-radius: 99px; }
.modal-option {
  width: 100%; text-align: left; background: transparent; border: none;
  border-radius: 8px; padding: 9px 12px;
  color: rgba(255,255,255,0.75); font-size: 0.9rem;
  font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.modal-option:hover { background: rgba(168,85,247,0.12); color: #fff; }
.modal-no-results { padding: 10px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.modal-no-results p { font-size: 0.85rem; color: rgba(255,255,255,0.35); }
.modal-add-custom {
  background: rgba(232,121,160,0.14); border: 1px solid rgba(232,121,160,0.32);
  color: #f9a8d4; border-radius: 8px; padding: 7px 14px; font-size: 0.84rem;
  font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer; transition: background 0.18s;
}
.modal-add-custom:hover { background: rgba(232,121,160,0.24); }
.modal-hint { font-size: 0.8rem; color: rgba(255,255,255,0.22); padding: 8px 12px; }
.modal-divider { display: flex; align-items: center; gap: 10px; color: rgba(255,255,255,0.18); font-size: 0.75rem; }
.modal-divider::before, .modal-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.08); }
.modal-custom-row { display: flex; gap: 8px; }
.modal-custom-input {
  flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.09);
  border-radius: 10px; padding: 9px 14px; color: #fff; font-size: 0.9rem;
  font-family: 'Space Grotesk', Arial, sans-serif; outline: none; transition: border-color 0.18s;
}
.modal-custom-input:focus { border-color: rgba(168,85,247,0.4); }
.modal-custom-input::placeholder { color: rgba(255,255,255,0.22); }
.modal-custom-add {
  background: rgba(168,85,247,0.17); border: 1px solid rgba(168,85,247,0.38);
  color: #c084fc; border-radius: 10px; padding: 9px 18px; font-size: 0.88rem;
  font-weight: 600; font-family: 'Space Grotesk', Arial, sans-serif; cursor: pointer;
  transition: background 0.18s; white-space: nowrap;
}
.modal-custom-add:hover:not(:disabled) { background: rgba(168,85,247,0.28); }
.modal-custom-add:disabled { opacity: 0.38; cursor: not-allowed; }

.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
