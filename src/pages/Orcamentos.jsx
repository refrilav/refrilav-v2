import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, FileText, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

const FILTROS = [
  { label: 'Todos', value: '' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Aprovados', value: 'aprovado' },
  { label: 'Recusados', value: 'recusado' },
]

const STATUS_INFO = {
  pendente:  { label: 'Pendente',  bg: 'bg-yellow-100', text: 'text-yellow-700' },
  aprovado:  { label: 'Aprovado',  bg: 'bg-green-100',  text: 'text-green-700'  },
  recusado:  { label: 'Recusado',  bg: 'bg-red-100',    text: 'text-red-700'    },
}

function fmt(v) {
  if (!v && v !== 0) return '—'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y,m,d] = s.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

export default function Orcamentos() {
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState('')
  const [orcamentos, setOrcamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { buscar() }, [filtro])

  async function buscar() {
    setLoading(true)
    let q = supabase
      .from('quotes')
      .select('*, clients(name, phone)')
      .order('created_at', { ascending: false })
      .range(0, 99)
    if (filtro) q = q.eq('status', filtro)
    const { data } = await q
    setOrcamentos(data || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 safe-top sticky top-0 z-10">
        <h1 className="text-lg font-bold text-navy mb-3">Orçamentos</h1>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTROS.map(f => (
            <button key={f.value} onClick={() => setFiltro(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                filtro === f.value ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhum orçamento encontrado</p>
          </div>
        ) : orcamentos.map(o => {
          const st = STATUS_INFO[o.status] || STATUS_INFO.pendente
          const equip = [o.equipment, o.brand, o.model].filter(Boolean).join(' ')
          return (
            <div key={o.id}
              onClick={() => window.open(`/orcamento/${o.id}`, '_blank')}
              className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.99] transition">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate mb-0.5">
                    {o.clients?.name || '—'}
                  </div>
                  <div className="text-xs text-gray-500 truncate mb-2">{equip || '—'}</div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${st.bg} ${st.text}`}>
                      {st.label}
                    </span>
                    <span className="text-xs text-gray-400">{fmtData(o.created_at)}</span>
                    {o.total_price > 0 && (
                      <span className="text-xs font-semibold text-navy">{fmt(o.total_price)}</span>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
