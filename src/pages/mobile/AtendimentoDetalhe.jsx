import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Phone, MapPin, Clock, Wrench, Package,
  CheckCircle, Edit2, Plus, Trash2, Save, FileText
} from 'lucide-react'
import MobileHeader from '../../components/ui/MobileHeader'
import { supabase } from '../../lib/supabase'

const STATUS_INFO = {
  agendado:     { label: 'Agendado',      bg: 'bg-blue-100',   text: 'text-blue-800',  dot: 'bg-blue-500' },
  em_andamento: { label: 'Em andamento',  bg: 'bg-yellow-100', text: 'text-yellow-800',dot: 'bg-yellow-500' },
  concluido:    { label: 'Concluído',     bg: 'bg-green-100',  text: 'text-green-800', dot: 'bg-green-500' },
  cancelado:    { label: 'Cancelado',     bg: 'bg-gray-100',   text: 'text-gray-500',  dot: 'bg-gray-400' },
}

function fmt(valor) {
  if (!valor && valor !== 0) return '—'
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtHora(str) {
  if (!str) return '—'
  return str.substring(11, 16)
}

function fmtData(str) {
  if (!str) return '—'
  const [y, m, d] = str.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export default function AtendimentoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [servico, setServico] = useState(null)
  const [pecas, setPecas] = useState([])
  const [loading, setLoading] = useState(true)

  // Edição inline
  const [editandoDiagnostico, setEditandoDiagnostico] = useState(false)
  const [diagnostico, setDiagnostico] = useState('')
  const [editandoTrabalho, setEditandoTrabalho] = useState(false)
  const [trabalho, setTrabalho] = useState('')
  const [moOrHand, setMaoDeObra] = useState('')
  const [editandoMao, setEditandoMao] = useState(false)

  // Nova peça
  const [adicionandoPeca, setAdicionandoPeca] = useState(false)
  const [novaPeca, setNovaPeca] = useState({ description: '', quantity: 1, unit_price: '' })

  const [salvando, setSalvando] = useState(false)

  useEffect(() => { buscar() }, [id])

  async function buscar() {
    setLoading(true)
    const { data: s } = await supabase
      .from('services')
      .select('*, clients(name, phone, address, neighborhood, city, cpf)')
      .eq('id', id)
      .single()
    const { data: p } = await supabase
      .from('service_parts')
      .select('*')
      .eq('service_id', id)
      .range(0, 999)
    setServico(s)
    setPecas(p || [])
    setDiagnostico(s?.diagnosis || '')
    setTrabalho(s?.work_done || '')
    setMaoDeObra(s?.labor_price || '')
    setLoading(false)
  }

  async function iniciarAtendimento() {
    setSalvando(true)
    await supabase.from('services').update({ status: 'em_andamento' }).eq('id', id)
    await buscar()
    setSalvando(false)
  }

  async function salvarDiagnostico() {
    await supabase.from('services').update({ diagnosis: diagnostico }).eq('id', id)
    setEditandoDiagnostico(false)
    buscar()
  }

  async function salvarTrabalho() {
    await supabase.from('services').update({ work_done: trabalho }).eq('id', id)
    setEditandoTrabalho(false)
    buscar()
  }

  async function salvarMaoDeObra() {
    const val = parseFloat(String(moOrHand).replace(',', '.')) || 0
    const totalPecas = pecas.reduce((s, p) => s + (p.quantity * p.unit_price), 0)
    await supabase.from('services').update({
      labor_price: val,
      total_price: val + totalPecas
    }).eq('id', id)
    setEditandoMao(false)
    buscar()
  }

  async function adicionarPeca() {
    if (!novaPeca.description) return
    const preco = parseFloat(String(novaPeca.unit_price).replace(',', '.')) || 0
    const { error } = await supabase.from('service_parts').insert({
      service_id: id,
      description: novaPeca.description,
      quantity: novaPeca.quantity,
      unit_price: preco,
    })
    if (!error) {
      setNovaPeca({ description: '', quantity: 1, unit_price: '' })
      setAdicionandoPeca(false)
      // Recalcula total
      const totalPecas = [...pecas, { quantity: novaPeca.quantity, unit_price: preco }]
        .reduce((s, p) => s + (p.quantity * p.unit_price), 0)
      const mao = parseFloat(servico?.labor_price || 0)
      await supabase.from('services').update({ total_price: totalPecas + mao }).eq('id', id)
      buscar()
    }
  }

  async function removerPeca(pecaId) {
    await supabase.from('service_parts').delete().eq('id', pecaId)
    buscar()
  }

  async function concluirAtendimento() {
    if (!window.confirm('Marcar como concluído e gerar cobrança?')) return
    setSalvando(true)
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    const total = servico?.total_price || 0

    await supabase.from('services').update({
      status: 'concluido',
      finished_at: nowStr,
    }).eq('id', id)

    // Gerar conta a receber automaticamente
    if (total > 0) {
      await supabase.from('receivables').insert({
        service_id: id,
        client_id: servico.client_id,
        description: `OS #${id.substring(0,8)} - ${servico.clients?.name || 'Cliente'}`,
        amount: total,
        due_date: nowStr.substring(0,10),
        status: 'pendente',
      })
    }

    setSalvando(false)
    buscar()
  }

  function abrirMaps() {
    const c = servico?.clients
    if (!c) return
    const endereco = [c.address, c.neighborhood, c.city].filter(Boolean).join(', ')
    window.open(`https://maps.google.com/?q=${encodeURIComponent(endereco)}`, '_blank')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!servico) return (
    <div className="min-h-screen flex items-center justify-center text-gray-500">
      Atendimento não encontrado.
    </div>
  )

  const cliente = servico.clients || {}
  const status = STATUS_INFO[servico.status] || STATUS_INFO.agendado
  const totalPecas = pecas.reduce((s, p) => s + (p.quantity * p.unit_price), 0)
  const totalGeral = (parseFloat(servico.labor_price || 0) + totalPecas)
  const emAndamento = servico.status === 'em_andamento'
  const concluido = servico.status === 'concluido'
  const podeEditar = !concluido && servico.status !== 'cancelado'

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <MobileHeader
        titulo={cliente.name || '—'}
        subtitulo={[servico.equipment, servico.brand, servico.model].filter(Boolean).join(' · ')}
        voltarPara="/atendimentos"
        status={
          <span className={`${status.bg} ${status.text} text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
            {status.label}
          </span>
        }
      />

      <div className="px-4 space-y-3 mt-4">

        {/* Contato e localização */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente</span>
          </div>
          {cliente.phone && (
            <a href={`tel:${cliente.phone}`} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 active:bg-gray-50">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                <Phone size={16} className="text-green-700" />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{cliente.phone}</div>
                <div className="text-xs text-gray-400">Toque para ligar</div>
              </div>
            </a>
          )}
          {(cliente.address || cliente.neighborhood || cliente.city) && (
            <button onClick={abrirMaps} className="w-full flex items-center gap-3 px-4 py-3 active:bg-gray-50 text-left">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center">
                <MapPin size={16} className="text-blue-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {[cliente.address, cliente.neighborhood].filter(Boolean).join(', ')}
                </div>
                <div className="text-xs text-blue-600">Abrir no Google Maps →</div>
              </div>
            </button>
          )}
        </div>

        {/* Informações do serviço */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Serviço</span>
          </div>
          <div className="divide-y divide-gray-50">
            <div className="flex items-center gap-3 px-4 py-3">
              <Clock size={16} className="text-gray-400 flex-shrink-0" />
              <div>
                <div className="text-xs text-gray-400">Agendado para</div>
                <div className="text-sm font-medium text-gray-900">
                  {fmtData(servico.scheduled_at)} às {fmtHora(servico.scheduled_at)}
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <Wrench size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-gray-400">Tipo</div>
                <div className="text-sm font-medium text-gray-900">{servico.type || '—'}</div>
              </div>
            </div>
            {servico.problem && (
              <div className="px-4 py-3">
                <div className="text-xs text-gray-400 mb-1">Problema relatado</div>
                <div className="text-sm text-gray-700 leading-relaxed">{servico.problem}</div>
              </div>
            )}
          </div>
        </div>

        {/* Diagnóstico — editável se em andamento */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Diagnóstico</span>
            {podeEditar && !editandoDiagnostico && (
              <button onClick={() => setEditandoDiagnostico(true)} className="p-1.5 rounded-lg bg-gray-100">
                <Edit2 size={14} className="text-gray-500" />
              </button>
            )}
          </div>
          <div className="px-4 py-3">
            {editandoDiagnostico ? (
              <div className="space-y-2">
                <textarea
                  value={diagnostico}
                  onChange={e => setDiagnostico(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
                  placeholder="Descreva o diagnóstico..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={salvarDiagnostico} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                  <button onClick={() => setEditandoDiagnostico(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">
                {servico.diagnosis || <span className="text-gray-300 italic">Nenhum diagnóstico registrado</span>}
              </p>
            )}
          </div>
        </div>

        {/* Trabalho realizado */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Trabalho realizado</span>
            {podeEditar && !editandoTrabalho && (
              <button onClick={() => setEditandoTrabalho(true)} className="p-1.5 rounded-lg bg-gray-100">
                <Edit2 size={14} className="text-gray-500" />
              </button>
            )}
          </div>
          <div className="px-4 py-3">
            {editandoTrabalho ? (
              <div className="space-y-2">
                <textarea
                  value={trabalho}
                  onChange={e => setTrabalho(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"
                  placeholder="Descreva o que foi feito..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={salvarTrabalho} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                  <button onClick={() => setEditandoTrabalho(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">
                {servico.work_done || <span className="text-gray-300 italic">Nenhum trabalho registrado</span>}
              </p>
            )}
          </div>
        </div>

        {/* Peças utilizadas */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Peças utilizadas</span>
            {podeEditar && (
              <button onClick={() => setAdicionandoPeca(true)} className="flex items-center gap-1 bg-navy/10 text-navy rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                <Plus size={13} /> Adicionar
              </button>
            )}
          </div>

          {/* Formulário nova peça */}
          {adicionandoPeca && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
              <input
                value={novaPeca.description}
                onChange={e => setNovaPeca(p => ({ ...p, description: e.target.value }))}
                placeholder="Nome da peça"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={novaPeca.quantity}
                  onChange={e => setNovaPeca(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                  placeholder="Qtd"
                  min={1}
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white"
                />
                <input
                  type="number"
                  value={novaPeca.unit_price}
                  onChange={e => setNovaPeca(p => ({ ...p, unit_price: e.target.value }))}
                  placeholder="Valor unitário"
                  step="0.01"
                  className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={adicionarPeca} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Adicionar</button>
                <button onClick={() => { setAdicionandoPeca(false); setNovaPeca({ description: '', quantity: 1, unit_price: '' }) }} className="px-4 bg-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
              </div>
            </div>
          )}

          <div className="divide-y divide-gray-50">
            {pecas.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-300 italic">Nenhuma peça adicionada</p>
            ) : pecas.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.description}</div>
                  <div className="text-xs text-gray-400">{p.quantity}x · {fmt(p.unit_price)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-900">{fmt(p.quantity * p.unit_price)}</span>
                  {podeEditar && (
                    <button onClick={() => removerPeca(p.id)} className="p-1.5 rounded-lg bg-red-50">
                      <Trash2 size={14} className="text-red-500" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Mão de obra e total */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Valores</span>
            {podeEditar && !editandoMao && (
              <button onClick={() => setEditandoMao(true)} className="p-1.5 rounded-lg bg-gray-100">
                <Edit2 size={14} className="text-gray-500" />
              </button>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-600">Peças</span>
              <span className="text-sm font-medium text-gray-900">{fmt(totalPecas)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-600">Mão de obra</span>
              {editandoMao ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={moOrHand}
                    onChange={e => setMaoDeObra(e.target.value)}
                    className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-primary"
                    step="0.01"
                    autoFocus
                  />
                  <button onClick={salvarMaoDeObra} className="bg-primary text-white rounded-lg px-2 py-1.5">
                    <Save size={14} />
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium text-gray-900">{fmt(servico.labor_price)}</span>
              )}
            </div>
            <div className="flex justify-between items-center px-4 py-3.5 bg-gray-50">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-base font-bold text-navy">{fmt(servico.total_price || totalGeral)}</span>
            </div>
          </div>
        </div>

        {/* Botão Recolher equipamento */}
        {podeEditar && (
          <button
            className="w-full bg-navy/10 text-navy rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
            onClick={() => navigate(`/m/recolher/${id}`)}
          >
            <Package size={18} />
            Recolher Equipamento
          </button>
        )}

        {/* Botão Recibo */}
        <button
          className="w-full border border-gray-200 bg-white text-gray-700 rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition"
          onClick={() => window.open(`/recibo/${id}`, '_blank')}
        >
          <FileText size={18} />
          Ver Recibo
        </button>

      </div>

      {/* CTA fixo no bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-bottom">
        {servico.status === 'agendado' && (
          <button
            onClick={iniciarAtendimento}
            disabled={salvando}
            className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 active:scale-[0.98] transition shadow-lg"
          >
            {salvando ? 'Atualizando...' : '▶  Iniciar Atendimento'}
          </button>
        )}
        {servico.status === 'em_andamento' && (
          <button
            onClick={concluirAtendimento}
            disabled={salvando}
            className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2"
          >
            <CheckCircle size={20} />
            {salvando ? 'Salvando...' : 'Concluir e Gerar Cobrança'}
          </button>
        )}
        {servico.status === 'concluido' && (
          <div className="w-full bg-green-50 text-green-700 rounded-2xl py-4 font-semibold text-sm text-center flex items-center justify-center gap-2">
            <CheckCircle size={18} />
            Atendimento concluído em {fmtData(servico.finished_at)}
          </div>
        )}
      </div>
    </div>
  )
}
