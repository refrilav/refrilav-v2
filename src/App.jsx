import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Agenda from './pages/Agenda'
import Atendimentos from './pages/Atendimentos'
import Clientes from './pages/Clientes'
import AtendimentoDetalhe from './pages/mobile/AtendimentoDetalhe'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Rotas protegidas com layout */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/agenda" replace />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="atendimentos" element={<Atendimentos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>

      {/* Detalhe mobile do atendimento (tela cheia, sem sidebar) */}
      <Route path="/m/atendimento/:id" element={<PrivateRoute><AtendimentoDetalhe /></PrivateRoute>} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
