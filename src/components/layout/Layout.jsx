import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, Users, Wrench, FileText, Calendar, ClipboardList,
  LogOut, Settings, ChevronLeft, ChevronRight, Menu, X,
  TrendingUp, TrendingDown, Package, ShoppingCart, BarChart2, DollarSign
} from 'lucide-react'
import { useState } from 'react'

const GRUPOS = [
  {
    label: 'Operacional',
    items: [
      { path: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
      { path: '/agenda',       label: 'Agenda',         icon: Calendar        },
      { path: '/atendimentos', label: 'Atendimentos',   icon: ClipboardList   },
      { path: '/oficina',      label: 'Oficina',        icon: Wrench          },
    ]
  },
  {
    label: 'Comercial',
    items: [
      { path: '/clientes',     label: 'Clientes',       icon: Users           },
      { path: '/orcamentos',   label: 'Orçamentos',     icon: FileText        },
    ]
  },
  {
    label: 'Financeiro',
    items: [
      { path: '/receber',      label: 'A Receber',      icon: TrendingUp      },
      { path: '/pagar',        label: 'A Pagar',        icon: TrendingDown    },
      { path: '/fluxo',        label: 'Fluxo de Caixa', icon: BarChart2       },
    ]
  },
  {
    label: 'Estoque',
    items: [
      { path: '/estoque',      label: 'Estoque',        icon: Package         },
      { path: '/compras',      label: 'Compras',        icon: ShoppingCart    },
    ]
  },
]

// Todos os itens flat para o menu mobile hamburguer
const todosItens = GRUPOS.flatMap(g => g.items)

// Menu fixo inferior mobile
const navBottomItems = [
  { path: '/agenda',       label: 'Agenda',       icon: Calendar      },
  { path: '/atendimentos', label: 'Atendimentos', icon: ClipboardList },
  { path: '/oficina',      label: 'Oficina',      icon: Wrench        },
  { path: '/fluxo',        label: 'Financeiro',   icon: DollarSign    },
]

export default function Layout() {
  const { signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const isMobile = window.innerWidth < 1024

  function navegar(path) {
    navigate(path)
    setMenuAberto(false)
  }

  // MOBILE
  if (isMobile) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <main className="flex-1 overflow-auto pb-20">
          <Outlet />
        </main>

        {/* Nav inferior fixo */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50"
          style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
          <div className="flex">
            {navBottomItems.map(({ path, label, icon: Icon }) => {
              const active = location.pathname === path
              return (
                <button key={path} onClick={() => navegar(path)}
                  className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition ${
                    active ? 'text-primary' : 'text-gray-400'
                  }`}>
                  <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                  <span className="text-[10px]">{label}</span>
                </button>
              )
            })}
            {/* Hamburguer */}
            <button onClick={() => setMenuAberto(true)}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 transition ${menuAberto ? 'text-primary' : 'text-gray-400'}`}>
              <Menu size={20} strokeWidth={1.8} />
              <span className="text-[10px]">Menu</span>
            </button>
          </div>
        </nav>

        {/* Drawer menu completo */}
        {menuAberto && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setMenuAberto(false)} />
            <div className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-3xl max-h-[85vh] overflow-y-auto"
              style={{paddingBottom: 'max(24px, env(safe-area-inset-bottom))'}}>
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-200 rounded-full" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xs">R</span>
                  </div>
                  <span className="font-bold text-navy text-base">Refrilav</span>
                </div>
                <button onClick={() => setMenuAberto(false)} className="p-1.5 rounded-full bg-gray-100">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Grupos no drawer */}
              <div className="px-4 py-3 space-y-4">
                {GRUPOS.map(grupo => (
                  <div key={grupo.label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 px-1">{grupo.label}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {grupo.items.map(({ path, label, icon: Icon }) => {
                        const active = location.pathname === path
                        return (
                          <button key={path} onClick={() => navegar(path)}
                            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition ${
                              active ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-600'
                            }`}>
                            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                            <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Configurações e Sair */}
              <div className="px-4 pb-2 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
                <button onClick={() => navegar('/configuracoes')}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-gray-50 text-gray-600">
                  <Settings size={18} />
                  <span className="text-sm font-medium">Configurações</span>
                </button>
                <button onClick={signOut}
                  className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 text-red-600">
                  <LogOut size={18} />
                  <span className="text-sm font-medium">Sair</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  // DESKTOP com sidebar em grupos
  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className={`flex flex-col bg-navy text-white transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'} min-h-screen flex-shrink-0`}>
        {/* Logo */}
        <div className={`flex items-center gap-3 px-4 py-4 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">R</span>
          </div>
          {!collapsed && <span className="font-bold text-base tracking-wide">Refrilav</span>}
        </div>

        {/* Nav com grupos */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {GRUPOS.map(grupo => (
            <div key={grupo.label} className="mb-3">
              {!collapsed && (
                <p className="text-[10px] font-semibold text-blue-300/60 uppercase tracking-widest px-4 mb-1">
                  {grupo.label}
                </p>
              )}
              <div className="space-y-0.5 px-2">
                {grupo.items.map(({ path, label, icon: Icon }) => {
                  const active = location.pathname === path
                  return (
                    <button key={path} onClick={() => navigate(path)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                        active ? 'bg-primary text-white' : 'text-blue-100 hover:bg-white/10'
                      } ${collapsed ? 'justify-center' : ''}`}>
                      <Icon size={17} />
                      {!collapsed && <span>{label}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 space-y-0.5 border-t border-white/10">
          <button onClick={() => navigate('/configuracoes')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-100 hover:bg-white/10 transition ${collapsed ? 'justify-center' : ''}`}>
            <Settings size={17} />
            {!collapsed && <span>Configurações</span>}
          </button>
          <button onClick={signOut}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-blue-100 hover:bg-white/10 transition ${collapsed ? 'justify-center' : ''}`}>
            <LogOut size={17} />
            {!collapsed && <span>Sair</span>}
          </button>
          <button onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-blue-200 hover:bg-white/10 transition">
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
