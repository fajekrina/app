/**
 * The customer app: `/s/:screen?m=<merchant>&…` — a signed template + value set, composed
 * by the engine. Query params (except `m`) seed the screen (`{{seatId}}`).
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SduiScreen } from '@fajekrina/sdui-r/react'
import type { SduiEngine, SduiProps } from '@fajekrina/sdui-r'
import { createSduiEngine } from '../sdui/engine'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN, MERCHANTS, specScreenKey } from '../sdui/config'
import { session } from '../api/bff'

function toQuery(merchant: string, params: SduiProps): string {
  const qs = new URLSearchParams()
  if (merchant !== DEFAULT_MERCHANT) qs.set('m', merchant)
  for (const [k, v] of Object.entries(params)) if (v !== null && typeof v !== 'object') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

export default function ScreenPage() {
  const { screen = DEFAULT_SCREEN } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const query = useMemo(() => new URLSearchParams(search), [search])
  const merchant = query.get('m') ?? DEFAULT_MERCHANT
  const seed = useMemo(() => Object.fromEntries([...query].filter(([k]) => k !== 'm')), [query])
  const [engine, setEngine] = useState<SduiEngine>()
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let alive = true
    setEngine(undefined)
    void session().catch(() => undefined)   // guest session + CSRF for api actions
    createSduiEngine({
      merchantId: merchant,
      navigate: (key, params) => navigate(`/s/${key}${toQuery(merchant, params)}`),
      onEvent: (e) => { if (e.type === 'connectivity_changed') setOnline(e.online) }
    }).then(async (created) => {
      await created.refreshManifest().catch((e) => console.warn('[sdui-r] manifest', e))
      if (alive) setEngine(created)
    }).catch((e: Error) => alive && setError(e.message))
    return () => { alive = false }
  }, [merchant, navigate])

  const key = specScreenKey(screen)
  if (key !== screen) return <Navigate replace to={`/s/${key}${search}`} />

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <strong className="text-slate-900">sdui-r · React + Tailwind</strong>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{merchant} / {screen}</span>
        <label className="flex items-center gap-1 text-slate-500">
          merchant
          <select className="rounded border border-slate-300 px-1 py-0.5" value={merchant}
            onChange={(e) => navigate(`/s/${screen}${toQuery(e.target.value, seed)}`)}>
            {[...new Set([...MERCHANTS, merchant])].map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        {!online && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Anda sedang offline — tampilan terakhir yang terverifikasi</span>}
        <Link to="/studio" className="ml-auto text-indigo-600 hover:underline">Studio →</Link>
      </header>
      <main className="mx-auto max-w-5xl">
        {error && <p className="p-6 text-red-600">{error}</p>}
        {engine ? <SduiScreen key={`${merchant}/${key}`} engine={engine} source={{ key }} seed={seed} /> : !error && <p className="p-6 text-slate-400">Memuat…</p>}
      </main>
    </div>
  )
}
