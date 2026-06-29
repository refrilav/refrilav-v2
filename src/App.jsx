import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Login from './pages/Login'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Agenda from './pages/Agenda'
import Atendimentos from './pages/Atendimentos'
import Clientes from './pages/Clientes'
import ClienteDetalhe from './pages/ClienteDetalhe'
import Oficina from './pages/Oficina'
import Orcamentos from './pages/Orcamentos'
import Vendas from './pages/Vendas'
import Receber from './pages/Receber'
import Pagar from './pages/Pagar'
import Configuracoes from './pages/Configuracoes'
import PessoalPagar from './pages/PessoalPagar'
import FluxoCaixa from './pages/FluxoCaixa'
import Conciliacao from './pages/Conciliacao'
import Fornecedores from './pages/Fornecedores'
import Estoque from './pages/Estoque'
import Compras from './pages/Compras'
import CompraDetalhe from './pages/CompraDetalhe'
import ComprasConciliacao from './pages/ComprasConciliacao'
import ComprasConferencia from './pages/ComprasConferencia'
import DRE from './pages/DRE'
import PMOC from './pages/PMOC'
import AtendimentoDetalhe from './pages/mobile/AtendimentoDetalhe'
import OSDetalhe from './pages/mobile/OSDetalhe'
import OrcamentoDetalhe from './pages/mobile/OrcamentoDetalhe'
import RecolherEquipamento from './pages/mobile/RecolherEquipamento'
import Recibo from './pages/publicas/Recibo'
import Orcamento from './pages/publicas/Orcamento'

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
  useEffect(() => { document.title = 'Refrilav Gestão' }, [])
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="atendimentos" element={<Atendimentos />} />
        <Route path="oficina" element={<Oficina />} />
        <Route path="orcamentos" element={<Orcamentos />} />
        <Route path="vendas" element={<Vendas />} />
        <Route path="receber" element={<Receber />} />
        <Route path="pagar" element={<Pagar />} />
        <Route path="fluxo" element={<FluxoCaixa />} />
        <Route path="conciliacao" element={<Conciliacao />} />
        <Route path="dre" element={<DRE />} />
        <Route path="pmoc" element={<PMOC />} />
        <Route path="configuracoes" element={<Configuracoes />} />
        <Route path="pessoal" element={<PessoalPagar />} />
        <Route path="estoque" element={<Estoque />} />
        <Route path="compras" element={<Compras />} />
        <Route path="compras/conciliacao" element={<ComprasConciliacao />} />
        <Route path="compras/conferencia" element={<ComprasConferencia />} />
        <Route path="compras/:id" element={<CompraDetalhe />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteDetalhe />} />
        <Route path="fornecedores" element={<Fornecedores />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>
      <Route path="/m/atendimento/:id" element={<PrivateRoute><AtendimentoDetalhe /></PrivateRoute>} />
      <Route path="/m/oficina/:id" element={<PrivateRoute><OSDetalhe /></PrivateRoute>} />
      <Route path="/m/orcamento/:id" element={<PrivateRoute><OrcamentoDetalhe /></PrivateRoute>} />
      <Route path="/m/recolher/:id" element={<PrivateRoute><RecolherEquipamento /></PrivateRoute>} />
      <Route path="/recibo/:token" element={<Recibo />} />
      <Route path="/orcamento/:token" element={<Orcamento />} />
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
