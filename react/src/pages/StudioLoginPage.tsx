/**
 * Dev stand-in for the workforce SSO (HLD Target §4.2). One Studio role — the template
 * admin — so the login only asks for a name: the admin IS the merchant, its name is the
 * merchant id. Each admin sees and edits only its own templates and pages.
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
      navigate('/studio/templates')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow">
        <h1 className="text-lg font-semibold">sdui-r Studio — login admin (dev)</h1>
        <label className="block text-sm">Nama admin (= ID merchant)
          <input required pattern="[A-Za-z][A-Za-z0-9_]{1,63}" className="mt-1 w-full rounded border border-slate-300 px-2 py-1 font-mono"
            placeholder="mis. toko_baru" value={username} onChange={(e) => setUsername(e.target.value)} />
          <span className="text-xs text-slate-500">Huruf, angka dan _ . Admin hanya melihat template dan halaman miliknya. Contoh yang sudah berisi: <code>merchant_demo</code>, <code>merchant_promo</code>.</span>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button className="w-full rounded bg-indigo-600 py-2 text-white hover:bg-indigo-700">Masuk</button>
      </form>
    </div>
  )
}
