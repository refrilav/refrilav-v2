// Módulo PMOC — Plano de Manutenção, Operação e Controle
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency, formatDate } from '../utils/helpers'
import {
  Plus, Search, X, Trash2, Edit2, FileText, ChevronDown,
  CheckCircle, Clock, AlertTriangle, Settings, Users, Package, DollarSign
} from 'lucide-react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'

// ─── Checklists por tipo ──────────────────────────────────────────────────────
const CHECKLIST_MENSAL = [
  'Inspecionar visualmente todos os equipamentos (danos físicos, corrosão, sujidade visível)',
  'Verificar e limpar os filtros de ar (lavar ou substituir se descartáveis — máx. 3 meses)',
  'Limpar a bandeja de condensado (remover sujidade e verificar escoamento livre)',
  'Verificar e limpar a tomada de ar externo / grelhas de ventilação',
  'Limpar a casa de máquinas e área ao redor dos equipamentos externos',
  'Medir e registrar tensão elétrica (R-S-T) nas unidades condensadoras',
  'Verificar ruídos e vibrações anormais em todas as unidades',
  'Verificar dreno e sistema de escoamento de condensado (sem entupimento ou refluxo)',
  'Verificar estado das aletas da evaporadora (deformações, obstruções)',
  'Verificar operação do controle remoto / painel de controle',
  'Registrar temperatura de operação do ambiente (°C) e umidade relativa (%UR)',
  'Registrar ocorrências e anomalias detectadas para acompanhamento',
]

const CHECKLIST_TRIMESTRAL_EXTRA = [
  'Limpar serpentinas do evaporador (produto biodegradável registrado MS)',
  'Limpar serpentinas do condensador (remover pó, detritos e sujidade)',
  'Verificar nível de gás refrigerante (pressões de sucção e descarga)',
  'Medir corrente elétrica dos compressores e ventiladores',
  'Verificar superaquecimento e sub-resfriamento do sistema (quando aplicável)',
  'Limpar e verificar o umidificador de ar (quando houver)',
  'Verificar estado e tensão das correias / polias (quando aplicável)',
  'Verificar e apertar conexões elétricas (evitar resistência de contato)',
  'Inspecionar cabos e fios (isolamento, fixação, ausência de aquecimento)',
  'Verificar a estrutura de suporte e fixações das unidades externas e internas',
  'Verificar válvulas de expansão termostática (se aplicável)',
  'Verificar estado do isolamento térmico das tubulações de cobre',
  'Registrar pressões e temperaturas de operação em formulário específico',
]

const CHECKLIST_SEMESTRAL_EXTRA = [
  'Limpar ventiladores (pás, hélices, carcaça) com produto adequado',
  'Limpar dutos de ar condicionado (inspecionar e higienizar quando indicado)',
  'Inspecionar e limpar caixas de ar (plenum) e difusores / grelhas de insuflamento',
  'Verificar equipamentos de controle (termostatos, sensores, atuadores)',
  'Verificar e calibrar sensores de temperatura e umidade (quando existentes)',
  'Testar funcionamento de alarmes e dispositivos de proteção (se existentes)',
  'Verificar hermeticidade do sistema (ausência de vazamentos de gás)',
  'ANÁLISE DE QUALIDADE DO AR INTERIOR — realizada por laboratório credenciado',
  'Coleta de amostras microbiológicas conforme NBR 17.037:23',
  'Coleta de amostras físico-químicas (CO2, material particulado, COVs)',
  'Receber e arquivar Laudo Laboratorial; comunicar resultado aos ocupantes',
  'Em caso de não conformidade: higienizar em até 72h e agendar reanálise em 30 dias',
  'Registrar e assinar Relatório Semestral completo de todas as atividades executadas',
]

const CHECKLIST_ANUAL_EXTRA = [
  'Inspeção estrutural completa de todas as instalações e dutos',
  'Verificar e substituir componentes com desgaste (rolamentos, condensadores eletrolíticos)',
  'Revisar e substituir filtros de alta eficiência (HEPA / absolutos — se existentes)',
  'Verificar e reapertar toda a fiação elétrica (disjuntores, contactoras, fusíveis)',
  'Medir e registrar eficiência energética (COP / EER) dos equipamentos',
  'Realizar drenagem e limpeza do sistema de água gelada (chillers — se houver)',
  'Inspecionar e tratar torre de resfriamento contra Legionella (se houver)',
  'Verificar documentação: manuais, laudos e ordens de serviço dos 12 meses anteriores',
  'Revisar e atualizar o documento PMOC (equipamentos novos, substituições, reformas)',
  'Emitir Relatório Anual consolidado e entregar ao responsável do estabelecimento',
  'Renovar a ART do Responsável Técnico para o próximo período de vigência',
  'Verificar conformidade com normas atualizadas (ABNT, ANVISA, legislação vigente)',
  'Assinar e datar o PMOC atualizado — RT + responsável do estabelecimento',
]

const getChecklist = (tipo) => {
  if (tipo === 'mensal') return CHECKLIST_MENSAL
  if (tipo === 'trimestral') return [...CHECKLIST_MENSAL, ...CHECKLIST_TRIMESTRAL_EXTRA]
  if (tipo === 'semestral') return [...CHECKLIST_MENSAL, ...CHECKLIST_TRIMESTRAL_EXTRA, ...CHECKLIST_SEMESTRAL_EXTRA]
  if (tipo === 'anual') return [...CHECKLIST_MENSAL, ...CHECKLIST_TRIMESTRAL_EXTRA, ...CHECKLIST_SEMESTRAL_EXTRA, ...CHECKLIST_ANUAL_EXTRA]
  return []
}

// ─── Gerar cronograma automático ──────────────────────────────────────────────
const gerarCronograma = (inicio, fim) => {
  const visitas = []
  // Usar strings para evitar problemas de timezone
  const [anoI, mesI, diaI] = inicio.split('-').map(Number)
  const [anoF, mesF] = fim.split('-').map(Number)

  let anoAtual = anoI
  let mesAtual = mesI // 1-12
  let mesesDiff = 0

  while (anoAtual < anoF || (anoAtual === anoF && mesAtual <= mesF)) {
    const dataStr = `${anoAtual}-${String(mesAtual).padStart(2,'0')}-${String(diaI).padStart(2,'0')}`
    
    let tipo = 'mensal'
    if (mesesDiff === 0) tipo = 'anual'
    else if (mesesDiff % 6 === 0) tipo = 'semestral'
    else if (mesesDiff % 3 === 0) tipo = 'trimestral'

    visitas.push({ tipo, data_prevista: dataStr })

    // Avançar mês
    mesAtual++
    if (mesAtual > 12) { mesAtual = 1; anoAtual++ }
    mesesDiff++
  }
  return visitas
}

// ─── Form de Contrato ─────────────────────────────────────────────────────────
function FormContrato({ contrato, clientes, onSalvar, onCancelar }) {
  const [aba, setAba] = useState('cliente')
  const [form, setForm] = useState({
    client_id: '', razao_social: '', cnpj: '', endereco: '',
    responsavel_local: '', tipo_estabelecimento: '', area_climatizada: '',
    capacidade_total_btu: '', rt_nome: '', rt_crea: '', rt_art: '',
    vigencia_inicio: '', vigencia_fim: '', valor_mensal: '',
    status: 'ativo', observacoes: '',
    ...(contrato || {})
  })
  const [equipamentos, setEquipamentos] = useState([])
  const [loading, setLoading] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [showDrop, setShowDrop] = useState(false)
  const clienteSelecionado = clientes.find(c => c.id === form.client_id)
  const clientesFiltrados = buscaCliente.length >= 1
    ? clientes.filter(c => c.name.toLowerCase().includes(buscaCliente.toLowerCase())).slice(0, 30)
    : []

  useEffect(() => {
    if (contrato?.id) {
      supabase.from('pmoc_equipamentos').select('*').eq('contract_id', contrato.id).then(({ data }) => setEquipamentos(data || []))
    }
  }, [contrato])

  const set = f => e => setForm(p => ({ ...p, [f]: e.target.value }))

  const addEquip = () => setEquipamentos(p => [...p, { tag: '', tipo: '', marca: '', modelo: '', numero_serie: '', capacidade_btu: '', gas_refrigerante: '', local: '', data_instalacao: '' }])
  const setEquip = (i, f, v) => setEquipamentos(p => p.map((e, idx) => idx === i ? { ...e, [f]: v } : e))
  const removeEquip = (i) => setEquipamentos(p => p.filter((_, idx) => idx !== i))

  const salvar = async (e) => {
    e.preventDefault()
    if (!form.razao_social) return
    setLoading(true)
    try {
      const payload = {
        client_id: form.client_id || null,
        razao_social: form.razao_social,
        cnpj: form.cnpj || null,
        endereco: form.endereco || null,
        responsavel_local: form.responsavel_local || null,
        tipo_estabelecimento: form.tipo_estabelecimento || null,
        area_climatizada: Number(form.area_climatizada) || null,
        capacidade_total_btu: Number(form.capacidade_total_btu) || null,
        rt_nome: form.rt_nome || null,
        rt_crea: form.rt_crea || null,
        rt_art: form.rt_art || null,
        vigencia_inicio: form.vigencia_inicio || null,
        vigencia_fim: form.vigencia_fim || null,
        valor_mensal: Number(form.valor_mensal) || 0,
        status: form.status,
        observacoes: form.observacoes || null,
      }

      let contratoId = contrato?.id
      if (contratoId) {
        await supabase.from('pmoc_contracts').update(payload).eq('id', contratoId)
      } else {
        const { data, error: errContrato } = await supabase.from('pmoc_contracts').insert(payload).select().single()
        if (errContrato) throw new Error('Erro ao criar contrato: ' + errContrato.message)
        contratoId = data.id

        // Gerar cronograma automático
        if (form.vigencia_inicio && form.vigencia_fim) {
          const cronograma = gerarCronograma(form.vigencia_inicio, form.vigencia_fim)
          await supabase.from('pmoc_visitas').insert(cronograma.map(v => ({ ...v, contract_id: contratoId, status: 'pendente' })))
        }

        // Gerar parcelas no financeiro
        if (Number(form.valor_mensal) > 0 && form.vigencia_inicio && form.vigencia_fim) {
          const start = new Date(form.vigencia_inicio)
          const end = new Date(form.vigencia_fim)
          const parcelas = []
          let curr = new Date(start)
          while (curr <= end) {
            parcelas.push({
              description: `PMOC — ${form.razao_social} — ${curr.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
              amount: Number(form.valor_mensal),
              due_date: curr.toISOString().split('T')[0],
              status: 'Pendente',
              category: 'PMOC',
              client_id: form.client_id || null,
            })
            curr.setMonth(curr.getMonth() + 1)
          }
          await supabase.from('receivables').insert(parcelas)
        }
      }

      // Salvar equipamentos
      if (contratoId) {
        await supabase.from('pmoc_equipamentos').delete().eq('contract_id', contratoId)
        const equipsValidos = equipamentos.filter(e => e.tag.trim())
        if (equipsValidos.length > 0) {
          const { error: errEquip } = await supabase.from('pmoc_equipamentos').insert(
            equipsValidos.map(e => ({
              contract_id: contratoId,
              tag: e.tag,
              tipo: e.tipo || null,
              marca: e.marca || null,
              modelo: e.modelo || null,
              numero_serie: e.numero_serie || null,
              capacidade_btu: Number(e.capacidade_btu) || null,
              gas_refrigerante: e.gas_refrigerante || null,
              local: e.local || null,
              data_instalacao: e.data_instalacao || null,
              ativo: true,
            }))
          )
          if (errEquip) throw new Error('Erro ao salvar equipamentos: ' + errEquip.message)
        }
      }

      onSalvar()
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const abas = [
    { id: 'cliente', label: 'Cliente' },
    { id: 'rt', label: 'Resp. Técnico' },
    { id: 'equipamentos', label: 'Equipamentos' },
    { id: 'contrato', label: 'Contrato' },
  ]

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-navy">{contrato ? 'Editar PMOC' : 'Novo Contrato PMOC'}</h2>
          <button onClick={onCancelar} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        {/* Abas */}
        <div className="flex gap-1 px-5 py-2 border-b border-gray-100 overflow-x-auto">
          {abas.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={['px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all', aba === a.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}>
              {a.label}
            </button>
          ))}
        </div>

        <form onSubmit={salvar} className="p-5 space-y-4">
          {/* Aba Cliente */}
          {aba === 'cliente' && (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 relative">
                <label className="text-sm font-medium text-gray-700">Vincular ao cliente cadastrado</label>
                <input
                  value={showDrop ? buscaCliente : (clienteSelecionado?.name || '')}
                  onChange={e => { setBuscaCliente(e.target.value); setShowDrop(true) }}
                  onFocus={() => { setShowDrop(true); setBuscaCliente('') }}
                  placeholder="Buscar cliente..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {showDrop && clientesFiltrados.length > 0 && (
                  <div className="absolute top-16 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto">
                    {clientesFiltrados.map(c => (
                      <button key={c.id} type="button"
                        onMouseDown={() => {
                          setForm(f => ({ ...f, client_id: c.id, razao_social: f.razao_social || c.name }))
                          setBuscaCliente(''); setShowDrop(false)
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-primary/5 text-sm border-b border-gray-50 last:border-0">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
                {showDrop && <div className="fixed inset-0 z-40" onMouseDown={() => setShowDrop(false)} />}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Razão Social *', field: 'razao_social', span: 2 },
                  { label: 'CNPJ / CPF', field: 'cnpj' },
                  { label: 'Tipo de Estabelecimento', field: 'tipo_estabelecimento' },
                  { label: 'Endereço Completo', field: 'endereco', span: 2 },
                  { label: 'Responsável no Local', field: 'responsavel_local' },
                  { label: 'Área Climatizada (m²)', field: 'area_climatizada', type: 'number' },
                  { label: 'Capacidade Total (BTU)', field: 'capacidade_total_btu', type: 'number' },
                ].map(({ label, field, span, type }) => (
                  <div key={field} className={`flex flex-col gap-1 ${span === 2 ? 'col-span-2' : ''}`}>
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                    <input type={type || 'text'} value={form[field] || ''} onChange={set(field)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                ))}
              </div>
              {Number(form.capacidade_total_btu) >= 60000 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700">
                  ⚠️ Capacidade ≥ 60.000 BTU — ART obrigatória conforme legislação
                </div>
              )}
            </div>
          )}

          {/* Aba RT */}
          {aba === 'rt' && (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Nome do Responsável Técnico', field: 'rt_nome', span: 2 },
                { label: 'CREA / CFT nº', field: 'rt_crea' },
                { label: 'ART nº', field: 'rt_art' },
              ].map(({ label, field, span }) => (
                <div key={field} className={`flex flex-col gap-1 ${span === 2 ? 'col-span-2' : ''}`}>
                  <label className="text-sm font-medium text-gray-700">{label}</label>
                  <input value={form[field] || ''} onChange={set(field)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
              ))}
            </div>
          )}

          {/* Aba Equipamentos */}
          {aba === 'equipamentos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-navy">Inventário de Equipamentos</p>
                <button type="button" onClick={addEquip}
                  className="flex items-center gap-1.5 text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium">
                  <Plus size={12} /> Adicionar
                </button>
              </div>
              {equipamentos.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhum equipamento adicionado. Clique em "Adicionar".</p>
              )}
              {equipamentos.map((e, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary">Equipamento {i + 1}</span>
                    <button type="button" onClick={() => removeEquip(i)} className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'TAG *', field: 'tag', placeholder: 'AC-001' },
                      { label: 'Tipo', field: 'tipo', placeholder: 'Split Hi-Wall' },
                      { label: 'Marca', field: 'marca' },
                      { label: 'Modelo', field: 'modelo' },
                      { label: 'Nº de Série', field: 'numero_serie' },
                      { label: 'Gás Refrigerante', field: 'gas_refrigerante', placeholder: 'R-410A' },
                      { label: 'Capacidade (BTU)', field: 'capacidade_btu', type: 'number' },
                      { label: 'Local / Andar', field: 'local' },
                    ].map(({ label, field, placeholder, type }) => (
                      <div key={field} className="flex flex-col gap-0.5">
                        <label className="text-xs text-gray-500">{label}</label>
                        <input type={type || 'text'} value={e[field] || ''} onChange={ev => setEquip(i, field, ev.target.value)}
                          placeholder={placeholder || ''}
                          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
                      </div>
                    ))}
                    <div className="flex flex-col gap-0.5 col-span-2">
                      <label className="text-xs text-gray-500">Data de Instalação</label>
                      <input type="date" value={e.data_instalacao || ''} onChange={ev => setEquip(i, 'data_instalacao', ev.target.value)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
                    </div>
                  </div>
                </div>
              ))}
              {equipamentos.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                  Total de equipamentos: <strong>{equipamentos.length}</strong> |
                  Capacidade total: <strong>{equipamentos.reduce((a, e) => a + (Number(e.capacidade_btu) || 0), 0).toLocaleString('pt-BR')} BTU</strong>
                </div>
              )}
            </div>
          )}

          {/* Aba Contrato */}
          {aba === 'contrato' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Vigência Início</label>
                  <input type="date" value={form.vigencia_inicio || ''} onChange={set('vigencia_inicio')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Vigência Fim</label>
                  <input type="date" value={form.vigencia_fim || ''} onChange={set('vigencia_fim')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Valor Mensal (R$)</label>
                  <input type="number" value={form.valor_mensal || ''} onChange={set('valor_mensal')} min="0" step="0.01"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select value={form.status} onChange={set('status')}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white">
                    <option value="ativo">Ativo</option>
                    <option value="suspenso">Suspenso</option>
                    <option value="encerrado">Encerrado</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="text-sm font-medium text-gray-700">Observações</label>
                  <textarea value={form.observacoes || ''} onChange={set('observacoes')} rows={3}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                </div>
              </div>
              {form.vigencia_inicio && form.vigencia_fim && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                  📅 Cronograma automático será gerado com visitas mensais, trimestrais, semestrais e anuais conforme PMOC
                  {Number(form.valor_mensal) > 0 && <p className="mt-1">💰 Parcelas mensais de {formatCurrency(Number(form.valor_mensal))} serão criadas no Contas a Receber</p>}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onCancelar} className="flex-1">Cancelar</Button>
            {aba !== 'contrato' ? (
              <Button type="button" onClick={() => {
                const idx = abas.findIndex(a => a.id === aba)
                setAba(abas[idx + 1]?.id || 'contrato')
              }} className="flex-1">Próximo →</Button>
            ) : (
              <Button type="submit" loading={loading} className="flex-1">{contrato ? 'Salvar' : 'Criar Contrato'}</Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Modal Checklist de Visita ───────────────────────────────────────────────
function ModalChecklist({ visita, contrato, equipamentos, onFechar, onMarcarRealizada }) {
  const checklist = getChecklist(visita.tipo)
  const labelTipo = { mensal: 'Mensal', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' }
  const todasTags = equipamentos.map(e => e.tag).join(', ')
  
  // Carregar dados salvos se visita já foi realizada
  const dadosSalvos = visita.observacoes ? (() => { try { return JSON.parse(visita.observacoes) } catch { return {} } })() : {}
  const checklistSalvo = dadosSalvos.checklist ? (() => { try { return JSON.parse(dadosSalvos.checklist) } catch { return [] } })() : []

  const [resultados, setResultados] = useState(() => {
    if (checklistSalvo.length > 0) return Object.fromEntries(checklistSalvo.map((item, i) => [i, item.resultado || '✓']))
    return Object.fromEntries(checklist.map((_, i) => [i, '✓']))
  })
  const [observacoes, setObservacoes] = useState(() => {
    if (checklistSalvo.length > 0) return Object.fromEntries(checklistSalvo.map((item, i) => [i, item.observacao || '']))
    return Object.fromEntries(checklist.map((_, i) => [i, '']))
  })
  const [tags, setTags] = useState(() => {
    if (checklistSalvo.length > 0) return Object.fromEntries(checklistSalvo.map((item, i) => [i, item.tags || todasTags]))
    return Object.fromEntries(checklist.map((_, i) => [i, todasTags]))
  })
  const [tecnico, setTecnico] = useState(visita.tecnico || contrato.rt_nome || '')
  const [dataVisita, setDataVisita] = useState(visita.data_realizada || new Date().toISOString().split('T')[0])
  const [horaInicio, setHoraInicio] = useState(dadosSalvos.horaInicio || '')
  const [horaFim, setHoraFim] = useState(dadosSalvos.horaFim || '')
  const [respNome, setRespNome] = useState(dadosSalvos.respNome || contrato.responsavel_local || '')
  const [respCargo, setRespCargo] = useState(dadosSalvos.respCargo || '')
  const [anomalias, setAnomalias] = useState(visita.anomalias || '')

  const setRes = (i, v) => setResultados(p => ({ ...p, [i]: v }))
  const setObs = (i, v) => setObservacoes(p => ({ ...p, [i]: v }))
  const setTag = (i, v) => setTags(p => ({ ...p, [i]: v }))

  const imprimir = () => {
    const dataFormatada = dataVisita ? new Date(dataVisita + 'T12:00:00').toLocaleDateString('pt-BR') : ''
    const titulo = 'PMOC - ' + contrato.razao_social + ' - ' + labelTipo[visita.tipo] + ' - ' + dataFormatada
    
    const tagsHtml = equipamentos.map(e => 
      '<span style="display:inline-block;margin:2px;padding:2px 6px;border:1px solid #ccc;border-radius:4px;font-family:monospace;font-size:11px">' + e.tag + ' — ' + (e.tipo||'') + ' ' + (e.marca||'') + ' ' + (e.modelo||'') + (e.local ? ' (' + e.local + ')' : '') + '</span>'
    ).join('')

    const linhas = checklist.map((item, i) => {
      const res = resultados[i] || ''
      const cor = res === '✓' ? '#16a34a' : res === '✗' ? '#dc2626' : '#666'
      return '<tr style="background:' + (i%2===0?'#fff':'#f9fafb') + '">' +
        '<td style="border:1px solid #ccc;padding:4px 8px;text-align:center;font-weight:bold">' + String(i+1).padStart(2,'0') + '</td>' +
        '<td style="border:1px solid #ccc;padding:4px 8px;font-size:11px">' + item + '</td>' +
        '<td style="border:1px solid #ccc;padding:4px 8px;text-align:center;font-weight:bold;color:' + cor + '">' + res + '</td>' +
        '<td style="border:1px solid #ccc;padding:4px 8px;font-size:11px">' + (tags[i]||'') + '</td>' +
        '<td style="border:1px solid #ccc;padding:4px 8px;font-size:11px">' + (observacoes[i]||'') + '</td>' +
        '</tr>'
    }).join('')

    const html = `<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>${titulo}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 1.5cm; color: #000; }
        h1 { font-size: 14px; text-align: center; margin: 4px 0; }
        h2 { font-size: 12px; text-align: center; margin: 4px 0; }
        table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        th { background: #1B2A4A; color: white; padding: 6px 8px; text-align: left; font-size: 11px; }
        .info-table td { padding: 3px 6px; border: 1px solid #ccc; }
        .ass { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; }
        .ass-item { text-align: center; }
        .ass-linha { border-top: 2px solid black; padding-top: 6px; margin-top: 60px; }
        @page { margin: 1.5cm; size: A4; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:12px">
        <img src="${window.location.origin}/logo.png" style="height:48px;object-fit:contain" /><br/>
        <h1>REFRILAV — Serviços de Climatização e Refrigeração</h1>
        <h2>CHECKLIST DE MANUTENÇÃO — VISITA ${(labelTipo[visita.tipo]||'').toUpperCase()}</h2>
        <p style="font-size:10px;color:#666">Conforme: Lei 13.589/2018 • Portaria MS 3.523/98 • NBR 13971 • NBR 17.037:23</p>
      </div>
      <table class="info-table">
        <tr><td width="15%"><b>Cliente</b></td><td colspan="3">${contrato.razao_social}</td></tr>
        <tr><td><b>CNPJ/CPF</b></td><td>${contrato.cnpj||'—'}</td><td width="15%"><b>Tipo</b></td><td>${contrato.tipo_estabelecimento||'—'}</td></tr>
        <tr><td><b>Endereço</b></td><td colspan="3">${contrato.endereco||'—'}</td></tr>
        <tr><td><b>Área climatizada</b></td><td>${contrato.area_climatizada ? contrato.area_climatizada + ' m²' : '—'}</td><td><b>Capacidade</b></td><td>${contrato.capacidade_total_btu ? contrato.capacidade_total_btu.toLocaleString('pt-BR') + ' BTU' : '—'}</td></tr>
        <tr><td><b>Resp. Técnico</b></td><td>${tecnico||'—'}</td><td><b>CREA/CFT</b></td><td>${contrato.rt_crea||'—'}</td></tr>
        <tr><td><b>ART nº</b></td><td>${contrato.rt_art||'—'}</td><td><b>Data</b></td><td>${dataFormatada}</td></tr>
        <tr><td><b>Início</b></td><td>${horaInicio||'—'}</td><td><b>Término</b></td><td>${horaFim||'—'}</td></tr>
      </table>
      ${equipamentos.length > 0 ? '<div style="margin:8px 0"><b>Equipamentos:</b><br/>' + tagsHtml + '</div>' : ''}
      <table>
        <thead><tr>
          <th style="width:30px">Nº</th>
          <th>Atividade a Verificar / Executar</th>
          <th style="width:40px">✓/✗/N/A</th>
          <th style="width:80px">TAG(s)</th>
          <th style="width:120px">Observações</th>
        </tr></thead>
        <tbody>${linhas}</tbody>
      </table>
      ${anomalias ? '<div style="border:1px solid #ccc;padding:8px;margin:8px 0"><b>Anomalias / Ações corretivas:</b><br/>' + anomalias + '</div>' : ''}
      <div class="ass">
        <div class="ass-item">
          <div class="ass-linha">
            <b>Técnico Responsável</b><br/>
            ${tecnico||'_________________________'}<br/>
            CREA/CFT: ${contrato.rt_crea||'_________________'}
          </div>
        </div>
        <div class="ass-item">
          <div class="ass-linha">
            <b>Responsável pelo Estabelecimento</b><br/>
            ${respNome||'_________________________'}<br/>
            Cargo: ${respCargo||'____________________'}
          </div>
        </div>
      </div>
    </body></html>`

    const janela = window.open('', '_blank')
    janela.document.write(html)
    janela.document.close()
    setTimeout(() => { janela.focus(); janela.print() }, 500)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl" id="print-area">
        {/* Header — visível na tela e no impresso */}
        <div className="px-6 py-5 border-b border-gray-100 print:border-b-2 print:border-black">
          <div className="flex items-start justify-between gap-3 no-print">
            <div />
            <div className="flex gap-2">
              <button onClick={imprimir}
                className="flex items-center gap-1.5 text-sm bg-navy text-white px-4 py-2 rounded-xl font-medium hover:bg-navy/90 transition-colors">
                🖨️ Imprimir
              </button>
              <button onClick={onFechar} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
          </div>
          {/* Cabeçalho do documento */}
          <div className="text-center mt-2 print:mt-0">
            <img src="/logo.png" alt="Refrilav" className="h-12 w-auto object-contain mx-auto mb-2" />
            <h1 className="text-lg font-bold text-navy">REFRILAV — Serviços de Climatização e Refrigeração</h1>
            <h2 className="text-base font-bold text-gray-700 mt-1">CHECKLIST DE MANUTENÇÃO — VISITA {labelTipo[visita.tipo]?.toUpperCase()}</h2>
            <p className="text-xs text-gray-500 mt-1">Conforme: Lei 13.589/2018 • Portaria MS 3.523/98 • NBR 13971 • NBR 17.037:23</p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Dados do contrato */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm border border-gray-200 rounded-xl p-4 print:border print:border-black">
            <div><span className="text-gray-500">Cliente:</span> <strong>{contrato.razao_social}</strong></div>
            <div><span className="text-gray-500">CNPJ/CPF:</span> <strong>{contrato.cnpj || '—'}</strong></div>
            <div className="col-span-2"><span className="text-gray-500">Endereço:</span> <strong>{contrato.endereco || '—'}</strong></div>
            <div><span className="text-gray-500">Tipo:</span> <strong>{contrato.tipo_estabelecimento || '—'}</strong></div>
            <div><span className="text-gray-500">Área climatizada:</span> <strong>{contrato.area_climatizada ? contrato.area_climatizada + ' m²' : '—'}</strong></div>
            <div><span className="text-gray-500">Resp. Técnico:</span> <strong>{contrato.rt_nome || '—'}</strong></div>
            <div><span className="text-gray-500">CREA/CFT:</span> <strong>{contrato.rt_crea || '—'}</strong></div>
            <div><span className="text-gray-500">ART nº:</span> <strong>{contrato.rt_art || '—'}</strong></div>
            <div><span className="text-gray-500">Data prevista:</span> <strong>{formatDate(visita.data_prevista)}</strong></div>
          </div>

          {/* Equipamentos */}
          {equipamentos.length > 0 && (
            <div>
              <h3 className="font-bold text-navy text-sm mb-2">Equipamentos desta unidade (TAGs)</h3>
              <div className="flex flex-wrap gap-1.5">
                {equipamentos.map(e => (
                  <span key={e.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono border border-gray-200">
                    {e.tag} — {e.tipo} {e.marca} {e.modelo} {e.local ? '(' + e.local + ')' : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Técnico e data */}
          <div className="grid grid-cols-2 gap-3 text-sm no-print">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Técnico responsável</label>
              <input value={tecnico} onChange={e => setTecnico(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Data da visita</label>
              <input type="date" value={dataVisita} onChange={e => setDataVisita(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Horário início</label>
              <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Horário término</label>
              <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Área de impressão dos dados preenchidos */}
          <div className="only-print text-sm grid grid-cols-2 gap-x-6 gap-y-1 border border-black p-3">
            <div><strong>Técnico:</strong> {tecnico}</div>
            <div><strong>Data:</strong> {dataVisita ? new Date(dataVisita + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</div>
            <div><strong>Início:</strong> {horaInicio || '____:____'}</div>
            <div><strong>Término:</strong> {horaFim || '____:____'}</div>
          </div>

          {/* Checklist */}
          <div>
            <h3 className="font-bold text-navy text-sm mb-3">
              Checklist — Visita {labelTipo[visita.tipo]} ({checklist.length} itens)
            </h3>
            <p className="text-xs text-gray-400 mb-2 no-print">Clique em ✓ / ✗ / N/A para marcar cada item</p>
            <table className="w-full text-xs border-collapse border border-gray-300">
              <thead>
                <tr className="bg-navy text-white print:bg-gray-200 print:text-black">
                  <th className="border border-gray-300 px-2 py-2 text-left w-8">Nº</th>
                  <th className="border border-gray-300 px-2 py-2 text-left">Atividade a Verificar / Executar</th>
                  <th className="border border-gray-300 px-2 py-2 text-center w-20">✓/✗/N/A</th>
                  <th className="border border-gray-300 px-2 py-2 text-center w-20 no-print">TAG(s)</th>
                  <th className="border border-gray-300 px-2 py-2 text-left no-print">Observações</th>
                  <th className="border border-gray-300 px-2 py-2 text-center w-20 only-print">TAG(s)</th>
                  <th className="border border-gray-300 px-2 py-2 text-left only-print">Observações</th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((item, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-2 py-1.5 text-center font-semibold">{String(i + 1).padStart(2, '0')}</td>
                    <td className="border border-gray-300 px-2 py-1.5">{item}</td>
                    <td className="border border-gray-300 px-1 py-1 text-center">
                      {/* Botões na tela */}
                      <div className="no-print flex gap-0.5 justify-center">
                        {['✓','✗','N/A'].map(v => (
                          <button key={v} type="button" onClick={() => setRes(i, resultados[i] === v ? '' : v)}
                            className={['px-1.5 py-0.5 rounded text-xs font-bold transition-all', resultados[i] === v
                              ? v === '✓' ? 'bg-green-500 text-white' : v === '✗' ? 'bg-red-500 text-white' : 'bg-gray-400 text-white'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'].join(' ')}>
                            {v}
                          </button>
                        ))}
                      </div>
                      {/* Valor no impresso */}
                      <span className={['only-print font-bold text-sm', resultados[i] === '✓' ? 'text-green-700' : resultados[i] === '✗' ? 'text-red-600' : ''].join(' ')}>
                        {resultados[i] || ''}
                      </span>
                    </td>
                    <td className="border border-gray-300 px-1 py-1">
                      <input value={tags[i]} onChange={e => setTag(i, e.target.value)}
                        className="w-full text-xs px-1 py-0.5 border border-gray-200 rounded focus:outline-none no-print"
                        placeholder="TAG" />
                      <span className="only-print text-xs">{tags[i]}</span>
                    </td>
                    <td className="border border-gray-300 px-1 py-1">
                      <input value={observacoes[i]} onChange={e => setObs(i, e.target.value)}
                        className="w-full text-xs px-1 py-0.5 border border-gray-200 rounded focus:outline-none no-print"
                        placeholder="Observação..." />
                      <span className="only-print text-xs">{observacoes[i]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Anomalias */}
          <div>
            <label className="text-sm font-semibold text-navy block mb-1">Anomalias detectadas / Ações corretivas</label>
            <textarea value={anomalias} onChange={e => setAnomalias(e.target.value)} rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none no-print"
              placeholder="Descreva anomalias detectadas e ações tomadas..." />
            <div className="only-print border border-gray-300 p-3 min-h-[60px] text-sm">
              <strong>Anomalias / Ações corretivas:</strong><br/>{anomalias || 'Nenhuma anomalia detectada.'}
            </div>
          </div>

          {/* Campos responsável — apenas na tela */}
          <div className="grid grid-cols-2 gap-3 no-print">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Nome do responsável pelo estabelecimento</label>
              <input value={respNome} onChange={e => setRespNome(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Cargo</label>
              <input value={respCargo} onChange={e => setRespCargo(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>

          {/* Assinaturas */}
          <div className="grid grid-cols-2 gap-8 mt-4">
            <div className="text-center text-xs">
              <div className="h-20 border-b-2 border-black mb-2 flex items-end justify-center pb-1">
                <span className="text-gray-400 text-xs only-print">{tecnico}</span>
              </div>
              <p className="font-bold">Técnico Responsável</p>
              <p className="text-gray-600 mt-1">{tecnico || '_________________________'}</p>
              <p className="text-gray-600">CREA/CFT: {contrato.rt_crea || '_________________'}</p>
            </div>
            <div className="text-center text-xs">
              <div className="h-20 border-b-2 border-black mb-2 flex items-end justify-center pb-1">
                <span className="text-gray-400 text-xs only-print">{respNome}</span>
              </div>
              <p className="font-bold">Responsável pelo Estabelecimento</p>
              <p className="text-gray-600 mt-1">{respNome || '_________________________'}</p>
              <p className="text-gray-600">Cargo: {respCargo || '____________________'}</p>
            </div>
          </div>

          {/* Botões — não aparecem no impresso */}
          <div className="flex gap-3 no-print pt-2">
            <Button variant="ghost" onClick={onFechar} className="flex-1">Fechar</Button>
            <Button onClick={async () => {
              // Salvar todos os dados preenchidos
              const checklistJson = JSON.stringify(checklist.map((item, i) => ({
                n: i + 1, atividade: item,
                resultado: resultados[i] || '',
                tags: tags[i] || '',
                observacao: observacoes[i] || ''
              })))
              await supabase.from('pmoc_visitas').update({
                status: 'realizada',
                data_realizada: dataVisita,
                tecnico,
                anomalias,
                observacoes: JSON.stringify({ horaInicio, horaFim, respNome, respCargo, checklist: checklistJson })
              }).eq('id', visita.id)
              onMarcarRealizada({ ...visita, data_realizada: dataVisita, tecnico })
              onFechar()
            }} className="flex-1">
              <CheckCircle size={14} /> Salvar e Marcar como Realizada
            </Button>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute !important;
            left: 0; top: 0;
            width: 100%;
            background: white;
            padding: 20px;
            box-shadow: none;
            border-radius: 0;
            max-height: none !important;
            overflow: visible !important;
            height: auto !important;
          }
          .no-print, .no-print * { display: none !important; visibility: hidden !important; }
          .only-print { display: block !important; visibility: visible !important; }
          @page { margin: 1.5cm; size: A4; }
        }
        @media screen {
          .only-print { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Detalhe do Contrato ──────────────────────────────────────────────────────
function DetalheContrato({ contrato, onFechar, onEditar }) {
  const [equipamentos, setEquipamentos] = useState([])
  const [visitas, setVisitas] = useState([])
  const [abaAtiva, setAbaAtiva] = useState('visitas')
  const [visitaChecklist, setVisitaChecklist] = useState(null)

  useEffect(() => {
    supabase.from('pmoc_equipamentos').select('*').eq('contract_id', contrato.id).then(({ data }) => setEquipamentos(data || []))
    supabase.from('pmoc_visitas').select('*').eq('contract_id', contrato.id).order('data_prevista').then(({ data }) => setVisitas(data || []))
  }, [contrato.id])

  const marcarRealizada = async (visita) => {
    const hoje = new Date().toISOString().split('T')[0]
    await supabase.from('pmoc_visitas').update({ status: 'realizada', data_realizada: hoje }).eq('id', visita.id)
    setVisitas(p => p.map(v => v.id === visita.id ? { ...v, status: 'realizada', data_realizada: hoje } : v))
  }

  const COR_TIPO = {
    mensal: 'bg-blue-100 text-blue-600',
    trimestral: 'bg-yellow-100 text-yellow-600',
    semestral: 'bg-purple-100 text-purple-600',
    anual: 'bg-red-100 text-red-600',
  }

  const hoje = new Date()
  const vencidas = visitas.filter(v => v.status === 'pendente' && new Date(v.data_prevista) < hoje).length
  const proximas = visitas.filter(v => {
    if (v.status !== 'pendente') return false
    const diff = (new Date(v.data_prevista) - hoje) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30
  }).length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-navy">{contrato.razao_social}</h2>
            <p className="text-xs text-gray-500">{contrato.tipo_estabelecimento} · PMOC {formatDate(contrato.vigencia_inicio)} a {formatDate(contrato.vigencia_fim)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEditar(contrato)} className="p-2 hover:bg-gray-100 rounded-lg"><Edit2 size={16} className="text-gray-500" /></button>
            <button onClick={onFechar} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
          </div>
        </div>

        {/* Alertas */}
        {(vencidas > 0 || proximas > 0) && (
          <div className="px-5 pt-3 space-y-2">
            {vencidas > 0 && <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600 font-medium">⚠️ {vencidas} visita(s) vencida(s)!</div>}
            {proximas > 0 && <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs text-yellow-600 font-medium">📅 {proximas} visita(s) nos próximos 30 dias</div>}
          </div>
        )}

        {/* Abas */}
        <div className="flex gap-1 px-5 py-3 border-b border-gray-100">
          {[
            { id: 'visitas', label: `Cronograma (${visitas.length})` },
            { id: 'equipamentos', label: `Equipamentos (${equipamentos.length})` },
            { id: 'info', label: 'Informações' },
          ].map(a => (
            <button key={a.id} onClick={() => setAbaAtiva(a.id)}
              className={['px-3 py-1.5 rounded-lg text-xs font-medium transition-all', abaAtiva === a.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'].join(' ')}>
              {a.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Cronograma */}
          {abaAtiva === 'visitas' && (
            <div className="space-y-2">
              {visitas.map(v => {
                const vencida = v.status === 'pendente' && new Date(v.data_prevista) < hoje
                return (
                  <div key={v.id} onClick={() => setVisitaChecklist(v)} className={['flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:shadow-sm', v.status === 'realizada' ? 'bg-green-50 border-green-200 opacity-75' : vencida ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'].join(' ')}>
                    <div className={['w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold', COR_TIPO[v.tipo]].join(' ')}>
                      {v.tipo.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy capitalize">{v.tipo}</p>
                      <p className="text-xs text-gray-500">
                        Prevista: {formatDate(v.data_prevista)}
                        {v.data_realizada && ` · Realizada: ${formatDate(v.data_realizada)}`}
                      </p>
                    </div>
                    {v.status === 'realizada'
                      ? <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">✓ Realizada</span>
                      : vencida
                        ? <button onClick={() => marcarRealizada(v)} className="text-xs bg-primary text-white px-2.5 py-1 rounded-lg font-medium flex-shrink-0 hover:bg-primary/90">Marcar Feita</button>
                        : <button onClick={() => marcarRealizada(v)} className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2.5 py-1 rounded-lg font-medium flex-shrink-0">Marcar Feita</button>
                    }
                  </div>
                )
              })}
            </div>
          )}

          {/* Equipamentos */}
          {abaAtiva === 'equipamentos' && (
            <div className="space-y-2">
              {equipamentos.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-6">Nenhum equipamento cadastrado</p>
              ) : equipamentos.map(e => (
                <div key={e.id} className="bg-gray-50 rounded-xl p-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{e.tag}</span>
                      <span className="text-xs text-gray-500">{e.tipo}</span>
                    </div>
                    <p className="text-sm font-medium text-navy">{[e.marca, e.modelo].filter(Boolean).join(' ')}</p>
                    <p className="text-xs text-gray-500">{e.local} · {e.capacidade_btu ? e.capacidade_btu.toLocaleString('pt-BR') + ' BTU' : ''} · {e.gas_refrigerante}</p>
                  </div>
                  {e.numero_serie && <p className="text-xs text-gray-400 flex-shrink-0">S/N: {e.numero_serie}</p>}
                </div>
              ))}
              {equipamentos.length > 0 && (
                <div className="bg-navy/5 rounded-lg p-3 text-sm flex justify-between">
                  <span className="text-gray-600">Total instalado</span>
                  <span className="font-bold text-navy">{equipamentos.reduce((a, e) => a + (Number(e.capacidade_btu) || 0), 0).toLocaleString('pt-BR')} BTU</span>
                </div>
              )}
            </div>
          )}

          {/* Info */}
          {abaAtiva === 'info' && (
            <div className="space-y-3 text-sm">
              {[
                { label: 'CNPJ/CPF', value: contrato.cnpj },
                { label: 'Endereço', value: contrato.endereco },
                { label: 'Responsável no local', value: contrato.responsavel_local },
                { label: 'Área climatizada', value: contrato.area_climatizada ? contrato.area_climatizada + ' m²' : null },
                { label: 'Capacidade total', value: contrato.capacidade_total_btu ? contrato.capacidade_total_btu.toLocaleString('pt-BR') + ' BTU' : null },
                { label: 'Resp. Técnico', value: contrato.rt_nome },
                { label: 'CREA/CFT', value: contrato.rt_crea },
                { label: 'ART nº', value: contrato.rt_art },
                { label: 'Valor mensal', value: contrato.valor_mensal > 0 ? formatCurrency(contrato.valor_mensal) : null },
                { label: 'Observações', value: contrato.observacoes },
              ].filter(i => i.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4 py-2 border-b border-gray-50">
                  <span className="text-gray-500 flex-shrink-0">{label}</span>
                  <span className="font-medium text-navy text-right">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {visitaChecklist && (
        <ModalChecklist
          visita={visitaChecklist}
          contrato={contrato}
          equipamentos={equipamentos}
          onFechar={() => setVisitaChecklist(null)}
          onMarcarRealizada={marcarRealizada}
        />
      )}
    </div>
  )
}

// ─── Calculadora de Precificação ─────────────────────────────────────────────
function Calculadora({ onFechar }) {
  const PRECOS = {
    'p9_12':   { label: 'Split 9.000 / 12.000 BTU', facil: 48, moderado: 55, dificil: 60 },
    'p18_24':  { label: 'Split 18.000 / 24.000 BTU', facil: 60, moderado: 67, dificil: 75 },
    'p30':     { label: 'Split 30.000 BTU',           facil: 75, moderado: 84, dificil: 90 },
    'cassete': { label: 'Cassete',                    facil: 120, moderado: 135, dificil: 150 },
  }

  const NIVEIS = {
    'facil':    { label: '🟢 Fácil', cor: 'text-green-600' },
    'moderado': { label: '🟡 Moderado', cor: 'text-yellow-600' },
    'dificil':  { label: '🔴 Difícil', cor: 'text-red-500' },
  }

  const [equips, setEquips] = useState([{ id: 1, tipo: 'p9_12', qtd: 1, nivel: 'facil' }])
  const [margem, setMargem] = useState(30)

  const addEquip = () => setEquips(p => [...p, { id: Date.now(), tipo: 'p9_12', qtd: 1, nivel: 'facil' }])
  const removeEquip = (id) => setEquips(p => p.filter(e => e.id !== id))
  const updateEquip = (id, field, value) => setEquips(p => p.map(e => {
    if (e.id !== id) return e
    if (field === 'qtd') return { ...e, qtd: Math.max(1, parseInt(value)||1) }
    return { ...e, [field]: value }
  }))

  const getPreco = (e) => PRECOS[e.tipo]?.[e.nivel || 'facil'] || 0
  const baseMes = equips.reduce((a, e) => a + getPreco(e) * e.qtd, 0)
  const totalMes = Math.round(baseMes * (1 + margem / 100) * 100) / 100
  const totalAno = Math.round(totalMes * 12 * 100) / 100

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <h2 className="text-lg font-bold text-navy">Calculadora de Precificação PMOC</h2>
          <button onClick={onFechar} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Cards de resultado */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-primary/5 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Valor mensal</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(totalMes)}</p>
            </div>
            <div className="bg-navy/5 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">Contrato anual</p>
              <p className="text-2xl font-bold text-navy">{formatCurrency(totalAno)}</p>
            </div>
          </div>

          {/* Equipamentos */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-navy">Equipamentos</p>
              <button onClick={addEquip}
                className="flex items-center gap-1 text-xs bg-primary text-white px-2.5 py-1.5 rounded-lg font-medium">
                <Plus size={12} /> Adicionar
              </button>
            </div>
            {equips.map((e, i) => (
              <div key={e.id} className="border border-gray-200 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5">#{i+1}</span>
                  <select value={e.tipo} onChange={ev => updateEquip(e.id, 'tipo', ev.target.value)}
                    className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(PRECOS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  <input type="number" min="1" value={e.qtd}
                    onChange={ev => updateEquip(e.id, 'qtd', ev.target.value)}
                    className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <button onClick={() => removeEquip(e.id)}
                    className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-400 transition-colors flex-shrink-0">
                    <X size={14} />
                  </button>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <span className="text-xs text-gray-400">Acesso:</span>
                  {Object.entries(NIVEIS).map(([k, v]) => (
                    <button key={k} type="button"
                      onClick={() => updateEquip(e.id, 'nivel', k)}
                      className={['px-2.5 py-1 rounded-lg text-xs font-medium transition-all border', e.nivel === k ? 'bg-navy text-white border-navy' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'].join(' ')}>
                      {v.label}
                    </button>
                  ))}
                  <span className="text-xs font-semibold text-primary ml-auto">{formatCurrency(getPreco(e))}/unid.</span>
                </div>
              </div>
            ))}
          </div>

          {/* Ajustes */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Margem de lucro (%)</label>
            <input type="number" min="0" max="100" step="1" value={margem}
              onChange={e => setMargem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>

          {/* Detalhamento */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <p className="font-semibold text-navy text-xs uppercase tracking-wide mb-2">Detalhamento</p>
            {equips.map((e, i) => {
              const preco = getPreco(e)
              const nivel = NIVEIS[e.nivel || 'facil']
              return (
                <div key={e.id} className="flex justify-between text-gray-600">
                  <span>#{i+1} {e.qtd}× {PRECOS[e.tipo]?.label} <span className="text-xs">{nivel?.label}</span></span>
                  <span>{formatCurrency(preco * e.qtd)}/mês</span>
                </div>
              )
            })}
            <div className="flex justify-between text-gray-600 border-t border-gray-200 pt-2">
              <span>Subtotal</span>
              <span>{formatCurrency(baseMes)}/mês</span>
            </div>
            {Number(margem) > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Margem ({margem}%)</span>
                <span>+ {formatCurrency(Math.round(baseMes * margem / 100 * 100) / 100)}/mês</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-navy border-t border-gray-200 pt-2">
              <span>Total mensal</span>
              <span className="text-primary">{formatCurrency(totalMes)}</span>
            </div>
            <div className="flex justify-between text-gray-500 text-xs">
              <span>Contrato anual (12 meses)</span>
              <span>{formatCurrency(totalAno)}</span>
            </div>
          </div>

          <button onClick={onFechar}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function PMOC() {
  const [contratos, setContratos] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [detalhe, setDetalhe] = useState(null)
  const [confirmExcluir, setConfirmExcluir] = useState(null)
  const [showCalc, setShowCalc] = useState(false)

  useEffect(() => {
    carregar()
    supabase.from('clients').select('id, name').order('name').range(0, 9999).then(({ data }) => setClientes(data || []))
  }, [])

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('pmoc_contracts').select('*').order('created_at', { ascending: false })
    setContratos(data || [])
    setLoading(false)
  }

  const excluir = async () => {
    await supabase.from('pmoc_contracts').delete().eq('id', confirmExcluir.id)
    setConfirmExcluir(null)
    carregar()
  }

  const filtrados = contratos.filter(c =>
    !busca || (c.razao_social || '').toLowerCase().includes(busca.toLowerCase())
  )

  const COR_STATUS = {
    ativo: 'bg-green-100 text-green-600',
    suspenso: 'bg-yellow-100 text-yellow-600',
    encerrado: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-navy">Contratos PMOC</h2>
          <p className="text-sm text-gray-500">Plano de Manutenção, Operação e Controle</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowCalc(true)}>
            <DollarSign size={16} /> Calcular Preço
          </Button>
          <Button onClick={() => { setEditando(null); setShowForm(true) }}>
            <Plus size={16} /> Novo Contrato
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Contratos Ativos', valor: contratos.filter(c => c.status === 'ativo').length, cor: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Receita Mensal', valor: formatCurrency(contratos.filter(c => c.status === 'ativo').reduce((a, c) => a + (c.valor_mensal || 0), 0)), cor: 'text-navy', bg: 'bg-navy/10' },
          { label: 'Total Contratos', valor: contratos.length, cor: 'text-primary', bg: 'bg-primary/10' },
        ].map(({ label, valor, cor, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
            <div className={['w-9 h-9 rounded-lg flex items-center justify-center mx-auto mb-2', bg].join(' ')}>
              <FileText size={17} className={cor} />
            </div>
            <p className={['text-lg font-bold', cor].join(' ')}>{valor}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={busca} onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por cliente..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : filtrados.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <FileText size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400">Nenhum contrato PMOC cadastrado</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setDetalhe(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={['text-xs px-2 py-0.5 rounded-full font-medium', COR_STATUS[c.status]].join(' ')}>
                        {c.status}
                      </span>
                      {c.tipo_estabelecimento && <span className="text-xs text-gray-400">{c.tipo_estabelecimento}</span>}
                    </div>
                    <p className="font-bold text-navy">{c.razao_social}</p>
                    <p className="text-xs text-gray-500">
                      Vigência: {formatDate(c.vigencia_inicio)} a {formatDate(c.vigencia_fim)}
                    </p>
                    {c.capacidade_total_btu && (
                      <p className="text-xs text-gray-400">{c.capacidade_total_btu.toLocaleString('pt-BR')} BTU instalados</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {c.valor_mensal > 0 && (
                      <p className="font-bold text-navy text-sm">{formatCurrency(c.valor_mensal)}/mês</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-gray-50">
                <button onClick={() => setDetalhe(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-primary hover:bg-primary/5 transition-colors font-medium">
                  <FileText size={13} /> Ver Contrato
                </button>
                <button onClick={() => { setEditando(c); setShowForm(true) }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors border-x border-gray-50">
                  <Edit2 size={13} /> Editar
                </button>
                <button onClick={() => setConfirmExcluir(c)}
                  className="px-4 flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <FormContrato contrato={editando} clientes={clientes} onSalvar={() => { setShowForm(false); setEditando(null); carregar() }} onCancelar={() => { setShowForm(false); setEditando(null) }} />}
      {detalhe && <DetalheContrato contrato={detalhe} onFechar={() => setDetalhe(null)} onEditar={c => { setDetalhe(null); setEditando(c); setShowForm(true) }} />}

      {showCalc && <Calculadora onFechar={() => setShowCalc(false)} />}

      {confirmExcluir && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center">
            <Trash2 size={28} className="text-red-400 mx-auto mb-3" />
            <h3 className="font-bold text-navy mb-2">Excluir contrato?</h3>
            <p className="text-gray-500 text-sm mb-5">Isso remove o contrato, equipamentos e cronograma. As parcelas do financeiro não serão removidas.</p>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setConfirmExcluir(null)} className="flex-1">Cancelar</Button>
              <Button variant="danger" onClick={excluir} className="flex-1">Excluir</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
