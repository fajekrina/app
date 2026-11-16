import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// The package is linked from ../../package and lives outside this root, so Vite would not
// see a rebuild: its chunk names carry a hash, and a stale import 404s (blank page).
// Watch its dist and reload the page when it changes.
const PACKAGE_DIST = fileURLToPath(new URL('../../package/dist', import.meta.url))
const slash = (p: string) => p.split('\\').join('/')
const watchPackage = (): Plugin => ({
  name: 'watch-sdui-r-package',
  configureServer(server) {
    server.watcher.add(PACKAGE_DIST)
    let timer: ReturnType<typeof setTimeout> | undefined
    server.watcher.on('all', (_event, file) => {
      if (!slash(file).startsWith(slash(PACKAGE_DIST))) return
      clearTimeout(timer)   // a build writes many files: reload once it settles
      timer = setTimeout(() => {
        server.moduleGraph.invalidateAll()
        server.ws.send({ type: 'full-reload' })
      }, 300)
    })
  }
})

// Same-origin BFFs (HLD Target AD-2): the app never calls a service directly.
export default defineConfig({
  plugins: [vue(), watchPackage()],
  // one Vue for app + package
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
