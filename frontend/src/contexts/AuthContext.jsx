import { createContext, useContext, useState, useEffect } from 'react'
import { setTimeZone } from '../lib/timeZone'
import PolicyGate from '../components/PolicyGate'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  setTimeZone(user?.timeZone)
  const updatePreferences = preferences => setUser(previous => {
    if (!previous) return previous
    const next = {...previous,...preferences}
    localStorage.setItem('user',JSON.stringify(next))
    return next
  })
  useEffect(()=>{
    if(!token)return
    const controller=new AbortController()
    fetch('/api/account/preferences',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(response=>response.ok?response.json():null).then(data=>{if(data&&!controller.signal.aborted)updatePreferences(data)}).catch(()=>{})
    return()=>controller.abort()
  },[token])

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')
    
    if (storedToken && storedUser) {
      try{
        const restored=JSON.parse(storedUser)
        if(!restored||typeof restored.id!=='string')throw new Error('Invalid stored session')
        setToken(storedToken);setUser(restored)
      }catch{localStorage.removeItem('token');localStorage.removeItem('user')}
    }
    setLoading(false)
  }, [])

  const login = (token, user) => {
    setToken(token)
    setUser(user)
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(user))
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  const value = {
    user,
    token,
    login,
    logout,
    updatePreferences,
    isAuthenticated: !!token,
    loading
  }

  return <AuthContext.Provider value={value}>{token?<PolicyGate key={token} token={token} onSignOut={logout}>{children}</PolicyGate>:children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
