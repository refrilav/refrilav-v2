import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Clock, User, Download, Target } from 'lucide-react'
import { supabase } from '../lib/supabase'

function exportarExcel(dados, nomeArquivo) {
  import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs').then(XLSX => {
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, nomeArquivo)
  })
}

const FILTROS = [
  { label: 'Todos', value: '' },
  { label: 'Agendados', value: 'agendado' },
  { label: 'Em andamento', value: 'em_andamento' },
  { label: 'Concluídos', value: 'concluido' },
]

const STATUS_INFO = {
  agendado:     { label: 'Agendado',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  em_andamento: { label: 'Em andamento', bg: 'bg-orange-100', text: 'text-orange-700' },
  concluido:    { label: 'Concluído',    bg: 'bg-green-100',  text: 'text-green-700'  },
  recolhido:    { label: 'Recolhido',    bg: 'bg-purple-100', text: 'text-purple-700' },
  cancelado:    { label: 'Cancelado',    bg: 'bg-gray-100',   text: 'text-gray-500'   },
}

const TIPOS_SERVICO = ['Todos', 'Limpeza', 'Higienização', 'Instalação', 'Manutenção', 'Reparo', 'Visita Técnica']
const EQUIPAMENTOS_OPT = ['Todos', 'Ar-condicionado', 'Lavadora', 'Bebedouro', 'Geladeira', 'Outro']
const PERIODOS = [
  { label: '3+ meses', meses: 3 },
  { label: '6+ meses', meses: 6 },
  { label: '9+ meses', meses: 9 },
  { label: '1+ ano',   meses: 12 },
  { label: '2+ anos',  meses: 24 },
]

function fmtData(str) {
  if (!str) return '—'
  const [y,m,d] = str.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}
function fmtHora(str) {
  if (!str) return ''
  return str.substring(11,16)
}
function diasDesde(str) {
  if (!str) return 0
  const d = new Date(str.substring(0,10))
  const hoje = new Date()
  hoje.setHours(0,0,0,0)
  return Math.floor((hoje - d) / (1000 * 60 * 60 * 24))
}
function descTempo(dias) {
  if (dias < 30) return `${dias} dias`
  if (dias < 365) return `${Math.floor(dias/30)} meses`
  const anos = Math.floor(dias/365)
  const mesesResto = Math.floor((dias % 365) / 30)
  return mesesResto > 0 ? `${anos} ano${anos>1?'s':''} e ${mesesResto} mês` : `${anos} ano${anos>1?'s':''}`
}

export default function Atendimentos() {
  const navigate = useNavigate()
  const [aba, setAba] = useState('atendimentos')

  // Aba atendimentos
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [servicos, setServicos] = useState([])
  const [loading, setLoading] = useState(true)

  // Aba oportunidades
  const [filtroTipo, setFiltroTipo] = useState('Todos')
  const [filtroEquip, setFiltroEquip] = useState('Todos')
  const [filtroPeriodo, setFiltroPeriodo] = useState(6)
  const [oportunidades, setOportunidades] = useState([])
  const [loadingOp, setLoadingOp] = useState(false)

  const isMobile = window.innerWidth < 1024

  useEffect(() => { if (aba === 'atendimentos') buscar() }, [filtroStatus, aba])
  useEffect(() => { if (aba === 'oportunidades') buscarOportunidades() }, [filtroTipo, filtroEquip, filtroPeriodo, aba])

  async function buscar() {
    setLoading(true)
    let q = supabase
      .from('services')
      .select('id, scheduled_at, status, type, equipment, brand, model, total_price, clients(name, phone)')
      .order('scheduled_at', { ascending: false })
      .range(0, 9999)
    if (filtroStatus) q = q.eq('status', filtroStatus)
    const { data } = await q
    setServicos(data || [])
    setLoading(false)
  }

  async function buscarOportunidades() {
    setLoadingOp(true)
    const corte = new Date()
    corte.setMonth(corte.getMonth() - filtroPeriodo)
    const corteStr = corte.toISOString().substring(0, 10)

    // Busca o último atendimento concluído por cliente+equipamento
    let q = supabase
      .from('services')
      .select('id, scheduled_at, finished_at, type, equipment, brand, model, clients(id, name, phone)')
      .eq('status', 'concluido')
      .lte('scheduled_at', corteStr + 'T23:59')
      .order('scheduled_at', { ascending: false })
      .range(0, 9999)

    if (filtroTipo !== 'Todos') q = q.ilike('type', `%${filtroTipo}%`)
    if (filtroEquip !== 'Todos') q = q.ilike('equipment', `%${filtroEquip}%`)

    const { data } = await q

    // Deduplica: mantém só o mais recente por cliente+equipamento
    const vistos = new Set()
    const dedup = (data || []).filter(s => {
      const chave = `${s.clients?.id}-${s.equipment}-${s.brand}-${s.model}`
      if (vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })

    // Filtra: verifica se não houve atendimento mais recente que o corte
    // (já está filtrado pelo lte acima, então só precisamos checar se há atendimento posterior)
    setOportunidades(dedup)
    setLoadingOp(false)
  }

  const filtrados = servicos.filter(s => {
    if (!busca) return true
    const nome = s.clients?.name?.toLowerCase() || ''
    const equip = `${s.equipment || ''} ${s.brand || ''} ${s.model || ''}`.toLowerCase()
    return nome.includes(busca.toLowerCase()) || equip.includes(busca.toLowerCase())
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-3 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Atendimentos</h1>
          {aba === 'atendimentos' && (
            <button onClick={() => exportarExcel(filtrados.map(s => ({
              Cliente: s.clients?.name || '',
              Equipamento: [s.equipment, s.brand, s.model].filter(Boolean).join(' '),
              Tipo: s.type || '',
              Status: STATUS_INFO[s.status]?.label || s.status || '',
              Data: s.scheduled_at ? s.scheduled_at.substring(0,10) : '',
              Hora: s.scheduled_at ? s.scheduled_at.substring(11,16) : '',
              Total: s.total_price || '',
            })), 'atendimentos.xlsx')}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Download size={13}/> Excel
            </button>
          )}
          {aba === 'oportunidades' && (
            <button onClick={() => exportarExcel(oportunidades.map(s => ({
              Cliente: s.clients?.name || '',
              Telefone: s.clients?.phone || '',
              Equipamento: [s.equipment, s.brand, s.model].filter(Boolean).join(' '),
              'Tipo de serviço': s.type || '',
              'Último atendimento': s.scheduled_at ? s.scheduled_at.substring(0,10) : '',
              'Dias sem atendimento': diasDesde(s.scheduled_at),
            })), 'oportunidades.xlsx')}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Download size={13}/> Excel
            </button>
          )}
        </div>

        {/* Toggle abas */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3">
          <button onClick={() => setAba('atendimentos')}
            className={`flex-1 py-2 text-xs font-semibold transition ${aba==='atendimentos'?'bg-navy text-white':'bg-white text-gray-500'}`}>
            Atendimentos
          </button>
          <button onClick={() => setAba('oportunidades')}
            className={`flex-1 py-2 text-xs font-semibold transition flex items-center justify-center gap-1 ${aba==='oportunidades'?'bg-navy text-white':'bg-white text-gray-500'}`}>
            <Target size={12}/> Oportunidades
          </button>
        </div>

        {/* Filtros da aba atendimentos */}
        {aba === 'atendimentos' && <>
          <div className="relative mb-3">
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por cliente ou equipamento..."
              className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"/>
            <Search size={15} className="absolute left-3 top-3 text-gray-400"/>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {FILTROS.map(f => (
              <button key={f.value} onClick={() => setFiltroStatus(f.value)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtroStatus===f.value?'bg-navy text-white':'bg-gray-100 text-gray-600'}`}>
                {f.label}
              </button>
            ))}
          </div>
        </>}

        {/* Filtros da aba oportunidades */}
        {aba === 'oportunidades' && (
          <div className="space-y-2">
            {/* Período */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {PERIODOS.map(p => (
                <button key={p.meses} onClick={() => setFiltroPeriodo(p.meses)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtroPeriodo===p.meses?'bg-primary text-white':'bg-gray-100 text-gray-600'}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Tipo de serviço */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {TIPOS_SERVICO.map(t => (
                <button key={t} onClick={() => setFiltroTipo(t)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtroTipo===t?'bg-navy text-white':'bg-gray-100 text-gray-600'}`}>
                  {t}
                </button>
              ))}
            </div>
            {/* Equipamento */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {EQUIPAMENTOS_OPT.map(e => (
                <button key={e} onClick={() => setFiltroEquip(e)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtroEquip===e?'bg-navy text-white':'bg-gray-100 text-gray-600'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Lista atendimentos */}
      {aba === 'atendimentos' && (
        <div className="px-4 py-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
          ) : filtrados.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Nenhum atendimento encontrado</div>
          ) : filtrados.map(s => {
            const st = STATUS_INFO[s.status] || STATUS_INFO.agendado
            return (
              <div key={s.id} onClick={() => navigate(`/m/atendimento/${s.id}`)}
                className="bg-white rounded-2xl p-4 shadow-sm active:scale-[0.99] transition cursor-pointer">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={13} className="text-gray-400 flex-shrink-0"/>
                      <span className="text-sm font-semibold text-gray-900 truncate">{s.clients?.name || '—'}</span>
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {[s.equipment, s.brand, s.model].filter(Boolean).join(' · ') || s.type}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={12}/>
                        {fmtData(s.scheduled_at)} {fmtHora(s.scheduled_at)}
                      </div>
                      {s.total_price > 0 && (
                        <span className="text-xs font-semibold text-navy">
                          R$ {Number(s.total_price).toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`${st.bg} ${st.text} text-[10px] font-semibold px-2 py-1 rounded-full`}>{st.label}</span>
                    <ChevronRight size={16} className="text-gray-300"/>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lista oportunidades */}
      {aba === 'oportunidades' && (
        <div className="px-4 py-3 space-y-2">
          {loadingOp ? (
            <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
          ) : oportunidades.length === 0 ? (
            <div className="text-center py-12">
              <Target size={40} className="text-gray-200 mx-auto mb-3"/>
              <p className="text-gray-400 text-sm">Nenhuma oportunidade encontrada</p>
              <p className="text-gray-300 text-xs mt-1">Tente aumentar o período ou mudar os filtros</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-1">{oportunidades.length} cliente{oportunidades.length!==1?'s':''} sem atendimento há {filtroPeriodo >= 12 ? `${filtroPeriodo/12} ano${filtroPeriodo>12?'s':''}` : `${filtroPeriodo} meses`}</p>
              {oportunidades.map(s => {
                const dias = diasDesde(s.scheduled_at)
                const urgencia = dias > 365 ? 'text-red-500' : dias > 180 ? 'text-orange-500' : 'text-yellow-600'
                return (
                  <div key={s.id} onClick={() => navigate(`/clientes/${s.clients?.id}`)} className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.99] transition">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.clients?.name || '—'}</p>
                        {s.clients?.phone && (
                          <a href={`tel:${s.clients.phone}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-blue-600 mt-0.5 block">
                            {s.clients.phone}
                          </a>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {[s.equipment, s.brand, s.model].filter(Boolean).join(' · ')}
                        </p>
                        {s.type && <p className="text-xs text-gray-400">{s.type}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`text-sm font-bold ${urgencia}`}>{descTempo(dias)}</p>
                        <p className="text-xs text-gray-400 mt-0.5">sem atendimento</p>
                        <p className="text-xs text-gray-300 mt-0.5">Último: {fmtData(s.scheduled_at)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
