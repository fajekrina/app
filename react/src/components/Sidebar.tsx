import { useState, type ReactNode } from 'react'

const KEY = 'sdui-r:studio-sidebar'
const read = () => { try { return localStorage.getItem(KEY) !== 'closed' } catch { return true } }

/**
 * The Studio's left panels (list + review requests), collapsible so the builder can use the
 * whole width. The choice is remembered per browser.
 */
export function Sidebar({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(read)
  const toggle = () => {
    setOpen(!open)
    try { localStorage.setItem(KEY, open ? 'closed' : 'open') } catch { /* private mode: not remembered */ }
  }
  return (
    <aside className="flex gap-2">
      {open && <div id="studio-sidebar" className="builder-pane w-[260px] min-w-0 space-y-3 overflow-y-auto overflow-x-hidden">{children}</div>}
      <button
        type="button"
        onClick={toggle}
        aria-controls="studio-sidebar"
        aria-expanded={open}
        title={open ? 'Tutup panel kiri' : 'Buka panel kiri'}
        className="builder-pane w-6 rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      >
        {open ? '«' : '»'}
      </button>
    </aside>
  )
}
