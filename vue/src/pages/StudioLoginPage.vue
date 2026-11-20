<script setup lang="ts">
/**
 * Dev stand-in for the workforce SSO. Studio users are internal: one role, so the login only
 * asks for a name (a person, not a kanal). Every user sees the shared templates and every
 * kanal's pages, and publishes without a review step.
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
    await router.push('/studio/pages')
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <form class="card p-4 shadow-sm" style="width: 28rem" @submit.prevent="submit">
      <h1 class="h5">sdui-r Studio — masuk (dev)</h1>
      <label class="form-label mt-2">Nama pengguna
        <input v-model="username" required pattern="[A-Za-z][A-Za-z0-9._\-]{1,63}" class="form-control" placeholder="mis. fajrina" />
        <span class="form-text">Huruf, angka, titik, _ atau -. Semua pengguna memakai template yang sama dan mengelola halaman semua kanal.</span>
      </label>
      <p v-if="error" class="text-danger small mt-2">{{ error }}</p>
      <button class="btn btn-primary mt-3">Masuk</button>
    </form>
  </div>
</template>
