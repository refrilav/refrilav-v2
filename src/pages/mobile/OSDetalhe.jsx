import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Edit2, Plus, Trash2, Save, CheckCircle, FileText
} from 'lucide-react'
import MobileHeader from '../../components/ui/MobileHeader'
import { supabase } from '../../lib/supabase'

const ETAPAS = [
  { value: 'recolhido',          label: 'Recolhido',          cor: 'bg-gray-100 text-gray-600',    dot: 'bg-gray-400' },
  { value: 'orcamento_enviado',  label: 'Orçamento enviado',  cor: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500' },
  { value: 'orcamento_aprovado', label: 'Orçamento aprovado', cor: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' },
  { value: 'em_conserto',        label: 'Em conserto',        cor: 'bg-yellow-100 text-yellow-700',dot: 'bg-yellow-500' },
  { value: 'pronto',             label: 'Pronto',             cor: 'bg-green-100 text-green-700',  dot: 'bg-green-500' },
  { value: 'entregue',           label: 'Entregue',           cor: 'bg-gray-100 text-gray-500',    dot: 'bg-gray-300' },
]

const PROXIMA_ETAPA = {
  recolhido:          'orcamento_enviado',
  orcamento_enviado:  'orcamento_aprovado',
  orcamento_aprovado: 'em_conserto',
  em_conserto:        'pronto',
  pronto:             'entregue',
}

const LABEL_BOTAO = {
  recolhido:          'Enviar Orçamento',
  orcamento_enviado:  'Marcar como Aprovado',
  orcamento_aprovado: 'Iniciar Conserto',
  em_conserto:        'Marcar como Pronto',
  pronto:             'Registrar Entrega',
}

function fmt(valor) {
  if (!valor && valor !== 0) return '—'
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtData(str) {
  if (!str) return '—'
  const [y,m,d] = str.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

export default function OSDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [os, setOs] = useState(null)
  const [pecas, setPecas] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [editandoDiagnostico, setEditandoDiagnostico] = useState(false)
  const [diagnostico, setDiagnostico] = useState('')
  const [editandoTrabalho, setEditandoTrabalho] = useState(false)
  const [trabalho, setTrabalho] = useState('')
  const [editandoMao, setEditandoMao] = useState(false)
  const [maoDeObra, setMaoDeObra] = useState('')
  const [adicionandoPeca, setAdicionandoPeca] = useState(false)
  const [novaPeca, setNovaPeca] = useState({ description: '', quantity: 1, unit_price: '' })

  useEffect(() => { buscar() }, [id])

  async function buscar() {
    setLoading(true)
    const { data: o } = await supabase
      .from('workshop_orders')
      .select('*, clients(name, phone, address, neighborhood, city)')
      .eq('id', id)
      .single()
    const { data: p } = await supabase
      .from('service_parts')
      .select('*')
      .eq('workshop_order_id', id)
      .range(0, 999)
    setOs(o)
    setPecas(p || [])
    setDiagnostico(o?.diagnosis || '')
    setTrabalho(o?.work_done || '')
    setMaoDeObra(o?.labor_price || '')
    setLoading(false)
  }

  async function excluirOS() {
    if (!window.confirm('Excluir esta OS? Esta ação não pode ser desfeita.')) return
    setSalvando(true)
    try {
      await supabase.from('service_parts').delete().eq('workshop_order_id', id)
      await supabase.from('receivables').delete().eq('workshop_order_id', id)
      // Desvincula o atendimento original se houver
      if (os.service_id) {
        await supabase.from('services').update({ workshop_order_id: null, status: 'agendado' }).eq('id', os.service_id)
      }
      await supabase.from('workshop_orders').delete().eq('id', id)
      navigate('/oficina')
    } catch (e) {
      alert('Erro ao excluir: ' + e.message)
    }
    setSalvando(false)
  }

  async function avancarEtapa() {
    const proxima = PROXIMA_ETAPA[os.etapa]
    if (!proxima) return
    setSalvando(true)

    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

    await supabase.from('workshop_orders').update({ etapa: proxima }).eq('id', id)

    // Se entregue → gera conta a receber
    if (proxima === 'entregue') {
      const total = os.total_price || 0
      if (total > 0) {
        await supabase.from('receivables').insert({
          workshop_order_id: id,
          client_id: os.client_id,
          description: `Oficina - ${os.clients?.name || 'Cliente'} - ${[os.equipment, os.brand, os.model].filter(Boolean).join(' ')}`,
          amount: total,
          due_date: nowStr.substring(0, 10),
          status: 'pendente',
        })
      }
    }

    setSalvando(false)
    buscar()
  }

  async function salvarDiagnostico() {
    await supabase.from('workshop_orders').update({ diagnosis: diagnostico }).eq('id', id)
    setEditandoDiagnostico(false)
    buscar()
  }

  async function salvarTrabalho() {
    await supabase.from('workshop_orders').update({ work_done: trabalho }).eq('id', id)
    setEditandoTrabalho(false)
    buscar()
  }

  async function salvarMaoDeObra() {
    const val = parseFloat(String(maoDeObra).replace(',', '.')) || 0
    const totalPecas = pecas.reduce((s, p) => s + (p.quantity * p.unit_price), 0)
    await supabase.from('workshop_orders').update({
      labor_price: val,
      total_price: val + totalPecas,
    }).eq('id', id)
    setEditandoMao(false)
    buscar()
  }

  async function adicionarPeca() {
    if (!novaPeca.description) return
    const preco = parseFloat(String(novaPeca.unit_price).replace(',', '.')) || 0
    await supabase.from('service_parts').insert({
      workshop_order_id: id,
      name: novaPeca.description,
      quantity: novaPeca.quantity,
      unit_price: preco,
    })
    const totalPecas = [...pecas, { quantity: novaPeca.quantity, unit_price: preco }]
      .reduce((s, p) => s + (p.quantity * p.unit_price), 0)
    const mao = parseFloat(os?.labor_price || 0)
    await supabase.from('workshop_orders').update({ total_price: totalPecas + mao }).eq('id', id)
    setNovaPeca({ description: '', quantity: 1, unit_price: '' })
    setAdicionandoPeca(false)
    buscar()
  }

  async function removerPeca(pecaId) {
    await supabase.from('service_parts').delete().eq('id', pecaId)
    buscar()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!os) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
      OS não encontrada.
    </div>
  )

  const etapaAtual = ETAPAS.find(e => e.value === os.etapa) || ETAPAS[0]
  const idxAtual = ETAPAS.findIndex(e => e.value === os.etapa)
  const podeEditar = os.etapa !== 'entregue'
  const totalPecas = pecas.reduce((s, p) => s + (p.quantity * p.unit_price), 0)
  const cliente = os.clients || {}

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <MobileHeader
        titulo={cliente.name || '—'}
        subtitulo={[os.equipment, os.brand, os.model].filter(Boolean).join(' · ')}
        voltarPara="/oficina"
        acoes={
          <button onClick={excluirOS} className="flex items-center justify-center w-8 h-8 bg-white/10 rounded-full">
            <Trash2 size={15} className="text-red-300" />
          </button>
        }
        status={
          <span className={`${etapaAtual.cor} text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${etapaAtual.dot}`} />
            {etapaAtual.label}
          </span>
        }
      />

      {/* Barra de progresso das etapas */}
      <div className="bg-white border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-1">
          {ETAPAS.map((e, i) => (
            <div key={e.value} className="flex items-center flex-1">
              <div className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= idxAtual ? 'bg-primary' : 'bg-gray-100'
              }`} />
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-gray-400">Recolhido</span>
          <span className="text-[9px] text-gray-400">Entregue</span>
        </div>
      </div>

      <div className="px-4 space-y-3 mt-4">

        {/* Cliente */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente</span>
          </div>
          <div className="px-4 py-3 space-y-1">
            <div className="text-sm font-medium text-gray-900">{cliente.name || '—'}</div>
            {cliente.phone && (
              <a href={`tel:${cliente.phone}`} className="text-sm text-blue-600">{cliente.phone}</a>
            )}
            {cliente.address && (
              <div className="text-xs text-gray-400">
                {[cliente.address, cliente.neighborhood, cliente.city].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Problema */}
        {os.problem && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Problema relatado</span>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm text-gray-700 leading-relaxed">{os.problem}</p>
            </div>
          </div>
        )}

        {/* Assinatura de autorização */}
        {podeEditar && !os.auth_signature && (
          <button
            onClick={() => navigate(`/m/recolher/${os.service_id}?assinar=1&os_id=${id}`)}
            className="w-full bg-white border border-dashed border-gray-300 rounded-2xl py-4 text-sm font-medium text-gray-500 flex items-center justify-center gap-2 shadow-sm"
          >
            <FileText size={16} />
            Coletar assinatura do cliente
          </button>
        )}
        {os.auth_signature && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Autorização de Retirada</span>
            </div>
            <div className="px-4 py-3">
              <img src={os.auth_signature} alt="Assinatura" className="w-full h-24 object-contain border border-gray-100 rounded-xl bg-gray-50" />
              <p className="text-xs text-gray-400 mt-1">
                Assinado em {fmtData(os.auth_signed_at)} por {os.auth_signer_name || cliente.name}
              </p>
            </div>
          </div>
        )}

        {/* Diagnóstico */}
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
                <textarea value={diagnostico} onChange={e => setDiagnostico(e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" autoFocus />
                <div className="flex gap-2">
                  <button onClick={salvarDiagnostico} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                  <button onClick={() => setEditandoDiagnostico(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">
                {os.diagnosis || <span className="text-gray-300 italic">Nenhum diagnóstico registrado</span>}
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
                <textarea value={trabalho} onChange={e => setTrabalho(e.target.value)} rows={4}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" autoFocus />
                <div className="flex gap-2">
                  <button onClick={salvarTrabalho} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                  <button onClick={() => setEditandoTrabalho(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed">
                {os.work_done || <span className="text-gray-300 italic">Nenhum trabalho registrado</span>}
              </p>
            )}
          </div>
        </div>

        {/* Peças */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Peças utilizadas</span>
            {podeEditar && (
              <button onClick={() => setAdicionandoPeca(true)} className="flex items-center gap-1 bg-navy/10 text-navy rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                <Plus size={13} /> Adicionar
              </button>
            )}
          </div>
          {adicionandoPeca && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
              <input value={novaPeca.description} onChange={e => setNovaPeca(p => ({ ...p, description: e.target.value }))}
                placeholder="Nome da peça" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white" autoFocus />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={novaPeca.quantity} onChange={e => setNovaPeca(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                  placeholder="Qtd" min={1} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white" />
                <input type="number" value={novaPeca.unit_price} onChange={e => setNovaPeca(p => ({ ...p, unit_price: e.target.value }))}
                  placeholder="Valor unitário" step="0.01" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary bg-white" />
              </div>
              <div className="flex gap-2">
                <button onClick={adicionarPeca} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Adicionar</button>
                <button onClick={() => { setAdicionandoPeca(false); setNovaPeca({ description: '', quantity: 1, unit_price: '' }) }}
                  className="px-4 bg-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
              </div>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {pecas.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-300 italic">Nenhuma peça adicionada</p>
            ) : pecas.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{p.name || p.description}</div>
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

        {/* Valores */}
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
              <span className="text-sm font-medium">{fmt(totalPecas)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-3">
              <span className="text-sm text-gray-600">Mão de obra</span>
              {editandoMao ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={maoDeObra} onChange={e => setMaoDeObra(e.target.value)}
                    className="w-28 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right focus:outline-none focus:border-primary" step="0.01" autoFocus />
                  <button onClick={salvarMaoDeObra} className="bg-primary text-white rounded-lg px-2 py-1.5">
                    <Save size={14} />
                  </button>
                </div>
              ) : (
                <span className="text-sm font-medium">{fmt(os.labor_price)}</span>
              )}
            </div>
            <div className="flex justify-between items-center px-4 py-3.5 bg-gray-50">
              <span className="text-sm font-bold text-gray-900">Total</span>
              <span className="text-base font-bold text-navy">{fmt(os.total_price || totalPecas)}</span>
            </div>
          </div>
        </div>

        {/* Botão recibo */}
        <button
          className="w-full border border-gray-200 bg-white text-gray-700 rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2"
          onClick={() => window.open(`/recibo/${id}`, '_blank')}
        >
          <FileText size={18} />
          Ver Recibo
        </button>

      </div>

      {/* CTA fixo */}
      {podeEditar && PROXIMA_ETAPA[os.etapa] && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-bottom">
          <button
            onClick={avancarEtapa}
            disabled={salvando}
            className={`w-full rounded-2xl py-4 font-bold text-base disabled:opacity-60 active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2 ${
              PROXIMA_ETAPA[os.etapa] === 'entregue'
                ? 'bg-green-600 text-white'
                : 'bg-primary text-white'
            }`}
          >
            {PROXIMA_ETAPA[os.etapa] === 'entregue' && <CheckCircle size={20} />}
            {salvando ? 'Salvando...' : LABEL_BOTAO[os.etapa]}
          </button>
        </div>
      )}

      {os.etapa === 'entregue' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 safe-bottom">
          <div className="w-full bg-green-50 text-green-700 rounded-2xl py-4 font-semibold text-sm text-center flex items-center justify-center gap-2">
            <CheckCircle size={18} />
            Entregue em {fmtData(os.updated_at)}
          </div>
        </div>
      )}
    </div>
  )
}
