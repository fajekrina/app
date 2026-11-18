<script setup lang="ts">
/**
 * Dev stand-in for the workforce SSO. One Studio role — the template admin — so the login
 * only asks for a name: the admin IS the merchant, its name is the merchant id. Each admin
 * sees and edits only its own templates and pages.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { studio } from '../api/studio'

const router = useRouter()
const username = ref('')
const error = ref<string>()

async function submit() {
  try {
    await studio.login(username.value.trim())
    await router.push('/studio/templates')
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <form class="card p-4 shadow-sm" style="width: 28rem" @submit.prevent="submit">
      <h1 class="h5">sdui-r Studio — login admin (dev)</h1>
      <label class="form-label mt-2">Nama admin (= ID merchant)
        <input v-model="username" required pattern="[A-Za-z][A-Za-z0-9_]{1,63}" class="form-control font-monospace" placeholder="mis. toko_baru" />
        <span class="form-text">Huruf, angka dan _ . Admin hanya melihat template dan halaman miliknya. Contoh yang sudah berisi: <code>merchant_demo</code>, <code>merchant_promo</code>.</span>
      </label>
      <p v-if="error" class="text-danger small mt-2">{{ error }}</p>
      <button class="btn btn-primary mt-3">Masuk</button>
    </form>
  </div>
</template>
