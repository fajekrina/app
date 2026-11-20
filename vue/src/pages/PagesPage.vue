<script setup lang="ts">
/**
 * The Studio's **Konten** tab: every page (they belong to no user; a user is only recorded as
 * who made and published what). A page is made from a released template (Buat halaman: pick one,
 * give the page a key) and edited in the same editor with its structure locked: no palette,
 * nothing added, removed or moved — but every text, picture, style, layout, data source and
 * button target can change (spec 2.6; what differs from the template is marked and can be taken
 * back). Terbitkan publishes the page at once (no review step); it renders at `/s/<page>`.
 *
 * New pages live in the Studio's one space (`PAGE_SPACE`); pages made before it keep their old
 * space (shown as "lama · <space>") and their old address.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/vue'
import { PAGE_SPACE, StudioError, studio, type CatalogEntry, type PageRow, type ScreenDetail } from '../api/studio'
import { CATALOG, SAMPLE_DATA, screenPath, studioAssetURL } from '../sdui/config'
import { createPage, pageBaseline, pageSource, publishPage, rebasePage, sampleTexts, savePage } from '../sdui/page'
import StudioSidebar from '../components/StudioSidebar.vue'

const ID = /^[A-Za-z][A-Za-z0-9_]*$/
const route = useRoute()
const router = useRouter()
// `/studio/pages/:key` (a page) or `/studio/pages/:space/:key` (an older page)
const space = computed(() => (route.params.space ? String(route.params.space) : PAGE_SPACE))
const key = computed(() => (route.params.key ? String(route.params.key) : undefined))
const pathOf = (s: string, k: string) => (s === PAGE_SPACE ? `/studio/pages/${k}` : `/studio/pages/${s}/${k}`)
const rows = ref<PageRow[]>([])
const templates = ref<CatalogEntry[]>([])
// the templates of an older page's space (its own templates)
const spaceTemplates = ref<CatalogEntry[]>([])
// the open page (undefined: loading; null: none) and the template release it is made from
const page = ref<ScreenDetail | null>()
const template = shallowRef<unknown>()
const document = shallowRef<EditorDocument>()
const dropped = ref<string[]>([])
const error = ref<string>()
const notice = ref<string>()
const creating = ref<{ template?: string; key: string }>({ key: '' })
const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }

async function reload() {
  const [p, c] = await Promise.all([studio.pages(), studio.catalog(PAGE_SPACE)])
  rows.value = p
  templates.value = c
}
reload().catch((e: Error) => { error.value = e.message })
watch(space, (s) => {
  if (s === PAGE_SPACE) { spaceTemplates.value = []; return }
  studio.catalog(s).then((c) => { spaceTemplates.value = c }).catch(() => { spaceTemplates.value = [] })
}, { immediate: true })

/** open the page's tree: the template release with the page written in, its key the page's */
function openDocument(p: ScreenDetail, release: unknown) {
  const { source, dropped: lost } = pageSource(release, p)
  ;(source.template as { key: string }).key = key.value!
  const doc = new EditorDocument({ mode: 'template', key: key.value!, locked: true })
  doc.importJSON(source)
  dropped.value = lost
  template.value = release
  page.value = p
  document.value = doc
}

watch([space, key], async ([s, k]) => {
  page.value = undefined
  template.value = undefined
  document.value = undefined
  error.value = undefined
  notice.value = undefined
  if (!k) return
  try {
    const p = await studio.screen(s, k).catch(notFound)
    if (k !== key.value) return
    if (!p) { page.value = null; return }
    const release = await studio.releasedTemplate(s, p.templateKey, p.templateVersion)
    if (k === key.value) openDocument(p, release)
  } catch (e) {
    if (k === key.value) error.value = (e as Error).message
  }
}, { immediate: true })

const entryOf = (k: string, s = space.value) => (s === PAGE_SPACE ? templates.value : [...spaceTemplates.value, ...templates.value]).find((t) => t.key === k)
const newer = computed(() => {
  const p = page.value
  const t = p ? entryOf(p.templateKey) : undefined
  return p && t && t.version > p.templateVersion ? t.version : undefined
})
const baseline = computed(() => (template.value && page.value ? pageBaseline(template.value, page.value) : undefined))
// a navigate goes to another page of the same space
const catalog = computed(() => ({ ...CATALOG, screens: rows.value.filter((r) => r.kanal === space.value).map((r) => r.key).sort() }))
const previewURL = computed(() => studioAssetURL(space.value))
const status = computed(() => notice.value ?? (dropped.value.length ? `Dibuang saat terbit (tidak ada lagi di template): ${dropped.value.join(', ')}.` : undefined))

async function save(payload: unknown) {
  page.value = await savePage(space.value, key.value!, payload, template.value, page.value ?? null)
  await reload()
}
async function publish(payload: unknown) {
  const samples = sampleTexts(payload)
  const res = await publishPage(space.value, key.value!, payload, template.value, page.value ?? null, (p) => { page.value = p })
  page.value = res.page
  notice.value = res.unchanged
    ? `Tidak ada perubahan: halaman ${key.value} sudah tayang.`
    : `Halaman ${key.value} terbit (v${res.page.activeSequence}).${samples.length ? ` Masih ada ${samples.length} teks contoh dari template: ${samples.join(', ')}.` : ''}`
  await reload()
}
async function update() {
  const p = page.value
  const version = newer.value
  if (!p || !version) return
  try {
    const release = await studio.releasedTemplate(space.value, p.templateKey, version)
    const res = await rebasePage(space.value, key.value!, p, release)
    openDocument(res.page, release)
    notice.value = `Diperbarui ke template v${version} (belum terbit).${res.dropped.length ? ` Dibuang: ${res.dropped.join(', ')}.` : ''}`
    await reload()
  } catch (e) { error.value = (e as Error).message }
}
async function create() {
  const t = creating.value.template ? templates.value.find((x) => x.key === creating.value.template) : undefined
  const k = creating.value.key
  if (!t || !ID.test(k)) { error.value = 'Pilih template dan isi kunci halaman (huruf, angka dan _)'; return }
  if (rows.value.some((r) => r.kanal === PAGE_SPACE && r.key.toLowerCase() === k.toLowerCase())) { error.value = `Halaman ${k} sudah ada`; return }
  try {
    await createPage(PAGE_SPACE, k, t.key, t.version)
    creating.value = { key: '' }
    await reload()
    await router.push(pathOf(PAGE_SPACE, k))
  } catch (e) { error.value = (e as Error).message }
}
const upload = (source: Parameters<typeof studio.uploadAsset>[1]) => studio.uploadAsset(space.value, source)
</script>

<template>
  <div class="d-grid gap-3 p-3" style="grid-template-columns: auto 1fr">
    <StudioSidebar>
      <section class="card card-body p-3 small">
        <h3 class="h6">Halaman</h3>
        <p v-if="rows.length === 0" class="text-secondary">Belum ada halaman. Buat yang pertama di bawah.</p>
        <div class="list-group list-group-flush">
          <button v-for="r in rows" :key="`${r.kanal}/${r.key}`" class="list-group-item list-group-item-action" :class="{ active: r.key === key && r.kanal === space }" @click="router.push(pathOf(r.kanal, r.key))">
            <div class="font-monospace text-truncate" :title="r.key">{{ r.key }}</div>
            <small class="d-block text-truncate">{{ entryOf(r.templateKey, r.kanal)?.title ?? r.templateKey }} v{{ r.templateVersion }} · {{ r.activeSequence ? 'tayang' : 'belum terbit' }}{{ r.unpublished && r.activeSequence ? ' · ada perubahan' : '' }}{{ r.kanal === PAGE_SPACE ? '' : ` · lama (${r.kanal})` }}</small>
            <span v-if="(entryOf(r.templateKey, r.kanal)?.version ?? 0) > r.templateVersion" class="badge rounded-pill text-bg-info">template v{{ entryOf(r.templateKey, r.kanal)?.version }} tersedia</span>
          </button>
        </div>
      </section>
      <form class="card card-body p-3 small" @submit.prevent="create">
        <h3 class="h6">Buat halaman</h3>
        <div role="radiogroup" aria-label="Template">
          <div v-for="t in templates.filter((x) => !x.deprecated)" :key="t.key" class="form-check border rounded px-2 py-1 mb-1" :class="{ 'border-primary bg-primary-subtle': creating.template === t.key }">
            <input :id="`tpl-${t.key}`" v-model="creating.template" class="form-check-input ms-0 me-2" type="radio" name="template" :value="t.key" />
            <label class="form-check-label" :for="`tpl-${t.key}`">{{ t.title ?? t.key }} <small class="d-block text-secondary"><span class="font-monospace">{{ t.key }}</span> v{{ t.version }}</small></label>
          </div>
        </div>
        <input v-model="creating.key" class="form-control form-control-sm font-monospace my-2" placeholder="kunciHalaman, mis. insightKopi" aria-label="Kunci halaman baru" />
        <button class="btn btn-sm btn-primary w-100">Buat halaman</button>
      </form>
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card d-flex flex-column">
      <p v-if="!key" class="p-4 text-secondary">Pilih halaman, atau buat yang baru dari template. Komponennya mengikuti template; isi, tampilan, sumber data dan tujuan tombolnya diatur di sini.</p>
      <p v-else-if="page === null" class="p-4 text-secondary">Halaman {{ key }} belum ada. Buat dari panel kiri.</p>
      <div v-if="key && page" class="d-flex flex-shrink-0 flex-wrap align-items-center gap-3 border-bottom bg-light px-3 py-1 small" style="min-height: 2.5rem">
        <span class="font-monospace text-secondary">{{ key }}{{ space === PAGE_SPACE ? '' : ` · lama (${space})` }}</span>
        <span class="text-secondary">template {{ page.templateKey }} v{{ page.templateVersion }}</span>
        <button v-if="newer" class="btn btn-sm btn-info py-0" @click="update">Perbarui ke template v{{ newer }}</button>
        <span v-if="status" class="text-truncate" :class="notice ? 'text-success' : 'text-warning-emphasis'" role="status">{{ status }}</span>
        <a v-if="page.activeSequence" :href="screenPath(space, key)" target="_blank" rel="noreferrer" class="ms-auto">Lihat halaman ↗</a>
      </div>
      <SduiTemplateBuilder
        v-if="key && document"
        :key="`${space}/${key}/${page?.templateVersion}`"
        :document="document"
        :title="page?.activeSequence ? `tayang v${page.activeSequence}` : 'belum terbit'"
        :catalog="catalog"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="previewURL"
        :upload-asset="upload"
        :baseline="baseline"
        :page-template="template as object"
        :on-save="save"
        :on-publish="publish"
      />
    </main>
  </div>
</template>
