import { createRouter, createWebHistory } from 'vue-router'
import MapPage from '@/views/MapPage.vue'
import CountryPage from '@/views/CountryPage.vue'

const routes = [
  { path: '/', component: MapPage },
  { path: '/:country', component: CountryPage },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
