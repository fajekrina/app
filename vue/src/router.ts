import { createRouter, createWebHistory } from 'vue-router'
import ScreenPage from './pages/ScreenPage.vue'
import StudioLayout from './pages/StudioLayout.vue'
import StudioLoginPage from './pages/StudioLoginPage.vue'
import TemplatesPage from './pages/TemplatesPage.vue'
import ScreensPage from './pages/ScreensPage.vue'
import { DEFAULT_MERCHANT, DEFAULT_SCREEN, screenPath, specScreenKey } from './sdui/config'

// HLD Target web §4.3: one generic SDUI route; the Studio has a page per builder.
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
        { path: '', component: { render: () => null } },   // StudioLayout sends it to the role's builder
        { path: 'templates/:key?', component: TemplatesPage },
        { path: 'screens/:merchantId?/:key?', component: ScreensPage }
      ]
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
