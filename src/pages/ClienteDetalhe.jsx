import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronLeft, Edit2, Save, Phone, MapPin, User, FileText } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y,m,d] = s.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

const STATUS_INFO = {
  agendado:     { label: 'Agendado',     bg: 'bg-blue-100',   text: 'text-blue-700'   },
  em_andamento: { label: 'Em andamento', bg: 'bg-orange-100', text: 'text-orange-700' },
  concluido:    { label: 'Concluído',    bg: 'bg-green-100',  text: 'text-green-700'  },
  recolhido:    { label: 'Recolhido',    bg: 'bg-purple-100', text: 'text-purple-700' },
  cancelado:    { label: 'Cancelado',    bg: 'bg-gray-100',   text: 'text-gray-500'   },
}

export default function ClienteDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [cliente, setCliente] = useState(null)
  const [atendimentos, setAtendimentos] = useState([])
  const [orcamentos, setOrcamentos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [aba, setAba] = useState('atendimentos')

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const [{ data: c }, { data: a }, { data: o }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('services').select('id, scheduled_at, status, type, equipment, brand, model, total_price').eq('client_id', id).order('scheduled_at', { ascending: false }).range(0, 9999),
      supabase.from('quotes').select('id, created_at, status, total_price, equipment, brand, model').eq('client_id', id).order('created_at', { ascending: false }).range(0, 9999),
    ])
    setCliente(c)
    setForm({ name: c?.name||'', phone: c?.phone||'', document: c?.document||'', address: c?.address||'', neighborhood: c?.neighborhood||'', city: c?.city||'' })
    setAtendimentos(a || [])
    setOrcamentos(o || [])
    setLoading(false)
  }

  async function salvar() {
    setSalvando(true)
    await supabase.from('clients').update({
      name: form.name,
      phone: form.phone || null,
      document: form.document || null,
      address: form.address || null,
      neighborhood: form.neighborhood || null,
      city: form.city || null,
    }).eq('id', id)
    setSalvando(false)
    setEditando(false)
    carregar()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/>
    </div>
  )
  if (!cliente) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Cliente não encontrado</div>
  )

  const totalGasto = atendimentos.filter(a => a.status === 'concluido').reduce((s,a) => s + Number(a.total_price||0), 0)
  const totalAtendimentos = atendimentos.length
  const totalConcluidos = atendimentos.filter(a => a.status === 'concluido').length
  const orcamentosAprovados = orcamentos.filter(o => o.status === 'aprovado').length

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-navy text-white px-4 pt-12 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate('/clientes')} className="flex items-center gap-1 text-blue-200 text-sm">
            <ChevronLeft size={18}/> Clientes
          </button>
          <button onClick={() => setEditando(!editando)}
            className="flex items-center gap-1.5 bg-white/10 text-white px-3 py-1.5 rounded-full text-xs font-medium">
            <Edit2 size={13}/> {editando ? 'Cancelar' : 'Editar'}
          </button>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/10 rounded-full flex items-center justify-center flex-shrink-0">
            <User size={24} className="text-white"/>
          </div>
          <div>
            <h1 className="text-xl font-bold">{cliente.name}</h1>
            {cliente.phone && <p className="text-blue-200 text-sm mt-0.5">{cliente.phone}</p>}
            {cliente.document && <p className="text-blue-300 text-xs mt-0.5">CPF/CNPJ: {cliente.document}</p>}
            {(cliente.neighborhood || cliente.city) && (
              <p className="text-blue-300 text-xs mt-0.5">{[cliente.neighborhood, cliente.city].filter(Boolean).join(', ')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Cards métricas */}
      <div className="px-4 -mt-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-400 mb-1">Total gasto</p>
            <p className="text-sm font-bold text-navy">{fmt(totalGasto)}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-400 mb-1">Atendimentos</p>
            <p className="text-lg font-bold text-navy">{totalAtendimentos}</p>
          </div>
          <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
            <p className="text-xs text-gray-400 mb-1">Orçamentos</p>
            <p className="text-lg font-bold text-navy">{orcamentos.length}</p>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-4">

        {/* Formulário edição */}
        {editando && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Editar dados</p>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
              placeholder="Nome" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={form.phone} onChange={e => setForm(f=>({...f,phone:e.target.value}))}
              placeholder="Telefone" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={form.document} onChange={e => setForm(f=>({...f,document:e.target.value}))}
              placeholder="CPF ou CNPJ" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={form.address} onChange={e => setForm(f=>({...f,address:e.target.value}))}
              placeholder="Endereço" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <div className="grid grid-cols-2 gap-2">
              <input value={form.neighborhood} onChange={e => setForm(f=>({...f,neighborhood:e.target.value}))}
                placeholder="Bairro" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              <input value={form.city} onChange={e => setForm(f=>({...f,city:e.target.value}))}
                placeholder="Cidade" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <button onClick={salvar} disabled={salvando}
              className="w-full bg-primary text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
              <Save size={16}/>{salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        )}

        {/* Dados cadastrais */}
        {!editando && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dados cadastrais</p>
            <div className="space-y-2">
              {cliente.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={15} className="text-gray-400 flex-shrink-0"/>
                  <span className="text-sm text-gray-700">{cliente.phone}</span>
                </div>
              )}
              {cliente.document && (
                <div className="flex items-center gap-3">
                  <FileText size={15} className="text-gray-400 flex-shrink-0"/>
                  <span className="text-sm text-gray-700">CPF/CNPJ: {cliente.document}</span>
                </div>
              )}
              {cliente.address && (
                <div className="flex items-center gap-3">
                  <MapPin size={15} className="text-gray-400 flex-shrink-0"/>
                  <span className="text-sm text-gray-700">{[cliente.address, cliente.neighborhood, cliente.city].filter(Boolean).join(', ')}</span>
                </div>
              )}
              {!cliente.phone && !cliente.address && !cliente.document && (
                <p className="text-sm text-gray-400 italic">Nenhum dado adicional cadastrado</p>
              )}
            </div>
          </div>
        )}

        {/* Abas */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden">
          {[
            { id:'atendimentos', label:`Atendimentos (${totalAtendimentos})` },
            { id:'orcamentos', label:`Orçamentos (${orcamentos.length})` },
          ].map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition ${aba===a.id?'bg-navy text-white':'bg-white text-gray-500'}`}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Atendimentos */}
        {aba === 'atendimentos' && (
          <div className="space-y-2 pb-6">
            {atendimentos.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhum atendimento</div>
            ) : atendimentos.map(a => {
              const st = STATUS_INFO[a.status] || STATUS_INFO.agendado
              const equip = [a.equipment, a.brand, a.model].filter(Boolean).join(' ')
              return (
                <div key={a.id} onClick={() => navigate(`/m/atendimento/${a.id}`)}
                  className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer active:scale-[0.99] transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                        {a.type && <span className="text-xs text-gray-400">{a.type}</span>}
                      </div>
                      {equip && <p className="text-sm font-medium text-gray-800 truncate">{equip}</p>}
                      <p className="text-xs text-gray-400 mt-1">{fmtData(a.scheduled_at)}</p>
                    </div>
                    {a.total_price > 0 && <p className="text-sm font-bold text-navy flex-shrink-0">{fmt(a.total_price)}</p>}
                  </div>
                </div>
              )
            })}
            {totalConcluidos > 0 && (
              <div className="bg-green-50 rounded-2xl p-4 flex justify-between items-center">
                <span className="text-sm text-green-700 font-medium">Total em {totalConcluidos} serviço{totalConcluidos>1?'s':''}</span>
                <span className="text-base font-bold text-green-700">{fmt(totalGasto)}</span>
              </div>
            )}
          </div>
        )}

        {/* Orçamentos */}
        {aba === 'orcamentos' && (
          <div className="space-y-2 pb-6">
            {orcamentos.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Nenhum orçamento</div>
            ) : orcamentos.map(o => {
              const equip = [o.equipment, o.brand, o.model].filter(Boolean).join(' ')
              return (
                <div key={o.id} onClick={() => navigate(`/m/orcamento/${o.id}`)}
                  className="bg-white rounded-2xl shadow-sm p-4 cursor-pointer active:scale-[0.99] transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          o.status==='aprovado' ? 'bg-green-100 text-green-700' :
                          o.status==='recusado' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {o.status==='aprovado'?'Aprovado':o.status==='recusado'?'Recusado':'Pendente'}
                        </span>
                      </div>
                      {equip && <p className="text-sm font-medium text-gray-800 truncate">{equip}</p>}
                      <p className="text-xs text-gray-400 mt-1">{fmtData(o.created_at)}</p>
                    </div>
                    {o.total_price > 0 && <p className="text-sm font-bold text-navy flex-shrink-0">{fmt(o.total_price)}</p>}
                  </div>
                </div>
              )
            })}
            {orcamentosAprovados > 0 && (
              <div className="bg-green-50 rounded-2xl p-4 flex justify-between items-center">
                <span className="text-sm text-green-700 font-medium">{orcamentosAprovados} aprovado{orcamentosAprovados>1?'s':''}</span>
                <span className="text-base font-bold text-green-700">
                  {fmt(orcamentos.filter(o=>o.status==='aprovado').reduce((s,o)=>s+Number(o.total_price||0),0))}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
