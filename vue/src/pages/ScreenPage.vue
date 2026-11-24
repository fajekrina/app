<script setup lang="ts">
/**
 * The customer app: `/s/:screen?…` — a published page (no merchant, kanal or user: they only
 * render what the Studio published): a signed template + value set, composed by the engine.
 * Query params seed the screen (`{{seatId}}`). Pages made before 2.6 keep `/s/:merchantId/:screen`;
 * old `/s/:screen?m=<space>` links redirect there (router).
 */
import { computed, shallowRef, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SduiScreen } from '@fajekrina/sdui-r/vue'
import type { SduiEngine, SduiProps } from '@fajekrina/sdui-r'
import { createSduiEngine } from '../sdui/engine'
import { PAGE_SPACE, isMerchantId, screenPath } from '../sdui/config'
import { currentCustomer, session, type Customer } from '../api/bff'

const route = useRoute()
const router = useRouter()
const screen = computed(() => String(route.params.screen))
// the Studio's one page space, or a page's older space
const merchant = computed(() => (route.params.merchantId ? String(route.params.merchantId) : PAGE_SPACE))
const valid = computed(() => isMerchantId(merchant.value))
const seed = computed(() => Object.fromEntries(Object.entries(route.query).filter(([, v]) => typeof v === 'string')) as Record<string, string>)
const engine = shallowRef<SduiEngine>()
const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
const error = ref<string>()
// the Studio's page space holds the demo insights: a customer must be logged in (the feedback is
// theirs); older spaces stay public
const needsCustomer = computed(() => merchant.value === PAGE_SPACE)
const customer = ref<Customer | null>()

watch([needsCustomer, () => route.fullPath], async ([needed]) => {
  if (!needed) { customer.value = null; return }
  try {
    const c = await currentCustomer()
    if (!c) await router.replace({ path: '/login', query: { next: route.fullPath } })
    else customer.value = c
  } catch (e) {
    error.value = (e as Error).message
  }
}, { immediate: true })

function query(params: SduiProps): Record<string, string> {
  const q: Record<string, string> = {}
  for (const [k, v] of Object.entries(params)) if (v !== null && typeof v !== 'object') q[k] = String(v)
  return q
}

watch(merchant, async (m) => {
  engine.value = undefined
  error.value = undefined
  if (!isMerchantId(m)) return
  if (m !== PAGE_SPACE) void session().catch(() => undefined)   // guest session + CSRF for api actions
  try {
    const created = await createSduiEngine({
      merchantId: m,
      // the page on screen, sent with every request (`X-Sdui-Page`)
      page: () => screen.value,
      navigate: (key, params) => void router.push({ path: screenPath(m, key), query: query(params) }),
      onEvent: (e) => { if (e.type === 'connectivity_changed') online.value = e.online }
    })
    await created.refreshManifest().catch((e) => console.warn('[sdui-r] manifest', e))
    if (m === merchant.value) engine.value = created
  } catch (e) {
    error.value = (e as Error).message
  }
}, { immediate: true })

</script>

<template>
  <div class="min-vh-100 bg-light">
    <nav class="navbar bg-white border-bottom px-4 py-2 gap-3 small">
      <strong>sdui-r · Vue + Bootstrap</strong>
      <span class="badge text-bg-light font-monospace">{{ merchant === PAGE_SPACE ? screen : `${merchant} / ${screen}` }}</span>
      <span v-if="!online" class="badge text-bg-warning">Anda sedang offline — tampilan terakhir yang terverifikasi</span>
      <RouterLink v-if="customer" to="/dashboard">← Dashboard</RouterLink>
      <span v-if="customer" class="ms-auto text-secondary">{{ customer.name }}</span>
      <RouterLink to="/studio" :class="{ 'ms-auto': !customer }">Studio →</RouterLink>
    </nav>
    <main class="container" style="max-width: 64rem">
      <p v-if="!valid" class="text-danger p-4">Alamat halaman tidak valid: <code>{{ merchant }}</code></p>
      <p v-if="error" class="text-danger p-4">{{ error }}</p>
      <p v-if="needsCustomer && !customer" class="text-secondary p-4">Memuat…</p>
      <SduiScreen v-else-if="engine" :key="`${merchant}/${screen}`" :engine="engine" :source="{ key: screen }" :seed="seed" />
      <p v-else-if="valid && !error" class="text-secondary p-4">Memuat…</p>
    </main>
  </div>
</template>
