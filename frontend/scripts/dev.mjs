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
process.on('SIGINT', () => void close())
process.on('SIGTERM', () => void close())
try {
  // Read backend configuration without printing credentials or changing the shell.
  const { config } = requireBackend('dotenv')
  config({ path: fileURLToPath(new URL('../../backend/.env', import.meta.url)) })
  process.env.API_PROXY_TARGET ||= `http://127.0.0.1:${process.env.PORT || '5000'}`
  // Launch the actual server directly: a watcher can stay alive after its
  // child crashes, incorrectly making startup appear successful.
  api = spawn(process.execPath, ['server.js'], { cwd: backend, env: process.env, stdio: ['inherit','inherit','inherit','ipc'], windowsHide: true })
  const ready = new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('The backend did not finish startup within 30 seconds. Check its output above.')),30000)
    const finish=callback=>value=>{clearTimeout(timer);callback(value)}
    api.once('error',finish(reject))
    api.once('exit',finish(()=>reject(new Error('The backend exited before it was ready. The actual startup error is printed above.'))))
    api.on('message',message=>{if(message?.type==='api-ready'){clearTimeout(timer);resolve()}})
  })
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
  process.stderr.write('Starting backend; waiting for the API listener…\n')
  await ready
  if(closing)throw new Error('Startup was cancelled.')
  vite = await createServer({ root: frontend })
  if (closing) await vite.close()
  else { await vite.listen(); vite.printUrls() }
} catch (error) {
  process.stderr.write(`Development startup failed: ${error.message}\nCheck backend/.env and install dependencies in both backend and frontend.\n`)
  await close(1)
}
