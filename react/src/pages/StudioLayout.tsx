import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { studio, type Me } from '../api/studio'
import { DEFAULT_SCREEN, screenPath } from '../sdui/config'

/** Studio shell: needs a studio-bff session (one role: the template admin of its merchant). */
export default function StudioLayout() {
  const navigate = useNavigate()
  const [me, setMe] = useState<Me | undefined>(studio.current())
  useEffect(() => {
    if (me) return
    void studio.restore().then((m) => (m ? setMe(m) : navigate('/studio/login', { replace: true })))
  }, [me, navigate])
  if (!me) return null
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <strong>sdui-r Studio</strong>
        <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-mono text-xs text-indigo-700" title="Admin template — merchant">{me.merchantId}</span>
        <Link to={screenPath(me.merchantId, DEFAULT_SCREEN)} className="ml-auto text-indigo-600">Lihat halaman merchant →</Link>
        <button className="text-slate-500 hover:text-red-600" onClick={() => void studio.logout().then(() => navigate('/studio/login'))}>Keluar</button>
      </header>
      <Outlet />
    </div>
  )
}
