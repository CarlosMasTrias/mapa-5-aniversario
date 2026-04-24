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
  background: #0d1117;
  color: #fff;
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background:
    radial-gradient(ellipse at 12% 70%, rgba(255, 77, 157, 0.16) 0%, transparent 52%),
    radial-gradient(ellipse at 88% 12%, rgba(140, 20, 90, 0.32) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, rgba(70, 10, 55, 0.22) 0%, transparent 42%),
    #0d1117;
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
  background: rgba(13, 17, 23, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255, 77, 157, 0.25);
  position: sticky;
  top: 0;
  z-index: 200;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
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
  background: linear-gradient(135deg, #ff4d9d 0%, #ff9dd3 60%, #ffb3e6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
