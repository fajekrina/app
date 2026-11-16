import { createRouter, createWebHistory } from 'vue-router'
import ScreenPage from './pages/ScreenPage.vue'
import StudioLayout from './pages/StudioLayout.vue'
import StudioLoginPage from './pages/StudioLoginPage.vue'
import TemplatesPage from './pages/TemplatesPage.vue'
import ScreensPage from './pages/ScreensPage.vue'
import { DEFAULT_SCREEN, specScreenKey } from './sdui/config'

// HLD Target web §4.3: one generic SDUI route; the Studio has a page per builder.
export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: `/s/${DEFAULT_SCREEN}` },
    {
      path: '/s/:screen',
      component: ScreenPage,
      // old kebab-case keys (`seat-selection`) → the screen key, query kept
      beforeEnter: (to) => {
        const key = String(to.params.screen)
        const spec = specScreenKey(key)
        return spec === key ? true : { path: `/s/${spec}`, query: to.query, replace: true }
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
