import { createRouter, createWebHistory } from 'vue-router'
import MapPage from '@/views/MapPage.vue'
import CountryPage from '@/views/CountryPage.vue'
import CityPage from '@/views/CityPage.vue'

const routes = [
  { path: '/', component: MapPage },
  { path: '/:country/:city', component: CityPage },
  { path: '/:country', component: CountryPage },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
