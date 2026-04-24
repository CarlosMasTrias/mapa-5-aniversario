<template>
  <div id="app">
    <header class="app-header">
      <div class="header-brand" @click="$router.push('/')" style="cursor:pointer">
        <span class="brand-icon">❤️</span>
        <h1 class="app-title">MAPA DE PAISES GORDITOS</h1>
      </div>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<script>
export default {
  name: 'App',
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
</style>
