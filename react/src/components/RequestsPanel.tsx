import { useState } from 'react'
import type { RequestRow } from '../api/studio'

/** Pending review requests: the checker approves / rejects; the requester may withdraw. */
export function RequestsPanel(props: {
  title: string
  rows: RequestRow[]
  me: string
  canDecide: boolean
  onDecide: (id: number, decision: 'approve' | 'reject' | 'withdraw', reason?: string) => Promise<void>
}) {
  const [busy, setBusy] = useState<number>()
  const [error, setError] = useState<string>()
  const act = async (id: number, decision: 'approve' | 'reject' | 'withdraw') => {
    const reason = decision === 'reject' ? window.prompt('Alasan penolakan') ?? undefined : undefined
    if (decision === 'reject' && !reason) return
    setBusy(id)
    setError(undefined)
    try { await props.onDecide(id, decision, reason) } catch (e) { setError((e as Error).message) } finally { setBusy(undefined) }
  }
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <h3 className="mb-2 font-semibold">{props.title}</h3>
      {props.rows.length === 0 && <p className="text-slate-400">Tidak ada pengajuan.</p>}
      <ul className="space-y-2">
        {props.rows.map((r) => {
          const own = r.requestedBy === props.me
          return (
            <li key={r.id} className="rounded border border-slate-100 p-2">
              <div className="flex items-center gap-2">
                <span className="font-mono">{r.key}</span>
                <span className="text-slate-400">rev {r.revision} · {r.requestedBy.replace(/^workforce:/, '')}</span>
              </div>
              {r.note && <p className="text-slate-600">“{r.note}”</p>}
              <div className="mt-1 flex gap-2">
                {props.canDecide && !own && <button disabled={busy === r.id} className="rounded bg-emerald-600 px-2 py-0.5 text-white" onClick={() => void act(r.id, 'approve')}>Setujui & terbitkan</button>}
                {props.canDecide && !own && <button disabled={busy === r.id} className="rounded bg-red-50 px-2 py-0.5 text-red-700" onClick={() => void act(r.id, 'reject')}>Tolak</button>}
                {own && <button disabled={busy === r.id} className="rounded bg-slate-100 px-2 py-0.5" onClick={() => void act(r.id, 'withdraw')}>Tarik pengajuan</button>}
                {(own || !props.canDecide) && <span className="text-xs text-slate-400">menunggu persetujuan checker</span>}
              </div>
            </li>
          )
        })}
      </ul>
      {error && <p className="mt-2 text-red-600">{error}</p>}
    </section>
  )
}
