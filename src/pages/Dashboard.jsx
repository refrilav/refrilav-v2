import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import {
  DollarSign, TrendingUp, TrendingDown, ChevronDown, ChevronRight,
  AlertCircle, Calendar, CheckCircle, Clock
} from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtHora(s) { return s ? s.substring(11, 16) : '—' }
function fmtData(s) {
  if (!s) return '—'
  const [y, m, d] = s.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function mesAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}

const STATUS_INFO = {
  agendado:     { label: 'Agendado',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  em_andamento: { label: 'Em andamento', bg: 'bg-orange-100', text: 'text-orange-700' },
  concluido:    { label: 'Concluído',    bg: 'bg-green-100',  text: 'text-green-700'  },
  recolhido:    { label: 'Recolhido',    bg: 'bg-purple-100', text: 'text-purple-700' },
}

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [empresa, setEmpresa] = useState({})
  const [financeiro, setFinanceiro] = useState({ saldo: 0, aReceber: 0, aPagar: 0 })
  const [atrasados, setAtrasados] = useState({ receber: [], pagar: [] })
  const [atendimentosHoje, setAtendimentosHoje] = useState([])
  const [atrasoAberto, setAtrasoAberto] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const hojeStr = hoje()
    const mes = mesAtual()

    // Empresa
    const { data: cfg } = await supabase.from('settings').select('*').single()
    setEmpresa(cfg || {})

    // Financeiro
    const [{ data: recPendente }, { data: pagPendente }, { data: recRecebido }, { data: pagPago }] = await Promise.all([
      supabase.from('receivables').select('amount').eq('status', 'pendente').range(0, 9999),
      supabase.from('payables').select('amount').eq('status', 'pendente').range(0, 9999),
      supabase.from('receivables').select('amount').eq('status', 'recebido').gte('due_date', mes + '-01').range(0, 9999),
      supabase.from('payables').select('amount').eq('status', 'pago').gte('due_date', mes + '-01').range(0, 9999),
    ])
    const aReceber = (recPendente || []).reduce((s, r) => s + Number(r.amount || 0), 0)
    const aPagar = (pagPendente || []).reduce((s, r) => s + Number(r.amount || 0), 0)
    const totalRecebido = (recRecebido || []).reduce((s, r) => s + Number(r.amount || 0), 0)
    const totalPago = (pagPago || []).reduce((s, r) => s + Number(r.amount || 0), 0)
    setFinanceiro({ saldo: totalRecebido - totalPago, aReceber, aPagar })

    // Em atraso
    const [{ data: recAtrasado }, { data: pagAtrasado }] = await Promise.all([
      supabase.from('receivables').select('id, description, amount, due_date, client_id').eq('status', 'pendente').lt('due_date', hojeStr).order('due_date').range(0, 49),
      supabase.from('payables').select('id, description, amount, due_date').eq('status', 'pendente').lt('due_date', hojeStr).order('due_date').range(0, 49),
    ])
    setAtrasados({ receber: recAtrasado || [], pagar: pagAtrasado || [] })

    // Atendimentos de hoje
    const { data: atend } = await supabase
      .from('services')
      .select('id, scheduled_at, status, equipment, brand, model, clients(name)')
      .gte('scheduled_at', hojeStr + 'T00:00')
      .lte('scheduled_at', hojeStr + 'T23:59')
      .not('scheduled_at', 'is', null)
      .order('scheduled_at')
      .range(0, 9999)
    setAtendimentosHoje(atend || [])

    setLoading(false)
  }

  const nomeUsuario = empresa.company_name || 'Refrilav'
  const totalAtrasado = [...atrasados.receber, ...atrasados.pagar].reduce((s, i) => s + Number(i.amount || 0), 0)
  const qtdAtrasados = atrasados.receber.length + atrasados.pagar.length
  const hojeStr = hoje()
  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Header azul */}
      <div style={{background:'linear-gradient(135deg, #1B2A4A 0%, #2a3f6f 100%)', padding:'48px 20px 24px'}}>
        <p style={{color:'rgba(255,255,255,0.7)', fontSize:13, margin:'0 0 2px'}}>
          {nomeUsuario}
        </p>
        <h1 style={{color:'white', fontSize:22, fontWeight:700, margin:0}}>
          Olá, {user?.email?.split('@')[0] || 'bem-vindo'}!
        </h1>
      </div>

      <div className="px-4 space-y-3" style={{marginTop: -8}}>

        {/* Resumo financeiro */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-bold text-gray-900 mb-4">Sua empresa hoje</h2>
          <div className="space-y-4">
            {/* Saldo */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <DollarSign size={22} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Saldo do mês</p>
                <p className={`text-xl font-bold ${financeiro.saldo >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                  {fmt(financeiro.saldo)}
                </p>
              </div>
            </div>
            <div className="border-t border-gray-50" />
            {/* A receber */}
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/atendimentos')}>
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp size={22} className="text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">A receber</p>
                <p className="text-xl font-bold text-gray-900">{fmt(financeiro.aReceber)}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
            <div className="border-t border-gray-50" />
            {/* A pagar */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <TrendingDown size={22} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm text-gray-500">A pagar</p>
                <p className="text-xl font-bold text-gray-900">{fmt(financeiro.aPagar)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Em atraso */}
        {qtdAtrasados > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setAtrasoAberto(!atrasoAberto)}
              className="w-full flex items-center justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <AlertCircle size={20} className="text-red-500 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-base font-bold text-gray-900">
                    Em atraso
                    <span className="ml-2 bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                      {qtdAtrasados}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">{fmt(totalAtrasado)} · até {fmtData(hojeStr)}</p>
                </div>
              </div>
              <ChevronDown size={18} className={`text-gray-400 transition-transform ${atrasoAberto ? 'rotate-180' : ''}`} />
            </button>

            {atrasoAberto && (
              <div className="border-t border-gray-50 divide-y divide-gray-50">
                {atrasados.receber.length > 0 && (
                  <div className="px-5 py-2">
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">A receber</p>
                    {atrasados.receber.map(r => (
                      <div key={r.id} className="flex justify-between items-center py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{r.description || '—'}</p>
                          <p className="text-xs text-red-500">Venceu em {fmtData(r.due_date)}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{fmt(r.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                {atrasados.pagar.length > 0 && (
                  <div className="px-5 py-2">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-2">A pagar</p>
                    {atrasados.pagar.map(p => (
                      <div key={p.id} className="flex justify-between items-center py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{p.description || '—'}</p>
                          <p className="text-xs text-red-500">Venceu em {fmtData(p.due_date)}</p>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{fmt(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Atendimentos de hoje */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-navy" />
              <h2 className="text-base font-bold text-gray-900">Hoje</h2>
              {atendimentosHoje.length > 0 && (
                <span className="bg-navy text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                  {atendimentosHoje.length}
                </span>
              )}
            </div>
            <button onClick={() => navigate('/agenda')}
              className="text-xs text-blue-600 font-semibold">Ver agenda</button>
          </div>

          {atendimentosHoje.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <CheckCircle size={32} className="text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Nenhum atendimento hoje</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {atendimentosHoje.map(a => {
                const st = STATUS_INFO[a.status] || STATUS_INFO.agendado
                const equip = [a.equipment, a.brand, a.model].filter(Boolean).join(' ')
                return (
                  <div key={a.id}
                    onClick={() => navigate(`/m/atendimento/${a.id}`)}
                    className="flex items-center gap-3 px-5 py-3 cursor-pointer active:bg-gray-50">
                    <div className="flex-shrink-0 text-center w-10">
                      <p className="text-sm font-bold text-navy">{fmtHora(a.scheduled_at)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{a.clients?.name || '—'}</p>
                      {equip && <p className="text-xs text-gray-400 truncate">{equip}</p>}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0 ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="h-6" />
      </div>
    </div>
  )
}
