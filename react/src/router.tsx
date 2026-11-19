import { Navigate, createBrowserRouter, useParams } from 'react-router-dom'
import ScreenPage, { LegacyScreenRedirect } from './pages/ScreenPage'
import StudioLayout from './pages/StudioLayout'
import StudioLoginPage from './pages/StudioLoginPage'
import TemplatesPage from './pages/TemplatesPage'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN } from './sdui/config'

/** old links (Screen Builder, the former content tab): a page IS its template → its editor */
function LegacyScreensRedirect() {
  const { key } = useParams()
  return <Navigate to={key ? `/studio/templates/${key}` : '/studio/templates'} replace />
}

// HLD Target web §4.3: one generic SDUI route; the Studio is one page per template: one editor
// for its design and content, one Terbitkan.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to={`/s/${DEFAULT_MERCHANT}/${DEFAULT_SCREEN}`} replace /> },
  // a merchant's published page
  { path: '/s/:merchantId/:screen', element: <ScreenPage /> },
  // old links: /s/:screen?m=<merchant> → /s/<merchant>/<screen>
  { path: '/s/:screen', element: <LegacyScreenRedirect /> },
  { path: '/studio/login', element: <StudioLoginPage /> },
  {
    path: '/studio',
    element: <StudioLayout />,
    children: [
      { index: true, element: <Navigate to="/studio/templates" replace /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'templates/:key', element: <TemplatesPage /> },
      { path: 'templates/:key/:tab', element: <LegacyScreensRedirect /> },
      { path: 'screens', element: <LegacyScreensRedirect /> },
      { path: 'screens/:merchantId', element: <LegacyScreensRedirect /> },
      { path: 'screens/:merchantId/:key', element: <LegacyScreensRedirect /> },
      // an unknown Studio address stays in the Studio (not the customer app)
      { path: '*', element: <Navigate to="/studio/templates" replace /> }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
])
