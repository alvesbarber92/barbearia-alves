import { Outlet, NavLink, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/useAuth'
import { useAccent } from '../../hooks/useAccent'
import Monogram from '../ui/Monogram'
import FundoFoto from '../ui/FundoFoto'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Calendar, Users, Package, DollarSign, Settings, LogOut, Eye
} from 'lucide-react'

const navItems = [
  { to: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard },
  { to: 'agendamentos',  label: 'Agendamentos',  icon: Calendar,    curto: 'Agenda' },
  { to: 'clientes',      label: 'Clientes',      icon: Users },
  { to: 'estoque',       label: 'Estoque',       icon: Package,     modulo: 'estoque' },
  { to: 'financeiro',    label: 'Financeiro',    icon: DollarSign },
  { to: 'configuracoes', label: 'Configurações', icon: Settings,    curto: 'Ajustes' },
]

export default function DashboardLayout() {
  const { slug } = useParams()
  const { salon, signOut, moduloLiberado, observando } = useAuth()
  useAccent(salon?.cor_primaria)
  const navigate = useNavigate()

  const sairDaObservacao = async () => {
    const { error } = await supabase.rpc('admin_encerrar_observacao')
    if (error) { toast.error('Não foi possível encerrar. Tente de novo.'); return }
    window.location.href = '/admin'
  }

  const itensVisiveis = navItems.filter(item => !item.modulo || moduloLiberado(item.modulo))

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden pt-[env(safe-area-inset-top)] md:flex-row md:h-auto md:min-h-screen md:overflow-visible md:pt-0">
      {observando && (
        <div className="fixed top-0 inset-x-0 z-30 flex items-center justify-center gap-3 px-4 py-2 pt-[calc(0.5rem+env(safe-area-inset-top))] border-b bg-elevado border-junta">
          <Eye size={14} className="flex-shrink-0 text-acento-marca" aria-hidden />
          <p className="text-micro text-cal-2">
            Você está vendo <span className="font-semibold text-cal">{salon?.nome}</span> como
            plataforma. Somente leitura: nada aqui pode ser alterado por você.
          </p>
          <button onClick={sairDaObservacao}
            className="text-micro font-semibold underline underline-offset-2 flex-shrink-0 text-cal hover:text-acento-marca">
            Voltar ao /admin
          </button>
        </div>
      )}

      <aside className={`hidden md:flex flex-col w-56 fixed h-full z-10 border-r bg-bancada border-junta ${observando ? 'pt-10' : ''}`}>
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-junta">
          <Monogram nome={salon?.nome} logoUrl={salon?.logo_url} />
          <span className="font-display truncate text-cal">
            {salon?.nome || 'BarberVez'}
          </span>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {itensVisiveis.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={`/${slug}/${to}`}
              className={({ isActive }) => `relative flex items-center gap-3 px-3 py-2 rounded-controle text-apoio transition-colors ${
                isActive
                  ? 'bg-elevado text-acento-texto font-semibold'
                  : 'text-cal-2 hover:text-cal hover:bg-elevado'
              }`}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-chapa bg-acento-marca" aria-hidden />
                  )}
                  <Icon size={18} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t flex flex-col gap-1 border-junta">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-controle text-apoio transition-colors text-cal-2 hover:text-danger hover:bg-danger-fundo"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </aside>

      <FundoFoto />

      <main className={`relative z-10 flex-1 min-w-0 min-h-0 overflow-y-auto md:overflow-visible md:ml-56 ${observando ? 'pt-10' : ''}`}>
        <Outlet />
      </main>

      <nav className="md:hidden flex-shrink-0 border-t flex z-10 bg-bancada border-junta pb-[env(safe-area-inset-bottom)]">
        {itensVisiveis.map(({ to, label, curto, icon: Icon }) => (
          <NavLink
            key={to}
            to={`/${slug}/${to}`}
            className={({ isActive }) => `relative flex-1 min-w-0 flex flex-col items-center py-2 text-micro transition-colors ${
              isActive ? 'text-acento-texto font-semibold' : 'text-cal-2'
            }`}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-[3px] w-8 rounded-chapa bg-acento-marca" aria-hidden />
                )}
                <Icon size={20} className="flex-shrink-0" />
                <span className="mt-0.5 w-full px-0.5 text-center truncate">{curto ?? label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
