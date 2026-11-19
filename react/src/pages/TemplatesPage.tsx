/**
 * The Studio, one page per template of the admin's merchant (a page IS its template: same key).
 * ONE editor for the page's design and its content, and ONE "Terbitkan": the page is live at
 * once (no review step). Design and content are still stored apart — the template (no content)
 * in template-service, the value set (the content) in value-service — see ../sdui/page.ts.
 * The admin only ever sees its own templates and pages (the backend scopes every call).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/react'
import { StudioError, deprecationOf, studio, type ScreenDetail, type ScreenRow, type TemplateDetail, type TemplateRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, screenPath, studioAssetURL } from '../sdui/config'
import { baselineOf, editorSource, publishPage, savePageDraft, type PageState } from '../sdui/page'
import { Sidebar } from '../components/Sidebar'

const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }

export default function TemplatesPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const merchantId = studio.merchantId()
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [pages, setPages] = useState<ScreenRow[]>([])
  // undefined: loading; null: not created yet
  const [detail, setDetail] = useState<TemplateDetail | null>()
  const [page, setPage] = useState<ScreenDetail | null>()
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
    setPage(undefined)
    setError(undefined)
    setNotice(undefined)
    if (!key) return
    let live = true
    void (async () => {
      const [d, p] = await Promise.all([studio.template(key).catch(notFound), studio.screen(key).catch(notFound)])
      const r = d ? await studio.releasedTemplates(key, d.releases.map((x) => x.version)) : []
      if (live) { released.current = r; setDetail(d); setPage(p) }
    })().catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [key])

  const state: PageState = { template: detail ?? null, page: page ?? null }
  const apply = (s: PageState) => { setDetail(s.template); setPage(s.page) }

  // one document per opened page (design + content); the builder keeps its own undo history
  const opened = useMemo(() => {
    if (!key || detail === undefined || page === undefined) return undefined
    const doc = new EditorDocument({ mode: 'template', key })
    for (const t of released.current) doc.reserveIds(t as object)
    const { source, dropped } = editorSource(state)
    if (source) doc.importJSON(source)
    return { doc, dropped }
  }, [key, detail === undefined || page === undefined])   // eslint-disable-line react-hooks/exhaustive-deps
  const document = opened?.doc
  // content saved for components the design no longer has: left out, dropped on the next publish
  const stale = opened?.dropped.length ? `Konten untuk komponen yang sudah tidak ada di desain akan dibuang: ${opened.dropped.join(', ')}.` : undefined
  const baseline = useMemo(() => baselineOf(state), [detail?.active, page?.active])   // eslint-disable-line react-hooks/exhaustive-deps

  // a navigate goes to a page, and a page IS a template: offer every template key
  // deprecated templates are marked in the page picker (and are no replacement)
  const catalog = useMemo(() => ({ ...CATALOG, screens: [...new Set([...rows.map((t) => t.key), ...(key ? [key] : [])])].sort(), deprecated: rows.filter((t) => t.deprecated).map((t) => t.key) }), [rows, key])
  const deprecation = useMemo(() => deprecationOf(detail), [detail])
  const previewURL = useMemo(() => studioAssetURL(merchantId), [merchantId])

  const save = async (payload: unknown) => {
    apply(await savePageDraft(key!, payload, state))
    await reload()
  }
  const publish = async (payload: unknown) => {
    try {
      const res = await publishPage(key!, payload, state, apply)
      apply(res)
      setNotice(`Halaman ${key} terbit (desain v${res.template?.activeVersion}, konten v${res.page?.activeSequence}).${res.dropped.length ? ` Dibuang (tidak ada lagi di desain): ${res.dropped.join(', ')}.` : ''}`)
    } catch (e) {
      // nothing changed since the last publish: the page is already live
      if (e instanceof StudioError && e.status === 409 && page?.activeSequence) setNotice(`Tidak ada perubahan: halaman ${key} sudah tayang.`)
      else throw e
    } finally {
      await reload()
    }
  }

  const pageOf = (k: string) => pages.find((p) => p.key === k)

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <Sidebar>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h3 className="mb-2 font-semibold">Halaman <span className="font-normal text-slate-500">· {merchantId}</span></h3>
          {rows.length === 0 && <p className="mb-2 text-xs text-slate-500">Belum ada halaman. Buat yang pertama di bawah.</p>}
          <ul className="space-y-1">
            {rows.map((t) => {
              const p = pageOf(t.key)
              const changed = t.unpublished || p?.unpublished
              return (
                <li key={t.key}>
                  <button className={`w-full rounded px-2 py-1 text-left ${t.key === key ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`} onClick={() => navigate(`/studio/templates/${t.key}`)}>
                    <div className="truncate font-mono" title={t.key}>{t.key}</div>
                    <div className="truncate text-xs text-slate-500">
                      {t.title ?? '—'} · {p?.activeSequence ? 'tayang' : 'belum terbit'}{changed && p?.activeSequence ? ' · ada perubahan' : ''}
                    </div>
                    {t.deprecated && <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 text-[10px] text-amber-800" title={t.deprecationReason ?? undefined}>deprecated{t.replacedBy ? ` → ${t.replacedBy}` : ''}</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <form className="mt-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey)) { navigate(`/studio/templates/${newKey}`); setNewKey('') } }}>
            <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono" placeholder="halamanBaru" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <button className="rounded bg-indigo-600 px-2 text-white">Buat</button>
          </form>
        </section>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Sidebar>
      <main className="builder-pane flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!key && <p className="p-6 text-slate-400">Pilih halaman, atau buat yang baru. Desain dan isinya diedit di sini, lalu Terbitkan sekali.</p>}
        {key && (
          <div className="flex h-10 flex-none items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 text-xs">
            <span className="font-mono text-slate-600">{merchantId} / {key}</span>
            {(notice ?? stale) && <span className={`truncate ${notice ? 'text-emerald-700' : 'text-amber-700'}`} role="status">{notice ?? stale}</span>}
            {page?.activeSequence && <a href={screenPath(merchantId, key)} target="_blank" rel="noreferrer" className="ml-auto text-indigo-600">Lihat halaman ↗</a>}
          </div>
        )}
        {key && document && (
          <SduiTemplateBuilder
            key={key}
            document={document}
            title={page?.activeSequence ? `tayang · desain v${detail?.activeVersion}, konten v${page.activeSequence}` : 'belum terbit'}
            catalog={catalog}
            sampleData={SAMPLE_DATA}
            assetURL={previewURL}
            uploadAsset={(source) => studio.uploadAsset(source)}
            baseline={baseline}
            onSave={save}
            onPublish={publish}
            deprecation={deprecation}
            onDeprecate={detail?.activeVersion ? async ({ reason, replacedBy }) => { setDetail(await studio.deprecateTemplate(key, reason, replacedBy)); await reload() } : undefined}
            onRestore={async () => { setDetail(await studio.restoreTemplate(key)); await reload() }}
          />
        )}
      </main>
    </div>
  )
}
