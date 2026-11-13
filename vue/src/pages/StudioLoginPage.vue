<script setup lang="ts">
/** Dev stand-in for the workforce SSO: a name and the roles to hold. */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ROLES, studio, type Role } from '../api/studio'
import { MERCHANTS } from '../sdui/config'

const LABELS: Record<Role, string> = {
  SDUI_TEMPLATE_ADMIN: 'Admin template (Template Builder)',
  SDUI_TEMPLATE_PUBLISHER: 'Checker template',
  SDUI_AUTHOR: 'Maker konten (Screen Builder)',
  SDUI_PUBLISHER: 'Checker konten',
  SDUI_VIEWER: 'Viewer'
}
const router = useRouter()
const username = ref('ana')
const roles = ref<Role[]>(['SDUI_AUTHOR'])
const merchants = ref<string[]>([...MERCHANTS])
const error = ref<string>()

async function submit() {
  try {
    const me = await studio.login(username.value, roles.value, merchants.value)
    await router.push(me.roles.some((r) => r.startsWith('SDUI_TEMPLATE')) ? '/studio/templates' : '/studio/screens')
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <form class="card p-4 shadow-sm" style="width: 28rem" @submit.prevent="submit">
      <h1 class="h5">sdui-r Studio — login (dev)</h1>
      <label class="form-label mt-2">Nama pengguna
        <input v-model="username" class="form-control" />
      </label>
      <fieldset class="mt-2">
        <legend class="fs-6 fw-semibold">Peran</legend>
        <div v-for="r in ROLES" :key="r" class="form-check">
          <input :id="r" v-model="roles" class="form-check-input" type="checkbox" :value="r" />
          <label class="form-check-label" :for="r">{{ LABELS[r] }} <code class="small">{{ r }}</code></label>
        </div>
      </fieldset>
      <fieldset class="mt-2">
        <legend class="fs-6 fw-semibold">Merchant</legend>
        <div v-for="m in MERCHANTS" :key="m" class="form-check">
          <input :id="m" v-model="merchants" class="form-check-input" type="checkbox" :value="m" />
          <label class="form-check-label" :for="m">{{ m }}</label>
        </div>
      </fieldset>
      <p v-if="error" class="text-danger small mt-2">{{ error }}</p>
      <button class="btn btn-primary mt-3">Masuk</button>
      <p class="text-secondary small mt-2 mb-0">Maker-checker: pengaju tidak bisa menyetujui perubahannya sendiri — login sebagai pengguna lain untuk menyetujui.</p>
    </form>
  </div>
</template>
