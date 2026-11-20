<script setup lang="ts">
/**
 * The Studio's **Konten** tab: the pages of a kanal. A page is made from a released template
 * (Buat halaman: pick one, give the page a key) and edited in the same editor with its structure
 * locked: no palette, nothing added, removed or moved — but every text, picture, style, layout,
 * data source and button target can change (spec 2.6; what differs from the template is marked
 * and can be taken back). Terbitkan publishes the page at once (no review step).
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/vue'
import { StudioError, studio, type CatalogEntry, type Kanal, type ScreenDetail, type ScreenRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, screenPath, studioAssetURL } from '../sdui/config'
import { createPage, pageBaseline, pageSource, publishPage, rebasePage, sampleTexts, savePage } from '../sdui/page'
import StudioSidebar from '../components/StudioSidebar.vue'

const ID = /^[A-Za-z][A-Za-z0-9_]*$/
const route = useRoute()
const router = useRouter()
const kanal = computed(() => (route.params.kanal ? String(route.params.kanal) : undefined))
const key = computed(() => (route.params.key ? String(route.params.key) : undefined))
const kanals = ref<Kanal[]>([])
const rows = ref<ScreenRow[]>([])
const templates = ref<CatalogEntry[]>([])
// the open page (undefined: loading; null: none) and the template release it is made from
const page = ref<ScreenDetail | null>()
const template = shallowRef<unknown>()
const document = shallowRef<EditorDocument>()
const dropped = ref<string[]>([])
const error = ref<string>()
const notice = ref<string>()
const newKanal = ref('')
const creating = ref<{ template?: string; key: string }>({ key: '' })
const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }

studio.kanals().then((list) => {
  kanals.value = list
  // no kanal in the address: the first one
  if (!kanal.value && list.length) void router.replace(`/studio/pages/${list[0]!.merchantId}`)
}).catch((e: Error) => { error.value = e.message })

async function reload() {
  if (!kanal.value) return
  const [s, c] = await Promise.all([studio.screens(kanal.value), studio.catalog(kanal.value)])
  rows.value = s
  templates.value = c
}
watch(kanal, () => { reload().catch((e: Error) => { error.value = e.message }) }, { immediate: true })

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

watch([kanal, key], async ([kn, k]) => {
  page.value = undefined
  template.value = undefined
  document.value = undefined
  error.value = undefined
  notice.value = undefined
  if (!kn || !k) return
  try {
    const p = await studio.screen(kn, k).catch(notFound)
    if (k !== key.value) return
    if (!p) { page.value = null; return }
    const release = await studio.releasedTemplate(kn, p.templateKey, p.templateVersion)
    if (k === key.value) openDocument(p, release)
  } catch (e) {
    if (k === key.value) error.value = (e as Error).message
  }
}, { immediate: true })

const entryOf = (k: string) => templates.value.find((t) => t.key === k)
const newer = computed(() => {
  const p = page.value
  const t = p ? entryOf(p.templateKey) : undefined
  return p && t && t.version > p.templateVersion ? t.version : undefined
})
const baseline = computed(() => (template.value && page.value ? pageBaseline(template.value, page.value) : undefined))
// a navigate goes to a page of this kanal
const catalog = computed(() => ({ ...CATALOG, screens: rows.value.map((r) => r.key).sort() }))
const previewURL = computed(() => studioAssetURL(kanal.value ?? ''))
const status = computed(() => notice.value ?? (dropped.value.length ? `Dibuang saat terbit (tidak ada lagi di template): ${dropped.value.join(', ')}.` : undefined))

async function save(payload: unknown) {
  page.value = await savePage(kanal.value!, key.value!, payload, template.value, page.value ?? null)
  await reload()
}
async function publish(payload: unknown) {
  const samples = sampleTexts(payload)
  const res = await publishPage(kanal.value!, key.value!, payload, template.value, page.value ?? null, (p) => { page.value = p })
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
    const release = await studio.releasedTemplate(kanal.value!, p.templateKey, version)
    const res = await rebasePage(kanal.value!, key.value!, p, release)
    openDocument(res.page, release)
    notice.value = `Diperbarui ke template v${version} (belum terbit).${res.dropped.length ? ` Dibuang: ${res.dropped.join(', ')}.` : ''}`
    await reload()
  } catch (e) { error.value = (e as Error).message }
}
async function addKanal() {
  if (!ID.test(newKanal.value)) { error.value = 'ID kanal: huruf, angka dan _ (mis. wondr)'; return }
  try {
    await studio.createKanal(newKanal.value)
    kanals.value = await studio.kanals()
    await router.push(`/studio/pages/${newKanal.value}`)
    newKanal.value = ''
  } catch (e) { error.value = (e as Error).message }
}
async function create() {
  const t = creating.value.template ? entryOf(creating.value.template) : undefined
  const k = creating.value.key
  if (!t || !ID.test(k)) { error.value = 'Pilih template dan isi kunci halaman (huruf, angka dan _)'; return }
  try {
    await createPage(kanal.value!, k, t.key, t.version)
    creating.value = { key: '' }
    await reload()
    await router.push(`/studio/pages/${kanal.value}/${k}`)
  } catch (e) { error.value = (e as Error).message }
}
const upload = (source: Parameters<typeof studio.uploadAsset>[1]) => studio.uploadAsset(kanal.value!, source)
</script>

<template>
  <div class="d-grid gap-3 p-3" style="grid-template-columns: auto 1fr">
    <StudioSidebar>
      <section class="card card-body p-3 small">
        <label class="form-label fw-semibold">Kanal
          <select class="form-select form-select-sm fw-normal mt-1" :value="kanal ?? ''" @change="router.push(`/studio/pages/${($event.target as HTMLSelectElement).value}`)">
            <option v-for="k in kanals" :key="k.merchantId" :value="k.merchantId">{{ k.name === k.merchantId ? k.merchantId : `${k.name} (${k.merchantId})` }}</option>
          </select>
        </label>
        <form class="input-group input-group-sm" @submit.prevent="addKanal">
          <input v-model="newKanal" class="form-control font-monospace" placeholder="kanalBaru" aria-label="ID kanal baru" />
          <button class="btn btn-outline-secondary">+ Kanal</button>
        </form>
      </section>
      <section v-if="kanal" class="card card-body p-3 small">
        <h3 class="h6">Halaman</h3>
        <p v-if="rows.length === 0" class="text-secondary">Belum ada halaman di kanal ini.</p>
        <div class="list-group list-group-flush">
          <button v-for="r in rows" :key="r.key" class="list-group-item list-group-item-action" :class="{ active: r.key === key }" @click="router.push(`/studio/pages/${kanal}/${r.key}`)">
            <div class="font-monospace text-truncate" :title="r.key">{{ r.key }}</div>
            <small class="d-block text-truncate">{{ entryOf(r.templateKey)?.title ?? r.templateKey }} v{{ r.templateVersion }} · {{ r.activeSequence ? 'tayang' : 'belum terbit' }}{{ r.unpublished && r.activeSequence ? ' · ada perubahan' : '' }}</small>
            <span v-if="(entryOf(r.templateKey)?.version ?? 0) > r.templateVersion" class="badge rounded-pill text-bg-info">template v{{ entryOf(r.templateKey)?.version }} tersedia</span>
          </button>
        </div>
      </section>
      <form v-if="kanal" class="card card-body p-3 small" @submit.prevent="create">
        <h3 class="h6">Buat halaman</h3>
        <div role="radiogroup" aria-label="Template">
          <div v-for="t in templates.filter((x) => !x.deprecated)" :key="t.key" class="form-check border rounded px-2 py-1 mb-1" :class="{ 'border-primary bg-primary-subtle': creating.template === t.key }">
            <input :id="`tpl-${t.key}`" v-model="creating.template" class="form-check-input ms-0 me-2" type="radio" name="template" :value="t.key" />
            <label class="form-check-label" :for="`tpl-${t.key}`">{{ t.title ?? t.key }} <small class="d-block text-secondary"><span class="font-monospace">{{ t.key }}</span> v{{ t.version }}{{ t.shared ? '' : ' · milik kanal ini' }}</small></label>
          </div>
        </div>
        <input v-model="creating.key" class="form-control form-control-sm font-monospace my-2" placeholder="kunciHalaman, mis. insightKopi" aria-label="Kunci halaman baru" />
        <button class="btn btn-sm btn-primary w-100">Buat halaman</button>
      </form>
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card d-flex flex-column">
      <p v-if="!key" class="p-4 text-secondary">Pilih halaman, atau buat yang baru dari template. Komponennya mengikuti template; isi, tampilan, sumber data dan tujuan tombolnya diatur di sini.</p>
      <p v-else-if="page === null" class="p-4 text-secondary">Halaman {{ key }} belum ada di kanal {{ kanal }}. Buat dari panel kiri.</p>
      <div v-if="key && page" class="d-flex flex-shrink-0 flex-wrap align-items-center gap-3 border-bottom bg-light px-3 py-1 small" style="min-height: 2.5rem">
        <span class="font-monospace text-secondary">{{ kanal }} / {{ key }}</span>
        <span class="text-secondary">template {{ page.templateKey }} v{{ page.templateVersion }}</span>
        <button v-if="newer" class="btn btn-sm btn-info py-0" @click="update">Perbarui ke template v{{ newer }}</button>
        <span v-if="status" class="text-truncate" :class="notice ? 'text-success' : 'text-warning-emphasis'" role="status">{{ status }}</span>
        <a v-if="page.activeSequence" :href="screenPath(kanal!, key)" target="_blank" rel="noreferrer" class="ms-auto">Lihat halaman ↗</a>
      </div>
      <SduiTemplateBuilder
        v-if="key && document"
        :key="`${kanal}/${key}/${page?.templateVersion}`"
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
