import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Clock, User, Download } from 'lucide-react'
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

function fmtData(str) {
  if (!str) return '—'
  const [y,m,d] = str.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}
function fmtHora(str) {
  if (!str) return ''
  return str.substring(11,16)
}

export default function Atendimentos() {
  const navigate = useNavigate()
  const [filtroStatus, setFiltroStatus] = useState('')
  const [busca, setBusca] = useState('')
  const [servicos, setServicos] = useState([])
  const [loading, setLoading] = useState(true)
  const isMobile = window.innerWidth < 1024

  useEffect(() => { buscar() }, [filtroStatus])

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

  const filtrados = servicos.filter(s => {
    if (!busca) return true
    const nome = s.clients?.name?.toLowerCase() || ''
    const equip = `${s.equipment || ''} ${s.brand || ''} ${s.model || ''}`.toLowerCase()
    return nome.includes(busca.toLowerCase()) || equip.includes(busca.toLowerCase())
  })

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Atendimentos</h1>
          <button
            onClick={() => exportarExcel(filtrados.map(s => ({
              Cliente: s.clients?.name || '',
              Equipamento: [s.equipment, s.brand, s.model].filter(Boolean).join(' '),
              Tipo: s.type || '',
              Status: STATUS_INFO[s.status]?.label || s.status || '',
              Data: s.scheduled_at ? s.scheduled_at.substring(0,10) : '',
              Hora: s.scheduled_at ? s.scheduled_at.substring(11,16) : '',
              Total: s.total_price || '',
            })), 'atendimentos.xlsx')}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Download size={13} /> Excel
          </button>
        </div>
        {/* Busca */}
        <div className="relative mb-3">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por cliente ou equipamento..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Search size={15} className="absolute left-3 top-3 text-gray-400" />
        </div>
        {/* Filtros de status */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTROS.map(f => (
            <button
              key={f.value}
              onClick={() => setFiltroStatus(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filtroStatus === f.value
                  ? 'bg-navy text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum atendimento encontrado</div>
        ) : filtrados.map(s => {
          const st = STATUS_INFO[s.status] || STATUS_INFO.agendado
          return (
            <div
              key={s.id}
              onClick={() => {
                if (isMobile) navigate(`/m/atendimento/${s.id}`)
                else navigate(`/m/atendimento/${s.id}`)
              }}
              className="bg-white rounded-2xl p-4 shadow-sm active:scale-[0.99] transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <User size={13} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-gray-900 truncate">{s.clients?.name || '—'}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {[s.equipment, s.brand, s.model].filter(Boolean).join(' · ') || s.type}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock size={12} />
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
                  <span className={`${st.bg} ${st.text} text-[10px] font-semibold px-2 py-1 rounded-full`}>
                    {st.label}
                  </span>
                  <ChevronRight size={16} className="text-gray-300" />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
