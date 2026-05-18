import { createRouter, createWebHistory } from 'vue-router'
import MapPage from '@/views/MapPage.vue'
import CountryPage from '@/views/CountryPage.vue'
import CityPage from '@/views/CityPage.vue'
import CityEditPage from '@/views/CityEditPage.vue'

const routes = [
  { path: '/', component: MapPage },
  { path: '/:country/:city/editar', component: CityEditPage },
  { path: '/:country/:city', component: CityPage },
  { path: '/:country', component: CountryPage },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
