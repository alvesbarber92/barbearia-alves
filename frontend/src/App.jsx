import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { useAuth } from './context/useAuth'
import { supabase } from './lib/supabase'
import { destinoAposLogin } from './lib/destinoAposLogin'

import LoginPage from './pages/auth/LoginPage'
import CadastroPage from './pages/auth/CadastroPage'
import CadastroClientePage from './pages/auth/CadastroClientePage'
import EsqueciSenhaPage from './pages/auth/EsqueciSenhaPage'
import RedefinirSenhaPage from './pages/auth/RedefinirSenhaPage'

import QueroMeuSalaoPage from './pages/lead/QueroMeuSalaoPage'

import TermosPage from './pages/legal/TermosPage'
import PrivacidadePage from './pages/legal/PrivacidadePage'

import AdminPage from './pages/admin/AdminPage'

import OnboardingPage from './pages/onboarding/OnboardingPage'

import DashboardLayout from './components/layout/DashboardLayout'
import DashboardHome from './pages/dashboard/DashboardHome'
import SalaoBloqueadoPage from './pages/dashboard/SalaoBloqueadoPage'
import AgendamentosPage from './pages/agendamentos/AgendamentosPage'
import ClientesPage from './pages/clientes/ClientesPage'
import EstoquePage from './pages/estoque/EstoquePage'
import FinanceiroPage from './pages/financeiro/FinanceiroPage'
import ConfiguracoesPage from './pages/configuracoes/ConfiguracoesPage'

import ClienteAreaPage from './pages/cliente/ClienteAreaPage'

import SalonPublicPage from './pages/public/SalonPublicPage'
import AgendarPage from './pages/public/AgendarPage'

function SalonHome() {
  const { slug } = useParams()
  const { salon, loading } = useAuth()
  if (loading) return null
  if (salon?.slug === slug) return <Navigate to={`/${slug}/dashboard`} replace />
  return <SalonPublicPage />
}

function PlataformaAdminRoute({ children }) {
  const { session, loading } = useAuth()
  const [verificacao, setVerificacao] = useState({ userId: null, ehAdmin: false })

  useEffect(() => {
    if (loading || !session) return
    let cancelado = false
    supabase.rpc('eh_admin').then(({ data, error }) => {
      if (!cancelado) setVerificacao({ userId: session.user.id, ehAdmin: !error && data === true })
    })
    return () => { cancelado = true }
  }, [session, loading])

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (verificacao.userId !== session.user.id) return null
  if (!verificacao.ehAdmin) return <Navigate to="/" replace />
  return children
}

function ModuloRoute({ modulo, children }) {
  const { slug } = useParams()
  const { modulosCarregando, moduloLiberado } = useAuth()
  if (modulosCarregando) return null
  if (moduloLiberado(modulo)) return children
  return <Navigate to={`/${slug}/dashboard`} replace />
}

function SalaoAtivoRoute({ children }) {
  const { salon, salonCarregando, observando } = useAuth()
  if (salonCarregando) return null
  if (salon && salon.ativo === false && !observando) return <SalaoBloqueadoPage />
  return children
}

function PrivateRoute({ children, adminOnly = false }) {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && session.user.user_metadata?.role === 'cliente') {
    return <Navigate to="/minha-conta" replace />
  }
  return children
}

function Inicio() {
  const { session, loading } = useAuth()
  const [destino, setDestino] = useState(null)

  useEffect(() => {
    const user = session?.user
    if (!user) return
    let vivo = true
    destinoAposLogin(user).then(d => { if (vivo) setDestino(d) })
    return () => { vivo = false }
  }, [session])

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />
  if (!destino) return null
  return <Navigate to={destino} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      <Route path="/cadastro-cliente" element={<CadastroClientePage />} />

      <Route path="/esqueci-senha" element={<EsqueciSenhaPage />} />
      <Route path="/redefinir-senha" element={<RedefinirSenhaPage />} />

      <Route path="/quero-meu-salao" element={<QueroMeuSalaoPage />} />

      <Route path="/termos" element={<TermosPage />} />
      <Route path="/privacidade" element={<PrivacidadePage />} />

      <Route path="/admin" element={<PlataformaAdminRoute><AdminPage /></PlataformaAdminRoute>} />

      <Route path="/onboarding" element={<PrivateRoute adminOnly><SalaoAtivoRoute><OnboardingPage /></SalaoAtivoRoute></PrivateRoute>} />

      <Route path="/:slug" element={<SalonHome />} />

      <Route path="/:slug" element={<PrivateRoute adminOnly><SalaoAtivoRoute><DashboardLayout /></SalaoAtivoRoute></PrivateRoute>}>
        <Route path="dashboard" element={<DashboardHome />} />
        <Route path="agendamentos" element={<AgendamentosPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="estoque" element={<ModuloRoute modulo="estoque"><EstoquePage /></ModuloRoute>} />
        <Route path="financeiro" element={<FinanceiroPage />} />
        <Route path="configuracoes" element={<ConfiguracoesPage />} />
      </Route>

      <Route path="/minha-conta" element={<PrivateRoute><ClienteAreaPage /></PrivateRoute>} />

      <Route path="/:slug/agendar" element={<AgendarPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
