import { useState, useEffect, useRef } from 'react'
import { Search, User, ChevronDown, ChevronLeft, Plus, X, Save } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TIPOS = ['Instalação','Manutenção','Reparo','Limpeza','Visita Técnica','Orçamento']
const EQUIPAMENTOS = ['Ar-condicionado','Lavadora','Bebedouro','Geladeira','Outro']
const DURACOES = [
  { label: '30 min', value: 30 },
  { label: '1 hora', value: 60 },
  { label: '1h30', value: 90 },
  { label: '2 horas', value: 120 },
  { label: '3 horas', value: 180 },
  { label: '4 horas', value: 240 },
]

function addMinutos(datetimeStr, minutos) {
  if (!datetimeStr) return null
  const [date, time] = datetimeStr.split('T')
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutos
  const nh = Math.floor(total / 60) % 24
  const nm = total % 60
  return `${date}T${String(nh).padStart(2,'0')}:${String(nm).padStart(2,'0')}`
}

const FORM_CLIENTE_VAZIO = { name:'', phone:'', address:'', neighborhood:'', city:'' }

export default function ModalNovoAtendimento({ dataHora, onClose, onSalvo }) {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState([])
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [form, setForm] = useState({
    scheduled_at: dataHora || '',
    duracao: 60,
    type: 'Manutenção',
    equipment: 'Ar-condicionado',
    brand: '',
    model: '',
    problem: '',
  })
  const [salvando, setSalvando] = useState(false)

  // Modal novo cliente
  const [modalCliente, setModalCliente] = useState(false)
  const [formCliente, setFormCliente] = useState(FORM_CLIENTE_VAZIO)
  const [salvandoCliente, setSalvandoCliente] = useState(false)

  const buscaRef = useRef(null)

  useEffect(() => {
    if (busca.length < 2) { setClientes([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('clients')
        .select('id, name, phone, address, neighborhood, city')
        .ilike('name', `%${busca}%`).range(0, 9999)
      setClientes(data || [])
      setMostrarResultados(true)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  function selecionarCliente(c) {
    setClienteSelecionado(c)
    setBusca(c.name)
    setMostrarResultados(false)
  }

  async function criarCliente() {
    if (!formCliente.name.trim()) return alert('Informe o nome do cliente.')
    setSalvandoCliente(true)
    const { data, error } = await supabase.from('clients').insert({
      name: formCliente.name.trim(),
      phone: formCliente.phone || null,
      address: formCliente.address || null,
      neighborhood: formCliente.neighborhood || null,
      city: formCliente.city || null,
    }).select().single()
    setSalvandoCliente(false)
    if (error) return alert('Erro: ' + error.message)
    selecionarCliente(data)
    setModalCliente(false)
    setFormCliente(FORM_CLIENTE_VAZIO)
  }

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }

  async function salvar() {
    if (!clienteSelecionado) return alert('Selecione um cliente.')
    if (!form.scheduled_at) return alert('Informe data e horário.')
    setSalvando(true)
    const scheduled_end = addMinutos(form.scheduled_at, form.duracao)
    const { error } = await supabase.from('services').insert({
      client_id: clienteSelecionado.id,
      scheduled_at: form.scheduled_at,
      scheduled_end,
      type: form.type,
      equipment: form.equipment,
      brand: form.brand || null,
      model: form.model || null,
      problem: form.problem || null,
      status: 'agendado',
    })
    setSalvando(false)
    if (error) return alert('Erro ao salvar: ' + error.message)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-100 sticky top-0 bg-white">
          <button onClick={onClose} className="flex items-center gap-1 text-primary text-sm font-medium">
            <ChevronLeft size={20}/> Voltar
          </button>
          <h2 className="font-semibold text-navy text-base">Novo Atendimento</h2>
          <div className="w-16"/>
        </div>

        <div className="p-4 space-y-4">

          {/* Cliente */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Cliente *</label>
              <button onClick={() => { setFormCliente(FORM_CLIENTE_VAZIO); setModalCliente(true) }}
                className="flex items-center gap-1 text-xs text-primary font-semibold">
                <Plus size={12}/> Novo cliente
              </button>
            </div>
            <div className="relative">
              <input ref={buscaRef} value={busca}
                onChange={e => { setBusca(e.target.value); setClienteSelecionado(null) }}
                placeholder="Buscar cliente pelo nome..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:border-primary"/>
              <Search size={16} className="absolute right-3 top-3.5 text-gray-400"/>
              {mostrarResultados && clientes.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                  {clientes.map(c => (
                    <button key={c.id} onClick={() => selecionarCliente(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                      <div className="w-8 h-8 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-navy"/>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{c.name}</div>
                        <div className="text-xs text-gray-400">{c.phone} · {c.neighborhood || c.city || ''}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {clienteSelecionado && (
              <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                ✓ {clienteSelecionado.name}
                {clienteSelecionado.phone && <span className="text-gray-400">· {clienteSelecionado.phone}</span>}
              </p>
            )}
          </div>

          {/* Data e hora */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data e horário *</label>
            <input type="datetime-local" value={form.scheduled_at} onChange={e => set('scheduled_at', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"/>
          </div>

          {/* Duração */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">Duração estimada</label>
            <div className="grid grid-cols-3 gap-2">
              {DURACOES.map(d => (
                <button key={d.value} onClick={() => set('duracao', d.value)}
                  className={`py-2.5 rounded-xl text-sm font-medium border transition ${
                    form.duracao === d.value ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200'
                  }`}>{d.label}</button>
              ))}
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de serviço</label>
            <div className="relative">
              <select value={form.type} onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:border-primary bg-white">
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none"/>
            </div>
          </div>

          {/* Equipamento */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Equipamento</label>
            <div className="relative">
              <select value={form.equipment} onChange={e => set('equipment', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:border-primary bg-white">
                {EQUIPAMENTOS.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none"/>
            </div>
          </div>

          {/* Marca e modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
              <input value={form.brand} onChange={e => set('brand', e.target.value)} placeholder="Ex: Samsung"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Modelo</label>
              <input value={form.model} onChange={e => set('model', e.target.value)} placeholder="Ex: 12000 BTU"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"/>
            </div>
          </div>

          {/* Problema */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Problema relatado</label>
            <textarea value={form.problem} onChange={e => set('problem', e.target.value)}
              placeholder="Descreva o problema..." rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"/>
          </div>

          <button onClick={salvar} disabled={salvando}
            className="w-full bg-primary text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-60">
            {salvando ? 'Salvando...' : 'Agendar Atendimento'}
          </button>
          <div className="h-4"/>
        </div>
      </div>

      {/* Modal novo cliente — sobre o modal de atendimento */}
      {modalCliente && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4" style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Novo Cliente</h3>
              <button onClick={() => setModalCliente(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <input value={formCliente.name} onChange={e => setFormCliente(f=>({...f,name:e.target.value}))}
              placeholder="Nome *" autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={formCliente.phone} onChange={e => setFormCliente(f=>({...f,phone:e.target.value}))}
              placeholder="Telefone"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={formCliente.address} onChange={e => setFormCliente(f=>({...f,address:e.target.value}))}
              placeholder="Endereço"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <div className="grid grid-cols-2 gap-2">
              <input value={formCliente.neighborhood} onChange={e => setFormCliente(f=>({...f,neighborhood:e.target.value}))}
                placeholder="Bairro"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              <input value={formCliente.city} onChange={e => setFormCliente(f=>({...f,city:e.target.value}))}
                placeholder="Cidade"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <button onClick={criarCliente} disabled={salvandoCliente}
              className="w-full bg-primary text-white rounded-2xl py-4 font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              <Save size={18}/>{salvandoCliente ? 'Salvando...' : 'Cadastrar e Selecionar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
