import { Navigate, createBrowserRouter } from 'react-router-dom'
import ScreenPage, { LegacyScreenRedirect } from './pages/ScreenPage'
import StudioLayout from './pages/StudioLayout'
import StudioLoginPage from './pages/StudioLoginPage'
import TemplatesPage from './pages/TemplatesPage'
import ScreensPage from './pages/ScreensPage'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN } from './sdui/config'
import { studio } from './api/studio'

/// `/studio` → the first builder the roles may open
function StudioHome() { return <Navigate to={studio.home()} replace /> }

// HLD Target web §4.3: one generic SDUI route; the Studio has a page per builder.
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
      { index: true, element: <StudioHome /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'templates/:key', element: <TemplatesPage /> },
      { path: 'screens', element: <ScreensPage /> },
      // a checker / viewer picks a merchant first (no screen yet)
      { path: 'screens/:merchantId', element: <ScreensPage /> },
      { path: 'screens/:merchantId/:key', element: <ScreensPage /> },
      // an unknown Studio address stays in the Studio (not the customer app)
      { path: '*', element: <StudioHome /> }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
])
