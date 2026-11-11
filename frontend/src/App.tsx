import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import HealthStatus from './HealthStatus'
import AuthForm from './AuthForm'
import Landing from './Landing'
import Dashboard from './Dashboard'
import ExperimentDetail from './ExperimentDetail'
import Calendar from './Calendar'
import Greeting, { rememberDisplayName } from './Greeting'
import NewExperimentForm from './NewExperimentForm'
import Settings, { CookieNotice, applyStoredTheme, getLandingPreference } from './Settings'
import { AuthProvider, useAuth } from './AuthContext'

function landingPath() {
  return getLandingPreference() === 'dashboard' ? '/dashboard' : '/greeting'
}

function Header() {
  return (
    <header style={{ position: 'fixed', top: 12, right: 16, zIndex: 20 }}>
      <HealthStatus />
    </header>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { signedIn } = useAuth()
  if (signedIn === null) return <p>Loading…</p>
  if (!signedIn) return <Navigate to="/" replace />
  return <>{children}</>
}

function Home() {
  const { signedIn } = useAuth()

  if (signedIn === null) return <p>Loading…</p>
  if (signedIn) return <Navigate to={landingPath()} replace />

  return <Landing />
}

function SignIn() {
  const { signedIn, signIn } = useAuth()
  const navigate = useNavigate()

  if (signedIn === null) return <p>Loading…</p>
  if (signedIn) return <Navigate to={landingPath()} replace />

  return (
    <AuthForm
      onAuthenticated={(user) => {
        rememberDisplayName(user.display_name)
        signIn()
        navigate(landingPath())
      }}
    />
  )
}

function AppRoutes() {
  useEffect(() => {
    applyStoredTheme()
  }, [])

  return (
    <>
      <Header />
      <CookieNotice />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route
          path="/greeting"
          element={
            <RequireAuth>
              <Greeting />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route
          path="/experiments/new"
          element={
            <RequireAuth>
              <NewExperimentForm />
            </RequireAuth>
          }
        />
        <Route
          path="/experiments/:id"
          element={
            <RequireAuth>
              <ExperimentDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/calendar"
          element={
            <RequireAuth>
              <Calendar />
            </RequireAuth>
          }
        />
        <Route
          path="/calendar/:experimentId"
          element={
            <RequireAuth>
              <Calendar />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
