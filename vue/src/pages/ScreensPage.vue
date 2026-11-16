<script setup lang="ts">
/**
 * Screen Builder (maker): pick a released template, fill in its components → a value set
 * for one merchant screen. Saved to value-service through studio-bff; a publisher approves.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SduiScreenBuilder, ValuesEditor, type TemplateChoice } from '@fajekrina/sdui-r/builder/vue'
import { TemplateDocument } from '@fajekrina/sdui-r'
import { studio, type CatalogEntry, type RequestRow, type ScreenDetail, type ScreenRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, assetURL } from '../sdui/config'
import RequestsPanel from '../components/RequestsPanel.vue'
import StudioSidebar from '../components/StudioSidebar.vue'

const route = useRoute()
const router = useRouter()
// the maker IS the merchant (its own account); checkers and viewers pick any merchant
const own = studio.has('SDUI_AUTHOR') ? studio.current()!.merchants[0] : undefined
const merchants = ref<string[]>(own ? [own] : [])
if (!own) studio.merchants().then((list) => { merchants.value = list.map((m) => m.merchantId) }).catch((e: Error) => { error.value = e.message })
const merchantId = computed(() => own ?? (route.params.merchantId ? String(route.params.merchantId) : merchants.value[0] ?? ''))
const key = computed(() => (route.params.key ? String(route.params.key) : undefined))
const rows = ref<ScreenRow[]>([])
const requests = ref<RequestRow[]>([])
const catalog = ref<CatalogEntry[]>([])
const detail = ref<ScreenDetail | null>()
const editor = shallowRef<ValuesEditor>()
const newKey = ref('')
const error = ref<string>()
const canEdit = studio.has('SDUI_AUTHOR')
const me = studio.current()!.sub
const templates = computed<TemplateChoice[]>(() => catalog.value.map((c) => ({ key: c.key, version: c.version, title: c.title })))

async function reload() {
  if (!merchantId.value) return
  rows.value = await studio.screens(merchantId.value)
  requests.value = await studio.screenRequests(merchantId.value, 'PENDING')
}
watch(merchantId, () => reload().catch((e: Error) => { error.value = e.message }), { immediate: true })
studio.catalog().then((c) => { catalog.value = c }).catch((e: Error) => { error.value = e.message })

// open a screen: its draft (or active) values with the template release they name
watch([merchantId, key], async ([mid, k]) => {
  detail.value = undefined
  editor.value = undefined
  if (!k || !mid) return
  try {
    const d = await studio.screen(mid, k).catch(() => null)
    const values = d?.draft ?? d?.active?.payload
    const template = d ? await studio.releasedTemplate(d.templateKey, d.templateVersion) : undefined
    if (k !== key.value || mid !== merchantId.value) return
    detail.value = d
    editor.value = new ValuesEditor({ screen: k, values, template: template && TemplateDocument.decode(template) })
  } catch (e) {
    error.value = (e as Error).message
  }
}, { immediate: true })

async function save(payload: unknown) {
  detail.value = await studio.saveScreen(merchantId.value, key.value!, payload, detail.value?.lockVersion)
  await reload()
}
async function submit(payload: unknown, note: string) {
  await save(payload)
  await studio.submitScreen(merchantId.value, key.value!, note)
  await reload()
}
async function decide(id: number, d: 'approve' | 'reject' | 'withdraw', reason?: string) {
  await studio.decideScreen(merchantId.value, id, d, reason)
  await reload()
  if (key.value) detail.value = await studio.screen(merchantId.value, key.value)
}
function create() {
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey.value)) void router.push(`/studio/screens/${merchantId.value}/${newKey.value}`)
}
const loadTemplate = (c: TemplateChoice) => studio.releasedTemplate(c.key, c.version)
</script>

<template>
  <div class="d-grid gap-3 p-3" style="grid-template-columns: auto 1fr">
    <StudioSidebar>
      <section class="card card-body p-3 small">
        <div v-if="own" class="fw-semibold mb-2">Merchant <code class="ms-1">{{ own }}</code></div>
        <label v-else class="d-flex align-items-center gap-2 fw-semibold mb-2">Merchant
          <select class="form-select form-select-sm" :value="merchantId" @change="router.push(`/studio/screens/${($event.target as HTMLSelectElement).value}`)">
            <option v-for="m in merchants" :key="m">{{ m }}</option>
          </select>
        </label>
        <p v-if="own && rows.length === 0" class="text-secondary mb-2">Belum ada screen. Buat screen baru, lalu pilih template yang sudah disetujui.</p>
        <div class="list-group list-group-flush">
          <button v-for="s in rows" :key="s.key" class="list-group-item list-group-item-action" :class="{ active: s.key === key }" @click="router.push(`/studio/screens/${merchantId}/${s.key}`)">
            <div class="font-monospace text-truncate" :title="s.key">{{ s.key }}</div>
            <small class="d-block text-truncate" :title="`${s.templateKey}@${s.templateVersion}`">{{ s.templateKey }}@{{ s.templateVersion }} · {{ s.activeSequence ? `v${s.activeSequence}` : 'belum terbit' }}{{ s.pending ? ' · menunggu review' : '' }}</small>
          </button>
        </div>
        <form v-if="canEdit" class="input-group input-group-sm mt-3" @submit.prevent="create">
          <input v-model="newKey" class="form-control font-monospace" placeholder="screenKeyBaru" />
          <button class="btn btn-primary">Buat</button>
        </form>
      </section>
      <RequestsPanel :title="`Pengajuan · ${merchantId}`" :rows="requests" :me="me" :can-decide="studio.has('SDUI_PUBLISHER')" :on-decide="decide" />
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card">
      <p v-if="!key" class="p-4 text-secondary">Pilih screen, atau buat yang baru. Di Screen Builder pilihannya template; Anda mengisi value komponennya.</p>
      <SduiScreenBuilder
        v-if="editor"
        :key="`${merchantId}/${key}`"
        :editor="editor"
        :title="merchantId"
        :templates="templates"
        :load-template="loadTemplate"
        :catalog="CATALOG"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="assetURL"
        :read-only="!canEdit"
        :baseline="detail?.active?.payload"
        :on-save="canEdit ? save : undefined"
        :on-submit-for-review="canEdit ? submit : undefined"
      />
    </main>
  </div>
</template>
