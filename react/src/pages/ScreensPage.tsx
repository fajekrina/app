/**
 * Screen Builder (maker): pick a released template, fill in its components → a value set
 * for one merchant screen. Saved to value-service through studio-bff; a publisher approves.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { SduiScreenBuilder, ValuesEditor, type TemplateChoice } from '@fajekrina/sdui-r/builder/react'
import { TemplateDocument } from '@fajekrina/sdui-r'
import { studio, type CatalogEntry, type RequestRow, type ScreenDetail, type ScreenRow } from '../api/studio'
import { CATALOG, SAMPLE_DATA, assetURL } from '../sdui/config'
import { RequestsPanel } from '../components/RequestsPanel'
import { Sidebar } from '../components/Sidebar'

export default function ScreensPage() {
  const params = useParams()
  const navigate = useNavigate()
  // the maker IS the merchant (its own account); checkers and viewers pick any merchant
  const maker = studio.has('SDUI_AUTHOR')
  const own = maker ? studio.current()!.merchants[0] : undefined
  const [merchants, setMerchants] = useState<string[]>(own ? [own] : [])
  useEffect(() => {
    if (own) return
    void studio.merchants().then((list) => setMerchants(list.map((m) => m.merchantId))).catch((e: Error) => setError(e.message))
  }, [own])
  const merchantId = own ?? params.merchantId ?? merchants[0] ?? ''
  const key = params.key
  const [rows, setRows] = useState<ScreenRow[]>([])
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [catalog, setCatalog] = useState<CatalogEntry[]>([])
  const [detail, setDetail] = useState<ScreenDetail | null>()
  const [editor, setEditor] = useState<ValuesEditor>()
  const [newKey, setNewKey] = useState('')
  const [error, setError] = useState<string>()
  const canEdit = studio.has('SDUI_AUTHOR')

  const reload = useCallback(async () => {
    if (!merchantId) return
    setRows(await studio.screens(merchantId))
    setRequests(await studio.screenRequests(merchantId, 'PENDING'))
  }, [merchantId])
  useEffect(() => { void reload().catch((e: Error) => setError(e.message)) }, [reload])
  useEffect(() => { void studio.catalog().then(setCatalog).catch((e: Error) => setError(e.message)) }, [])

  // open a screen: its draft (or active) values with the template release they name
  useEffect(() => {
    setDetail(undefined)
    setEditor(undefined)
    if (!key || !merchantId) return
    let alive = true
    ;(async () => {
      const d = await studio.screen(merchantId, key).catch(() => null)
      const values = d?.draft ?? d?.active?.payload
      const template = d ? await studio.releasedTemplate(d.templateKey, d.templateVersion) : undefined
      if (!alive) return
      setDetail(d)
      setEditor(new ValuesEditor({ screen: key, values, template: template && TemplateDocument.decode(template) }))
    })().catch((e: Error) => setError(e.message))
    return () => { alive = false }
  }, [merchantId, key])

  const templates: TemplateChoice[] = useMemo(() => catalog.map((c) => ({ key: c.key, version: c.version, title: c.title })), [catalog])

  const save = async (payload: unknown) => {
    const saved = await studio.saveScreen(merchantId, key!, payload, detail?.lockVersion)
    setDetail(saved)
    await reload()
  }

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <Sidebar>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {own ? (
            <div className="mb-2 font-semibold">Merchant <code className="ml-1 rounded bg-slate-100 px-1 font-normal">{own}</code></div>
          ) : (
            <label className="mb-2 flex items-center gap-2 font-semibold">Merchant
              <select className="rounded border border-slate-300 px-1 font-normal" value={merchantId} onChange={(e) => navigate(`/studio/screens/${e.target.value}`)}>
                {merchants.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          )}
          {own && rows.length === 0 && <p className="mb-2 text-xs text-slate-500">Belum ada screen. Buat screen baru, lalu pilih template yang sudah disetujui.</p>}
          <ul className="space-y-1">
            {rows.map((s) => (
              <li key={s.key}>
                <button className={`w-full rounded px-2 py-1 text-left ${s.key === key ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`} onClick={() => navigate(`/studio/screens/${merchantId}/${s.key}`)}>
                  <div className="truncate font-mono" title={s.key}>{s.key}</div>
                  <div className="truncate text-xs text-slate-500" title={`${s.templateKey}@${s.templateVersion}`}>{s.templateKey}@{s.templateVersion} · {s.activeSequence ? `v${s.activeSequence}` : 'belum terbit'}{s.pending ? ' · menunggu review' : ''}</div>
                </button>
              </li>
            ))}
          </ul>
          {canEdit && (
            <form className="mt-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey)) navigate(`/studio/screens/${merchantId}/${newKey}`) }}>
              <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono" placeholder="screenKeyBaru" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
              <button className="rounded bg-indigo-600 px-2 text-white">Buat</button>
            </form>
          )}
        </section>
        <RequestsPanel title={`Pengajuan · ${merchantId}`} rows={requests} me={studio.current()!.sub} canDecide={studio.has('SDUI_PUBLISHER')}
          onDecide={async (id, d, reason) => { await studio.decideScreen(merchantId, id, d, reason); await reload(); if (key) setDetail(await studio.screen(merchantId, key)) }} />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Sidebar>
      <main className="builder-pane overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!key && <p className="p-6 text-slate-400">Pilih screen, atau buat yang baru. Di Screen Builder pilihannya template; Anda mengisi value komponennya.</p>}
        {editor && (
          <SduiScreenBuilder
            key={`${merchantId}/${key}`}
            editor={editor}
            title={merchantId}
            templates={templates}
            loadTemplate={(c) => studio.releasedTemplate(c.key, c.version)}
            catalog={CATALOG}
            sampleData={SAMPLE_DATA}
            assetURL={assetURL}
            readOnly={!canEdit}
            baseline={detail?.active?.payload}
            onSave={canEdit ? save : undefined}
            onSubmitForReview={canEdit ? async (payload, note) => { await save(payload); await studio.submitScreen(merchantId, key!, note); await reload() } : undefined}
          />
        )}
      </main>
    </div>
  )
}
