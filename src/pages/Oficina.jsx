import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'

const ETAPAS = [
  { value: 'recolhido',          label: 'Recolhido',          cor: 'bg-gray-100 text-gray-600' },
  { value: 'orcamento_enviado',  label: 'Orçamento enviado',  cor: 'bg-blue-100 text-blue-700' },
  { value: 'orcamento_aprovado', label: 'Orçamento aprovado', cor: 'bg-purple-100 text-purple-700' },
  { value: 'em_conserto',        label: 'Em conserto',        cor: 'bg-yellow-100 text-yellow-700' },
  { value: 'pronto',             label: 'Pronto',             cor: 'bg-green-100 text-green-700' },
  { value: 'entregue',           label: 'Entregue',           cor: 'bg-gray-100 text-gray-400' },
]

const FILTROS = [{ label: 'Todas', value: '' }, ...ETAPAS]

function fmtData(str) {
  if (!str) return '—'
  const [y,m,d] = str.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

export default function Oficina() {
  const navigate = useNavigate()
  const [etapaFiltro, setEtapaFiltro] = useState('')
  const [ordens, setOrdens] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { buscar() }, [etapaFiltro])

  async function buscar() {
    setLoading(true)
    let q = supabase
      .from('workshop_orders')
      .select('*, clients(name, phone)')
      .neq('etapa', 'entregue')
      .order('created_at', { ascending: false })
      .range(0, 9999)
    if (etapaFiltro) q = q.eq('etapa', etapaFiltro)
    else q = q.neq('etapa', 'entregue')
    const { data } = await q
    setOrdens(data || [])
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-navy mb-3">Oficina</h1>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTROS.slice(0, 6).map(f => (
            <button
              key={f.value}
              onClick={() => setEtapaFiltro(f.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                etapaFiltro === f.value ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
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
        ) : ordens.length === 0 ? (
          <div className="text-center py-12">
            <Package size={40} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nenhuma OS na oficina</p>
          </div>
        ) : ordens.map(os => {
          const etapa = ETAPAS.find(e => e.value === os.etapa) || ETAPAS[0]
          const equip = [os.equipment, os.brand, os.model].filter(Boolean).join(' ')
          return (
            <div
              key={os.id}
              onClick={() => navigate(`/m/oficina/${os.id}`)}
              className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.99] transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate mb-0.5">
                    {os.clients?.name || '—'}
                  </div>
                  <div className="text-xs text-gray-500 truncate mb-2">{equip || '—'}</div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${etapa.cor}`}>
                      {etapa.label}
                    </span>
                    <span className="text-xs text-gray-300">{fmtData(os.created_at)}</span>
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
