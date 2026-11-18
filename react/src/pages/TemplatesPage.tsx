/**
 * Template Builder (admin): components → a template (ids + orders). Drafts are saved to
 * template-service through studio-bff; a template publisher approves the release.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/react'
import { deprecationOf, studio, type RequestRow, type TemplateDetail, type TemplateRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, assetURL } from '../sdui/config'
import { RequestsPanel } from '../components/RequestsPanel'
import { Sidebar } from '../components/Sidebar'

export default function TemplatesPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [detail, setDetail] = useState<TemplateDetail | null>()
  const [error, setError] = useState<string>()
  const [newKey, setNewKey] = useState('')
  const canEdit = studio.has('SDUI_TEMPLATE_ADMIN')

  const reload = useCallback(async () => {
    setRows(await studio.templates())
    setRequests(await studio.templateRequests('PENDING'))
  }, [])
  useEffect(() => { void reload().catch((e: Error) => setError(e.message)) }, [reload])
  // every released version of the open template: their component ids are never generated again
  const released = useRef<unknown[]>([])
  useEffect(() => {
    setDetail(undefined)
    if (!key) return
    let live = true
    void (async () => {
      const d = await studio.template(key).catch(() => null)   // null: a new template
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

  const save = async (payload: unknown) => {
    const saved = await studio.saveTemplate(key!, payload, detail?.lockVersion)
    setDetail(saved)
    await reload()
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <Sidebar>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h3 className="mb-2 font-semibold">Template</h3>
          <ul className="space-y-1">
            {rows.map((t) => (
              <li key={t.key}>
                <button className={`w-full rounded px-2 py-1 text-left ${t.key === key ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`} onClick={() => navigate(`/studio/templates/${t.key}`)}>
                  <div className="truncate font-mono" title={t.key}>{t.key}</div>
                  <div className="truncate text-xs text-slate-500">{t.title ?? '—'} · {t.activeVersion ? `v${t.activeVersion}` : 'belum terbit'}{t.pending ? ' · menunggu review' : ''}</div>
                  {t.deprecated && <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 text-[10px] text-amber-800" title={t.deprecationReason ?? undefined}>deprecated{t.replacedBy ? ` → ${t.replacedBy}` : ''}</span>}
                </button>
              </li>
            ))}
          </ul>
          {canEdit && (
            <form className="mt-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey)) navigate(`/studio/templates/${newKey}`) }}>
              <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono" placeholder="templateKeyBaru" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              <button className="rounded bg-indigo-600 px-2 text-white">Buat</button>
            </form>
          )}
        </section>
        <RequestsPanel title="Pengajuan template" rows={requests} me={studio.current()!.sub} canDecide={studio.has('SDUI_TEMPLATE_PUBLISHER')}
          onDecide={async (id, d, reason) => { await studio.decideTemplate(id, d, reason); await reload(); if (key) setDetail(await studio.template(key)) }} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Sidebar>
      <main className="builder-pane overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!key && <p className="p-6 text-slate-400">Pilih template, atau buat yang baru.</p>}
        {document && (
          <SduiTemplateBuilder
            key={key}
            document={document}
            title={detail?.activeVersion ? `aktif v${detail.activeVersion}` : 'baru'}
            catalog={catalog}
            sampleData={SAMPLE_DATA}
            assetURL={assetURL}
            readOnly={!canEdit}
            baseline={detail?.active?.payload}
            onSave={canEdit ? save : undefined}
            onSubmitForReview={canEdit ? async (payload, note) => { await save(payload); await studio.submitTemplate(key!, note); await reload() } : undefined}
            deprecation={deprecation}
            onDeprecate={canEdit && detail?.activeVersion ? async ({ reason, replacedBy }) => { setDetail(await studio.deprecateTemplate(key!, reason, replacedBy)); await reload() } : undefined}
            onRestore={canEdit ? async () => { setDetail(await studio.restoreTemplate(key!)); await reload() } : undefined}
          />
        )}
      </main>
    </div>
  )
}
