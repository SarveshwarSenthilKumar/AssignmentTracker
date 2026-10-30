import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { createServer } from 'vite'

const frontend = fileURLToPath(new URL('../', import.meta.url))
const backend = fileURLToPath(new URL('../../backend/', import.meta.url))
const requireBackend = createRequire(new URL('../../backend/package.json', import.meta.url))
let vite, api, closing = false
async function close(code = 0) {
  if (closing) return
  closing = true
  api?.kill()
  await vite?.close()
  process.exitCode = code
}
try {
  // Read backend configuration without printing credentials or changing the shell.
  const { config } = requireBackend('dotenv')
  config({ path: fileURLToPath(new URL('../../backend/.env', import.meta.url)) })
  process.env.API_PROXY_TARGET ||= `http://127.0.0.1:${process.env.PORT || '5000'}`
  const nodemon = requireBackend.resolve('nodemon/bin/nodemon.js')
  api = spawn(process.execPath, [nodemon, 'server.js'], { cwd: backend, env: process.env, stdio: 'inherit', windowsHide: true })
  api.on('error', error => {
    process.stderr.write(`Could not start the backend: ${error.message}\n`)
    void close(1)
  })
  api.on('exit', code => {
    if (!closing) {
      process.stderr.write('The backend stopped. Resolve the startup error above and restart npm run dev.\n')
      void close(code || 1)
    }
  })
  vite = await createServer({ root: frontend })
  if (closing) await vite.close()
  else { await vite.listen(); vite.printUrls() }
} catch (error) {
  process.stderr.write(`Development startup failed: ${error.message}\nInstall dependencies in both backend and frontend before starting.\n`)
  await close(1)
}
process.on('SIGINT', () => void close())
process.on('SIGTERM', () => void close())
