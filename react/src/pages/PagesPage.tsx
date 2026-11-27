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
 *
 * Bahasa (spec 2.8): the page is edited one language at a time; in another language than the
 * default only what differs from the default texts is stored. The app shows each page in the
 * customer's language, else in the default.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/react'
import { TemplateDocument } from '@fajekrina/sdui-r'
import { PAGE_SPACE, StudioError, studio, studioCatalog, type CatalogEntry, type PageRow, type ScreenDetail, type StudioNames } from '../api/studio'
import { ASSETS, LANGUAGES, SAMPLE_DATA, screenPath, studioAssetURL } from '../sdui/config'
import { createPage, documentLanguages, pageBaseline, pageSource, publishPage, rebasePage, sampleTexts, savePage } from '../sdui/page'
import { Sidebar } from '../components/Sidebar'

const ID = /^[A-Za-z][A-Za-z0-9_]*$/
const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }
const pathOf = (space: string, key: string) => (space === PAGE_SPACE ? `/studio/pages/${key}` : `/studio/pages/${space}/${key}`)

export default function PagesPage() {
  const params = useParams()
  // `/studio/pages/:key` (a page) or `/studio/pages/:space/:key` (an older page)
  const space = params.space ?? PAGE_SPACE
  const key = params.key
  const navigate = useNavigate()
  const [rows, setRows] = useState<PageRow[]>([])
  const [templates, setTemplates] = useState<CatalogEntry[]>([])
  // the templates of an older page's space (its own templates)
  const [spaceTemplates, setSpaceTemplates] = useState<CatalogEntry[]>([])
  // the open page and the template release it is made from (undefined: loading)
  const [page, setPage] = useState<ScreenDetail | null>()
  const [template, setTemplate] = useState<unknown>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [creating, setCreating] = useState<{ template?: string; key: string }>({ key: '' })
  // the language being edited ('' = the page's default)
  const [language, setLanguage] = useState('')
  // the names the builder offers: the catalog (database), never typed freely
  const [names, setNames] = useState<StudioNames>()
  useEffect(() => { void studio.names().then(setNames).catch((e: Error) => setError(e.message)) }, [])

  const reload = useCallback(async () => {
    const [p, c] = await Promise.all([studio.pages(), studio.catalog(PAGE_SPACE)])
    setRows(p)
    setTemplates(c)
  }, [])
  useEffect(() => { void reload().catch((e: Error) => setError(e.message)) }, [reload])
  useEffect(() => {
    if (space === PAGE_SPACE) { setSpaceTemplates([]); return }
    void studio.catalog(space).then(setSpaceTemplates).catch(() => setSpaceTemplates([]))
  }, [space])

  useEffect(() => {
    setPage(undefined)
    setTemplate(undefined)
    setError(undefined)
    setNotice(undefined)
    setLanguage('')
    if (!key) return
    let live = true
    void (async () => {
      const p = await studio.screen(space, key).catch(notFound)
      if (!live) return
      if (!p) { setPage(null); return }
      const release = await studio.releasedTemplate(space, p.templateKey, p.templateVersion)
      if (live) { setTemplate(release); setPage(p) }
    })().catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [space, key])

  // one locked document per opened page; its key is the page's
  const opened = useMemo(() => {
    if (!key || !page || !template) return undefined
    const { source, dropped } = pageSource(template, page, language)
    ;(source.template as { key: string }).key = key
    const doc = new EditorDocument({ mode: 'template', key, locked: true })
    doc.importJSON(source)
    return { doc, dropped }
  }, [key, page?.templateVersion, template, language])   // eslint-disable-line react-hooks/exhaustive-deps
  const baseline = useMemo(() => (template && page ? pageBaseline(template, page, language) : undefined), [template, page?.active, language])   // eslint-disable-line react-hooks/exhaustive-deps
  // the page's default language and the ones it (or its template) has texts for
  const languages = useMemo(() => {
    const own = documentLanguages(page?.draft ?? page?.active?.payload)
    const fromTemplate = documentLanguages(template)
    const all = new Set([...LANGUAGES.map((l) => l.code), ...own.others, ...fromTemplate.others])
    all.delete(own.default)
    return { default: own.default, others: [...all] }
  }, [page?.draft, page?.active, template])
  const labelOf = (code: string) => LANGUAGES.find((l) => l.code === code)?.label ?? code
  const pageTemplate = useMemo(() => (template && language ? TemplateDocument.decode(template).inLanguage(language).toJSON() : template), [template, language])

  const entryOf = (k: string, s = space) => (s === PAGE_SPACE ? templates : [...spaceTemplates, ...templates]).find((t) => t.key === k)
  const newer = page && entryOf(page.templateKey) && entryOf(page.templateKey)!.version > page.templateVersion ? entryOf(page.templateKey)!.version : undefined
  // requests, sources, links and the pages a navigate may open: the catalog
  const catalog = useMemo(() => studioCatalog(names, Object.keys(ASSETS)), [names])
  const previewURL = useMemo(() => studioAssetURL(space), [space])

  const save = async (payload: unknown) => {
    setPage(await savePage(space, key!, payload, template, page ?? null, language))
    await reload()
  }
  const publish = async (payload: unknown) => {
    const samples = sampleTexts(payload)
    const res = await publishPage(space, key!, payload, template, page ?? null, setPage, language)
    setPage(res.page)
    setNotice(res.unchanged
      ? `Tidak ada perubahan: halaman ${key} sudah tayang.`
      : `Halaman ${key} terbit (v${res.page.activeSequence}).${samples.length ? ` Masih ada ${samples.length} teks contoh dari template: ${samples.join(', ')}.` : ''}`)
    await reload()
  }
  const update = async () => {
    if (!page || !newer) return
    const release = await studio.releasedTemplate(space, page.templateKey, newer)
    const res = await rebasePage(space, key!, page, release)
    setTemplate(release)
    setPage(res.page)
    setNotice(`Diperbarui ke template v${newer} (belum terbit).${res.dropped.length ? ` Dibuang: ${res.dropped.join(', ')}.` : ''}`)
    await reload()
  }
  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = creating.template ? templates.find((x) => x.key === creating.template) : undefined
    if (!t || !ID.test(creating.key)) { setError('Pilih template dan isi kunci halaman (huruf, angka dan _)'); return }
    if (rows.some((r) => r.kanal === PAGE_SPACE && r.key.toLowerCase() === creating.key.toLowerCase())) { setError(`Halaman ${creating.key} sudah ada`); return }
    try {
      await createPage(PAGE_SPACE, creating.key, t.key, t.version)
      setCreating({ key: '' })
      await reload()
      navigate(pathOf(PAGE_SPACE, creating.key))
    } catch (err) { setError((err as Error).message) }
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <Sidebar>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h3 className="mb-2 font-semibold">Halaman</h3>
          {rows.length === 0 && <p className="mb-2 text-xs text-slate-500">Belum ada halaman. Buat yang pertama di bawah.</p>}
          <ul className="space-y-1">
            {rows.map((r) => {
              const t = entryOf(r.templateKey, r.kanal)
              const current = r.key === key && r.kanal === space
              return (
                <li key={`${r.kanal}/${r.key}`}>
                  <button className={`w-full rounded px-2 py-1 text-left ${current ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`} onClick={() => navigate(pathOf(r.kanal, r.key))}>
                    <div className="truncate font-mono" title={r.key}>{r.key}</div>
                    <div className="truncate text-xs text-slate-500">
                      {t?.title ?? r.templateKey} v{r.templateVersion} · {r.activeSequence ? 'tayang' : 'belum terbit'}{r.unpublished && r.activeSequence ? ' · ada perubahan' : ''}{r.kanal === PAGE_SPACE ? '' : ` · lama (${r.kanal})`}
                    </div>
                    {t && t.version > r.templateVersion && <span className="mt-0.5 inline-block rounded-full bg-sky-100 px-2 text-[10px] text-sky-800">template v{t.version} tersedia</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
        <form className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm" onSubmit={(e) => void create(e)}>
          <h3 className="font-semibold">Buat halaman</h3>
          <div className="space-y-1" role="radiogroup" aria-label="Template">
            {templates.filter((t) => !t.deprecated).map((t) => (
              <label key={t.key} className={`flex cursor-pointer items-start gap-2 rounded border px-2 py-1 ${creating.template === t.key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                <input type="radio" name="template" className="mt-1" checked={creating.template === t.key} onChange={() => setCreating({ ...creating, template: t.key })} />
                <span><span className="block">{t.title ?? t.key}</span><span className="text-xs text-slate-500"><span className="font-mono">{t.key}</span> v{t.version}</span></span>
              </label>
            ))}
          </div>
          <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono" placeholder="kunciHalaman, mis. insightKopi" aria-label="Kunci halaman baru" value={creating.key} onChange={(e) => setCreating({ ...creating, key: e.target.value })} />
          <button className="w-full rounded bg-indigo-600 py-1 text-white">Buat halaman</button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Sidebar>
      <main className="builder-pane flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!key && <p className="p-6 text-slate-400">Pilih halaman, atau buat yang baru dari template. Komponennya mengikuti template; isi, tampilan, sumber data dan tujuan tombolnya diatur di sini.</p>}
        {key && page === null && <p className="p-6 text-slate-400">Halaman {key} belum ada. Buat dari panel kiri.</p>}
        {key && page && (
          <div className="flex min-h-10 flex-none flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <span className="font-mono text-slate-600">{key}{space === PAGE_SPACE ? '' : ` · lama (${space})`}</span>
            <span className="text-slate-500">template {page.templateKey} v{page.templateVersion}</span>
            <label className="flex items-center gap-1 text-slate-600">
              Bahasa
              <select className="rounded border border-slate-300 bg-white px-1 py-0.5" aria-label="Bahasa yang diedit" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="">{labelOf(languages.default)} (utama)</option>
                {languages.others.map((code) => <option key={code} value={code}>{labelOf(code)}</option>)}
              </select>
            </label>
            {language && <span className="text-amber-700">Hanya teks yang berbeda dari {labelOf(languages.default)} yang disimpan untuk {labelOf(language)}.</span>}
            {newer && <button className="rounded bg-sky-600 px-2 py-0.5 text-white" onClick={() => void update().catch((e: Error) => setError(e.message))}>Perbarui ke template v{newer}</button>}
            {(notice ?? (opened?.dropped.length ? 'x' : undefined)) &&
              <span className={`truncate ${notice ? 'text-emerald-700' : 'text-amber-700'}`} role="status">{notice ?? `Dibuang saat terbit (tidak ada lagi di template): ${opened!.dropped.join(', ')}.`}</span>}
            {page.activeSequence && <a href={screenPath(space, key)} target="_blank" rel="noreferrer" className="ml-auto text-indigo-600">Lihat halaman ↗</a>}
          </div>
        )}
        {key && opened && (
          <SduiTemplateBuilder
            key={`${space}/${key}/${page?.templateVersion}/${language}`}
            document={opened.doc}
            title={page?.activeSequence ? `tayang v${page.activeSequence}` : 'belum terbit'}
            catalog={catalog}
            sampleData={SAMPLE_DATA}
            assetURL={previewURL}
            uploadAsset={(source) => studio.uploadAsset(space, source)}
            baseline={baseline}
            pageTemplate={pageTemplate as object}
            onSave={save}
            onPublish={publish}
          />
        )}
      </main>
    </div>
  )
}
