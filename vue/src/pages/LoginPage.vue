<script setup lang="ts">
/**
 * The customer login (demo): a customer id and a password, checked by customer-service through
 * web-bff. It is not the Studio login — a separate session (cookie `sdui_web_sess`), separate users.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { customerLogin } from '../api/bff'

const route = useRoute()
const router = useRouter()
const username = ref('')
const password = ref('')
const error = ref<string>()
const busy = ref(false)

/** only an address inside this app (never another host) */
function safeNext(next: unknown): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/studio') ? next : '/dashboard'
}

async function submit() {
  busy.value = true
  error.value = undefined
  try {
    await customerLogin(username.value.trim(), password.value)
    await router.replace(safeNext(route.query.next))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center px-3" style="background: #effaf8">
    <form class="card p-4 shadow-sm border-0 rounded-4" style="width: 24rem" @submit.prevent="submit">
      <h1 class="h4 mb-0">Masuk</h1>
      <p class="text-secondary small">Aplikasi nasabah (demo insight)</p>
      <label class="form-label">Nama pengguna
        <input v-model="username" required autocomplete="username" class="form-control" />
      </label>
      <label class="form-label">Password
        <input v-model="password" required type="password" autocomplete="current-password" class="form-control" />
      </label>
      <p v-if="error" role="alert" class="text-danger small">{{ error }}</p>
      <button :disabled="busy" class="btn rounded-pill fw-semibold" style="background: #71dad3">{{ busy ? 'Memeriksa…' : 'Masuk' }}</button>
      <p class="bg-light rounded p-2 small text-secondary mt-3 mb-0">Akun demo: <b>andi</b> atau <b>sari</b>, password <b>demo123</b>.</p>
    </form>
  </div>
</template>
