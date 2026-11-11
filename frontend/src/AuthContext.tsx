import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export type Experiment = {
  id: string
  title: string
  cadence_type: string
  cadence_days?: number | null
  start_date?: string | null
  status: string
  ended_early?: boolean
}

type AuthState = {
  // null while the initial GET /experiments check is in flight
  signedIn: boolean | null
  experiments: Experiment[] | null
  experimentsError: string | null
  signIn: () => void
  signOut: () => void
  refetch: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [experiments, setExperiments] = useState<Experiment[] | null>(null)
  const [experimentsError, setExperimentsError] = useState<string | null>(null)

  function refetch() {
    // No /auth/me endpoint exists; GET /experiments doubles as the signed-in
    // check (200 = signed in, 401 = signed out) and supplies Dashboard's
    // data, so this is the only request made on load/sign-in.
    return fetch(`${BASE_URL}/experiments`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setSignedIn(false)
          setExperiments(null)
          setExperimentsError(data.detail ?? null)
          return
        }
        setSignedIn(true)
        setExperiments(data)
        setExperimentsError(null)
      })
      .catch(() => {
        setSignedIn(false)
        setExperiments(null)
      })
  }

  useEffect(() => {
    refetch()
  }, [])

  function signIn() {
    // The signup/login response already confirms success; refetch to
    // populate the experiments list the newly-signed-in session can see.
    refetch()
  }

  function signOut() {
    fetch(`${BASE_URL}/auth/logout`, { method: 'POST', credentials: 'include' }).finally(() => {
      setSignedIn(false)
      setExperiments(null)
    })
  }

  return (
    <AuthContext.Provider value={{ signedIn, experiments, experimentsError, signIn, signOut, refetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
