<script setup lang="ts">
/**
 * The Studio's **Template** tab: the shared templates. A template decides which components a
 * page has, with their defaults (sample texts in [brackets]). Every Studio user sees and edits
 * the same templates; Terbitkan releases one at once (no review step), then offers to update
 * the pages made from it (each with what it would lose) — see ../sdui/page.ts.
 */
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/vue'
import { PAGE_SPACE, SHARED_KANAL, StudioError, deprecationOf, studio, type PageRow, type TemplateDetail, type TemplateRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, studioAssetURL } from '../sdui/config'
import { pagesToUpdate, publishTemplateDraft, saveTemplateDraft, templateSource, updatePages, type PageUpdate, type PageUpdateResult } from '../sdui/page'
import StudioSidebar from '../components/StudioSidebar.vue'

const route = useRoute()
const router = useRouter()
const key = computed(() => (route.params.key ? String(route.params.key) : undefined))
const rows = ref<TemplateRow[]>([])
const pages = ref<PageRow[]>([])
// undefined: loading; null: not created yet
const detail = ref<TemplateDetail | null>()
const document = shallowRef<EditorDocument>()
const newKey = ref('')
const error = ref<string>()
const notice = ref<string>()
// K5: after a release, the pages behind it (checked = update)
const offer = ref<{ version: number; pages: PageUpdate[]; chosen: Set<string> }>()
const results = ref<PageUpdateResult[]>()
const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }
const previewURL = studioAssetURL(SHARED_KANAL)

async function reload() {
  const [t, p] = await Promise.all([studio.templates(), studio.pages()])
  rows.value = t
  pages.value = p
}
reload().catch((e: Error) => { error.value = e.message })
const usedBy = (k: string) => pages.value.filter((p) => p.templateKey === k)
// a navigate goes to another page: offer every page key; its replacement, when
// deprecated, is another template
const catalog = computed(() => ({
  ...CATALOG,
  screens: [...new Set(pages.value.map((p) => p.key))].sort(),
  templates: rows.value.filter((t) => t.activeVersion).map((t) => t.key),
  deprecated: rows.value.filter((t) => t.deprecated).map((t) => t.key)
}))

watch(key, async (k) => {
  detail.value = undefined
  document.value = undefined
  error.value = undefined
  notice.value = undefined
  offer.value = undefined
  results.value = undefined
  if (!k) return
  try {
    const d = await studio.template(k).catch(notFound)
    // every released version: their component ids are never generated again
    const released = d ? await studio.releasedTemplates(k, d.releases.map((x) => x.version)) : []
    if (k !== key.value) return
    const doc = new EditorDocument({ mode: 'template', key: k })
    for (const t of released) doc.reserveIds(t as object)
    const source = templateSource(d)
    if (source) doc.importJSON(source)
    detail.value = d
    document.value = doc
  } catch (e) {
    if (k === key.value) error.value = (e as Error).message
  }
}, { immediate: true })

async function save(payload: unknown) {
  detail.value = await saveTemplateDraft(key.value!, payload, detail.value ?? null)
  await reload()
}
async function publish(payload: unknown) {
  const { template, unchanged } = await publishTemplateDraft(key.value!, payload, detail.value ?? null, (t) => { detail.value = t })
  detail.value = template
  await reload()
  if (unchanged) { notice.value = `Tidak ada perubahan: template ${key.value} v${template.activeVersion} sudah aktif.`; return }
  notice.value = `Template ${key.value} v${template.activeVersion} terbit.`
  const behind = await pagesToUpdate(key.value!, template.activeVersion!, template.active!.payload)
  if (behind.length) offer.value = { version: template.activeVersion!, pages: behind, chosen: new Set(behind.map((p) => `${p.kanal}/${p.key}`)) }
}
async function applyOffer() {
  if (!offer.value) return
  const o = offer.value
  results.value = await updatePages(o.pages.filter((p) => o.chosen.has(`${p.kanal}/${p.key}`)), o.version)
  offer.value = undefined
  await reload()
}
function toggle(id: string) {
  if (!offer.value) return
  const chosen = new Set(offer.value.chosen)
  if (chosen.has(id)) chosen.delete(id); else chosen.add(id)
  offer.value = { ...offer.value, chosen }
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
const upload = (source: Parameters<typeof studio.uploadAsset>[1]) => studio.uploadAsset(SHARED_KANAL, source)
</script>

<template>
  <div class="d-grid gap-3 p-3" style="grid-template-columns: auto 1fr">
    <StudioSidebar>
      <section class="card card-body p-3 small">
        <h3 class="h6">Template <span class="fw-normal text-secondary">· dipakai bersama</span></h3>
        <p v-if="rows.length === 0" class="text-secondary">Belum ada template. Buat yang pertama di bawah.</p>
        <div class="list-group list-group-flush">
          <button v-for="t in rows" :key="t.key" class="list-group-item list-group-item-action" :class="{ active: t.key === key }" @click="router.push(`/studio/templates/${t.key}`)">
            <div class="text-truncate" :title="t.key">{{ t.title ?? t.key }}</div>
            <small class="d-block text-truncate"><span class="font-monospace">{{ t.key }}</span> · {{ t.activeVersion ? `v${t.activeVersion}` : 'belum terbit' }}{{ t.unpublished && t.activeVersion ? ' · ada perubahan' : '' }} · {{ usedBy(t.key).length }} halaman</small>
            <span v-if="t.deprecated" class="badge rounded-pill text-bg-warning" :title="t.deprecationReason ?? undefined">deprecated{{ t.replacedBy ? ` → ${t.replacedBy}` : '' }}</span>
          </button>
        </div>
        <form class="input-group input-group-sm mt-3" @submit.prevent="create">
          <input v-model="newKey" class="form-control font-monospace" placeholder="templateBaru" aria-label="Kunci template baru" />
          <button class="btn btn-primary">Buat</button>
        </form>
      </section>
      <p v-if="error" class="text-danger small">{{ error }}</p>
    </StudioSidebar>
    <main class="builder-pane overflow-hidden card d-flex flex-column">
      <p v-if="!key" class="p-4 text-secondary">Pilih template, atau buat yang baru. Template menentukan komponen apa saja yang ada di halaman; isi dan tampilannya diatur per halaman di tab Konten.</p>
      <div v-if="key" class="d-flex flex-shrink-0 flex-wrap align-items-center gap-3 border-bottom bg-light px-3 py-1 small" style="min-height: 2.5rem">
        <span class="font-monospace text-secondary">template / {{ key }}</span>
        <span v-if="notice" class="text-truncate text-success" role="status">{{ notice }}</span>
        <span class="ms-auto text-secondary">{{ usedBy(key).length }} halaman memakai template ini</span>
      </div>
      <div v-if="offer" class="flex-shrink-0 border-bottom bg-warning-subtle p-3 small" role="dialog" aria-label="Perbarui halaman">
        <strong>Perbarui juga {{ offer.pages.length }} halaman yang memakai template ini ke v{{ offer.version }}?</strong>
        <p class="text-secondary mb-2">Halaman yang dipilih langsung diterbitkan dengan versi baru. Yang tidak dipilih tetap di versi lamanya dan bisa diperbarui nanti di tab Konten.</p>
        <div v-for="p in offer.pages" :key="`${p.kanal}/${p.key}`" class="form-check">
          <input :id="`upd-${p.kanal}-${p.key}`" class="form-check-input" type="checkbox" :checked="offer.chosen.has(`${p.kanal}/${p.key}`)" @change="toggle(`${p.kanal}/${p.key}`)" />
          <label class="form-check-label" :for="`upd-${p.kanal}-${p.key}`">
            <span class="font-monospace">{{ p.kanal === PAGE_SPACE ? p.key : `${p.key} · lama (${p.kanal})` }}</span> <span class="text-secondary">(v{{ p.templateVersion }})</span>
            <span v-if="p.dropped.length" class="d-block text-warning-emphasis">Akan hilang: {{ p.dropped.join(', ') }}</span>
          </label>
        </div>
        <div class="d-flex gap-2 mt-2">
          <button class="btn btn-sm btn-primary" @click="applyOffer">Perbarui &amp; terbitkan yang dipilih</button>
          <button class="btn btn-sm btn-outline-secondary" @click="offer = undefined">Nanti saja</button>
        </div>
      </div>
      <div v-if="results" class="flex-shrink-0 border-bottom p-3 small" role="status">
        <div v-for="r in results" :key="`${r.kanal}/${r.key}`" :class="r.ok ? 'text-success' : 'text-danger'">
          {{ r.kanal === PAGE_SPACE ? r.key : `${r.key} · lama (${r.kanal})` }}: {{ r.ok ? `terbit${r.dropped.length ? ` (dibuang: ${r.dropped.join(', ')})` : ''}` : `gagal — ${r.error}` }}
        </div>
      </div>
      <SduiTemplateBuilder
        v-if="key && document"
        :key="key"
        :document="document"
        :title="detail?.activeVersion ? `aktif v${detail.activeVersion}` : 'belum terbit'"
        :catalog="catalog"
        :sample-data="SAMPLE_DATA"
        :asset-u-r-l="previewURL"
        :upload-asset="upload"
        :baseline="detail?.active?.payload"
        :on-save="save"
        :on-publish="publish"
        :deprecation="deprecation"
        :on-deprecate="detail?.activeVersion ? deprecate : undefined"
        :on-restore="restore"
      />
    </main>
  </div>
</template>
