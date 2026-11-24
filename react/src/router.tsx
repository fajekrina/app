import { Navigate, createBrowserRouter, useParams } from 'react-router-dom'
import ScreenPage, { LegacyScreenRedirect } from './pages/ScreenPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import StudioLayout from './pages/StudioLayout'
import StudioLoginPage from './pages/StudioLoginPage'
import TemplatesPage from './pages/TemplatesPage'
import PagesPage from './pages/PagesPage'

/** old links (the former content tab, the Screen Builder) → the Konten tab */
function LegacyScreensRedirect() {
  const { merchantId, key } = useParams()
  return <Navigate to={merchantId && key ? `/studio/pages/${merchantId}/${key}` : '/studio/pages'} replace />
}

/** `/studio/templates/:key/:tab` (the old Desain / Isi konten tabs) → the template */
function LegacyTabRedirect() {
  const { key } = useParams()
  return <Navigate to={`/studio/templates/${key}`} replace />
}

// HLD Target web §4.3: one generic SDUI route — `/s/<page>` (pages made before 2.6 keep
// `/s/<space>/<page>`). The Studio has two tabs, one editor in both: Template and Konten.
// Nothing in it belongs to a user.
export const router = createBrowserRouter([
  // the customer app: its own login (not the Studio's), the dashboard, then the insight pages
  { path: '/', element: <Navigate to="/dashboard" replace /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/dashboard', element: <DashboardPage /> },
  // a published page (no merchant / kanal / user in its address)
  { path: '/s/:screen', element: <LegacyScreenRedirect /> },
  // a page made before 2.6, in its old space
  { path: '/s/:merchantId/:screen', element: <ScreenPage /> },
  { path: '/studio/login', element: <StudioLoginPage /> },
  {
    path: '/studio',
    element: <StudioLayout />,
    children: [
      { index: true, element: <Navigate to="/studio/pages" replace /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'templates/:key', element: <TemplatesPage /> },
      { path: 'templates/:key/:tab', element: <LegacyTabRedirect /> },
      { path: 'pages', element: <PagesPage /> },
      // a page; an older page keeps its old space
      { path: 'pages/:key', element: <PagesPage /> },
      { path: 'pages/:space/:key', element: <PagesPage /> },
      { path: 'screens', element: <LegacyScreensRedirect /> },
      { path: 'screens/:merchantId', element: <LegacyScreensRedirect /> },
      { path: 'screens/:merchantId/:key', element: <LegacyScreensRedirect /> },
      // an unknown Studio address stays in the Studio (not the customer app)
      { path: '*', element: <Navigate to="/studio/pages" replace /> }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
])
