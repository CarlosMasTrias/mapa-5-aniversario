import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '@/lib/supabase.js'
import MapPage from '@/views/MapPage.vue'
import CountryPage from '@/views/CountryPage.vue'
import CityPage from '@/views/CityPage.vue'

const publicPaths = new Set(['/login', '/register', '/forgot-password', '/reset-password'])

const routes = [
  // Auth pages – static paths, resolved before dynamic :country segment
  { path: '/login',            component: () => import('@/views/LoginPage.vue') },
  { path: '/register',         component: () => import('@/views/RegisterPage.vue') },
  { path: '/forgot-password',  component: () => import('@/views/ForgotPasswordPage.vue') },
  { path: '/reset-password',   component: () => import('@/views/ResetPasswordPage.vue') },
  // App pages
  { path: '/',                 component: MapPage },
  { path: '/:country/:city',   component: CityPage },
  { path: '/:country',         component: CountryPage },
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach(async (to) => {
  if (process.env.NODE_ENV === 'development') {
    if (publicPaths.has(to.path)) return '/'
    return true
  }
  if (publicPaths.has(to.path)) return true
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return '/login'
  return true
})

export default router
