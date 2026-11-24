/**
 * The customer login (demo): a customer id and a password, checked by customer-service through
 * web-bff. It is not the Studio login — a separate session (cookie `sdui_web_sess`), separate users.
 */
import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { customerLogin } from '../api/bff'

/** only an address inside this app (never another host) */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/studio') ? next : '/dashboard'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await customerLogin(username.trim(), password)
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-teal-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Masuk</h1>
          <p className="text-sm text-slate-500">Aplikasi nasabah (demo insight)</p>
        </div>
        <label className="block text-sm">Nama pengguna
          <input required autoComplete="username" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="block text-sm">Password
          <input required type="password" autoComplete="current-password" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button disabled={busy} className="w-full rounded-full bg-teal-400 py-2 font-semibold text-slate-900 hover:bg-teal-500 disabled:opacity-60">
          {busy ? 'Memeriksa…' : 'Masuk'}
        </button>
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Akun demo: <b>andi</b> atau <b>sari</b>, password <b>demo123</b>.</p>
      </form>
    </div>
  )
}
