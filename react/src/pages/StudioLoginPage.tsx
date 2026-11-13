/**
 * Dev stand-in for the workforce SSO (HLD Target §4.2): a name and the roles to hold.
 * Template Builder: SDUI_TEMPLATE_ADMIN (maker) / SDUI_TEMPLATE_PUBLISHER (checker).
 * Screen Builder: SDUI_AUTHOR (maker) / SDUI_PUBLISHER (checker).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLES, studio, type Role } from '../api/studio'
import { MERCHANTS } from '../sdui/config'

const LABELS: Record<Role, string> = {
  SDUI_TEMPLATE_ADMIN: 'Admin template (Template Builder)',
  SDUI_TEMPLATE_PUBLISHER: 'Checker template',
  SDUI_AUTHOR: 'Maker konten (Screen Builder)',
  SDUI_PUBLISHER: 'Checker konten',
  SDUI_VIEWER: 'Viewer'
}

export default function StudioLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('ana')
  const [roles, setRoles] = useState<Role[]>(['SDUI_AUTHOR'])
  const [merchants, setMerchants] = useState<string[]>([...MERCHANTS])
  const [error, setError] = useState<string>()
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const me = await studio.login(username, roles, merchants)
      navigate(me.roles.some((r) => r.startsWith('SDUI_TEMPLATE')) ? '/studio/templates' : '/studio/screens')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">sdui-r Studio — login (dev)</h1>
        <label className="block text-sm">Nama pengguna
          <input className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium">Peran</legend>
          {ROLES.map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input type="checkbox" checked={roles.includes(r)} onChange={() => setRoles(toggle(roles, r))} />
              {LABELS[r]} <code className="text-xs text-slate-400">{r}</code>
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium">Merchant</legend>
          {MERCHANTS.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="checkbox" checked={merchants.includes(m)} onChange={() => setMerchants(toggle(merchants, m))} /> {m}
            </label>
          ))}
        </fieldset>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-indigo-600 py-2 text-white hover:bg-indigo-700">Masuk</button>
        <p className="text-xs text-slate-500">Maker-checker: pengaju tidak bisa menyetujui perubahannya sendiri — login sebagai pengguna lain untuk menyetujui.</p>
      </form>
    </div>
  )
}
