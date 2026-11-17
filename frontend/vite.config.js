import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const offlineShell = {
  name: 'assignmenttracker-offline-shell',
  apply: 'build',
  async writeBundle({ dir }, bundle) {
    const script = await readFile(new URL('./offline-worker.js', import.meta.url), 'utf8')
    const assets = ['/', '/appearance-init.js', ...Object.keys(bundle).filter(name => name.startsWith('assets/')).map(name => '/' + name)]
    const revision = createHash('sha256').update(script + JSON.stringify(assets) + await readFile(resolve(dir, 'index.html'), 'utf8')).digest('hex').slice(0, 16)
    await writeFile(resolve(dir, 'offline-worker.js'), script.replace('__REVISION__', revision).replace('__ASSETS__', JSON.stringify(assets)))
  }
}

export default defineConfig({
  plugins: [react(), offlineShell],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
        configure(proxy) {
          proxy.on('error', (_error, _request, response) => {
            if (!response || typeof response.writeHead !== 'function' || response.headersSent || response.destroyed) return
            response.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
            response.end(JSON.stringify({ message: 'The API server is unavailable or restarting. Stop this frontend with Ctrl+C, then run npm run dev:frontend in frontend to start both services. If using dev:frontend-only, start the backend separately. Check the backend output for startup errors, then retry.' }))
          })
        },
      }
    }
  }
})
