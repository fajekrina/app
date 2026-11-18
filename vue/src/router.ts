import { createRouter, createWebHistory } from 'vue-router'
import ScreenPage from './pages/ScreenPage.vue'
import StudioLayout from './pages/StudioLayout.vue'
import StudioLoginPage from './pages/StudioLoginPage.vue'
import TemplatesPage from './pages/TemplatesPage.vue'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN, screenPath, specScreenKey } from './sdui/config'

// HLD Target web §4.3: one generic SDUI route; the Studio is one page per template with a
// design tab and a content tab (the admin fills the page's values there).
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: screenPath(DEFAULT_MERCHANT, DEFAULT_SCREEN) },
    {
      // a merchant's published page
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
      // old links: /s/:screen?m=<merchant> → /s/<merchant>/<screen>
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
        { path: '', redirect: '/studio/templates' },
        { path: 'templates/:key?/:tab?', component: TemplatesPage },
        // old Screen Builder links: a page IS its template → its content tab
        { path: 'screens/:merchantId?/:key?', redirect: (to) => (to.params.key ? `/studio/templates/${String(to.params.key)}/content` : '/studio/templates') },
        // an unknown Studio address stays in the Studio (not the customer app)
        { path: ':pathMatch(.*)*', redirect: '/studio/templates' }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
