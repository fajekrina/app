import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { studio, type Me } from '../api/studio'

/** Studio shell: needs a studio-bff session; links to the two builders. */
export default function StudioLayout() {
  const navigate = useNavigate()
  const [me, setMe] = useState<Me | undefined>(studio.current())
  useEffect(() => {
    if (me) return
    void studio.restore().then((m) => (m ? setMe(m) : navigate('/studio/login', { replace: true })))
  }, [me, navigate])
  if (!me) return null
  const tab = ({ isActive }: { isActive: boolean }) => `rounded px-3 py-1 ${isActive ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 text-sm">
        <strong>sdui-r Studio</strong>
        <NavLink to="/studio/templates" className={tab}>Template Builder (admin)</NavLink>
        <NavLink to="/studio/screens" className={tab}>Screen Builder (maker)</NavLink>
        <span className="ml-auto text-slate-500">{me.name} · {me.roles.join(', ')}</span>
        <Link to="/" className="text-indigo-600">App →</Link>
        <button className="text-slate-500 hover:text-red-600" onClick={() => void studio.logout().then(() => navigate('/studio/login'))}>Keluar</button>
      </header>
      <Outlet />
    </div>
  )
}
