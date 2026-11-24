/**
 * The customer app: `/s/:screen?…` — a published page (no merchant, kanal or user: they only
 * render what the Studio published): a signed template + value set, composed by the engine.
 * Query params seed the screen (`{{seatId}}`). Pages made before 2.6 keep `/s/:space/:screen`;
 * the old `/s/:screen?m=<space>` links redirect there (`LegacyScreenRedirect`).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { SduiScreen } from '@fajekrina/sdui-r/react'
import type { SduiEngine, SduiProps } from '@fajekrina/sdui-r'
import { createSduiEngine } from '../sdui/engine'
import { DEFAULT_SCREEN, PAGE_SPACE, isMerchantId, screenPath, specScreenKey } from '../sdui/config'
import { currentCustomer, session, type Customer } from '../api/bff'

function toQuery(params: SduiProps): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== null && typeof v !== 'object') qs.set(k, String(v))
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** `/s/:screen`: a page; an old link `/s/:screen?m=<space>&…` → `/s/<space>/<screen>?…` */
export function LegacyScreenRedirect() {
  const { screen = DEFAULT_SCREEN } = useParams()
  const { search } = useLocation()
  const query = new URLSearchParams(search)
  const space = query.get('m')
  if (!space) return <ScreenPage />
  query.delete('m')
  const rest = query.toString()
  return <Navigate replace to={`${screenPath(space, specScreenKey(screen))}${rest ? `?${rest}` : ''}`} />
}

export default function ScreenPage() {
  // the Studio's one page space, or a page's older space
  const { merchantId: merchant = PAGE_SPACE, screen = DEFAULT_SCREEN } = useParams()
  const navigate = useNavigate()
  const { search } = useLocation()
  const seed = useMemo(() => Object.fromEntries(new URLSearchParams(search)), [search])
  const [engine, setEngine] = useState<SduiEngine>()
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [error, setError] = useState<string>()
  const valid = isMerchantId(merchant)
  // the Studio's page space holds the demo insights: a customer must be logged in (the feedback is
  // theirs); older spaces stay public
  const needsCustomer = merchant === PAGE_SPACE
  const [customer, setCustomer] = useState<Customer | null>()
  // the page on screen, sent with every request (`X-Sdui-Page`)
  const pageRef = useRef(screen)
  pageRef.current = specScreenKey(screen)

  useEffect(() => {
    if (!needsCustomer) { setCustomer(null); return }
    let alive = true
    void currentCustomer().then((c) => {
      if (!alive) return
      if (!c) navigate(`/login?next=${encodeURIComponent(`${screenPath(merchant, specScreenKey(screen))}${search}`)}`, { replace: true })
      else setCustomer(c)
    }).catch((e: Error) => alive && setError(e.message))
    return () => { alive = false }
  }, [needsCustomer, merchant, screen, search, navigate])

  useEffect(() => {
    let alive = true
    setEngine(undefined)
    setError(undefined)
    if (!valid) return
    if (!needsCustomer) void session().catch(() => undefined)   // guest session + CSRF for api actions
    createSduiEngine({
      merchantId: merchant,
      page: () => pageRef.current,
      navigate: (key, params) => navigate(`${screenPath(merchant, key)}${toQuery(params)}`),
      onEvent: (e) => { if (e.type === 'connectivity_changed') setOnline(e.online) }
    }).then(async (created) => {
      await created.refreshManifest().catch((e) => console.warn('[sdui-r] manifest', e))
      if (alive) setEngine(created)
    }).catch((e: Error) => alive && setError(e.message))
    return () => { alive = false }
  }, [merchant, navigate, valid, needsCustomer])

  const key = specScreenKey(screen)
  if (key !== screen) return <Navigate replace to={`${screenPath(merchant, key)}${search}`} />

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-6 py-3 text-sm">
        <strong className="text-slate-900">sdui-r · React + Tailwind</strong>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-600">{merchant === PAGE_SPACE ? screen : `${merchant} / ${screen}`}</span>
        {!online && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">Anda sedang offline — tampilan terakhir yang terverifikasi</span>}
        {customer && <Link to="/dashboard" className="text-teal-700 hover:underline">← Dashboard</Link>}
        {customer && <span className="ml-auto text-slate-500">{customer.name}</span>}
        <Link to="/studio" className={`${customer ? '' : 'ml-auto '}text-indigo-600 hover:underline`}>Studio →</Link>
      </header>
      <main className="mx-auto max-w-5xl">
        {!valid && <p className="p-6 text-red-600">Alamat halaman tidak valid: <code>{merchant}</code></p>}
        {error && <p className="p-6 text-red-600">{error}</p>}
        {needsCustomer && !customer ? <p className="p-6 text-slate-400">Memuat…</p> : engine ? <SduiScreen key={`${merchant}/${key}`} engine={engine} source={{ key }} seed={seed} /> : valid && !error && <p className="p-6 text-slate-400">Memuat…</p>}
      </main>
    </div>
  )
}
