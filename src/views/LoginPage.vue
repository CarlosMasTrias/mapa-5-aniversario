<template>
  <div class="auth-page">
    <div class="auth-card">
      <div class="auth-logo">❤️</div>
      <h2 class="auth-title">Iniciar sesión</h2>
      <form @submit.prevent="submit">
        <div class="field">
          <label>Email</label>
          <input v-model="email" type="email" required autocomplete="email" />
        </div>
        <div class="field">
          <label>Contraseña</label>
          <input v-model="password" type="password" required autocomplete="current-password" />
        </div>
        <p v-if="error" class="auth-error">{{ error }}</p>
        <button type="submit" :disabled="loading" class="auth-btn">
          {{ loading ? 'Entrando...' : 'Entrar' }}
        </button>
      </form>
      <div class="auth-footer">
        <router-link to="/forgot-password">¿Olvidaste tu contraseña?</router-link>
        <router-link to="/register">Crear cuenta</router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { supabase } from '@/lib/supabase.js'

export default {
  name: 'LoginPage',
  data() {
    return { email: '', password: '', error: '', loading: false }
  },
  methods: {
    async submit() {
      this.loading = true
      this.error = ''
      const { error } = await supabase.auth.signInWithPassword({
        email: this.email,
        password: this.password,
      })
      this.loading = false
      if (error) {
        this.error = error.message
      } else {
        this.$router.push('/')
      }
    },
  },
}
</script>

<style scoped>
.auth-page {
  min-height: calc(100vh - 68px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.auth-card {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(168, 85, 247, 0.22);
  border-radius: 20px;
  padding: 40px 36px;
  backdrop-filter: blur(16px);
}
.auth-logo {
  font-size: 2.2rem;
  text-align: center;
  margin-bottom: 6px;
}
.auth-title {
  text-align: center;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 3px;
  text-transform: uppercase;
  background: linear-gradient(135deg, #e879a0 0%, #a855f7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 28px;
}
.field { margin-bottom: 18px; }
.field label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 7px;
}
.field input {
  width: 100%;
  padding: 11px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(168, 85, 247, 0.25);
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  font-family: 'Space Grotesk', Arial, sans-serif;
  outline: none;
  transition: border-color 0.18s;
  box-sizing: border-box;
}
.field input:focus { border-color: rgba(168, 85, 247, 0.6); }
.field input::placeholder { color: rgba(255, 255, 255, 0.2); }
.auth-error {
  color: #f87171;
  font-size: 0.84rem;
  margin-bottom: 14px;
  margin-top: -4px;
}
.auth-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #e879a0 0%, #a855f7 100%);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 1px;
  font-family: 'Space Grotesk', Arial, sans-serif;
  cursor: pointer;
  margin-top: 4px;
  transition: opacity 0.2s;
}
.auth-btn:hover:not(:disabled) { opacity: 0.88; }
.auth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.auth-footer {
  margin-top: 22px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.auth-footer a {
  color: rgba(168, 85, 247, 0.8);
  text-decoration: none;
  font-size: 0.82rem;
  transition: color 0.15s;
}
.auth-footer a:hover { color: #a855f7; }
</style>
