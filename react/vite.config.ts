import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Same-origin BFFs (HLD Target AD-2): the app never calls a service directly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // the package is linked from ../../package: one React for app + package
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    port: 5180,
    strictPort: true,
    proxy: {
      '/bff': { target: 'http://localhost:8110' },
      '/studio-bff': { target: 'http://localhost:8111' }
    }
  },
  test: { environment: 'jsdom' }
})
