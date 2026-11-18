<script setup lang="ts">
/**
 * The Studio, one page per template of the admin's merchant, two tabs:
 * - **Desain** — the Template Builder: components → a template (ids + orders). Save a draft,
 *   or Terbitkan: the release is live at once (no review step).
 * - **Isi konten** — the admin fills the merchant's page made from this template (a page IS
 *   its template: same key) and publishes it, also at once.
 * The admin only ever sees its own templates and pages (the backend scopes every call).
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorDocument, SduiScreenBuilder, SduiTemplateBuilder, ValuesEditor } from '@fajekrina/sdui-r/builder/vue'
import { TemplateDocument } from '@fajekrina/sdui-r'
import { StudioError, deprecationOf, studio, type ScreenDetail, type ScreenRow, type TemplateDetail, type TemplateRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, assetURL, screenPath, studioAssetURL } from '../sdui/config'
import StudioSidebar from '../components/StudioSidebar.vue'

const route = useRoute()
const router = useRouter()
const key = computed(() => (route.params.key ? String(route.params.key) : undefined))
const tab = computed<'design' | 'content'>(() => (route.params.tab === 'content' ? 'content' : 'design'))
const merchantId = studio.merchantId()
const rows = ref<TemplateRow[]>([])
const pages = ref<ScreenRow[]>([])
// a navigate goes to a page, and a page IS a template: offer every template key
// deprecated templates are marked in the page picker (and are no replacement)
const catalog = computed(() => ({ ...CATALOG, screens: [...new Set([...rows.value.map((t) => t.key), ...(key.value ? [key.value] : [])])].sort(), deprecated: rows.value.filter((t) => t.deprecated).map((t) => t.key) }))
const detail = ref<TemplateDetail | null>()
const document = shallowRef<EditorDocument>()
const newKey = ref('')
const error = ref<string>()
const notice = ref<string>()
const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }

async function reload() {
  const [t, p] = await Promise.all([studio.templates(), studio.screens()])
  rows.value = t
  pages.value = p
}
reload().catch((e: Error) => { error.value = e.message })
const pageOf = (k: string) => pages.value.find((p) => p.key === k)

// one document per opened template; the builder keeps its own undo history
watch(key, async (k) => {
  detail.value = undefined
  document.value = undefined
  error.value = undefined
  notice.value = undefined
  if (!k) return
  try {
    const d = await studio.template(k).catch(notFound)   // null: a new template
    // every released version: their component ids are never generated again
    const released = d ? await studio.releasedTemplates(k, d.releases.map((x) => x.version)) : []
    if (k !== key.value) return
    const doc = new EditorDocument({ mode: 'template', key: k })
    for (const t of released) doc.reserveIds(t as object)
    const source = d?.draft ?? d?.active?.payload
    if (source) doc.importJSON(source as object)
    detail.value = d
    document.value = doc
  } catch (e) {
    if (k === key.value) error.value = (e as Error).message
  }
}, { immediate: true })

async function saveTemplate(payload: unknown) {
  detail.value = await studio.saveTemplate(key.value!, payload, detail.value?.lockVersion)
  await reload()
}
async function publishTemplate(payload: unknown) {
  const saved = await studio.saveTemplate(key.value!, payload, detail.value?.lockVersion)
  // nothing changed since the last release: it is already live
  const published = saved.unpublished || !saved.activeVersion ? await studio.publishTemplate(key.value!) : saved
  detail.value = published
  await reload()
  notice.value = `Template ${key.value} v${published.activeVersion} terbit. Isi kontennya di tab "Isi konten".`
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

// ---- content tab: the merchant's page made from this template ----
const page = ref<ScreenDetail | null>()
const editor = shallowRef<ValuesEditor>()
const previewURL = studioAssetURL(merchantId)
watch([tab, key, () => detail.value?.activeVersion], async ([t, k, version]) => {
  page.value = undefined
  editor.value = undefined
  if (t !== 'content' || !k || !version) return
  try {
    const p = await studio.screen(k).catch(notFound)
    const latest = TemplateDocument.decode(await studio.releasedTemplate(k, version))
    const values = p?.draft ?? p?.active?.payload
    let e: ValuesEditor
    if (p && values && p.templateVersion !== version) {
      // the page was filled for an older release: carry its values over to the latest
      e = new ValuesEditor({ screen: k, values, template: TemplateDocument.decode(await studio.releasedTemplate(k, p.templateVersion)) })
      const dropped = e.setTemplate(latest)
      notice.value = `Konten dipindahkan dari template v${p.templateVersion} ke v${version}${dropped.length ? `; dibuang (tidak ada lagi di template): ${dropped.join(', ')}` : ''}. Simpan atau terbitkan untuk memakainya.`
    } else {
      e = new ValuesEditor({ screen: k, values, template: latest })
    }
    if (k !== key.value || t !== tab.value) return
    page.value = p
    editor.value = e
  } catch (e) {
    error.value = (e as Error).message
  }
}, { immediate: true })
async function savePage(payload: unknown) {
  page.value = await studio.saveScreen(key.value!, payload, page.value?.lockVersion)
  await reload()
}
async function publishPage(payload: unknown) {
  const saved = await studio.saveScreen(key.value!, payload, page.value?.lockVersion)
  const published = saved.unpublished || !saved.activeSequence ? await studio.publishScreen(key.value!) : saved
  page.value = published
  await reload()
  notice.value = `Halaman ${key.value} v${published.activeSequence} terbit.`
}
const upload = (source: Parameters<typeof studio.uploadAsset>[0]) => studio.uploadAsset(source)
</script>

<template>
  <div class="d-grid gap-3 p-3" style="grid-template-columns: auto 1fr">
    <StudioSidebar>
      <section class="card card-body p-3 small">
        <h3 class="h6">Template <span class="fw-normal text-secondary">· {{ merchantId }}</span></h3>
        <p v-if="rows.length === 0" class="text-secondary">Belum ada template. Buat yang pertama di bawah.</p>
        <div class="list-group list-group-flush">
          <button v-for="t in rows" :key="t.key" class="list-group-item list-group-item-action" :class="{ active: t.key === key }" @click="router.push(`/studio/templates/${t.key}${tab === 'content' ? '/content' : ''}`)">
            <div class="font-monospace text-truncate" :title="t.key">{{ t.key }}</div>
            <small class="d-block text-truncate">{{ t.title ?? '—' }} · {{ t.activeVersion ? `v${t.activeVersion}` : 'belum terbit' }}{{ t.unpublished && t.activeVersion ? ' · ada perubahan' : '' }}</small>
            <small class="d-block text-truncate opacity-75">halaman: {{ pageOf(t.key) ? (pageOf(t.key)!.activeSequence ? `v${pageOf(t.key)!.activeSequence}${pageOf(t.key)!.unpublished ? ' · ada perubahan' : ''}` : 'draf') : 'belum diisi' }}</small>
            <span v-if="t.deprecated" class="badge rounded-pill text-bg-warning" :title="t.deprecationReason ?? undefined">deprecated{{ t.replacedBy ? ` → ${t.replacedBy}` : '' }}</span>
          </button>
        </div>
        <form class="input-group input-group-sm mt-3" @submit.prevent="create">
          <input v-model="newKey" class="form-control font-monospace" placeholder="templateKeyBaru" />
          <button class="btn btn-primary">Buat</button>
        </form>
      </section>
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card d-flex flex-column">
      <p v-if="!key" class="p-4 text-secondary">Pilih template, atau buat yang baru. Setelah template terbit, isi kontennya di tab “Isi konten”.</p>
      <ul v-if="key" class="nav nav-tabs px-3 pt-2 bg-light align-items-end small" aria-label="Mode">
        <li class="nav-item"><RouterLink :to="`/studio/templates/${key}`" class="nav-link" :class="{ active: tab === 'design' }" :aria-current="tab === 'design' ? 'page' : undefined">Desain</RouterLink></li>
        <li class="nav-item"><RouterLink :to="`/studio/templates/${key}/content`" class="nav-link" :class="{ active: tab === 'content' }" :aria-current="tab === 'content' ? 'page' : undefined">Isi konten</RouterLink></li>
        <li v-if="notice" class="ms-3 mb-1 text-success text-truncate" role="status">{{ notice }}</li>
        <li v-if="pageOf(key)?.activeSequence" class="ms-auto mb-1"><a :href="screenPath(merchantId, key)" target="_blank" rel="noreferrer">Lihat halaman ↗</a></li>
      </ul>
      <SduiTemplateBuilder
        v-if="key && tab === 'design' && document"
        :key="key"
        :document="document"
        :title="detail?.activeVersion ? `aktif v${detail.activeVersion}` : 'baru'"
        :catalog="catalog"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="assetURL"
        :baseline="detail?.active?.payload"
        :on-save="saveTemplate"
        :on-publish="publishTemplate"
        :deprecation="deprecation"
        :on-deprecate="detail?.activeVersion ? deprecate : undefined"
        :on-restore="restore"
      />
      <p v-if="key && tab === 'content' && detail !== undefined && !detail?.activeVersion" class="p-4 text-secondary">
        Template <code>{{ key }}</code> belum terbit. Terbitkan dulu di tab “Desain”, lalu isi kontennya di sini.
      </p>
      <SduiScreenBuilder
        v-if="key && tab === 'content' && editor"
        :key="`${key}@${detail?.activeVersion}`"
        :editor="editor"
        :show-templates="false"
        :title="`${merchantId} / ${key}`"
        :catalog="CATALOG"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="previewURL"
        :upload-asset="upload"
        :baseline="page?.active?.payload"
        :on-save="savePage"
        :on-publish="publishPage"
      />
    </main>
  </div>
</template>
