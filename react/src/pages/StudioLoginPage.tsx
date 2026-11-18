/**
 * Dev stand-in for the workforce SSO (HLD Target §4.2): a name and ONE role.
 * The maker IS the merchant — its name is its merchant id; checkers and viewers see every
 * merchant. One role per login keeps maker and checker apart: approving needs another account.
 * A viewer only reads, so it signs in without a name.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROLES, studio, type Role } from '../api/studio'

const LABELS: Record<Role, [string, string]> = {
  SDUI_TEMPLATE_ADMIN: ['Admin template', 'membuat dan mengajukan template (Template Builder)'],
  SDUI_TEMPLATE_PUBLISHER: ['Checker template', 'menyetujui / menolak pengajuan template'],
  SDUI_AUTHOR: ['Maker (merchant)', 'menyusun screen merchant-nya dari template yang disetujui (Screen Builder)'],
  SDUI_PUBLISHER: ['Checker konten', 'menyetujui / menolak pengajuan screen semua merchant'],
  SDUI_VIEWER: ['Viewer', 'hanya melihat template dan screen']
}

export default function StudioLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<Role>()
  const [error, setError] = useState<string>()
  const maker = role === 'SDUI_AUTHOR'
  const viewer = role === 'SDUI_VIEWER'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!role) { setError('Pilih peran'); return }
    try {
      await studio.login(viewer ? '' : username.trim(), [role], [])
      navigate(studio.home())
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">sdui-r Studio — login (dev)</h1>
        <fieldset className="space-y-1 text-sm">
          <legend className="font-medium">Peran</legend>
          {ROLES.map((r) => (
            <label key={r} className="flex items-start gap-2">
              <input type="radio" name="role" className="mt-1" checked={role === r} onChange={() => setRole(r)} />
              <span><span className="font-medium">{LABELS[r][0]}</span> <span className="text-slate-500">— {LABELS[r][1]}</span></span>
            </label>
          ))}
          <p className="text-xs text-slate-500">Satu akun satu peran. Untuk menyetujui pengajuan, login sebagai akun lain dengan peran checker.</p>
        </fieldset>
        {role && !viewer && <label className="block text-sm">{maker ? 'Nama merchant' : 'Nama pengguna'}
          <input required pattern={maker ? '[A-Za-z][A-Za-z0-9_]{1,63}' : '[A-Za-z][A-Za-z0-9._\\-]{1,63}'} className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono"
            placeholder={maker ? 'mis. toko_baru' : 'mis. tia, tono'} value={username} onChange={(e) => setUsername(e.target.value)} />
          {maker && <span className="text-xs text-slate-500">Merchant contoh yang sudah berisi screen: <code>merchant_demo</code>, <code>merchant_promo</code>.</span>}
        </label>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-indigo-600 py-2 text-white hover:bg-indigo-700">Masuk</button>
      </form>
    </div>
  )
}
