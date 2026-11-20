<script setup lang="ts">
/** Studio shell: a studio-bff session (internal users, one role) and the two tabs. */
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { studio, type Me } from '../api/studio'

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
      <ul class="nav nav-pills" aria-label="Studio">
        <li class="nav-item"><RouterLink to="/studio/templates" class="nav-link py-1" active-class="active">Template</RouterLink></li>
        <li class="nav-item"><RouterLink to="/studio/pages" class="nav-link py-1" active-class="active">Konten</RouterLink></li>
      </ul>
      <span class="ms-auto text-secondary" title="Pengguna">{{ me.name }}</span>
      <button class="btn btn-sm btn-link text-secondary" @click="logout">Keluar</button>
    </nav>
    <RouterView />
  </div>
</template>
