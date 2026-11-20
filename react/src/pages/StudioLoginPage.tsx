/**
 * Dev stand-in for the workforce SSO (HLD Target §4.2). Studio users are internal: one role,
 * so the login only asks for a name (a person, not a kanal). Every user sees the shared
 * templates and every kanal's pages, and publishes without a review step.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { studio } from '../api/studio'

export default function StudioLoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string>()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await studio.login(username.trim())
      navigate('/studio/pages')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">sdui-r Studio — masuk (dev)</h1>
        <label className="block text-sm">Nama pengguna
          <input required pattern="[A-Za-z][A-Za-z0-9._\-]{1,63}" className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
            placeholder="mis. fajrina" value={username} onChange={(e) => setUsername(e.target.value)} />
          <span className="text-xs text-slate-500">Huruf, angka, titik, _ atau -. Semua pengguna memakai template yang sama dan mengelola halaman semua kanal.</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-indigo-600 py-2 text-white hover:bg-indigo-700">Masuk</button>
      </form>
    </div>
  )
}
