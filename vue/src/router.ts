import { createRouter, createWebHistory } from 'vue-router'
import ScreenPage from './pages/ScreenPage.vue'
import StudioLayout from './pages/StudioLayout.vue'
import StudioLoginPage from './pages/StudioLoginPage.vue'
import TemplatesPage from './pages/TemplatesPage.vue'
import PagesPage from './pages/PagesPage.vue'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN, screenPath, specScreenKey } from './sdui/config'

// HLD Target web §4.3: one generic SDUI route. The Studio has two tabs: Template (the shared
// templates) and Konten (the pages of a kanal), one editor in both.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: screenPath(DEFAULT_MERCHANT, DEFAULT_SCREEN) },
    {
      // a kanal's published page
      path: '/s/:merchantId/:screen',
      component: ScreenPage,
      // old kebab-case keys (`seat-selection`) → the screen key, query kept
      beforeEnter: (to) => {
        const key = String(to.params.screen)
        const spec = specScreenKey(key)
        return spec === key ? true : { path: screenPath(String(to.params.merchantId), spec), query: to.query, replace: true }
      }
    },
    {
      // old links: /s/:screen?m=<kanal> → /s/<kanal>/<screen>
      path: '/s/:screen',
      redirect: (to) => {
        const { m, ...rest } = to.query
        return { path: screenPath(typeof m === 'string' ? m : DEFAULT_MERCHANT, specScreenKey(String(to.params.screen))), query: rest }
      }
    },
    { path: '/studio/login', component: StudioLoginPage },
    {
      path: '/studio',
      component: StudioLayout,
      children: [
        { path: '', redirect: '/studio/pages' },
        { path: 'templates/:key?', component: TemplatesPage },
        // the old Desain / Isi konten tabs → the template
        { path: 'templates/:key/:tab', redirect: (to) => `/studio/templates/${String(to.params.key)}` },
        { path: 'pages/:kanal?/:key?', component: PagesPage },
        // old links (the former content tab, the Screen Builder) → the Konten tab
        { path: 'screens/:merchantId?/:key?', redirect: (to) => (to.params.merchantId ? `/studio/pages/${String(to.params.merchantId)}${to.params.key ? `/${String(to.params.key)}` : ''}` : '/studio/pages') },
        // an unknown Studio address stays in the Studio (not the customer app)
        { path: ':pathMatch(.*)*', redirect: '/studio/pages' }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
