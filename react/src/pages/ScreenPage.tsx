/**
 * The customer app: `/s/:merchantId/:screen?…` — one merchant's published page: a signed
 * template + value set, composed by the engine. Query params seed the screen (`{{seatId}}`).
 * The old `/s/:screen?m=<merchant>` links redirect here (`LegacyScreenRedirect`).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SduiScreen } from '@fajekrina/sdui-r/react'
import type { SduiEngine, SduiProps } from '@fajekrina/sdui-r'
import { createSduiEngine } from '../sdui/engine'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN, isMerchantId, screenPath, specScreenKey } from '../sdui/config'
import { publicMerchants, session, type PublicMerchant } from '../api/bff'

function toQuery(params: SduiProps): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== null && typeof v !== 'object') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** `/s/:screen?m=<merchant>&…` (old links) → `/s/<merchant>/<screen>?…` */
export function LegacyScreenRedirect() {
  const { screen = DEFAULT_SCREEN } = useParams()
  const { search } = useLocation()
  const query = new URLSearchParams(search)
  const merchant = query.get('m') ?? DEFAULT_MERCHANT
  query.delete('m')
  const rest = query.toString()
  return <Navigate replace to={`${screenPath(merchant, specScreenKey(screen))}${rest ? `?${rest}` : ''}`} />
}

export default function ScreenPage() {
  const { merchantId: merchant = DEFAULT_MERCHANT, screen = DEFAULT_SCREEN } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const seed = useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search])
  const [engine, setEngine] = useState<SduiEngine>()
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [error, setError] = useState<string>()
  // every kanal with a published page (not a fixed list); the current one always stays
  const [merchants, setMerchants] = useState<PublicMerchant[]>([])
  useEffect(() => { void publicMerchants().then(setMerchants).catch((e) => console.warn('[sdui-r] merchants', e)) }, [])
  const valid = isMerchantId(merchant)

  useEffect(() => {
    let alive = true
    setEngine(undefined)
    setError(undefined)
    if (!valid) return
    void session().catch(() => undefined)   // guest session + CSRF for api actions
    createSduiEngine({
      merchantId: merchant,
      navigate: (key, params) => navigate(`${screenPath(merchant, key)}${toQuery(params)}`),
      onEvent: (e) => { if (e.type === 'connectivity_changed') setOnline(e.online) }
    }).then(async (created) => {
      await created.refreshManifest().catch((e) => console.warn('[sdui-r] manifest', e))
      if (alive) setEngine(created)
    }).catch((e: Error) => alive && setError(e.message))
    return () => { alive = false }
  }, [merchant, navigate, valid])

  const key = specScreenKey(screen)
  if (key !== screen) return <Navigate replace to={`${screenPath(merchant, key)}${search}`} />

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <strong className="text-slate-900">sdui-r · React + Tailwind</strong>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{merchant} / {screen}</span>
        <label className="flex items-center gap-1 text-slate-500">
          kanal
          <select className="rounded border border-slate-300 px-1 py-0.5" value={merchant}
            onChange={(e) => navigate(`${screenPath(e.target.value, screen)}${toQuery(seed)}`)}>
            {!merchants.some((m) => m.merchantId === merchant) && <option value={merchant}>{merchant}</option>}
            {merchants.map((m) => <option key={m.merchantId} value={m.merchantId}>{m.name === m.merchantId ? m.merchantId : `${m.name} (${m.merchantId})`}</option>)}
          </select>
        </label>
        {!online && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Anda sedang offline — tampilan terakhir yang terverifikasi</span>}
        <Link to="/studio" className="ml-auto text-indigo-600 hover:underline">Studio →</Link>
      </header>
      <main className="mx-auto max-w-5xl">
        {!valid && <p className="p-6 text-red-600">ID kanal tidak valid: <code>{merchant}</code></p>}
        {error && <p className="p-6 text-red-600">{error}</p>}
        {engine ? <SduiScreen key={`${merchant}/${key}`} engine={engine} source={{ key }} seed={seed} /> : valid && !error && <p className="p-6 text-slate-400">Memuat…</p>}
      </main>
    </div>
  )
}
