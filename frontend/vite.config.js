import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
