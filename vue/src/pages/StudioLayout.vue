<script setup lang="ts">
/** Studio shell: needs a studio-bff session; shows only the builders the role may open. */
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { studio, type Me } from '../api/studio'

const route = useRoute()
const router = useRouter()
const me = ref<Me | undefined>(studio.current())

// a page outside the role → the first allowed one (the backend refuses it anyway)
function guard() {
  if (!me.value) return
  const p = route.path
  if ((p.startsWith('/studio/templates') && !studio.canTemplates()) || (p.startsWith('/studio/screens') && !studio.canScreens()) || p === '/studio' || p === '/studio/') {
    void router.replace(studio.home())
  }
}
onMounted(async () => {
  if (!me.value) me.value = await studio.restore()
  if (!me.value) await router.replace('/studio/login')
  guard()
})
watch(() => route.path, guard)

async function logout() {
  await studio.logout()
  await router.push('/studio/login')
}
</script>

<template>
  <div v-if="me" class="min-vh-100 bg-light">
    <nav class="navbar bg-white border-bottom px-3 py-2 gap-2 small">
      <strong>sdui-r Studio</strong>
      <RouterLink v-if="studio.canTemplates()" to="/studio/templates" class="btn btn-sm" active-class="btn-primary">Template Builder</RouterLink>
      <RouterLink v-if="studio.canScreens()" to="/studio/screens" class="btn btn-sm" active-class="btn-primary">Screen Builder</RouterLink>
      <span class="ms-auto text-secondary">{{ me.name }} · {{ me.roles.map((r) => r.replace('SDUI_', '').toLowerCase()).join(', ') }}</span>
      <RouterLink to="/">App →</RouterLink>
      <button class="btn btn-sm btn-link text-secondary" @click="logout">Keluar</button>
    </nav>
    <RouterView v-if="(route.path.startsWith('/studio/templates') && studio.canTemplates()) || (route.path.startsWith('/studio/screens') && studio.canScreens())" />
  </div>
</template>
