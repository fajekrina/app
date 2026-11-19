<script setup lang="ts">
/**
 * The Studio, one page per template of the admin's merchant (a page IS its template: same key).
 * ONE editor for the page's design and its content, and ONE "Terbitkan": the page is live at
 * once (no review step). Design and content are still stored apart — the template (no content)
 * in template-service, the value set (the content) in value-service — see ../sdui/page.ts.
 * The admin only ever sees its own templates and pages (the backend scopes every call).
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/vue'
import { StudioError, deprecationOf, studio, type ScreenDetail, type ScreenRow, type TemplateDetail, type TemplateRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, screenPath, studioAssetURL } from '../sdui/config'
import { baselineOf, editorSource, publishPage, savePageDraft, type PageState } from '../sdui/page'
import StudioSidebar from '../components/StudioSidebar.vue'

const route = useRoute()
const router = useRouter()
const key = computed(() => (route.params.key ? String(route.params.key) : undefined))
const merchantId = studio.merchantId()
const rows = ref<TemplateRow[]>([])
const pages = ref<ScreenRow[]>([])
// a navigate goes to a page, and a page IS a template: offer every template key
// deprecated templates are marked in the page picker (and are no replacement)
const catalog = computed(() => ({ ...CATALOG, screens: [...new Set([...rows.value.map((t) => t.key), ...(key.value ? [key.value] : [])])].sort(), deprecated: rows.value.filter((t) => t.deprecated).map((t) => t.key) }))
// undefined: loading; null: not created yet
const detail = ref<TemplateDetail | null>()
const page = ref<ScreenDetail | null>()
const document = shallowRef<EditorDocument>()
// content saved for components the design no longer has: left out, dropped on the next publish
const stale = ref<string>()
const newKey = ref('')
const error = ref<string>()
const notice = ref<string>()
const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }
const previewURL = studioAssetURL(merchantId)

async function reload() {
  const [t, p] = await Promise.all([studio.templates(), studio.screens()])
  rows.value = t
  pages.value = p
}
reload().catch((e: Error) => { error.value = e.message })
const pageOf = (k: string) => pages.value.find((p) => p.key === k)

const state = (): PageState => ({ template: detail.value ?? null, page: page.value ?? null })
const apply = (s: PageState) => { detail.value = s.template; page.value = s.page }

// one document per opened page (design + content); the builder keeps its own undo history
watch(key, async (k) => {
  detail.value = undefined
  page.value = undefined
  document.value = undefined
  stale.value = undefined
  error.value = undefined
  notice.value = undefined
  if (!k) return
  try {
    const [d, p] = await Promise.all([studio.template(k).catch(notFound), studio.screen(k).catch(notFound)])
    // every released version: their component ids are never generated again
    const released = d ? await studio.releasedTemplates(k, d.releases.map((x) => x.version)) : []
    if (k !== key.value) return
    const doc = new EditorDocument({ mode: 'template', key: k })
    for (const t of released) doc.reserveIds(t as object)
    const { source, dropped } = editorSource({ template: d, page: p })
    if (source) doc.importJSON(source)
    stale.value = dropped.length ? `Konten untuk komponen yang sudah tidak ada di desain akan dibuang: ${dropped.join(', ')}.` : undefined
    detail.value = d
    page.value = p
    document.value = doc
  } catch (e) {
    if (k === key.value) error.value = (e as Error).message
  }
}, { immediate: true })
const baseline = computed(() => baselineOf({ template: detail.value ?? null, page: page.value ?? null }))

async function save(payload: unknown) {
  apply(await savePageDraft(key.value!, payload, state()))
  await reload()
}
async function publish(payload: unknown) {
  try {
    const res = await publishPage(key.value!, payload, state(), apply)
    apply(res)
    notice.value = `Halaman ${key.value} terbit (desain v${res.template?.activeVersion}, konten v${res.page?.activeSequence}).${res.dropped.length ? ` Dibuang (tidak ada lagi di desain): ${res.dropped.join(', ')}.` : ''}`
  } catch (e) {
    // nothing changed since the last publish: the page is already live
    if (e instanceof StudioError && e.status === 409 && page.value?.activeSequence) notice.value = `Tidak ada perubahan: halaman ${key.value} sudah tayang.`
    else throw e
  } finally {
    await reload()
  }
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
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey.value)) { void router.push(`/studio/templates/${newKey.value}`); newKey.value = '' }
}
const changed = (t: TemplateRow) => t.unpublished || pageOf(t.key)?.unpublished
const upload = (source: Parameters<typeof studio.uploadAsset>[0]) => studio.uploadAsset(source)
</script>

<template>
  <div class="d-grid gap-3 p-3" style="grid-template-columns: auto 1fr">
    <StudioSidebar>
      <section class="card card-body p-3 small">
        <h3 class="h6">Halaman <span class="fw-normal text-secondary">· {{ merchantId }}</span></h3>
        <p v-if="rows.length === 0" class="text-secondary">Belum ada halaman. Buat yang pertama di bawah.</p>
        <div class="list-group list-group-flush">
          <button v-for="t in rows" :key="t.key" class="list-group-item list-group-item-action" :class="{ active: t.key === key }" @click="router.push(`/studio/templates/${t.key}`)">
            <div class="font-monospace text-truncate" :title="t.key">{{ t.key }}</div>
            <small class="d-block text-truncate">{{ t.title ?? '—' }} · {{ pageOf(t.key)?.activeSequence ? 'tayang' : 'belum terbit' }}{{ changed(t) && pageOf(t.key)?.activeSequence ? ' · ada perubahan' : '' }}</small>
            <span v-if="t.deprecated" class="badge rounded-pill text-bg-warning" :title="t.deprecationReason ?? undefined">deprecated{{ t.replacedBy ? ` → ${t.replacedBy}` : '' }}</span>
          </button>
        </div>
        <form class="input-group input-group-sm mt-3" @submit.prevent="create">
          <input v-model="newKey" class="form-control font-monospace" placeholder="halamanBaru" />
          <button class="btn btn-primary">Buat</button>
        </form>
      </section>
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card d-flex flex-column">
      <p v-if="!key" class="p-4 text-secondary">Pilih halaman, atau buat yang baru. Desain dan isinya diedit di sini, lalu Terbitkan sekali.</p>
      <div v-if="key" class="d-flex flex-shrink-0 align-items-center gap-3 border-bottom bg-light px-3 small" style="height: 3rem">
        <span class="font-monospace text-secondary">{{ merchantId }} / {{ key }}</span>
        <span v-if="notice ?? stale" class="text-truncate" :class="notice ? 'text-success' : 'text-warning-emphasis'" role="status">{{ notice ?? stale }}</span>
        <a v-if="page?.activeSequence" :href="screenPath(merchantId, key)" target="_blank" rel="noreferrer" class="ms-auto">Lihat halaman ↗</a>
      </div>
      <SduiTemplateBuilder
        v-if="key && document"
        :key="key"
        :document="document"
        :title="page?.activeSequence ? `tayang · desain v${detail?.activeVersion}, konten v${page.activeSequence}` : 'belum terbit'"
        :catalog="catalog"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="previewURL"
        :upload-asset="upload"
        :baseline="baseline"
        :on-save="save"
        :on-publish="publish"
        :deprecation="deprecation"
        :on-deprecate="detail?.activeVersion ? deprecate : undefined"
        :on-restore="restore"
      />
    </main>
  </div>
</template>
