import { Navigate, createBrowserRouter, useParams } from 'react-router-dom'
import ScreenPage, { LegacyScreenRedirect } from './pages/ScreenPage'
import StudioLayout from './pages/StudioLayout'
import StudioLoginPage from './pages/StudioLoginPage'
import TemplatesPage from './pages/TemplatesPage'
import PagesPage from './pages/PagesPage'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN } from './sdui/config'

/** old links (the former content tab, the Screen Builder) → the Konten tab */
function LegacyScreensRedirect() {
  const { merchantId, key } = useParams()
  return <Navigate to={merchantId ? `/studio/pages/${merchantId}${key ? `/${key}` : ''}` : '/studio/pages'} replace />
}

/** `/studio/templates/:key/:tab` (the old Desain / Isi konten tabs) → the template */
function LegacyTabRedirect() {
  const { key } = useParams()
  return <Navigate to={`/studio/templates/${key}`} replace />
}

// HLD Target web §4.3: one generic SDUI route. The Studio has two tabs: Template (the shared
// templates) and Konten (the pages of a kanal), one editor in both.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to={`/s/${DEFAULT_MERCHANT}/${DEFAULT_SCREEN}`} replace /> },
  // a kanal's published page
  { path: '/s/:merchantId/:screen', element: <ScreenPage /> },
  // old links: /s/:screen?m=<kanal> → /s/<kanal>/<screen>
  { path: '/s/:screen', element: <LegacyScreenRedirect /> },
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
      { path: 'pages/:kanal', element: <PagesPage /> },
      { path: 'pages/:kanal/:key', element: <PagesPage /> },
      { path: 'screens', element: <LegacyScreensRedirect /> },
      { path: 'screens/:merchantId', element: <LegacyScreensRedirect /> },
      { path: 'screens/:merchantId/:key', element: <LegacyScreensRedirect /> },
      // an unknown Studio address stays in the Studio (not the customer app)
      { path: '*', element: <Navigate to="/studio/pages" replace /> }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
])
