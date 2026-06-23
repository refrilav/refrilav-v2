import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, FileText, Plus, X, Search, User, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'

const FILTROS = [
  { label: 'Todos', value: '' },
  { label: 'Pendentes', value: 'pendente' },
  { label: 'Aprovados', value: 'aprovado' },
  { label: 'Recusados', value: 'recusado' },
]

const STATUS_INFO = {
  pendente: { label: 'Pendente', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  aprovado: { label: 'Aprovado', bg: 'bg-green-100',  text: 'text-green-700'  },
  recusado: { label: 'Recusado', bg: 'bg-red-100',    text: 'text-red-700'    },
}

const EQUIPAMENTOS = ['Ar-condicionado','Lavadora','Bebedouro','Geladeira','Outro']

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

  // Modal novo orçamento
  const [modalNovo, setModalNovo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({ equipment:'Ar-condicionado', brand:'', model:'', problem:'' })

  // Busca de cliente
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesSugestoes, setClientesSugestoes] = useState([])
  const [clienteSelecionado, setClienteSelecionado] = useState(null)

  useEffect(() => { buscar() }, [filtro])

  useEffect(() => {
    if (buscaCliente.length < 2) { setClientesSugestoes([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('clients')
        .select('id, name, phone').ilike('name', `%${buscaCliente}%`).range(0, 9)
      setClientesSugestoes(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente])

  async function buscar() {
    setLoading(true)
    let q = supabase.from('quotes').select('*, clients(name, phone)')
      .order('created_at', { ascending: false }).range(0, 9999)
    if (filtro) q = q.eq('status', filtro)
    const { data } = await q
    setOrcamentos(data || [])
    setLoading(false)
  }

  function abrirNovo() {
    setForm({ equipment:'Ar-condicionado', brand:'', model:'', problem:'' })
    setBuscaCliente('')
    setClienteSelecionado(null)
    setClientesSugestoes([])
    setModalNovo(true)
  }

  async function criarOrcamento() {
    if (!clienteSelecionado) return alert('Selecione um cliente.')
    setSalvando(true)
    const { data: orc, error } = await supabase.from('quotes').insert({
      client_id: clienteSelecionado.id,
      equipment: form.equipment || null,
      brand: form.brand || null,
      model: form.model || null,
      problem: form.problem || null,
      status: 'pendente',
    }).select().single()
    setSalvando(false)
    if (error) return alert('Erro: ' + error.message)
    setModalNovo(false)
    // Abre direto para editar
    navigate(`/m/orcamento/${orc.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Orçamentos</h1>
          <button onClick={abrirNovo}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Plus size={15}/> Novo
          </button>
        </div>
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
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : orcamentos.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-400 text-sm">Nenhum orçamento encontrado</p>
          </div>
        ) : orcamentos.map(o => {
          const st = STATUS_INFO[o.status] || STATUS_INFO.pendente
          const equip = [o.equipment, o.brand, o.model].filter(Boolean).join(' ')
          return (
            <div key={o.id}
              onClick={() => navigate(`/m/orcamento/${o.id}`)}
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
                <ChevronRight size={16} className="text-gray-300 flex-shrink-0 mt-1"/>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal novo orçamento */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-bold text-navy">Novo Orçamento</h3>
              <button onClick={() => setModalNovo(false)}><X size={20} className="text-gray-400"/></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Cliente */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Cliente *</label>
                <div className="relative">
                  <input value={buscaCliente}
                    onChange={e => { setBuscaCliente(e.target.value); setClienteSelecionado(null) }}
                    placeholder="Buscar cliente..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary pr-9"/>
                  <Search size={15} className="absolute right-3 top-3 text-gray-400"/>
                  {clientesSugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                      {clientesSugestoes.map(c => (
                        <button key={c.id} onClick={() => { setClienteSelecionado(c); setBuscaCliente(c.name); setClientesSugestoes([]) }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                          <div className="w-7 h-7 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <User size={13} className="text-navy"/>
                          </div>
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {clienteSelecionado && <p className="text-xs text-green-600 mt-1">✓ {clienteSelecionado.name}</p>}
              </div>

              {/* Equipamento */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Equipamento</label>
                <div className="flex gap-2 flex-wrap">
                  {EQUIPAMENTOS.map(e => (
                    <button key={e} onClick={() => setForm(f=>({...f,equipment:e}))}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition ${form.equipment===e?'bg-navy text-white border-navy':'bg-white text-gray-600 border-gray-200'}`}>
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Marca e modelo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Marca</label>
                  <input value={form.brand} onChange={e => setForm(f=>({...f,brand:e.target.value}))}
                    placeholder="Ex: Samsung"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Modelo</label>
                  <input value={form.model} onChange={e => setForm(f=>({...f,model:e.target.value}))}
                    placeholder="Ex: 12000 BTU"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
              </div>

              {/* Problema */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Problema relatado</label>
                <textarea value={form.problem} onChange={e => setForm(f=>({...f,problem:e.target.value}))}
                  placeholder="Descreva o problema..." rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"/>
              </div>

            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0"
              style={{paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
              <button onClick={criarOrcamento} disabled={salvando || !clienteSelecionado}
                className="w-full bg-primary text-white rounded-2xl py-4 font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                <Save size={18}/>{salvando ? 'Criando...' : 'Criar Orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
