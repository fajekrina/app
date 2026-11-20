/**
 * The Studio's **Konten** tab: the pages of a kanal. A page is made from a released template
 * (Buat halaman: pick one, give the page a key) and edited in the same editor with its structure
 * locked: no palette, nothing added, removed or moved — but every text, picture, style, layout,
 * data source and button target can change (spec 2.6; what differs from the template is marked
 * and can be taken back). Terbitkan publishes the page at once (no review step).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/react'
import { StudioError, studio, type CatalogEntry, type Kanal, type ScreenDetail, type ScreenRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, screenPath, studioAssetURL } from '../sdui/config'
import { createPage, pageBaseline, pageSource, publishPage, rebasePage, sampleTexts, savePage } from '../sdui/page'
import { Sidebar } from '../components/Sidebar'

const ID = /^[A-Za-z][A-Za-z0-9_]*$/
const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }

export default function PagesPage() {
  const { kanal, key } = useParams()
  const navigate = useNavigate()
  const [kanals, setKanals] = useState<Kanal[]>([])
  const [rows, setRows] = useState<ScreenRow[]>([])
  const [templates, setTemplates] = useState<CatalogEntry[]>([])
  // the open page and the template release it is made from (undefined: loading)
  const [page, setPage] = useState<ScreenDetail | null>()
  const [template, setTemplate] = useState<unknown>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [newKanal, setNewKanal] = useState('')
  const [creating, setCreating] = useState<{ template?: string; key: string }>({ key: '' })

  useEffect(() => { void studio.kanals().then(setKanals).catch((e: Error) => setError(e.message)) }, [])
  // no kanal in the address: the first one
  useEffect(() => { if (!kanal && kanals.length) navigate(`/studio/pages/${kanals[0]!.merchantId}`, { replace: true }) }, [kanal, kanals, navigate])

  const reload = useCallback(async () => {
    if (!kanal) return
    const [s, c] = await Promise.all([studio.screens(kanal), studio.catalog(kanal)])
    setRows(s)
    setTemplates(c)
  }, [kanal])
  useEffect(() => { void reload().catch((e: Error) => setError(e.message)) }, [reload])

  const open = useCallback(async (k: string, p: ScreenDetail) => {
    setTemplate(await studio.releasedTemplate(kanal!, p.templateKey, p.templateVersion))
    setPage(p)
    return k
  }, [kanal])
  useEffect(() => {
    setPage(undefined)
    setTemplate(undefined)
    setError(undefined)
    setNotice(undefined)
    if (!kanal || !key) return
    let live = true
    void (async () => {
      const p = await studio.screen(kanal, key).catch(notFound)
      if (!live) return
      if (!p) { setPage(null); return }
      await open(key, p)
    })().catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [kanal, key, open])

  // one locked document per opened page; its key is the page's
  const opened = useMemo(() => {
    if (!key || !page || !template) return undefined
    const { source, dropped } = pageSource(template, page)
    ;(source.template as { key: string }).key = key
    const doc = new EditorDocument({ mode: 'template', key, locked: true })
    doc.importJSON(source)
    return { doc, dropped }
  }, [key, page?.templateVersion, template])   // eslint-disable-line react-hooks/exhaustive-deps
  const baseline = useMemo(() => (template && page ? pageBaseline(template, page) : undefined), [template, page?.active])   // eslint-disable-line react-hooks/exhaustive-deps

  const entryOf = (k: string) => templates.find((t) => t.key === k)
  const newer = page && entryOf(page.templateKey) && entryOf(page.templateKey)!.version > page.templateVersion ? entryOf(page.templateKey)!.version : undefined
  // a navigate goes to a page of this kanal
  const catalog = useMemo(() => ({ ...CATALOG, screens: rows.map((r) => r.key).sort() }), [rows])
  const previewURL = useMemo(() => studioAssetURL(kanal ?? ''), [kanal])

  const save = async (payload: unknown) => {
    setPage(await savePage(kanal!, key!, payload, template, page ?? null))
    await reload()
  }
  const publish = async (payload: unknown) => {
    const samples = sampleTexts(payload)
    const res = await publishPage(kanal!, key!, payload, template, page ?? null, setPage)
    setPage(res.page)
    setNotice(res.unchanged
      ? `Tidak ada perubahan: halaman ${key} sudah tayang.`
      : `Halaman ${key} terbit (v${res.page.activeSequence}).${samples.length ? ` Masih ada ${samples.length} teks contoh dari template: ${samples.join(', ')}.` : ''}`)
    await reload()
  }
  const update = async () => {
    if (!page || !newer) return
    const release = await studio.releasedTemplate(kanal!, page.templateKey, newer)
    const res = await rebasePage(kanal!, key!, page, release)
    setTemplate(release)
    setPage(res.page)
    setNotice(`Diperbarui ke template v${newer} (belum terbit).${res.dropped.length ? ` Dibuang: ${res.dropped.join(', ')}.` : ''}`)
    await reload()
  }
  const addKanal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ID.test(newKanal)) { setError('ID kanal: huruf, angka dan _ (mis. wondr)'); return }
    try {
      await studio.createKanal(newKanal)
      setKanals(await studio.kanals())
      navigate(`/studio/pages/${newKanal}`)
      setNewKanal('')
    } catch (err) { setError((err as Error).message) }
  }
  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    const t = creating.template ? entryOf(creating.template) : undefined
    if (!t || !ID.test(creating.key)) { setError('Pilih template dan isi kunci halaman (huruf, angka dan _)'); return }
    try {
      await createPage(kanal!, creating.key, t.key, t.version)
      setCreating({ key: '' })
      await reload()
      navigate(`/studio/pages/${kanal}/${creating.key}`)
    } catch (err) { setError((err as Error).message) }
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <Sidebar>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <label className="mb-2 block font-semibold">Kanal
            <select className="mt-1 w-full rounded border border-slate-300 px-1 py-1 font-normal" value={kanal ?? ''} onChange={(e) => navigate(`/studio/pages/${e.target.value}`)}>
              {kanals.map((k) => <option key={k.merchantId} value={k.merchantId}>{k.name === k.merchantId ? k.merchantId : `${k.name} (${k.merchantId})`}</option>)}
            </select>
          </label>
          <form className="flex gap-1" onSubmit={(e) => void addKanal(e)}>
            <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs" placeholder="kanalBaru" aria-label="ID kanal baru" value={newKanal} onChange={(e) => setNewKanal(e.target.value)} />
            <button className="rounded border border-slate-300 px-2 text-xs">+ Kanal</button>
          </form>
        </section>
        {kanal && (
          <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
            <h3 className="mb-2 font-semibold">Halaman</h3>
            {rows.length === 0 && <p className="mb-2 text-xs text-slate-500">Belum ada halaman di kanal ini.</p>}
            <ul className="space-y-1">
              {rows.map((r) => {
                const t = entryOf(r.templateKey)
                return (
                  <li key={r.key}>
                    <button className={`w-full rounded px-2 py-1 text-left ${r.key === key ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`} onClick={() => navigate(`/studio/pages/${kanal}/${r.key}`)}>
                      <div className="truncate font-mono" title={r.key}>{r.key}</div>
                      <div className="truncate text-xs text-slate-500">
                        {t?.title ?? r.templateKey} v{r.templateVersion} · {r.activeSequence ? 'tayang' : 'belum terbit'}{r.unpublished && r.activeSequence ? ' · ada perubahan' : ''}
                      </div>
                      {t && t.version > r.templateVersion && <span className="mt-0.5 inline-block rounded-full bg-sky-100 px-2 text-[10px] text-sky-800">template v{t.version} tersedia</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}
        {kanal && (
          <form className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm" onSubmit={(e) => void create(e)}>
            <h3 className="font-semibold">Buat halaman</h3>
            <div className="space-y-1" role="radiogroup" aria-label="Template">
              {templates.filter((t) => !t.deprecated).map((t) => (
                <label key={t.key} className={`flex cursor-pointer items-start gap-2 rounded border px-2 py-1 ${creating.template === t.key ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'}`}>
                  <input type="radio" name="template" className="mt-1" checked={creating.template === t.key} onChange={() => setCreating({ ...creating, template: t.key })} />
                  <span><span className="block">{t.title ?? t.key}</span><span className="text-xs text-slate-500"><span className="font-mono">{t.key}</span> v{t.version}{t.shared ? '' : ' · milik kanal ini'}</span></span>
                </label>
              ))}
            </div>
            <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono" placeholder="kunciHalaman, mis. insightKopi" aria-label="Kunci halaman baru" value={creating.key} onChange={(e) => setCreating({ ...creating, key: e.target.value })} />
            <button className="w-full rounded bg-indigo-600 py-1 text-white">Buat halaman</button>
          </form>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Sidebar>
      <main className="builder-pane flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!key && <p className="p-6 text-slate-400">Pilih halaman, atau buat yang baru dari template. Komponennya mengikuti template; isi, tampilan, sumber data dan tujuan tombolnya diatur di sini.</p>}
        {key && page === null && <p className="p-6 text-slate-400">Halaman {key} belum ada di kanal {kanal}. Buat dari panel kiri.</p>}
        {key && page && (
          <div className="flex min-h-10 flex-none flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <span className="font-mono text-slate-600">{kanal} / {key}</span>
            <span className="text-slate-500">template {page.templateKey} v{page.templateVersion}</span>
            {newer && <button className="rounded bg-sky-600 px-2 py-0.5 text-white" onClick={() => void update().catch((e: Error) => setError(e.message))}>Perbarui ke template v{newer}</button>}
            {(notice ?? (opened?.dropped.length ? `Dibuang saat terbit (tidak ada lagi di template): ${opened.dropped.join(', ')}.` : undefined)) &&
              <span className={`truncate ${notice ? 'text-emerald-700' : 'text-amber-700'}`} role="status">{notice ?? `Dibuang saat terbit (tidak ada lagi di template): ${opened!.dropped.join(', ')}.`}</span>}
            {page.activeSequence && <a href={screenPath(kanal!, key)} target="_blank" rel="noreferrer" className="ml-auto text-indigo-600">Lihat halaman ↗</a>}
          </div>
        )}
        {key && opened && (
          <SduiTemplateBuilder
            key={`${kanal}/${key}/${page?.templateVersion}`}
            document={opened.doc}
            title={page?.activeSequence ? `tayang v${page.activeSequence}` : 'belum terbit'}
            catalog={catalog}
            sampleData={SAMPLE_DATA}
            assetURL={previewURL}
            uploadAsset={(source) => studio.uploadAsset(kanal!, source)}
            baseline={baseline}
            pageTemplate={template as object}
            onSave={save}
            onPublish={publish}
          />
        )}
      </main>
    </div>
  )
}
