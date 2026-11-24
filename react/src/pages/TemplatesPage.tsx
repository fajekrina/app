/**
 * The Studio's **Template** tab: the shared templates. A template decides which components a
 * page has, with their defaults (sample texts in [brackets]). Every Studio user sees and edits
 * the same templates; Terbitkan releases one at once (no review step), then offers to update
 * the pages made from it (each with what it would lose) — see ../sdui/page.ts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { EditorDocument, SduiTemplateBuilder } from '@fajekrina/sdui-r/builder/react'
import { PAGE_SPACE, SHARED_KANAL, StudioError, deprecationOf, studio, studioCatalog, type PageRow, type TemplateDetail, type TemplateRow, type StudioNames } from '../api/studio'
import { ASSETS, SAMPLE_DATA, studioAssetURL } from '../sdui/config'
import { pagesToUpdate, publishTemplateDraft, saveTemplateDraft, templateSource, updatePages, type PageUpdate, type PageUpdateResult } from '../sdui/page'
import { Sidebar } from '../components/Sidebar'

const notFound = (e: unknown) => { if (e instanceof StudioError && e.status === 404) return null; throw e }
const previewURL = studioAssetURL(SHARED_KANAL)

export default function TemplatesPage() {
  const { key } = useParams()
  const navigate = useNavigate()
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [pages, setPages] = useState<PageRow[]>([])
  // undefined: loading; null: not created yet
  const [detail, setDetail] = useState<TemplateDetail | null>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [newKey, setNewKey] = useState('')
  // K5: after a release, the pages behind it (checked = update)
  const [offer, setOffer] = useState<{ version: number; pages: PageUpdate[]; chosen: Set<string> }>()
  const [results, setResults] = useState<PageUpdateResult[]>()
  // the names the builder offers: the catalog (database), never typed freely
  const [names, setNames] = useState<StudioNames>()
  useEffect(() => { void studio.names().then(setNames).catch((e: Error) => setError(e.message)) }, [])

  const reload = useCallback(async () => {
    const [t, p] = await Promise.all([studio.templates(), studio.pages()])
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
    setOffer(undefined)
    setResults(undefined)
    if (!key) return
    let live = true
    void (async () => {
      const d = await studio.template(key).catch(notFound)
      const r = d ? await studio.releasedTemplates(key, d.releases.map((x) => x.version)) : []
      if (live) { released.current = r; setDetail(d) }
    })().catch((e: Error) => { if (live) setError(e.message) })
    return () => { live = false }
  }, [key])

  const document = useMemo(() => {
    if (!key || detail === undefined) return undefined
    const doc = new EditorDocument({ mode: 'template', key })
    for (const t of released.current) doc.reserveIds(t as object)
    const source = templateSource(detail)
    if (source) doc.importJSON(source)
    return doc
  }, [key, detail === undefined])   // eslint-disable-line react-hooks/exhaustive-deps

  // requests, sources, links and the pages a navigate may open: the catalog;
  // a template's replacement, when deprecated, is another template
  const catalog = useMemo(() => ({
    ...studioCatalog(names, Object.keys(ASSETS)),
    templates: rows.filter((t) => t.activeVersion).map((t) => t.key),
    deprecated: rows.filter((t) => t.deprecated).map((t) => t.key)
  }), [names, rows])
  const deprecation = useMemo(() => deprecationOf(detail), [detail])
  const usedBy = (k: string) => pages.filter((p) => p.templateKey === k)

  const save = async (payload: unknown) => {
    setDetail(await saveTemplateDraft(key!, payload, detail ?? null))
    await reload()
  }
  const publish = async (payload: unknown) => {
    const { template, unchanged } = await publishTemplateDraft(key!, payload, detail ?? null, setDetail)
    setDetail(template)
    await reload()
    if (unchanged) { setNotice(`Tidak ada perubahan: template ${key} v${template.activeVersion} sudah aktif.`); return }
    setNotice(`Template ${key} v${template.activeVersion} terbit.`)
    const behind = await pagesToUpdate(key!, template.activeVersion!, template.active!.payload)
    if (behind.length) setOffer({ version: template.activeVersion!, pages: behind, chosen: new Set(behind.map((p) => `${p.kanal}/${p.key}`)) })
  }
  const applyOffer = async () => {
    if (!offer) return
    const chosen = offer.pages.filter((p) => offer.chosen.has(`${p.kanal}/${p.key}`))
    setResults(await updatePages(chosen, offer.version))
    setOffer(undefined)
    await reload()
  }
  const toggle = (id: string) => setOffer((o) => {
    if (!o) return o
    const chosen = new Set(o.chosen)
    if (chosen.has(id)) chosen.delete(id); else chosen.add(id)
    return { ...o, chosen }
  })

  return (
    <div className="grid grid-cols-[auto_1fr] gap-3 p-3">
      <Sidebar>
        <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
          <h3 className="mb-2 font-semibold">Template <span className="font-normal text-slate-500">· dipakai bersama</span></h3>
          {rows.length === 0 && <p className="mb-2 text-xs text-slate-500">Belum ada template. Buat yang pertama di bawah.</p>}
          <ul className="space-y-1">
            {rows.map((t) => (
              <li key={t.key}>
                <button className={`w-full rounded px-2 py-1 text-left ${t.key === key ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50'}`} onClick={() => navigate(`/studio/templates/${t.key}`)}>
                  <div className="truncate" title={t.key}>{t.title ?? t.key}</div>
                  <div className="truncate text-xs text-slate-500">
                    <span className="font-mono">{t.key}</span> · {t.activeVersion ? `v${t.activeVersion}` : 'belum terbit'}{t.unpublished && t.activeVersion ? ' · ada perubahan' : ''} · {usedBy(t.key).length} halaman
                  </div>
                  {t.deprecated && <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 text-[10px] text-amber-800" title={t.deprecationReason ?? undefined}>deprecated{t.replacedBy ? ` → ${t.replacedBy}` : ''}</span>}
                </button>
              </li>
            ))}
          </ul>
          <form className="mt-3 flex gap-1" onSubmit={(e) => { e.preventDefault(); if (/^[A-Za-z][A-Za-z0-9_]*$/.test(newKey)) { navigate(`/studio/templates/${newKey}`); setNewKey('') } }}>
            <input className="w-full rounded border border-slate-300 px-2 py-1 font-mono" placeholder="templateBaru" aria-label="Kunci template baru" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
            <button className="rounded bg-indigo-600 px-2 text-white">Buat</button>
          </form>
        </section>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </Sidebar>
      <main className="builder-pane flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
        {!key && <p className="p-6 text-slate-400">Pilih template, atau buat yang baru. Template menentukan komponen apa saja yang ada di halaman; isi dan tampilannya diatur per halaman di tab Konten.</p>}
        {key && (
          <div className="flex min-h-10 flex-none flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <span className="font-mono text-slate-600">template / {key}</span>
            {notice && <span className="truncate text-emerald-700" role="status">{notice}</span>}
            {key && <span className="ml-auto text-slate-500">{usedBy(key).length} halaman memakai template ini</span>}
          </div>
        )}
        {offer && (
          <div className="flex-none space-y-2 border-b border-amber-200 bg-amber-50 p-3 text-sm" role="dialog" aria-label="Perbarui halaman">
            <strong>Perbarui juga {offer.pages.length} halaman yang memakai template ini ke v{offer.version}?</strong>
            <p className="text-xs text-slate-600">Halaman yang dipilih langsung diterbitkan dengan versi baru. Yang tidak dipilih tetap di versi lamanya dan bisa diperbarui nanti di tab Konten.</p>
            <ul className="space-y-1">
              {offer.pages.map((p) => {
                const id = `${p.kanal}/${p.key}`
                return (
                  <li key={id}>
                    <label className="flex items-start gap-2">
                      <input type="checkbox" checked={offer.chosen.has(id)} onChange={() => toggle(id)} />
                      <span><span className="font-mono">{p.kanal === PAGE_SPACE ? p.key : `${p.key} · lama (${p.kanal})`}</span> <span className="text-slate-500">(v{p.templateVersion})</span>
                        {p.dropped.length > 0 && <span className="block text-xs text-amber-800">Akan hilang: {p.dropped.join(', ')}</span>}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <div className="flex gap-2">
              <button className="rounded bg-indigo-600 px-3 py-1 text-white" onClick={() => void applyOffer()}>Perbarui &amp; terbitkan yang dipilih</button>
              <button className="rounded border border-slate-300 px-3 py-1" onClick={() => setOffer(undefined)}>Nanti saja</button>
            </div>
          </div>
        )}
        {results && (
          <div className="flex-none border-b border-slate-200 bg-white p-3 text-xs" role="status">
            {results.map((r) => (
              <div key={`${r.kanal}/${r.key}`} className={r.ok ? 'text-emerald-700' : 'text-red-600'}>
                {r.kanal === PAGE_SPACE ? r.key : `${r.key} · lama (${r.kanal})`}: {r.ok ? `terbit${r.dropped.length ? ` (dibuang: ${r.dropped.join(', ')})` : ''}` : `gagal — ${r.error}`}
              </div>
            ))}
          </div>
        )}
        {key && document && (
          <SduiTemplateBuilder
            key={key}
            document={document}
            title={detail?.activeVersion ? `aktif v${detail.activeVersion}` : 'belum terbit'}
            catalog={catalog}
            sampleData={SAMPLE_DATA}
            assetURL={previewURL}
            uploadAsset={(source) => studio.uploadAsset(SHARED_KANAL, source)}
            baseline={detail?.active?.payload}
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
