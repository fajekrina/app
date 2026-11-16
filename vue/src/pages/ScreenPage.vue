<script setup lang="ts">
/**
 * The customer app: `/s/:screen?m=<merchant>&…` — a signed template + value set, composed
 * by the engine. Query params (except `m`) seed the screen (`{{seatId}}`).
 */
import { computed, shallowRef, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SduiScreen } from '@fajekrina/sdui-r/vue'
import type { SduiEngine, SduiProps } from '@fajekrina/sdui-r'
import { createSduiEngine } from '../sdui/engine'
import { DEFAULT_MERCHANT, MERCHANTS } from '../sdui/config'
import { session } from '../api/bff'

const route = useRoute()
const router = useRouter()
const screen = computed(() => String(route.params.screen))
const merchant = computed(() => (typeof route.query.m === 'string' ? route.query.m : DEFAULT_MERCHANT))
const seed = computed(() => Object.fromEntries(Object.entries(route.query).filter(([k, v]) => k !== 'm' && typeof v === 'string')) as Record<string, string>)
const engine = shallowRef<SduiEngine>()
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const error = ref<string>()

function query(m: string, params: SduiProps): Record<string, string> {
  const q: Record<string, string> = {}
  if (m !== DEFAULT_MERCHANT) q.m = m
  for (const [k, v] of Object.entries(params)) if (v !== null && typeof v !== 'object') q[k] = String(v)
  return q
}

watch(merchant, async (m) => {
  engine.value = undefined
  error.value = undefined
  void session().catch(() => undefined)   // guest session + CSRF for api actions
  try {
    const created = await createSduiEngine({
      merchantId: m,
      navigate: (key, params) => void router.push({ path: `/s/${key}`, query: query(m, params) }),
      onEvent: (e) => { if (e.type === 'connectivity_changed') online.value = e.online }
    })
    await created.refreshManifest().catch((e) => console.warn('[sdui-r] manifest', e))
    if (m === merchant.value) engine.value = created
  } catch (e) {
    error.value = (e as Error).message
  }
}, { immediate: true })

const switchMerchant = (event: Event) => void router.push({ path: `/s/${screen.value}`, query: query((event.target as HTMLSelectElement).value, seed.value) })
</script>

<template>
  <div class="min-vh-100 bg-light">
    <nav class="navbar bg-white border-bottom px-4 py-2 gap-3 small">
      <strong>sdui-r · Vue + Bootstrap</strong>
      <span class="badge text-bg-light font-monospace">{{ merchant }} / {{ screen }}</span>
      <label class="d-flex align-items-center gap-1 text-secondary">merchant
        <select class="form-select form-select-sm" :value="merchant" @change="switchMerchant">
          <option v-for="m in [...new Set([...MERCHANTS, merchant])]" :key="m">{{ m }}</option>
        </select>
      </label>
      <span v-if="!online" class="badge text-bg-warning">Anda sedang offline — tampilan terakhir yang terverifikasi</span>
      <RouterLink to="/studio" class="ms-auto">Studio →</RouterLink>
    </nav>
    <main class="container" style="max-width: 64rem">
      <p v-if="error" class="text-danger p-4">{{ error }}</p>
      <SduiScreen v-if="engine" :key="`${merchant}/${screen}`" :engine="engine" :source="{ key: screen }" :seed="seed" />
      <p v-else-if="!error" class="text-secondary p-4">Memuat…</p>
    </main>
  </div>
</template>
