import SignupTermsReview from './SignupTermsReview'
import {TERMS_VERSION} from './TermsPage'
import {readApiJson} from '../lib/apiResponse'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true)
  const [termsReviewed,setTermsReviewed]=useState(false),[termsAccepted,setTermsAccepted]=useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if(loading)return
    if(!isLogin&&(!termsReviewed||!termsAccepted)){setError('Review the Terms and Conditions and agree before creating your account.');return}
    setError('')
    setFieldErrors({})
    setLoading(true)

    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),20000)
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register'
      const identifier = email.trim()
      const body = isLogin
        ? { identifier, password, ...(/^[^\s@]+@[^\s@]+$/.test(identifier) && { email: identifier.toLowerCase() }) }
        : { username:username.trim(), email:email.trim().toLowerCase(), password,termsReviewed,termsAccepted,termsVersion:TERMS_VERSION }

      const response = await fetch(endpoint, {
        method: 'POST',
        signal:controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await readApiJson(response)

      if (!response.ok) {
        if (!isLogin && response.status === 409 && data.fieldErrors) setFieldErrors(data.fieldErrors)
        if (isLogin && response.status === 400 && data?.message === 'Email and password are required') {
          throw new Error('This backend only supports email sign-in. Use your email or update and restart the backend to sign in with a username.')
        }
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
                  aria-invalid={!!fieldErrors.username}
                  aria-describedby={fieldErrors.username ? 'auth-username-error' : undefined}
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setFieldErrors(previous => ({ ...previous, username: undefined })) }}
                  placeholder="Choose a username"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  required
                />
                {fieldErrors.username && <p id="auth-username-error" className="mt-2 text-sm text-red-400">{fieldErrors.username}</p>}
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-slate-400 mb-2 text-sm">{isLogin ? 'Username or email' : 'Email'}</label>
              <input
                type={isLogin ? 'text' : 'email'}
                id="auth-email" autoComplete={isLogin ? 'username' : 'email'}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'auth-email-error' : undefined}
                autoCapitalize="none"
                spellCheck={false}
                  value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors(previous => ({ ...previous, email: undefined })) }}
                placeholder={isLogin ? 'Username or email' : 'your@email.com'}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
              />
              {fieldErrors.email && <p id="auth-email-error" className="mt-2 text-sm text-red-400">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="auth-password" className="block text-slate-400 mb-2 text-sm">Password</label>
              <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="auth-password" autoComplete={isLogin ? 'current-password' : 'new-password'}
                  value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-4 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
                minLength="6"
              />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-controls="auth-password"
                title={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(previous => !previous)}
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">
                {showPassword ? <EyeOff size={18} aria-hidden="true"/> : <Eye size={18} aria-hidden="true"/>}
              </button>
              </div>
            </div>

            {!isLogin&&<SignupTermsReview reviewed={termsReviewed} accepted={termsAccepted} onReviewed={()=>setTermsReviewed(true)} onAccepted={setTermsAccepted} disabled={loading}/>}

            <button
              type="submit"
              disabled={loading||(!isLogin&&(!termsReviewed||!termsAccepted))}
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
          <nav className="auth-terms-link" aria-label="Terms and privacy">
            <p>Review the platform’s terms and privacy information.</p>
            <div><a href="#/terms">Terms and Conditions</a><a href="#/privacy">Privacy Policy</a></div>
          </nav>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin)
                setFieldErrors({})
                setShowPassword(false)
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
