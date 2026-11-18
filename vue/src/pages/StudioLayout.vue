<script setup lang="ts">
/** Studio shell: needs a studio-bff session (one role: the template admin of its merchant). */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { studio, type Me } from '../api/studio'
import { DEFAULT_SCREEN, screenPath } from '../sdui/config'

const router = useRouter()
const me = ref<Me | undefined>(studio.current())

onMounted(async () => {
  if (!me.value) me.value = await studio.restore()
  if (!me.value) await router.replace('/studio/login')
})

async function logout() {
  await studio.logout()
  await router.push('/studio/login')
}
</script>

<template>
  <div v-if="me" class="min-vh-100 bg-light">
    <nav class="navbar bg-white border-bottom px-3 py-2 gap-2 small">
      <strong>sdui-r Studio</strong>
      <span class="badge rounded-pill text-bg-primary bg-opacity-10 text-primary font-monospace" title="Admin template — merchant">{{ me.merchantId }}</span>
      <RouterLink :to="screenPath(me.merchantId, DEFAULT_SCREEN)" class="ms-auto">Lihat halaman merchant →</RouterLink>
      <button class="btn btn-sm btn-link text-secondary" @click="logout">Keluar</button>
    </nav>
    <RouterView />
  </div>
</template>
