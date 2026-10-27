import {readApiJson} from '../lib/apiResponse'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Loader2 } from 'lucide-react'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if(loading)return
    setError('')
    setLoading(true)

    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),20000)
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const body = isLogin
        ? { email:email.trim().toLowerCase(), password }
        : { username:username.trim(), email:email.trim().toLowerCase(), password }

      const response = await fetch(endpoint, {
        method: 'POST',
        signal:controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await readApiJson(response)

      if (!response.ok) {
        throw new Error((typeof data?.message==='string'&&data.message) || 'Authentication failed')
      }

      if(typeof data?.token!=='string'||!data.token||!data.user||typeof data.user.id!=='string')throw new Error('The sign-in service returned an incomplete response. Restart the backend and try again.')
      login(data.token, data.user)
    } catch (err) {
      setError(err.name==='AbortError'?'Sign-in timed out. Check that the backend and database are running, then try again.':err instanceof TypeError?'Could not reach the sign-in service. Check your connection and that the backend is running.':err.message)
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold text-white mb-2 tracking-tight">
            Assignment Tracker
          </h1>
          <p className="text-slate-400 text-lg">
            {isLogin ? 'Sign in to your workspace' : 'Create your account'}
          </p>
        </div>

        <div className="auth-card bg-white/5 border border-white/10 rounded-2xl p-8">
          {error && (
            <div role="alert" className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label htmlFor="auth-username" className="block text-slate-400 mb-2 text-sm">Username</label>
                <input
                  type="text"
                  id="auth-username" autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-slate-400 mb-2 text-sm">Email</label>
              <input
                type="email"
                id="auth-email" autoComplete="email"
                  value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-slate-400 mb-2 text-sm">Password</label>
              <input
                type="password"
                id="auth-password" autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
                minLength="6"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-800 text-white rounded-xl font-medium transition-all   flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setError('')
              }}
              className="text-slate-400 hover:text-white transition-colors"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
