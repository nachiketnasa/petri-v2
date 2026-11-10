import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import HealthStatus from './HealthStatus'
import AuthForm from './AuthForm'
import Dashboard from './Dashboard'
import ExperimentDetail from './ExperimentDetail'
import NewExperimentForm from './NewExperimentForm'
import { AuthProvider, useAuth } from './AuthContext'
import './App.css'

function Header() {
  const { signedIn, signOut } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    navigate('/')
  }

  return (
    <header>
      <HealthStatus />
      {signedIn && (
        <button type="button" onClick={handleSignOut}>
          Sign out
        </button>
      )}
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
  const { signedIn, signIn } = useAuth()
  const navigate = useNavigate()

  if (signedIn === null) return <p>Loading…</p>
  if (signedIn) return <Navigate to="/dashboard" replace />

  return (
    <AuthForm
      onAuthenticated={() => {
        signIn()
        navigate('/dashboard')
      }}
    />
  )
}

function AppRoutes() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
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
