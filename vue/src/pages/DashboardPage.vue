<script setup lang="ts">
/**
 * The customer dashboard (an app page, not SDUI): tick simulated activities ("Sering beli kopi
 * bulan ini") and the insights they bring up appear, each with this customer's 👍 / 👎. Opening
 * one shows the SDUI insight page made in the Studio's Konten tab.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { activities as loadActivities, currentCustomer, customerLogout, insights as loadInsights, tickActivities, type Activity, type Customer, type Insight } from '../api/bff'
import { PAGE_SPACE, screenPath } from '../sdui/config'

const VOTE: Record<Insight['vote'], [string, string]> = {
  like: ['👍 Kamu suka', 'text-bg-success'],
  dislike: ['👎 Kurang suka', 'text-bg-danger'],
  '': ['Belum ada feedback', 'text-bg-light']
}

const router = useRouter()
const me = ref<Customer | null>()
const list = ref<Activity[]>([])
const ticked = ref<string[]>([])
const shown = ref<Insight[]>([])
const error = ref<string>()
const saving = ref(false)

async function reload() {
  const [a, i] = await Promise.all([loadActivities(), loadInsights()])
  list.value = a.activities
  ticked.value = a.codes
  shown.value = i
}

currentCustomer().then(async (c) => {
  if (!c) { await router.replace('/login?next=/dashboard'); return }
  me.value = c
  await reload()
}).catch((e: Error) => { error.value = e.message })

async function toggle(code: string) {
  const next = ticked.value.includes(code) ? ticked.value.filter((c) => c !== code) : [...ticked.value, code]
  saving.value = true
  try {
    await tickActivities(next)
    await reload()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    saving.value = false
  }
}

async function logout() {
  await customerLogout().catch(() => undefined)
  await router.replace('/login')
}
</script>

<template>
  <p v-if="!me" class="p-4 text-secondary">{{ error ?? 'Memuat…' }}</p>
  <div v-else class="min-vh-100 bg-light">
    <header class="px-4 pt-4 pb-5" style="background: #c2f0ed">
      <div class="container d-flex align-items-center gap-3" style="max-width: 48rem">
        <div>
          <div class="small text-secondary">Halo,</div>
          <h1 class="h4 fw-bold mb-0">{{ me.name }}</h1>
        </div>
        <button class="btn btn-light btn-sm rounded-pill ms-auto" @click="logout">Keluar</button>
      </div>
    </header>
    <main class="container pb-5" style="max-width: 48rem; margin-top: -1.5rem">
      <p v-if="error" role="alert" class="alert alert-danger small">{{ error }}</p>
      <section class="card border-0 shadow-sm rounded-4 p-4 mb-4">
        <h2 class="h6 fw-semibold">Simulasi aktivitas</h2>
        <p class="small text-secondary">Centang aktivitas yang seolah-olah kamu lakukan; insight yang cocok akan muncul di bawah.</p>
        <label v-for="a in list" :key="a.code" class="d-flex gap-3 border rounded-3 p-3 mb-2" style="cursor: pointer">
          <input type="checkbox" class="form-check-input mt-1" :checked="ticked.includes(a.code)" :disabled="saving" @change="toggle(a.code)" />
          <span>
            <span class="d-block small fw-medium">{{ a.title }}</span>
            <span class="d-block small text-secondary">{{ a.description }}</span>
          </span>
        </label>
      </section>
      <section class="card border-0 shadow-sm rounded-4 p-4">
        <h2 class="h6 fw-semibold mb-3">Insight untukmu</h2>
        <p v-if="shown.length === 0" class="small text-secondary mb-0">Belum ada insight. Centang aktivitas di atas.</p>
        <RouterLink v-for="i in shown" :key="i.page" :to="screenPath(PAGE_SPACE, i.page)"
          class="d-flex align-items-center gap-3 border rounded-3 p-3 mb-2 text-decoration-none text-body">
          <span class="flex-grow-1">
            <span class="d-block fw-medium">{{ i.title }}</span>
            <span :class="['badge rounded-pill mt-1', VOTE[i.vote][1]]">{{ VOTE[i.vote][0] }}</span>
          </span>
          <span aria-hidden="true" class="text-secondary">›</span>
        </RouterLink>
      </section>
    </main>
  </div>
</template>
