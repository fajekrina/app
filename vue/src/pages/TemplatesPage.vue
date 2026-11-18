<script setup lang="ts">
/**
 * Template Builder (admin): components → a template (ids + orders). Drafts are saved to
 * template-service through studio-bff; a template publisher approves the release.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/vue'
import { deprecationOf, studio, type RequestRow, type TemplateDetail, type TemplateRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, assetURL } from '../sdui/config'
import RequestsPanel from '../components/RequestsPanel.vue'
import StudioSidebar from '../components/StudioSidebar.vue'

const route = useRoute()
const router = useRouter()
const key = computed(() => (route.params.key ? String(route.params.key) : undefined))
const rows = ref<TemplateRow[]>([])
// a navigate goes to a page, and a page IS a template: offer every template key
// deprecated templates are marked in the page picker (and are no replacement)
const catalog = computed(() => ({ ...CATALOG, screens: [...new Set([...rows.value.map((t) => t.key), ...(key.value ? [key.value] : [])])].sort(), deprecated: rows.value.filter((t) => t.deprecated).map((t) => t.key) }))
const requests = ref<RequestRow[]>([])
const detail = ref<TemplateDetail | null>()
const document = shallowRef<EditorDocument>()
const newKey = ref('')
const error = ref<string>()
const canEdit = studio.has('SDUI_TEMPLATE_ADMIN')
const me = studio.current()!.sub

async function reload() {
  rows.value = await studio.templates()
  requests.value = await studio.templateRequests('PENDING')
}
reload().catch((e: Error) => { error.value = e.message })

// one document per opened template; the builder keeps its own undo history
watch(key, async (k) => {
  detail.value = undefined
  document.value = undefined
  if (!k) return
  const d = await studio.template(k).catch(() => null)   // null: a new template
  // every released version: their component ids are never generated again
  let released: unknown[]
  try { released = d ? await studio.releasedTemplates(k, d.releases.map((x) => x.version)) : [] } catch (e) { if (k === key.value) error.value = (e as Error).message; return }
  if (k !== key.value) return
  const doc = new EditorDocument({ mode: 'template', key: k })
  for (const t of released) doc.reserveIds(t as object)
  const source = d?.draft ?? d?.active?.payload
  if (source) doc.importJSON(source as object)
  detail.value = d
  document.value = doc
}, { immediate: true })

async function save(payload: unknown) {
  detail.value = await studio.saveTemplate(key.value!, payload, detail.value?.lockVersion)
  await reload()
}
async function submit(payload: unknown, note: string) {
  await save(payload)
  await studio.submitTemplate(key.value!, note)
  await reload()
}
async function decide(id: number, d: 'approve' | 'reject' | 'withdraw', reason?: string) {
  await studio.decideTemplate(id, d, reason)
  await reload()
  if (key.value) detail.value = await studio.template(key.value)
}
const deprecation = computed(() => deprecationOf(detail.value))
async function deprecate(info: { reason: string; replacedBy?: string }) {
  detail.value = await studio.deprecateTemplate(key.value!, info.reason, info.replacedBy)
  await reload()
}
async function restore() {
  detail.value = await studio.restoreTemplate(key.value!)
  await reload()
}
function create() {
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey.value)) void router.push(`/studio/templates/${newKey.value}`)
}
</script>

<template>
  <div class="d-grid gap-3 p-3" style="grid-template-columns: auto 1fr">
    <StudioSidebar>
      <section class="card card-body p-3 small">
        <h3 class="h6">Template</h3>
        <div class="list-group list-group-flush">
          <button v-for="t in rows" :key="t.key" class="list-group-item list-group-item-action" :class="{ active: t.key === key }" @click="router.push(`/studio/templates/${t.key}`)">
            <div class="font-monospace text-truncate" :title="t.key">{{ t.key }}</div>
            <small class="d-block text-truncate">{{ t.title ?? '—' }} · {{ t.activeVersion ? `v${t.activeVersion}` : 'belum terbit' }}{{ t.pending ? ' · menunggu review' : '' }}</small>
            <span v-if="t.deprecated" class="badge rounded-pill text-bg-warning" :title="t.deprecationReason ?? undefined">deprecated{{ t.replacedBy ? ` → ${t.replacedBy}` : '' }}</span>
          </button>
        </div>
        <form v-if="canEdit" class="input-group input-group-sm mt-3" @submit.prevent="create">
          <input v-model="newKey" class="form-control font-monospace" placeholder="templateKeyBaru" />
          <button class="btn btn-primary">Buat</button>
        </form>
      </section>
      <RequestsPanel title="Pengajuan template" :rows="requests" :me="me" :can-decide="studio.has('SDUI_TEMPLATE_PUBLISHER')" :on-decide="decide" />
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card">
      <p v-if="!key" class="p-4 text-secondary">Pilih template, atau buat yang baru.</p>
      <SduiTemplateBuilder
        v-if="document"
        :key="key"
        :document="document"
        :title="detail?.activeVersion ? `aktif v${detail.activeVersion}` : 'baru'"
        :catalog="catalog"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="assetURL"
        :read-only="!canEdit"
        :baseline="detail?.active?.payload"
        :on-save="canEdit ? save : undefined"
        :on-submit-for-review="canEdit ? submit : undefined"
        :deprecation="deprecation"
        :on-deprecate="canEdit && detail?.activeVersion ? deprecate : undefined"
        :on-restore="canEdit ? restore : undefined"
      />
    </main>
  </div>
</template>
