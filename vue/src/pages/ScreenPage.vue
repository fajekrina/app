<script setup lang="ts">
/**
 * The customer app: `/s/:merchantId/:screen?…` — one merchant's published page: a signed
 * template + value set, composed by the engine. Query params seed the screen (`{{seatId}}`).
 * The old `/s/:screen?m=<merchant>` links redirect here (router).
 */
import { computed, shallowRef, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SduiScreen } from '@fajekrina/sdui-r/vue'
import type { SduiEngine, SduiProps } from '@fajekrina/sdui-r'
import { createSduiEngine } from '../sdui/engine'
import { isMerchantId, screenPath } from '../sdui/config'
import { publicMerchants, session, type PublicMerchant } from '../api/bff'

const route = useRoute()
const router = useRouter()
const screen = computed(() => String(route.params.screen))
const merchant = computed(() => String(route.params.merchantId))
const valid = computed(() => isMerchantId(merchant.value))
const seed = computed(() => Object.fromEntries(Object.entries(route.query).filter(([, v]) => typeof v === 'string')) as Record<string, string>)
const engine = shallowRef<SduiEngine>()
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const error = ref<string>()
// every kanal with a published page (not a fixed list); the current one always stays
const merchants = ref<PublicMerchant[]>([])
publicMerchants().then((list) => { merchants.value = list }).catch((e) => console.warn('[sdui-r] merchants', e))
const listed = computed(() => merchants.value.some((m) => m.merchantId === merchant.value))

function query(params: SduiProps): Record<string, string> {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) if (v !== null && typeof v !== 'object') q[k] = String(v)
  return q
}

watch(merchant, async (m) => {
  engine.value = undefined
  error.value = undefined
  if (!isMerchantId(m)) return
  void session().catch(() => undefined)   // guest session + CSRF for api actions
  try {
    const created = await createSduiEngine({
      merchantId: m,
      navigate: (key, params) => void router.push({ path: screenPath(m, key), query: query(params) }),
      onEvent: (e) => { if (e.type === 'connectivity_changed') online.value = e.online }
    })
    await created.refreshManifest().catch((e) => console.warn('[sdui-r] manifest', e))
    if (m === merchant.value) engine.value = created
  } catch (e) {
    error.value = (e as Error).message
  }
}, { immediate: true })

const switchMerchant = (event: Event) => void router.push({ path: screenPath((event.target as HTMLSelectElement).value, screen.value), query: seed.value })
</script>

<template>
  <div class="min-vh-100 bg-light">
    <nav class="navbar bg-white border-bottom px-4 py-2 gap-3 small">
      <strong>sdui-r · Vue + Bootstrap</strong>
      <span class="badge text-bg-light font-monospace">{{ merchant }} / {{ screen }}</span>
      <label class="d-flex align-items-center gap-1 text-secondary">kanal
        <select class="form-select form-select-sm" :value="merchant" @change="switchMerchant">
          <option v-if="!listed" :value="merchant">{{ merchant }}</option>
          <option v-for="m in merchants" :key="m.merchantId" :value="m.merchantId">{{ m.name === m.merchantId ? m.merchantId : `${m.name} (${m.merchantId})` }}</option>
        </select>
      </label>
      <span v-if="!online" class="badge text-bg-warning">Anda sedang offline — tampilan terakhir yang terverifikasi</span>
      <RouterLink to="/studio" class="ms-auto">Studio →</RouterLink>
    </nav>
    <main class="container" style="max-width: 64rem">
      <p v-if="!valid" class="text-danger p-4">ID kanal tidak valid: <code>{{ merchant }}</code></p>
      <p v-if="error" class="text-danger p-4">{{ error }}</p>
      <SduiScreen v-if="engine" :key="`${merchant}/${screen}`" :engine="engine" :source="{ key: screen }" :seed="seed" />
      <p v-else-if="valid && !error" class="text-secondary p-4">Memuat…</p>
    </main>
  </div>
</template>
