import { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react'
import { setTimeZone } from '../lib/timeZone'
import PolicyGate from '../components/PolicyGate'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  useLayoutEffect(()=>{
    if(loading)return
    const mode=token&&user?.themeMode==='light'?'light':'dark'
    document.documentElement.setAttribute('data-app-theme',mode)
    document.documentElement.style.colorScheme=mode
  },[loading,token,user?.themeMode])
  setTimeZone(user?.timeZone)
  const updatePreferences = preferences => setUser(previous => {
    if (!previous) return previous
    const next = {...previous,...preferences}
    try{localStorage.setItem('user',JSON.stringify(next))}catch{/* Account preferences still work for this visit. */}
    return next
  })
  useEffect(()=>{
    const changed=event=>{
      if(event.key!=='user'||!event.newValue)return
      try{const updated=JSON.parse(event.newValue);setUser(previous=>previous&&updated.id===previous.id?{...previous,themeMode:updated.themeMode==='light'?'light':'dark'}:previous)}catch{/* Ignore malformed cache updates. */}
    }
    window.addEventListener('storage',changed)
    return()=>window.removeEventListener('storage',changed)
  },[])
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
