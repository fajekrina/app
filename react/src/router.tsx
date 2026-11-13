import { Navigate, createBrowserRouter } from 'react-router-dom'
import ScreenPage from './pages/ScreenPage'
import StudioLayout from './pages/StudioLayout'
import StudioLoginPage from './pages/StudioLoginPage'
import TemplatesPage from './pages/TemplatesPage'
import ScreensPage from './pages/ScreensPage'
import { DEFAULT_SCREEN } from './sdui/config'

// HLD Target web §4.3: one generic SDUI route; the Studio has a page per builder.
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to={`/s/${DEFAULT_SCREEN}`} replace /> },
  { path: '/s/:screen', element: <ScreenPage /> },
  { path: '/studio/login', element: <StudioLoginPage /> },
  {
    path: '/studio',
    element: <StudioLayout />,
    children: [
      { index: true, element: <Navigate to="screens" replace /> },
      { path: 'templates', element: <TemplatesPage /> },
      { path: 'templates/:key', element: <TemplatesPage /> },
      { path: 'screens', element: <ScreensPage /> },
      { path: 'screens/:merchantId/:key', element: <ScreensPage /> }
    ]
  },
  { path: '*', element: <Navigate to="/" replace /> }
])
