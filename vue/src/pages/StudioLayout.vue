<script setup lang="ts">
/** Studio shell: needs a studio-bff session; links to the two builders. */
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
      <RouterLink to="/studio/templates" class="btn btn-sm" active-class="btn-primary">Template Builder (admin)</RouterLink>
      <RouterLink to="/studio/screens" class="btn btn-sm" active-class="btn-primary">Screen Builder (maker)</RouterLink>
      <span class="ms-auto text-secondary">{{ me.name }} · {{ me.roles.join(', ') }}</span>
      <RouterLink to="/">App →</RouterLink>
      <button class="btn btn-sm btn-link text-secondary" @click="logout">Keluar</button>
    </nav>
    <RouterView />
  </div>
</template>
