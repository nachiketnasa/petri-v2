import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const BASE_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8000'

export type Experiment = {
  id: string
  title: string
  hypothesis?: string
  cadence_type: string
  cadence_days?: number | null
  start_date?: string | null
  target_days?: number | null
  status: string
  ended_early?: boolean
  check_in_due?: boolean
}

export type Milestone = {
  id: string
  title: string
  cadence_type: string
  cadence_days?: number | null
  check_in_kind: string
  target_date?: string | null
  started_at?: string | null
  status: string
}

export type Goal = {
  id: string
  title: string
  why_text?: string
  start_date: string
  target_date: string
  status: string
  ended_early?: boolean
  milestones: Milestone[]
}

type AuthState = {
  // null while the initial GET /experiments check is in flight
  signedIn: boolean | null
  experiments: Experiment[] | null
  experimentsError: string | null
  goals: Goal[] | null
  goalsError: string | null
  signIn: () => void
  signOut: () => void
  refetch: () => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [experiments, setExperiments] = useState<Experiment[] | null>(null)
  const [experimentsError, setExperimentsError] = useState<string | null>(null)
  const [goals, setGoals] = useState<Goal[] | null>(null)
  const [goalsError, setGoalsError] = useState<string | null>(null)

  function refetch() {
    // No /auth/me endpoint exists; GET /experiments doubles as the signed-in
    // check (200 = signed in, 401 = signed out) and supplies Dashboard's
    // experiment data. GET /goals only fires once that check succeeds --
    // it's a second, distinct endpoint, not a repeat of the same call.
    return fetch(`${BASE_URL}/experiments`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setSignedIn(false)
          setExperiments(null)
          setExperimentsError(data.detail ?? null)
          setGoals(null)
          setGoalsError(null)
          return
        }
        setSignedIn(true)
        setExperiments(data)
        setExperimentsError(null)
        return fetch(`${BASE_URL}/goals`, { credentials: 'include' })
          .then(async (goalsRes) => {
            const goalsData = await goalsRes.json()
            if (!goalsRes.ok) {
              setGoals(null)
              setGoalsError(goalsData.detail ?? null)
              return
            }
            setGoals(goalsData)
            setGoalsError(null)
          })
          .catch(() => {
            setGoals(null)
          })
      })
      .catch(() => {
        setSignedIn(false)
        setExperiments(null)
        setGoals(null)
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
      setGoals(null)
    })
  }

  return (
    <AuthContext.Provider
      value={{ signedIn, experiments, experimentsError, goals, goalsError, signIn, signOut, refetch }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
