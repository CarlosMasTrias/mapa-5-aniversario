<template>
  <div id="app">
    <header class="app-header">
      <div class="header-brand" @click="$router.push('/')" style="cursor:pointer">
        <span class="brand-icon">❤️</span>
        <h1 class="app-title">MAPA DE PAISES <span class="secret-key" @click.stop="revealHungary">G</span>ORDITO<span class="secret-key" @click.stop="hideHungary">S</span></h1>
      </div>
      <div v-if="user" class="header-user">
        <span class="header-email">{{ user.email }}</span>
        <button class="logout-btn" @click="logout">Salir</button>
      </div>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script>
import { secretStore } from '@/store/secret.js'
import { supabase } from '@/lib/supabase.js'

export default {
  name: 'App',
  data() {
    return { user: null }
  },
  created() {
    supabase.auth.getSession().then(({ data: { session } }) => {
      this.user = session?.user ?? null
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      this.user = session?.user ?? null
    })
    this._authSub = subscription
  },
  beforeUnmount() {
    this._authSub?.unsubscribe()
  },
  methods: {
    revealHungary() { secretStore.hungaryRevealed = true },
    hideHungary() { secretStore.hungaryRevealed = false },
    async logout() {
      await supabase.auth.signOut()
      this.$router.push('/login')
    },
  },
}
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Space Grotesk', Arial, sans-serif;
  background: #0c0c14;
  color: #fff;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 8% 72%, rgba(232, 121, 160, 0.13) 0%, transparent 50%),
    radial-gradient(ellipse at 90% 8%,  rgba(168, 85, 247, 0.18) 0%, transparent 48%),
    radial-gradient(ellipse at 48% 98%, rgba(110, 40, 160, 0.12) 0%, transparent 40%),
    #0c0c14;
}

main {
  flex: 1;
}

/* ── Header ──────────────────────────────────────────── */
.app-header {
  display: flex;
  align-items: center;
  padding: 0 36px;
  height: 68px;
  background: rgba(12, 12, 20, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(168, 85, 247, 0.22);
  position: sticky;
  top: 0;
  z-index: 200;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.5);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  font-size: 1.6rem;
  line-height: 1;
}

.app-title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 4px;
  text-transform: uppercase;
  background: linear-gradient(135deg, #e879a0 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.secret-key {
  cursor: inherit;
  user-select: none;
}

/* ── Header user / logout ────────────────────────────── */
.header-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}

.header-email {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.35);
  font-weight: 500;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.45);
  border-radius: 8px;
  padding: 5px 14px;
  font-size: 0.78rem;
  font-weight: 600;
  font-family: 'Space Grotesk', Arial, sans-serif;
  cursor: pointer;
  transition: all 0.18s;
}

.logout-btn:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: rgba(248, 113, 113, 0.28);
  color: #fca5a5;
}
</style>
