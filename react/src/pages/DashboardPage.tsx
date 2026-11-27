/**
 * The customer dashboard (an app page, not SDUI): tick simulated activities ("Sering beli kopi
 * bulan ini") and the insights they bring up appear, each with this customer's 👍 / 👎. Opening
 * one shows the SDUI insight page made in the Studio's Konten tab.
 */
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { activities as loadActivities, currentCustomer, customerLogout, insights as loadInsights, resetFeedback, tickActivities, type Activity, type Customer, type Insight } from '../api/bff'
import { LANGUAGES, appLanguages, screenPath, setAppLanguage, PAGE_SPACE } from '../sdui/config'

const VOTE: Record<Insight['vote'], [string, string]> = {
  like: ['👍 Kamu suka', 'bg-green-100 text-green-800'],
  dislike: ['👎 Kurang suka', 'bg-rose-100 text-rose-800'],
  '': ['Belum ada feedback', 'bg-slate-100 text-slate-600']
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [me, setMe] = useState<Customer | null>()
  const [list, setList] = useState<Activity[]>([])
  const [ticked, setTicked] = useState<string[]>([])
  const [shown, setShown] = useState<Insight[]>([])
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string>()
  // the language insight pages open in (spec 2.8; a page without it shows its default texts)
  const [language, setLanguage] = useState(() => LANGUAGES.find((l) => appLanguages().some((w) => w.split('-')[0] === l.code))?.code ?? 'id')

  const reload = useCallback(async () => {
    const [a, i] = await Promise.all([loadActivities(), loadInsights()])
    setList(a.activities)
    setTicked(a.codes)
    setShown(i)
  }, [])

  useEffect(() => {
    void currentCustomer().then((c) => {
      if (!c) { navigate('/login?next=/dashboard', { replace: true }); return }
      setMe(c)
      return reload()
    }).catch((e: Error) => setError(e.message))
  }, [navigate, reload])

  const toggle = async (code: string) => {
    const next = ticked.includes(code) ? ticked.filter((c) => c !== code) : [...ticked, code]
    setSaving(true)
    try {
      await tickActivities(next)
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // demo: forget every vote of this customer (the insights stay; they open with no choice again)
  const reset = async () => {
    if (!window.confirm('Hapus semua feedback 👍 / 👎 yang sudah kamu berikan?')) return
    setSaving(true)
    setNotice(undefined)
    try {
      const { deleted } = await resetFeedback()
      setNotice(deleted ? `${deleted} feedback dihapus.` : 'Belum ada feedback untuk dihapus.')
      await reload()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const logout = async () => {
    await customerLogout().catch(() => undefined)
    navigate('/login', { replace: true })
  }

  if (!me) return <p className="p-6 text-slate-400">{error ?? 'Memuat…'}</p>
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-teal-100 px-6 pb-8 pt-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div>
            <p className="text-sm text-slate-600">Halo,</p>
            <h1 className="text-xl font-bold text-slate-900">{me.name}</h1>
          </div>
          <select aria-label="Bahasa" value={language} onChange={(e) => { setAppLanguage(e.target.value); setLanguage(e.target.value) }} className="ml-auto rounded-full bg-white px-3 py-1 text-sm text-slate-700 shadow-sm">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={logout} className="rounded-full bg-white px-4 py-1 text-sm text-slate-700 shadow-sm hover:bg-slate-50">Keluar</button>
        </div>
      </header>
      <main className="mx-auto -mt-4 max-w-3xl space-y-6 px-4 pb-10">
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-slate-900">Simulasi aktivitas</h2>
          <p className="mb-3 text-sm text-slate-500">Centang aktivitas yang seolah-olah kamu lakukan; insight yang cocok akan muncul di bawah.</p>
          <ul className="space-y-2">
            {list.map((a) => (
              <li key={a.code}>
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                  <input type="checkbox" className="mt-1" checked={ticked.includes(a.code)} disabled={saving} onChange={() => void toggle(a.code)} />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{a.title}</span>
                    <span className="block text-xs text-slate-500">{a.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="font-semibold text-slate-900">Insight untukmu</h2>
            <button onClick={() => void reset()} disabled={saving}
              className="ml-auto rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              Reset feedback
            </button>
          </div>
          {notice && <p role="status" className="mb-3 rounded-lg bg-teal-50 p-2 text-sm text-teal-800">{notice}</p>}
          {shown.length === 0
            ? <p className="text-sm text-slate-500">Belum ada insight. Centang aktivitas di atas.</p>
            : (
              <ul className="space-y-3">
                {shown.map((i) => (
                  <li key={i.page}>
                    <Link to={screenPath(PAGE_SPACE, i.page)} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-teal-300 hover:bg-teal-50">
                      <span className="flex-1">
                        <span className="block font-medium text-slate-900">{i.title}</span>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${VOTE[i.vote][1]}`}>{VOTE[i.vote][0]}</span>
                      </span>
                      <span aria-hidden="true" className="text-slate-400">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </section>
      </main>
    </div>
  )
}
