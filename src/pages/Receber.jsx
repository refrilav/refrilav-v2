import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  ChevronLeft, ChevronRight, Search, Plus, Edit2, Trash2,
  CheckCircle, X, Save, ChevronDown
} from 'lucide-react'

const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Cheque']

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y, m, d] = s.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function mesStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
function nomeMes(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function statusConta(conta) {
  if (conta.status === 'recebido') return 'recebido'
  if (conta.due_date && conta.due_date < hoje()) return 'vencido'
  return 'em_aberto'
}

const STATUS_STYLE = {
  em_aberto: { label: 'Em aberto', bg: 'bg-blue-100',   text: 'text-blue-700'  },
  vencido:   { label: 'Vencido',   bg: 'bg-red-100',    text: 'text-red-700'   },
  recebido:  { label: 'Recebido',  bg: 'bg-green-100',  text: 'text-green-700' },
}

export default function Receber() {
  const [mesRef, setMesRef] = useState(new Date())
  const [busca, setBusca] = useState('')
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [clientes, setClientes] = useState([])

  const [filtroCard, setFiltroCard] = useState(null) // null | 'vencido' | 'hoje' | 'a_vencer' | 'recebido'
  const [modalReceber, setModalReceber] = useState(null)
  const [formaPgto, setFormaPgto] = useState('Dinheiro')
  const [desconto, setDesconto] = useState('')
  const [dataRecebimento, setDataRecebimento] = useState(hoje())
  const [salvandoReceber, setSalvandoReceber] = useState(false)

  // Modal nova/editar conta
  const [modalConta, setModalConta] = useState(null) // null | 'novo' | {conta}
  const [formConta, setFormConta] = useState({ description:'', amount:'', due_date:'', client_id:'' })
  const [salvandoConta, setSalvandoConta] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesFiltrados, setClientesFiltrados] = useState([])
  const [mostrarClientes, setMostrarClientes] = useState(false)

  useEffect(() => { carregar() }, [mesRef])

  useEffect(() => {
    if (buscaCliente.length < 2) { setClientesFiltrados([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('clients').select('id, name').ilike('name', `%${buscaCliente}%`).range(0, 9)
      setClientesFiltrados(data || [])
      setMostrarClientes(true)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente])

  async function carregar() {
    setLoading(true)
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth() + 1
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`
    // Último dia real do mês
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
    const { data } = await supabase
      .from('receivables')
      .select('*, clients(name)')
      .gte('due_date', inicio)
      .lte('due_date', fim)
      .order('due_date', { ascending: true })
      .range(0, 9999)
    setContas(data || [])
    setLoading(false)
  }

  function mudarMes(delta) {
    const d = new Date(mesRef)
    d.setMonth(d.getMonth() + delta)
    setMesRef(d)
  }

  // Totais
  const hojeStr = hoje()

  const filtradas = contas.filter(c => {
    if (busca) {
      const desc = (c.description || '').toLowerCase()
      const nome = (c.clients?.name || '').toLowerCase()
      if (!desc.includes(busca.toLowerCase()) && !nome.includes(busca.toLowerCase())) return false
    }
    if (filtroCard === 'vencido')   return c.status !== 'recebido' && c.due_date < hojeStr
    if (filtroCard === 'hoje')      return c.status !== 'recebido' && c.due_date === hojeStr
    if (filtroCard === 'a_vencer')  return c.status !== 'recebido' && c.due_date > hojeStr
    if (filtroCard === 'recebido')  return c.status === 'recebido'
    return true
  })

  const vencidos   = contas.filter(c => c.status !== 'recebido' && c.due_date < hojeStr).reduce((s,c) => s + Number(c.amount||0), 0)
  const vencemHoje = contas.filter(c => c.status !== 'recebido' && c.due_date === hojeStr).reduce((s,c) => s + Number(c.amount||0), 0)
  const aVencer    = contas.filter(c => c.status !== 'recebido' && c.due_date > hojeStr).reduce((s,c) => s + Number(c.amount||0), 0)
  const recebidos  = contas.filter(c => c.status === 'recebido').reduce((s,c) => s + Number(c.amount||0), 0)
  const total      = contas.reduce((s,c) => s + Number(c.amount||0), 0)

  // Normaliza status: pendente = em_aberto
  function stNorm(c) {
    if (c.status === 'recebido') return 'recebido'
    if (c.due_date && c.due_date < hojeStr) return 'vencido'
    return 'em_aberto'
  }

  // Marcar como recebido
  async function confirmarRecebimento() {
    if (!modalReceber) return
    setSalvandoReceber(true)
    const val = parseFloat(String(modalReceber.amount || 0))
    const taxa = parseFloat(String(desconto || 0))
    const valorLiquido = val - taxa
    await supabase.from('receivables').update({
      status: 'recebido',
      payment_method: formaPgto,
      received_at: dataRecebimento,
      received_amount: valorLiquido,
      discount: taxa || null,
    }).eq('id', modalReceber.id)
    setSalvandoReceber(false)
    setModalReceber(null)
    setDesconto('')
    setFormaPgto('Dinheiro')
    carregar()
  }

  // Criar / editar conta
  function abrirNova() {
    setFormConta({ description:'', amount:'', due_date: hoje(), client_id:'' })
    setBuscaCliente('')
    setModalConta('novo')
  }
  function abrirEditar(c) {
    setFormConta({ description: c.description||'', amount: c.amount||'', due_date: c.due_date||'', client_id: c.client_id||'' })
    setBuscaCliente(c.clients?.name || '')
    setModalConta(c)
  }
  async function salvarConta() {
    if (!formConta.description || !formConta.amount) return alert('Preencha descrição e valor.')
    setSalvandoConta(true)
    const payload = {
      description: formConta.description,
      amount: parseFloat(String(formConta.amount).replace(',','.')) || 0,
      due_date: formConta.due_date || null,
      client_id: formConta.client_id || null,
      status: 'pendente',
    }
    if (modalConta === 'novo') {
      await supabase.from('receivables').insert(payload)
    } else {
      await supabase.from('receivables').update(payload).eq('id', modalConta.id)
    }
    setSalvandoConta(false)
    setModalConta(null)
    carregar()
  }
  async function excluir(id) {
    if (!window.confirm('Excluir esta conta?')) return
    await supabase.from('receivables').delete().eq('id', id)
    carregar()
  }

  const temDesconto = formaPgto.includes('Cartão') || formaPgto === 'Dinheiro'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-navy">Contas a Receber</h1>
          <button onClick={abrirNova}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Plus size={15} /> Nova
          </button>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => mudarMes(-1)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            <ChevronLeft size={16} className="text-gray-600" />
          </button>
          <div className="flex-1 text-center text-sm font-semibold text-navy capitalize">
            {nomeMes(mesRef)}
          </div>
          <button onClick={() => mudarMes(1)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200">
            <ChevronRight size={16} className="text-gray-600" />
          </button>
        </div>

        {/* Busca */}
        <div className="relative">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Pesquisar no período..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none" />
          <Search size={15} className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>

      {/* Cards de totais — clicáveis como filtro */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-5 gap-1.5 mb-3">
          {[
            { label: 'Vencidos',     valor: vencidos,   cor: 'text-red-600',    filtro: 'vencido',   ativo: 'ring-2 ring-red-400'    },
            { label: 'Vencem hoje',  valor: vencemHoje, cor: 'text-orange-500', filtro: 'hoje',      ativo: 'ring-2 ring-orange-400' },
            { label: 'A vencer',     valor: aVencer,    cor: 'text-blue-600',   filtro: 'a_vencer',  ativo: 'ring-2 ring-blue-400'   },
            { label: 'Recebidos',    valor: recebidos,  cor: 'text-green-600',  filtro: 'recebido',  ativo: 'ring-2 ring-green-400'  },
            { label: 'Total',        valor: total,      cor: 'text-navy',       filtro: null,        ativo: ''                       },
          ].map(({ label, valor, cor, filtro, ativo }) => (
            <button
              key={label}
              onClick={() => setFiltroCard(filtroCard === filtro ? null : filtro)}
              className={`bg-white rounded-xl p-2 shadow-sm text-center transition ${
                filtroCard === filtro && filtro !== null ? ativo + ' bg-gray-50' : 'hover:bg-gray-50'
              }`}
            >
              <p className="text-[9px] text-gray-400 mb-0.5 leading-tight">{label}</p>
              <p className={`text-xs font-bold ${cor} leading-tight`}>
                {Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </button>
          ))}
        </div>
        {filtroCard && (
          <button onClick={() => setFiltroCard(null)}
            className="w-full text-center text-xs text-primary font-medium mb-2 flex items-center justify-center gap-1">
            <X size={12} /> Limpar filtro
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="px-4 pb-6 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhuma conta neste período</div>
        ) : filtradas.map(c => {
          const st = STATUS_STYLE[stNorm(c)]
          return (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3">
                {/* Barra lateral colorida */}
                <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${
                  stNorm(c) === 'vencido' ? 'bg-red-400' :
                  stNorm(c) === 'recebido' ? 'bg-green-400' : 'bg-blue-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.description || '—'}</p>
                  {c.clients?.name && <p className="text-xs text-gray-400 truncate">{c.clients.name}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">Venc: {fmtData(c.due_date)}</span>
                    {c.status === 'recebido' && c.received_at && (
                      <span className="text-xs text-green-600">Rec: {fmtData(c.received_at)}</span>
                    )}
                  </div>
                  {c.payment_method && (
                    <p className="text-xs text-gray-400 mt-0.5">{c.payment_method}
                      {c.discount > 0 && <span className="text-red-400"> (-{fmt(c.discount)})</span>}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-base font-bold text-gray-900">{fmt(c.amount)}</p>
                  {c.received_amount && c.received_amount !== c.amount && (
                    <p className="text-xs text-green-600 font-medium">Líq: {fmt(c.received_amount)}</p>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>
                    {st.label}
                  </span>
                </div>
              </div>

              {/* Ações */}
              {c.status !== 'recebido' && (
                <div className="flex border-t border-gray-50">
                  <button onClick={() => { setModalReceber(c); setDataRecebimento(hoje()) }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-green-600 hover:bg-green-50 transition">
                    <CheckCircle size={14} /> Receber
                  </button>
                  <div className="w-px bg-gray-50" />
                  <button onClick={() => abrirEditar(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition">
                    <Edit2 size={14} /> Editar
                  </button>
                  <div className="w-px bg-gray-50" />
                  <button onClick={() => excluir(c.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )}
              {c.status === 'recebido' && (
                <div className="flex border-t border-gray-50">
                  <button onClick={() => abrirEditar(c)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition">
                    <Edit2 size={14} /> Editar
                  </button>
                  <div className="w-px bg-gray-50" />
                  <button onClick={() => excluir(c.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                    <Trash2 size={14} /> Excluir
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Totais do período */}
      {filtradas.length > 0 && (
        <div className="mx-4 mb-6 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Totais do período — {nomeMes(mesRef)}
          </p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Vencidos</span><span className="font-semibold text-red-600">{fmt(vencidos)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">A vencer</span><span className="font-semibold text-blue-600">{fmt(aVencer)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Recebidos</span><span className="font-semibold text-green-600">{fmt(recebidos)}</span></div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2">
              <span>Total do período</span><span className="text-navy">{fmt(total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Marcar como recebido */}
      {modalReceber && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4"
            style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Registrar Recebimento</h3>
              <button onClick={() => setModalReceber(null)}><X size={20} className="text-gray-400"/></button>
            </div>

            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-900 truncate">{modalReceber.description}</p>
              <p className="text-lg font-bold text-navy mt-1">{fmt(modalReceber.amount)}</p>
            </div>

            {/* Data */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Data do recebimento</label>
              <input type="date" value={dataRecebimento} onChange={e => setDataRecebimento(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>

            {/* Forma de pagamento */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Forma de pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {FORMAS_PAGAMENTO.map(f => (
                  <button key={f} onClick={() => setFormaPgto(f)}
                    className={`py-2 px-1 rounded-xl text-xs font-medium border transition text-center ${
                      formaPgto === f ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200'
                    }`}>{f}</button>
                ))}
              </div>
            </div>

            {/* Desconto/taxa */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                {formaPgto.includes('Cartão') ? 'Taxa do cartão (R$)' : 'Desconto à vista (R$)'}
                <span className="text-gray-400 font-normal"> — opcional</span>
              </label>
              <input type="number" value={desconto} onChange={e => setDesconto(e.target.value)}
                placeholder="0,00" step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              {desconto > 0 && (
                <p className="text-xs text-green-600 mt-1">
                  Valor líquido: {fmt(Number(modalReceber.amount) - parseFloat(desconto || 0))}
                </p>
              )}
            </div>

            <button onClick={confirmarRecebimento} disabled={salvandoReceber}
              className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2">
              <CheckCircle size={20} />
              {salvandoReceber ? 'Salvando...' : 'Confirmar Recebimento'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Nova / Editar conta */}
      {modalConta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">
                {modalConta === 'novo' ? 'Nova Conta a Receber' : 'Editar Conta'}
              </h3>
              <button onClick={() => setModalConta(null)}><X size={20} className="text-gray-400"/></button>
            </div>

            {/* Descrição */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Descrição *</label>
              <input value={formConta.description} onChange={e => setFormConta(f=>({...f,description:e.target.value}))}
                placeholder="Ex: Manutenção ar-condicionado"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>

            {/* Valor */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Valor *</label>
              <input type="number" value={formConta.amount} onChange={e => setFormConta(f=>({...f,amount:e.target.value}))}
                placeholder="0,00" step="0.01"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>

            {/* Vencimento */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Vencimento</label>
              <input type="date" value={formConta.due_date} onChange={e => setFormConta(f=>({...f,due_date:e.target.value}))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>

            {/* Cliente */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Cliente</label>
              <div className="relative">
                <input value={buscaCliente} onChange={e => { setBuscaCliente(e.target.value); setFormConta(f=>({...f,client_id:''})) }}
                  placeholder="Buscar cliente..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                {mostrarClientes && clientesFiltrados.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                    {clientesFiltrados.map(c => (
                      <button key={c.id} onClick={() => { setFormConta(f=>({...f,client_id:c.id})); setBuscaCliente(c.name); setMostrarClientes(false) }}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <button onClick={salvarConta} disabled={salvandoConta}
              className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2">
              <Save size={18} />
              {salvandoConta ? 'Salvando...' : modalConta === 'novo' ? 'Criar Conta' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
