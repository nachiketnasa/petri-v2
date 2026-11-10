import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

type AuthState = {
  // null while the initial GET /experiments check is in flight
  signedIn: boolean | null
  signIn: () => void
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)

  useEffect(() => {
    // No /auth/me endpoint exists; GET /experiments doubles as the signed-in
    // check (200 = signed in, 401 = signed out) so this is the only request
    // made on load.
    fetch(`${BASE_URL}/experiments`, { credentials: 'include' })
      .then((res) => setSignedIn(res.ok))
      .catch(() => setSignedIn(false))
  }, [])

  function signIn() {
    setSignedIn(true)
  }

  function signOut() {
    fetch(`${BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).finally(() =>
      setSignedIn(false),
    )
  }

  return <AuthContext.Provider value={{ signedIn, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
