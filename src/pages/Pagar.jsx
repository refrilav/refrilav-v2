import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  ChevronLeft, ChevronRight, Search, Plus, Edit2, Trash2,
  CheckCircle, X, Save, User, RefreshCw
} from 'lucide-react'

const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência', 'Boleto', 'Cheque']
const CATS_PADRAO = ['Fornecedor', 'Aluguel', 'Salário', 'Impostos', 'Serviços', 'Equipamentos', 'Peças', 'Outros']
const RECORRENCIAS = [
  { value: null, label: 'Não' },
  { value: 'mensal', label: 'Mensal' },
  { value: 'bimestral', label: 'Bimestral' },
  { value: 'trimestral', label: 'Trimestral' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'anual', label: 'Anual' },
]

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y, m, d] = s.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}
function nomeMes(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const CATS_KEY = 'refrilav_categorias_pagar'
function carregarCats() {
  try { return JSON.parse(localStorage.getItem(CATS_KEY)) || CATS_PADRAO } catch { return CATS_PADRAO }
}
function salvarCatsLS(cats) { localStorage.setItem(CATS_KEY, JSON.stringify(cats)) }

export default function Pagar() {
  const [mesRef, setMesRef] = useState(new Date())
  const [busca, setBusca] = useState('')
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filtroCard, setFiltroCard] = useState(null)
  const [filtroCategoria, setFiltroCategoria] = useState(null)
  const [categorias, setCategorias] = useState(carregarCats)

  // Modal pagar
  const [modalPagar, setModalPagar] = useState(null)
  const [formaPgto, setFormaPgto] = useState('Pix')
  const [dataPagamento, setDataPagamento] = useState(hoje())
  const [salvandoPagar, setSalvandoPagar] = useState(false)

  // Modal nova/editar conta
  const [modalConta, setModalConta] = useState(null)
  const [formConta, setFormConta] = useState({ description:'', amount:'', due_date:'', category:'', supplier_id:'', supplier_name:'', recorrencia: null, parcelas: 1 })
  const [salvandoConta, setSalvandoConta] = useState(false)

  // Fornecedor
  const [buscaFornecedor, setBuscaFornecedor] = useState('')
  const [fornecedores, setFornecedores] = useState([])
  const [mostrarFornecedores, setMostrarFornecedores] = useState(false)
  const fornecedorRef = useRef()

  // Categorias
  const [modalCats, setModalCats] = useState(false)
  const [novaCat, setNovaCat] = useState('')

  useEffect(() => { carregar() }, [mesRef])

  useEffect(() => {
    if (buscaFornecedor.length < 2) { setFornecedores([]); setMostrarFornecedores(false); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('suppliers').select('id, name').ilike('name', `%${buscaFornecedor}%`).range(0, 9)
      setFornecedores(data || [])
      setMostrarFornecedores(true)
    }, 300)
    return () => clearTimeout(t)
  }, [buscaFornecedor])

  // Fechar dropdown de fornecedor ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (fornecedorRef.current && !fornecedorRef.current.contains(e.target)) {
        setMostrarFornecedores(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function carregar() {
    setLoading(true)
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth() + 1
    const inicio = `${ano}-${String(mes).padStart(2,'0')}-01`
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fim = `${ano}-${String(mes).padStart(2,'0')}-${String(ultimoDia).padStart(2,'0')}`
    const { data } = await supabase
      .from('payables')
      .select('*')
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

  const hojeStr = hoje()
  function stNorm(c) {
    if (c.status === 'pago') return 'pago'
    if (c.due_date && c.due_date < hojeStr) return 'vencido'
    return 'em_aberto'
  }

  const filtradas = contas.filter(c => {
    if (busca) {
      const desc = (c.description || '').toLowerCase()
      const forn = (c.supplier_name || '').toLowerCase()
      if (!desc.includes(busca.toLowerCase()) && !forn.includes(busca.toLowerCase())) return false
    }
    if (filtroCategoria && c.category !== filtroCategoria) return false
    if (filtroCard === 'vencido')  return stNorm(c) === 'vencido'
    if (filtroCard === 'hoje')     return c.status !== 'pago' && c.due_date === hojeStr
    if (filtroCard === 'a_vencer') return c.status !== 'pago' && c.due_date > hojeStr
    if (filtroCard === 'pago')     return c.status === 'pago'
    return true
  })

  const vencidos   = contas.filter(c => stNorm(c) === 'vencido').reduce((s,c) => s + Number(c.amount||0), 0)
  const vencemHoje = contas.filter(c => c.status !== 'pago' && c.due_date === hojeStr).reduce((s,c) => s + Number(c.amount||0), 0)
  const aVencer    = contas.filter(c => c.status !== 'pago' && c.due_date > hojeStr).reduce((s,c) => s + Number(c.amount||0), 0)
  const pagos      = contas.filter(c => c.status === 'pago').reduce((s,c) => s + Number(c.amount||0), 0)
  const total      = contas.reduce((s,c) => s + Number(c.amount||0), 0)

  async function confirmarPagamento() {
    setSalvandoPagar(true)
    await supabase.from('payables').update({
      status: 'pago',
      payment_method: formaPgto,
      paid_at: dataPagamento,
    }).eq('id', modalPagar.id)
    setSalvandoPagar(false)
    setModalPagar(null)
    carregar()
  }

  function abrirNova() {
    setFormConta({ description:'', amount:'', due_date: hoje(), category:'', supplier_id:'', supplier_name:'', recorrencia: null, parcelas: 1 })
    setBuscaFornecedor('')
    setMostrarFornecedores(false)
    setModalConta('novo')
  }
  function abrirEditar(c) {
    setFormConta({
      description: c.description||'', amount: c.amount||'',
      due_date: c.due_date||'', category: c.category||'',
      supplier_id: c.supplier_id||'', supplier_name: c.supplier_name||'',
      recorrencia: c.recorrencia || null, parcelas: 1,
    })
    setBuscaFornecedor(c.supplier_name || '')
    setMostrarFornecedores(false)
    setModalConta(c)
  }

  async function criarFornecedor() {
    if (!buscaFornecedor.trim()) return
    const { data, error } = await supabase.from('suppliers').insert({ name: buscaFornecedor.trim() }).select().single()
    if (data) {
      setFormConta(f => ({ ...f, supplier_id: data.id, supplier_name: data.name }))
      setMostrarFornecedores(false)
      setBuscaFornecedor(data.name)
    } else {
      alert('Erro ao criar fornecedor: ' + error?.message)
    }
  }

  function selecionarFornecedor(f) {
    setFormConta(fc => ({ ...fc, supplier_id: f.id, supplier_name: f.name }))
    setBuscaFornecedor(f.name)
    setMostrarFornecedores(false)
  }

  // Gerar próximas parcelas para recorrência
  function gerarDatasRecorrencia(dataBase, recorrencia, qtd = 12) {
    const datas = []
    const [y, m, d] = dataBase.split('-').map(Number)
    const mesesPorPeriodo = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }
    const intervalo = mesesPorPeriodo[recorrencia] || 1
    for (let i = 1; i <= qtd; i++) {
      const novaData = new Date(y, m - 1 + i * intervalo, d)
      const str = `${novaData.getFullYear()}-${String(novaData.getMonth()+1).padStart(2,'0')}-${String(novaData.getDate()).padStart(2,'0')}`
      datas.push(str)
    }
    return datas
  }

  async function salvarConta() {
    if (!formConta.description || !formConta.amount) return alert('Preencha descrição e valor.')
    setSalvandoConta(true)
    const valorTotal = parseFloat(String(formConta.amount).replace(',','.')) || 0
    const nParcelas = parseInt(formConta.parcelas) || 1
    const valorParcela = nParcelas > 1 ? parseFloat((valorTotal / nParcelas).toFixed(2)) : valorTotal

    const basePayload = {
      description: formConta.description,
      due_date: formConta.due_date || null,
      category: formConta.category || null,
      supplier_id: formConta.supplier_id || null,
      supplier_name: formConta.supplier_name || buscaFornecedor || null,
      recorrencia: formConta.recorrencia || null,
      status: 'em_aberto',
    }

    if (modalConta === 'novo') {
      if (nParcelas > 1) {
        // Gera N parcelas mensais
        for (let i = 0; i < nParcelas; i++) {
          const [y, m, d] = (formConta.due_date || hoje()).split('-').map(Number)
          const dataVenc = new Date(y, m - 1 + i, d)
          const dataStr = `${dataVenc.getFullYear()}-${String(dataVenc.getMonth()+1).padStart(2,'0')}-${String(dataVenc.getDate()).padStart(2,'0')}`
          // Ajuste no valor da última parcela para compensar arredondamento
          const valor = i === nParcelas - 1 ? parseFloat((valorTotal - valorParcela * (nParcelas - 1)).toFixed(2)) : valorParcela
          await supabase.from('payables').insert({
            ...basePayload,
            amount: valor,
            description: `${formConta.description} (${i+1}/${nParcelas})`,
            due_date: dataStr,
          })
        }
      } else {
        await supabase.from('payables').insert({ ...basePayload, amount: valorTotal })
        // Recorrência
        if (formConta.recorrencia && formConta.due_date) {
          const proximas = gerarDatasRecorrencia(formConta.due_date, formConta.recorrencia)
          for (const data of proximas) {
            await supabase.from('payables').insert({ ...basePayload, amount: valorTotal, due_date: data })
          }
        }
      }
    } else {
      await supabase.from('payables').update({ ...basePayload, amount: valorTotal }).eq('id', modalConta.id)
    }
    setSalvandoConta(false)
    setModalConta(null)
    carregar()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta conta?')) return
    await supabase.from('payables').delete().eq('id', id)
    carregar()
  }

  function adicionarCategoria() {
    const cat = novaCat.trim()
    if (!cat || categorias.includes(cat)) return
    const novas = [...categorias, cat]
    setCategorias(novas)
    salvarCatsLS(novas)
    setNovaCat('')
  }

  function removerCategoria(cat) {
    if (CATS_PADRAO.includes(cat)) return
    const novas = categorias.filter(c => c !== cat)
    setCategorias(novas)
    salvarCatsLS(novas)
  }

  const STATUS_STYLE = {
    em_aberto: { label: 'Em aberto', bg: 'bg-blue-100',  text: 'text-blue-700'  },
    vencido:   { label: 'Vencido',   bg: 'bg-red-100',   text: 'text-red-700'   },
    pago:      { label: 'Pago',      bg: 'bg-green-100', text: 'text-green-700' },
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Contas a Pagar</h1>
          <button onClick={abrirNova}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Plus size={15}/> Nova
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => mudarMes(-1)} className="p-2 rounded-lg bg-gray-100"><ChevronLeft size={16} className="text-gray-600"/></button>
          <div className="flex-1 text-center text-sm font-semibold text-navy capitalize">{nomeMes(mesRef)}</div>
          <button onClick={() => mudarMes(1)} className="p-2 rounded-lg bg-gray-100"><ChevronRight size={16} className="text-gray-600"/></button>
        </div>
        <div className="relative mb-3">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"/>
          <Search size={15} className="absolute left-3 top-3 text-gray-400"/>
        </div>
        {/* Filtro por categoria */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <button onClick={() => setFiltroCategoria(null)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${!filtroCategoria ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'}`}>
            Todas
          </button>
          {categorias.map(cat => (
            <button key={cat} onClick={() => setFiltroCategoria(filtroCategoria === cat ? null : cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${filtroCategoria === cat ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-5 gap-1.5 mb-1">
          {[
            { label:'Vencidos',    valor:vencidos,   cor:'text-red-600',    filtro:'vencido',   ativo:'ring-2 ring-red-400'    },
            { label:'Vencem hoje', valor:vencemHoje, cor:'text-orange-500', filtro:'hoje',      ativo:'ring-2 ring-orange-400' },
            { label:'A vencer',    valor:aVencer,    cor:'text-blue-600',   filtro:'a_vencer',  ativo:'ring-2 ring-blue-400'   },
            { label:'Pagos',       valor:pagos,      cor:'text-green-600',  filtro:'pago',      ativo:'ring-2 ring-green-400'  },
            { label:'Total',       valor:total,      cor:'text-navy',       filtro:null,        ativo:''                       },
          ].map(({ label, valor, cor, filtro, ativo }) => (
            <button key={label} onClick={() => setFiltroCard(filtroCard === filtro ? null : filtro)}
              className={`bg-white rounded-xl p-2 shadow-sm text-center transition ${filtroCard === filtro && filtro ? ativo + ' bg-gray-50' : 'hover:bg-gray-50'}`}>
              <p className="text-[9px] text-gray-400 mb-0.5 leading-tight">{label}</p>
              <p className={`text-xs font-bold ${cor} leading-tight`}>{Number(valor).toLocaleString('pt-BR',{minimumFractionDigits:2})}</p>
            </button>
          ))}
        </div>
        {filtroCard && (
          <button onClick={() => setFiltroCard(null)} className="w-full text-center text-xs text-primary font-medium mt-1 mb-1 flex items-center justify-center gap-1">
            <X size={12}/> Limpar filtro
          </button>
        )}
      </div>

      {/* Lista */}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhuma conta neste período</div>
        ) : filtradas.map(c => {
          const st = STATUS_STYLE[stNorm(c)]
          return (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-start gap-3 px-4 py-3">
                <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${stNorm(c)==='vencido'?'bg-red-400':stNorm(c)==='pago'?'bg-green-400':'bg-blue-400'}`}/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.description||'—'}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {c.category && <span className="text-xs text-gray-400">{c.category}</span>}
                    {c.supplier_name && <span className="text-xs text-blue-500">{c.supplier_name}</span>}
                    {c.recorrencia && <span className="text-xs text-purple-500 flex items-center gap-0.5"><RefreshCw size={9}/>{c.recorrencia}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">Venc: {fmtData(c.due_date)}</span>
                    {c.status==='pago' && c.paid_at && <span className="text-xs text-green-600">Pago: {fmtData(c.paid_at)}</span>}
                  </div>
                  {c.payment_method && <p className="text-xs text-gray-400 mt-0.5">{c.payment_method}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-base font-bold text-gray-900">{fmt(c.amount)}</p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                </div>
              </div>
              <div className="flex border-t border-gray-50">
                {c.status !== 'pago' && (
                  <>
                    <button onClick={() => { setModalPagar(c); setDataPagamento(hoje()) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-green-600 hover:bg-green-50 transition">
                      <CheckCircle size={14}/> Pagar
                    </button>
                    <div className="w-px bg-gray-50"/>
                  </>
                )}
                <button onClick={() => abrirEditar(c)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition">
                  <Edit2 size={14}/> Editar
                </button>
                <div className="w-px bg-gray-50"/>
                <button onClick={() => excluir(c.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition">
                  <Trash2 size={14}/> Excluir
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Totais */}
      {filtradas.length > 0 && (
        <div className="mx-4 mb-6 bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Totais — {nomeMes(mesRef)}</p>
          <div className="space-y-2">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Vencidos</span><span className="font-semibold text-red-600">{fmt(vencidos)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">A vencer</span><span className="font-semibold text-blue-600">{fmt(aVencer)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-gray-600">Pagos</span><span className="font-semibold text-green-600">{fmt(pagos)}</span></div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2"><span>Total</span><span className="text-navy">{fmt(total)}</span></div>
          </div>
        </div>
      )}

      {/* MODAL: Pagar */}
      {modalPagar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4" style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Registrar Pagamento</h3>
              <button onClick={() => setModalPagar(null)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-semibold truncate">{modalPagar.description}</p>
              <p className="text-lg font-bold text-navy mt-1">{fmt(modalPagar.amount)}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Data do pagamento</label>
              <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Forma de pagamento</label>
              <div className="grid grid-cols-3 gap-2">
                {FORMAS_PAGAMENTO.map(f => (
                  <button key={f} onClick={() => setFormaPgto(f)}
                    className={`py-2 px-1 rounded-xl text-xs font-medium border transition text-center ${formaPgto===f?'bg-navy text-white border-navy':'bg-white text-gray-600 border-gray-200'}`}>{f}</button>
                ))}
              </div>
            </div>
            <button onClick={confirmarPagamento} disabled={salvandoPagar}
              className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2">
              <CheckCircle size={20}/>{salvandoPagar?'Salvando...':'Confirmar Pagamento'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Nova/Editar */}
      {modalConta && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-bold text-navy">{modalConta==='novo'?'Nova Conta a Pagar':'Editar Conta'}</h3>
              <button onClick={() => setModalConta(null)}><X size={20} className="text-gray-400"/></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Descrição *</label>
                <input value={formConta.description} onChange={e => setFormConta(f=>({...f,description:e.target.value}))}
                  placeholder="Ex: Conta de luz"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Valor total *</label>
                  <input type="number" value={formConta.amount} onChange={e => setFormConta(f=>({...f,amount:e.target.value}))}
                    placeholder="0,00" step="0.01"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Vencimento 1ª parcela</label>
                  <input type="date" value={formConta.due_date} onChange={e => setFormConta(f=>({...f,due_date:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
              </div>

              {/* Parcelamento — só para nova conta */}
              {modalConta === 'novo' && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Parcelamento</label>
                  <div className="flex gap-2 flex-wrap">
                    {[1,2,3,4,5,6,8,10,12,18,24,36,48,60].map(n => (
                      <button key={n} onClick={() => setFormConta(f=>({...f,parcelas:n, recorrencia: n>1 ? null : f.recorrencia}))}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${formConta.parcelas===n?'bg-navy text-white border-navy':'bg-white text-gray-600 border-gray-200'}`}>
                        {n===1 ? 'À vista' : `${n}x`}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">Outro:</span>
                    <input type="number" min={1} max={360}
                      placeholder="Ex: 72"
                      onChange={e => { const v = parseInt(e.target.value)||1; setFormConta(f=>({...f,parcelas:v,recorrencia:v>1?null:f.recorrencia})) }}
                      className="w-20 border border-gray-200 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-primary"/>
                  </div>
                  {formConta.parcelas > 1 && formConta.amount && (
                    <p className="text-xs text-blue-600 mt-1.5">
                      {formConta.parcelas}x de {fmt(parseFloat(String(formConta.amount).replace(',','.')) / formConta.parcelas)} · vencimentos mensais
                    </p>
                  )}
                </div>
              )}

              {/* Recorrência */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Recorrente?</label>
                <div className="grid grid-cols-3 gap-2">
                  {RECORRENCIAS.map(r => (
                    <button key={String(r.value)} onClick={() => setFormConta(f=>({...f,recorrencia:r.value}))}
                      className={`py-2 px-1 rounded-xl text-xs font-medium border transition text-center flex items-center justify-center gap-1 ${formConta.recorrencia===r.value?'bg-navy text-white border-navy':'bg-white text-gray-600 border-gray-200'}`}>
                      {r.value && <RefreshCw size={10}/>}{r.label}
                    </button>
                  ))}
                </div>
                {formConta.recorrencia && (
                  <p className="text-xs text-purple-600 mt-1.5">
                    Serão criadas automaticamente as próximas 12 parcelas {formConta.recorrencia}s a partir do vencimento informado.
                  </p>
                )}
              </div>

              {/* Fornecedor */}
              <div ref={fornecedorRef}>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Fornecedor</label>
                <div className="relative">
                  <input value={buscaFornecedor}
                    onChange={e => { setBuscaFornecedor(e.target.value); setFormConta(f=>({...f,supplier_id:'',supplier_name:''})) }}
                    onFocus={() => buscaFornecedor.length >= 2 && setMostrarFornecedores(true)}
                    placeholder="Buscar ou criar fornecedor..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary pr-10"/>
                  <User size={15} className="absolute right-3 top-3 text-gray-400"/>
                  {mostrarFornecedores && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-20 overflow-hidden">
                      {fornecedores.map(f => (
                        <button key={f.id} onClick={() => selecionarFornecedor(f)}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          {f.name}
                        </button>
                      ))}
                      {buscaFornecedor.trim() && (
                        <button onClick={criarFornecedor}
                          className="w-full px-4 py-3 text-left text-sm text-primary font-semibold hover:bg-blue-50 flex items-center gap-2">
                          <Plus size={14}/> Criar "{buscaFornecedor}"
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {formConta.supplier_id && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <CheckCircle size={11}/> {formConta.supplier_name || buscaFornecedor}
                  </p>
                )}
              </div>

              {/* Categoria */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500">Categoria</label>
                  <button onClick={() => setModalCats(true)} className="text-xs text-primary font-semibold">+ Gerenciar</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {categorias.map(cat => (
                    <button key={cat} onClick={() => setFormConta(f=>({...f,category:cat===formConta.category?'':cat}))}
                      className={`py-2 px-1 rounded-xl text-xs font-medium border transition text-center ${formConta.category===cat?'bg-navy text-white border-navy':'bg-white text-gray-600 border-gray-200'}`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0" style={{paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
              <button onClick={salvarConta} disabled={salvandoConta}
                className="w-full bg-primary text-white rounded-2xl py-4 font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                <Save size={18}/>{salvandoConta?'Salvando...':modalConta==='novo'?'Criar Conta':'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Gerenciar categorias */}
      {modalCats && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4 max-h-[70vh] overflow-y-auto" style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Gerenciar Categorias</h3>
              <button onClick={() => setModalCats(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="flex gap-2">
              <input value={novaCat} onChange={e => setNovaCat(e.target.value)}
                placeholder="Nova categoria..."
                onKeyDown={e => e.key==='Enter' && adicionarCategoria()}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              <button onClick={adicionarCategoria} className="bg-primary text-white px-4 rounded-xl font-semibold">
                <Plus size={16}/>
              </button>
            </div>
            <div className="space-y-2">
              {categorias.map(cat => (
                <div key={cat} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-sm text-gray-800">{cat}</span>
                  {!CATS_PADRAO.includes(cat) ? (
                    <button onClick={() => removerCategoria(cat)} className="p-1 rounded-lg bg-red-50">
                      <Trash2 size={14} className="text-red-500"/>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-300">padrão</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
