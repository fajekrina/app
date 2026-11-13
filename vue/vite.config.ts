import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Same-origin BFFs (HLD Target AD-2): the app never calls a service directly.
export default defineConfig({
  plugins: [vue()],
  // the package is linked from ../../package: one Vue for app + package
  resolve: { dedupe: ['vue'] },
  server: {
    port: 5181,
    strictPort: true,
    proxy: {
      '/bff': { target: 'http://localhost:8110' },
      '/studio-bff': { target: 'http://localhost:8111' }
    }
  },
  test: { environment: 'jsdom' }
})
