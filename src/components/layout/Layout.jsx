import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, Calendar, ClipboardList, Users, Wrench, FileText,
  LogOut, Settings, ChevronLeft, ChevronRight, Bell
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navItems = [
  { path: '/agenda', label: 'Agenda', icon: Calendar },
  { path: '/atendimentos', label: 'Atendimentos', icon: ClipboardList },
  { path: '/oficina', label: 'Oficina', icon: Wrench },
  { path: '/orcamentos', label: 'Orçamentos', icon: FileText },
  { path: '/clientes', label: 'Clientes', icon: Users },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
]

export default function Layout() {
  const { signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = window.innerWidth < 1024

  // No mobile, renderiza só o conteúdo + nav inferior
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <main className="flex-1 overflow-auto pb-20">
          <Outlet />
        </main>
        {/* Nav inferior mobile */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-50">
          <div className="flex">
            {navItems.slice(0, 4).map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition ${
                    active ? 'text-primary' : 'text-gray-400'
                  }`}
                >
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="text-[10px]">{label}</span>
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    )
  }

  // Desktop: sidebar
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className={`flex flex-col bg-navy text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'} min-h-screen`}>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          {!collapsed && <span className="font-bold text-base tracking-wide">Refrilav</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-primary text-white' : 'text-blue-100 hover:bg-white/10'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <Icon size={18} />
                {!collapsed && <span>{label}</span>}
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div className="p-2 space-y-1 border-t border-white/10">
          <button
            onClick={() => navigate('/configuracoes')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-100 hover:bg-white/10 transition ${collapsed ? 'justify-center' : ''}`}
          >
            <Settings size={18} />
            {!collapsed && <span>Configurações</span>}
          </button>
          <button
            onClick={signOut}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-100 hover:bg-white/10 transition ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut size={18} />
            {!collapsed && <span>Sair</span>}
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-blue-200 hover:bg-white/10 transition"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
