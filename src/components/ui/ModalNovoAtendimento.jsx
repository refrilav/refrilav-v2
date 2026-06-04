import { useState, useEffect, useRef } from 'react'
import { X, Search, User, ChevronDown, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TIPOS = ['Instalação','Manutenção','Reparo','Limpeza','Visita Técnica','Orçamento']
const EQUIPAMENTOS = ['Ar-condicionado','Lavadora','Bebedouro','Geladeira','Outro']

export default function ModalNovoAtendimento({ dataHora, onClose, onSalvo }) {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState([])
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [form, setForm] = useState({
    scheduled_at: dataHora || '',
    type: 'Manutenção',
    equipment: 'Ar-condicionado',
    brand: '',
    model: '',
    problem: '',
  })
  const [salvando, setSalvando] = useState(false)
  const buscaRef = useRef(null)

  useEffect(() => {
    if (busca.length < 2) { setClientes([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, address, neighborhood, city')
        .ilike('name', `%${busca}%`)
        .range(0, 9)
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

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function salvar() {
    if (!clienteSelecionado) return alert('Selecione um cliente.')
    if (!form.scheduled_at) return alert('Informe data e horário.')
    setSalvando(true)
    const payload = {
      client_id: clienteSelecionado.id,
      scheduled_at: form.scheduled_at,
      type: form.type,
      equipment: form.equipment,
      brand: form.brand || null,
      model: form.model || null,
      problem: form.problem || null,
      status: 'agendado',
    }
    const { error } = await supabase.from('services').insert(payload)
    setSalvando(false)
    if (error) return alert('Erro ao salvar: ' + error.message)
    onSalvo()
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-gray-100 sticky top-0 bg-white safe-top">
          <button onClick={onClose} className="flex items-center gap-1 text-primary text-sm font-medium">
            <ChevronLeft size={20} /> Voltar
          </button>
          <h2 className="font-semibold text-navy text-base">Novo Atendimento</h2>
          <div className="w-16" />
        </div>

        <div className="p-4 space-y-4">
          {/* Busca de cliente */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente *</label>
            <div className="relative">
              <input
                ref={buscaRef}
                value={busca}
                onChange={e => { setBusca(e.target.value); setClienteSelecionado(null) }}
                placeholder="Buscar cliente pelo nome..."
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm pr-10 focus:outline-none focus:border-primary"
              />
              <Search size={16} className="absolute right-3 top-3.5 text-gray-400" />
              {mostrarResultados && clientes.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                  {clientes.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selecionarCliente(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-8 h-8 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <User size={14} className="text-navy" />
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
          </div>

          {/* Data e hora */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Data e horário *</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => set('scheduled_at', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tipo de serviço</label>
            <div className="relative">
              <select
                value={form.type}
                onChange={e => set('type', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:border-primary bg-white"
              >
                {TIPOS.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Equipamento */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Equipamento</label>
            <div className="relative">
              <select
                value={form.equipment}
                onChange={e => set('equipment', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm appearance-none focus:outline-none focus:border-primary bg-white"
              >
                {EQUIPAMENTOS.map(t => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Marca e modelo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Marca</label>
              <input
                value={form.brand}
                onChange={e => set('brand', e.target.value)}
                placeholder="Ex: Samsung"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Modelo</label>
              <input
                value={form.model}
                onChange={e => set('model', e.target.value)}
                placeholder="Ex: 12000 BTU"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Problema */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Problema relatado</label>
            <textarea
              value={form.problem}
              onChange={e => set('problem', e.target.value)}
              placeholder="Descreva o problema..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Botão salvar */}
          <button
            onClick={salvar}
            disabled={salvando}
            className="w-full bg-primary text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-60 active:scale-[0.98] transition"
          >
            {salvando ? 'Salvando...' : 'Agendar Atendimento'}
          </button>
          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}
