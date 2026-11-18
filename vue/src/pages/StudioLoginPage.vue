<script setup lang="ts">
/**
 * Dev stand-in for the workforce SSO: a name and ONE role. The maker IS the merchant — its
 * name is its merchant id; checkers and viewers see every merchant. One role per login keeps
 * maker and checker apart: approving needs another account. A viewer only reads, so it
 * signs in without a name.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ROLES, studio, type Role } from '../api/studio'

const LABELS: Record<Role, [string, string]> = {
  SDUI_TEMPLATE_ADMIN: ['Admin template', 'membuat dan mengajukan template (Template Builder)'],
  SDUI_TEMPLATE_PUBLISHER: ['Checker template', 'menyetujui / menolak pengajuan template'],
  SDUI_AUTHOR: ['Maker (merchant)', 'menyusun screen merchant-nya dari template yang disetujui (Screen Builder)'],
  SDUI_PUBLISHER: ['Checker konten', 'menyetujui / menolak pengajuan screen semua merchant'],
  SDUI_VIEWER: ['Viewer', 'hanya melihat template dan screen']
}
const router = useRouter()
const username = ref('')
const role = ref<Role>()
const error = ref<string>()
const maker = computed(() => role.value === 'SDUI_AUTHOR')
const viewer = computed(() => role.value === 'SDUI_VIEWER')

async function submit() {
  if (!role.value) { error.value = 'Pilih peran'; return }
  try {
    await studio.login(viewer.value ? '' : username.value.trim(), [role.value], [])
    await router.push(studio.home())
  } catch (e) {
    error.value = (e as Error).message
  }
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <form class="card p-4 shadow-sm" style="width: 32rem" @submit.prevent="submit">
      <h1 class="h5">sdui-r Studio — login (dev)</h1>
      <fieldset class="mt-2">
        <legend class="fs-6 fw-semibold">Peran</legend>
        <div v-for="r in ROLES" :key="r" class="form-check">
          <input :id="r" v-model="role" class="form-check-input" type="radio" name="role" :value="r" />
          <label class="form-check-label" :for="r"><strong>{{ LABELS[r][0] }}</strong> <span class="text-secondary">— {{ LABELS[r][1] }}</span></label>
        </div>
        <p class="text-secondary small mb-0">Satu akun satu peran. Untuk menyetujui pengajuan, login sebagai akun lain dengan peran checker.</p>
      </fieldset>
      <label v-if="role && !viewer" class="form-label mt-3">{{ maker ? 'Nama merchant' : 'Nama pengguna' }}
        <input v-model="username" required :pattern="maker ? '[A-Za-z][A-Za-z0-9_]{1,63}' : '[A-Za-z][A-Za-z0-9._\\-]{1,63}'" class="form-control font-monospace" :placeholder="maker ? 'mis. toko_baru' : 'mis. tia, tono'" />
        <span v-if="maker" class="form-text">Merchant contoh yang sudah berisi screen: <code>merchant_demo</code>, <code>merchant_promo</code>.</span>
      </label>
      <p v-if="error" class="text-danger small mt-2">{{ error }}</p>
      <button class="btn btn-primary mt-3">Masuk</button>
    </form>
  </div>
</template>
