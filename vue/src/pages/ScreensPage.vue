<script setup lang="ts">
/**
 * Screen Builder (maker): pick a released template, fill in its components → a value set
 * for one merchant screen. Saved to value-service through studio-bff; a publisher approves.
 * A page IS its template: the maker never types a page id — a new page's key is the key of
 * the template it is made from (so a template's `navigate` always finds the page).
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SduiScreenBuilder, ValuesEditor, type TemplateChoice } from '@fajekrina/sdui-r/builder/vue'
import { TemplateDocument } from '@fajekrina/sdui-r'
import { StudioError, deprecationOf, studio, type CatalogEntry, type RequestRow, type ScreenDetail, type ScreenRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, studioAssetURL } from '../sdui/config'
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
const newTemplate = ref('')
const error = ref<string>()
const canEdit = studio.has('SDUI_AUTHOR')
const me = studio.current()!.sub
// the page's own template only (its newer releases): the template is not switched per page
const pageTemplate = computed(() => detail.value?.templateKey ?? key.value)
const templates = computed<TemplateChoice[]>(() => catalog.value.filter((c) => c.key === pageTemplate.value).map((c) => ({ key: c.key, version: c.version, title: c.title, deprecated: deprecationOf(c) ?? undefined })))
// templates this merchant has no page for yet (a deprecated one starts no new page)
const unused = computed(() => catalog.value.filter((c) => !c.deprecated && !rows.value.some((s) => s.key === c.key)))
const deprecatedKeys = computed(() => new Set(catalog.value.filter((c) => c.deprecated).map((c) => c.key)))
const previewURL = computed(() => studioAssetURL(merchantId.value))
const uploadAsset = (source: { file: Blob & { name?: string } } | { url: string }) => studio.uploadAsset(merchantId.value, source)

async function reload() {
  if (!merchantId.value) return
  rows.value = await studio.screens(merchantId.value)
  requests.value = await studio.screenRequests(merchantId.value, 'PENDING')
}
watch(merchantId, () => reload().catch((e: Error) => { error.value = e.message }), { immediate: true })
studio.catalog().then((c) => { catalog.value = c }).catch((e: Error) => { error.value = e.message })

// open a screen: its draft (or active) values with the template release they name; a new
// page starts from the latest approved release of the template it is named after
watch([merchantId, key, catalog], async ([mid, k, entries]) => {
  detail.value = undefined
  editor.value = undefined
  if (!k || !mid) return
  try {
    // only a 404 means "no page yet"; any other failure is shown, never treated as a new page
    const d = await studio.screen(mid, k).catch((e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e })
    const values = d?.draft ?? d?.active?.payload
    const release = d ? { key: d.templateKey, version: d.templateVersion } : entries.find((c) => c.key === k)
    // a deprecated template starts no new page (value-service refuses it too)
    if (!d && release && 'deprecated' in release && release.deprecated) {
      error.value = `Template "${k}" deprecated${release.deprecationReason ? ` (${release.deprecationReason})` : ''} — tidak bisa dipakai untuk page baru${release.replacedBy ? `; gunakan ${release.replacedBy}` : ''}.`
      return
    }
    if (!d && !release) {
      if (entries.length > 0) error.value = `Template "${k}" belum disetujui — page hanya bisa dibuat dari template yang disetujui.`
      return
    }
    const template = await studio.releasedTemplate(release!.key, release!.version)
    if (k !== key.value || mid !== merchantId.value) return
    error.value = undefined
    detail.value = d
    editor.value = new ValuesEditor({ screen: k, values, template: TemplateDocument.decode(template) })
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
  if (!newTemplate.value) return
  void router.push(`/studio/screens/${merchantId.value}/${newTemplate.value}`)
  newTemplate.value = ''
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
        <p v-if="own && rows.length === 0" class="text-secondary mb-2">Belum ada page. Buat page baru dari template yang sudah disetujui.</p>
        <div class="list-group list-group-flush">
          <button v-for="s in rows" :key="s.key" class="list-group-item list-group-item-action" :class="{ active: s.key === key }" @click="router.push(`/studio/screens/${merchantId}/${s.key}`)">
            <div class="font-monospace text-truncate" :title="s.key">{{ s.key }}</div>
            <small class="d-block text-truncate" :title="`${s.templateKey}@${s.templateVersion}`">{{ s.templateKey }}@{{ s.templateVersion }} · {{ s.activeSequence ? `v${s.activeSequence}` : 'belum terbit' }}{{ s.pending ? ' · menunggu review' : '' }}</small>
            <span v-if="deprecatedKeys.has(s.templateKey)" class="badge rounded-pill text-bg-warning">template deprecated</span>
          </button>
        </div>
        <form v-if="canEdit" class="input-group input-group-sm mt-3" @submit.prevent="create">
          <select v-model="newTemplate" aria-label="Template page baru" class="form-select font-monospace">
            <option value="">{{ unused.length ? '— page baru dari template —' : 'semua template sudah dipakai' }}</option>
            <option v-for="c in unused" :key="c.key" :value="c.key">{{ c.key }}{{ c.title ? ` · ${c.title}` : '' }}</option>
          </select>
          <button class="btn btn-primary" :disabled="!newTemplate">Buat</button>
        </form>
      </section>
      <RequestsPanel :title="`Pengajuan · ${merchantId}`" :rows="requests" :me="me" :can-decide="studio.has('SDUI_PUBLISHER')" :on-decide="decide" />
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card">
      <p v-if="!key" class="p-4 text-secondary">Pilih page, atau buat yang baru dari template yang disetujui. Anda mengisi value komponennya.</p>
      <SduiScreenBuilder
        v-if="editor"
        :key="`${merchantId}/${key}`"
        :editor="editor"
        :title="merchantId"
        :templates="templates"
        :load-template="loadTemplate"
        :catalog="CATALOG"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="previewURL"
        :upload-asset="canEdit ? uploadAsset : undefined"
        :read-only="!canEdit"
        :baseline="detail?.active?.payload"
        :on-save="canEdit ? save : undefined"
        :on-submit-for-review="canEdit ? submit : undefined"
      />
    </main>
  </div>
</template>
