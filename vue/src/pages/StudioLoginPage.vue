<script setup lang="ts">
/**
 * Dev stand-in for the workforce SSO. Studio users are internal: one role, so the login only
 * asks for a name (a person). Nothing belongs to a user: every user sees the templates and
 * pages, and publishes without a review step; the name only records who did what.
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
        <span class="form-text">Huruf, angka, titik, _ atau -. Semua pengguna melihat dan mengelola semua template dan halaman; nama Anda hanya dicatat sebagai pembuat dan penerbit.</span>
      </label>
      <p v-if="error" class="text-danger small mt-2">{{ error }}</p>
      <button class="btn btn-primary mt-3">Masuk</button>
    </form>
  </div>
</template>
