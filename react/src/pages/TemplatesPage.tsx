/**
 * The Studio, one page per template of the admin's merchant, two tabs:
 * - **Desain** — the Template Builder: components → a template (ids + orders). Save a draft,
 *   or Terbitkan: the release is live at once (no review step).
 * - **Isi konten** — the admin fills the merchant's page made from this template (a page IS
 *   its template: same key) and publishes it, also at once.
 * The admin only ever sees its own templates and pages (the backend scopes every call).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EditorDocument, SduiScreenBuilder, SduiTemplateBuilder, ValuesEditor } from '@fajekrina/sdui-r/builder/react'
import { TemplateDocument } from '@fajekrina/sdui-r'
import { StudioError, deprecationOf, studio, type ScreenDetail, type ScreenRow, type TemplateDetail, type TemplateRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, assetURL, screenPath, studioAssetURL } from '../sdui/config'
import { Sidebar } from '../components/Sidebar'

type Tab = 'design' | 'content'

export default function TemplatesPage() {
  const { key, tab: tabParam } = useParams()
  const tab: Tab = tabParam === 'content' ? 'content' : 'design'
  const navigate = useNavigate()
  const merchantId = studio.merchantId()
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [pages, setPages] = useState<ScreenRow[]>([])
  const [detail, setDetail] = useState<TemplateDetail | null>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [newKey, setNewKey] = useState('')

  const reload = useCallback(async () => {
    const [t, p] = await Promise.all([studio.templates(), studio.screens()])
    setRows(t)
    setPages(p)
  }, [])
  useEffect(() => { void reload().catch((e: Error) => setError(e.message)) }, [reload])
  // every released version of the open template: their component ids are never generated again
  const released = useRef<unknown[]>([])
  useEffect(() => {
    setDetail(undefined)
    setError(undefined)
    setNotice(undefined)
    if (!key) return
    let live = true
    void (async () => {
      const d = await studio.template(key).catch((e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e })   // null: a new template
      const r = d ? await studio.releasedTemplates(key, d.releases.map((x) => x.version)) : []
      if (live) { released.current = r; setDetail(d) }
    })().catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [key])

  // one document per opened template; the builder keeps its own undo history
  const document = useMemo(() => {
    if (!key || detail === undefined) return undefined
    const doc = new EditorDocument({ mode: 'template', key })
    for (const t of released.current) doc.reserveIds(t as object)
    const source = detail?.draft ?? detail?.active?.payload
    if (source) doc.importJSON(source as object)
    return doc
  }, [key, detail === undefined])   // eslint-disable-line react-hooks/exhaustive-deps

  // a navigate goes to a page, and a page IS a template: offer every template key
  // deprecated templates are marked in the page picker (and are no replacement)
  const catalog = useMemo(() => ({ ...CATALOG, screens: [...new Set([...rows.map((t) => t.key), ...(key ? [key] : [])])].sort(), deprecated: rows.filter((t) => t.deprecated).map((t) => t.key) }), [rows, key])
  const deprecation = useMemo(() => deprecationOf(detail), [detail])

  const saveTemplate = async (payload: unknown) => {
    setDetail(await studio.saveTemplate(key!, payload, detail?.lockVersion))
    await reload()
  }
  const publishTemplate = async (payload: unknown) => {
    const saved = await studio.saveTemplate(key!, payload, detail?.lockVersion)
    // nothing changed since the last release: it is already live
    const published = saved.unpublished || !saved.activeVersion ? await studio.publishTemplate(key!) : saved
    setDetail(published)
    await reload()
    setNotice(`Template ${key} v${published.activeVersion} terbit. Isi kontennya di tab "Isi konten".`)
  }

  // ---- content tab: the merchant's page made from this template ----
  const [page, setPage] = useState<ScreenDetail | null>()
  const [editor, setEditor] = useState<ValuesEditor>()
  useEffect(() => {
    setPage(undefined)
    setEditor(undefined)
    if (tab !== 'content' || !key || !detail?.activeVersion) return
    let live = true
    void (async () => {
      const p = await studio.screen(key).catch((e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e })
      const latest = TemplateDocument.decode(await studio.releasedTemplate(key, detail.activeVersion!))
      const values = p?.draft ?? p?.active?.payload
      let e: ValuesEditor
      if (p && values && p.templateVersion !== detail.activeVersion) {
        // the page was filled for an older release: carry its values over to the latest
        e = new ValuesEditor({ screen: key, values, template: TemplateDocument.decode(await studio.releasedTemplate(key, p.templateVersion)) })
        const dropped = e.setTemplate(latest)
        if (live) setNotice(`Konten dipindahkan dari template v${p.templateVersion} ke v${detail.activeVersion}${dropped.length ? `; dibuang (tidak ada lagi di template): ${dropped.join(', ')}` : ''}. Simpan atau terbitkan untuk memakainya.`)
      } else {
        e = new ValuesEditor({ screen: key, values, template: latest })
      }
      if (live) { setPage(p); setEditor(e) }
    })().catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [tab, key, detail?.activeVersion])
  const previewURL = useMemo(() => studioAssetURL(merchantId), [merchantId])
  const savePage = async (payload: unknown) => {
    setPage(await studio.saveScreen(key!, payload, page?.lockVersion))
    await reload()
  }
  const publishPage = async (payload: unknown) => {
    const saved = await studio.saveScreen(key!, payload, page?.lockVersion)
    const published = saved.unpublished || !saved.activeSequence ? await studio.publishScreen(key!) : saved
    setPage(published)
    await reload()
    setNotice(`Halaman ${key} v${published.activeSequence} terbit.`)
  }

  const pageOf = (k: string) => pages.find((p) => p.key === k)
  const tabClass = (on: boolean) => `rounded-t px-3 py-1 text-sm ${on ? 'border border-b-white border-slate-200 bg-white font-medium text-indigo-700' : 'text-slate-500 hover:text-slate-900'}`

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <Sidebar>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h3 className="mb-2 font-semibold">Template <span className="font-normal text-slate-500">· {merchantId}</span></h3>
          {rows.length === 0 && <p className="mb-2 text-xs text-slate-500">Belum ada template. Buat yang pertama di bawah.</p>}
          <ul className="space-y-1">
            {rows.map((t) => {
              const p = pageOf(t.key)
              return (
                <li key={t.key}>
                  <button className={`w-full rounded px-2 py-1 text-left ${t.key === key ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`} onClick={() => navigate(`/studio/templates/${t.key}${tab === 'content' ? '/content' : ''}`)}>
                    <div className="truncate font-mono" title={t.key}>{t.key}</div>
                    <div className="truncate text-xs text-slate-500">
                      {t.title ?? '—'} · {t.activeVersion ? `v${t.activeVersion}` : 'belum terbit'}{t.unpublished && t.activeVersion ? ' · ada perubahan' : ''}
                    </div>
                    <div className="truncate text-xs text-slate-400">halaman: {p ? (p.activeSequence ? `v${p.activeSequence}${p.unpublished ? ' · ada perubahan' : ''}` : 'draf') : 'belum diisi'}</div>
                    {t.deprecated && <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 text-[10px] text-amber-800" title={t.deprecationReason ?? undefined}>deprecated{t.replacedBy ? ` → ${t.replacedBy}` : ''}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <form className="mt-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey)) { navigate(`/studio/templates/${newKey}`); setNewKey('') } }}>
            <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono" placeholder="templateKeyBaru" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <button className="rounded bg-indigo-600 px-2 text-white">Buat</button>
          </form>
        </section>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Sidebar>
      <main className="builder-pane flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!key && <p className="p-6 text-slate-400">Pilih template, atau buat yang baru. Setelah template terbit, isi kontennya di tab “Isi konten”.</p>}
        {key && (
          <nav className="flex items-end gap-1 border-b border-slate-200 bg-slate-50 px-3 pt-2" aria-label="Mode">
            <Link to={`/studio/templates/${key}`} className={tabClass(tab === 'design')} aria-current={tab === 'design' ? 'page' : undefined}>Desain</Link>
            <Link to={`/studio/templates/${key}/content`} className={tabClass(tab === 'content')} aria-current={tab === 'content' ? 'page' : undefined}>Isi konten</Link>
            {notice && <span className="mb-1 ml-3 truncate text-xs text-emerald-700" role="status">{notice}</span>}
            {pageOf(key)?.activeSequence && <a href={screenPath(merchantId, key)} target="_blank" rel="noreferrer" className="mb-1 ml-auto text-xs text-indigo-600">Lihat halaman ↗</a>}
          </nav>
        )}
        {key && tab === 'design' && document && (
          <SduiTemplateBuilder
            key={key}
            document={document}
            title={detail?.activeVersion ? `aktif v${detail.activeVersion}` : 'baru'}
            catalog={catalog}
            sampleData={SAMPLE_DATA}
            assetURL={assetURL}
            baseline={detail?.active?.payload}
            onSave={saveTemplate}
            onPublish={publishTemplate}
            deprecation={deprecation}
            onDeprecate={detail?.activeVersion ? async ({ reason, replacedBy }) => { setDetail(await studio.deprecateTemplate(key, reason, replacedBy)); await reload() } : undefined}
            onRestore={async () => { setDetail(await studio.restoreTemplate(key)); await reload() }}
          />
        )}
        {key && tab === 'content' && detail !== undefined && !detail?.activeVersion && (
          <p className="p-6 text-slate-500">Template <code>{key}</code> belum terbit. Terbitkan dulu di tab “Desain”, lalu isi kontennya di sini.</p>
        )}
        {key && tab === 'content' && editor && (
          <SduiScreenBuilder
            key={`${key}@${detail?.activeVersion}`}
            editor={editor}
            showTemplates={false}
            title={`${merchantId} / ${key}`}
            catalog={CATALOG}
            sampleData={SAMPLE_DATA}
            assetURL={previewURL}
            uploadAsset={(source) => studio.uploadAsset(source)}
            baseline={page?.active?.payload}
            onSave={savePage}
            onPublish={publishPage}
          />
        )}
      </main>
    </div>
  )
}
