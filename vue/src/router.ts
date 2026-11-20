import { createRouter, createWebHistory } from 'vue-router'
import ScreenPage from './pages/ScreenPage.vue'
import StudioLayout from './pages/StudioLayout.vue'
import StudioLoginPage from './pages/StudioLoginPage.vue'
import TemplatesPage from './pages/TemplatesPage.vue'
import PagesPage from './pages/PagesPage.vue'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN, PAGE_SPACE, screenPath, specScreenKey } from './sdui/config'

// HLD Target web §4.3: one generic SDUI route — `/s/<page>` (pages made before 2.6 keep
// `/s/<space>/<page>`). The Studio has two tabs, one editor in both: Template and Konten.
// Nothing in it belongs to a user.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: screenPath(DEFAULT_MERCHANT, DEFAULT_SCREEN) },
    {
      // a page made before 2.6, in its old space
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
      // a published page (no merchant / kanal / user in its address); old links `?m=<space>` → its old space
      path: '/s/:screen',
      component: ScreenPage,
      beforeEnter: (to) => {
        const { m, ...rest } = to.query
        const key = String(to.params.screen)
        if (typeof m === 'string') return { path: screenPath(m, specScreenKey(key)), query: rest, replace: true }
        const spec = specScreenKey(key)
        return spec === key ? true : { path: screenPath(PAGE_SPACE, spec), query: to.query, replace: true }
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
        // a page; an older page keeps its old space
        { path: 'pages/:key?', component: PagesPage },
        { path: 'pages/:space/:key', component: PagesPage },
        // old links (the former content tab, the Screen Builder) → the Konten tab
        { path: 'screens/:merchantId?/:key?', redirect: (to) => (to.params.merchantId && to.params.key ? `/studio/pages/${String(to.params.merchantId)}/${String(to.params.key)}` : '/studio/pages') },
        // an unknown Studio address stays in the Studio (not the customer app)
        { path: ':pathMatch(.*)*', redirect: '/studio/pages' }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
