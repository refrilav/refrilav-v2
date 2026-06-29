import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, X, Search, Link, Plus, ChevronDown, CheckCircle2, Save } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Math.abs(Number(v)).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y,m,d] = s.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

function parseOFX(text) {
  const transacoes = []
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let match
  while ((match = stmtTrnRegex.exec(text)) !== null) {
    const bloco = match[1]
    const get = (tag) => { const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i')); return m ? m[1].trim() : '' }
    const dtposted = get('DTPOSTED')
    const trnamt = parseFloat(get('TRNAMT').replace(',', '.')) || 0
    const fitid = get('FITID')
    const name = get('NAME')
    const memo = get('MEMO')
    let date = ''
    if (dtposted.length >= 8) date = `${dtposted.substring(0,4)}-${dtposted.substring(4,6)}-${dtposted.substring(6,8)}`
    const type = trnamt >= 0 ? 'credit' : 'debit'
    transacoes.push({ date, amount: Math.abs(trnamt), type, description: name || memo, memo, fitid, party_name: name || '', category: '', status: 'pendente' })
  }
  if (transacoes.length === 0) {
    const blocos = text.split('<STMTTRN>').slice(1)
    blocos.forEach(bloco => {
      const get = (tag) => { const m = bloco.match(new RegExp(`<${tag}>\\s*([^\r\n<]+)`, 'i')); return m ? m[1].trim() : '' }
      const dtposted = get('DTPOSTED')
      const trnamt = parseFloat(get('TRNAMT').replace(',', '.')) || 0
      const fitid = get('FITID')
      const name = get('NAME')
      const memo = get('MEMO')
      let date = ''
      if (dtposted.length >= 8) date = `${dtposted.substring(0,4)}-${dtposted.substring(4,6)}-${dtposted.substring(6,8)}`
      const type = trnamt >= 0 ? 'credit' : 'debit'
      if (fitid) transacoes.push({ date, amount: Math.abs(trnamt), type, description: name || memo, memo, fitid, party_name: name || '', category: '', status: 'pendente' })
    })
  }
  return transacoes
}

const CATS_RECEITA_PADRAO = ['Serviços','Vendas','Outros recebimentos']
const CATS_DESPESA_PADRAO = ['Fornecedores','Aluguel','Salários','Impostos','Compras','Combustível','Alimentação','Telefone','Internet','Outros']

export default function Conciliacao() {
  const [transacoes, setTransacoes] = useState([])
  const [loading, setLoading] = useState(true)
  const [importando, setImportando] = useState(false)
  const [filtro, setFiltro] = useState('pendente')
  const [busca, setBusca] = useState('')

  // Editar inline
  const [editando, setEditando] = useState(null)
  const [formEdit, setFormEdit] = useState({})
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  // Categorias dinâmicas
  const [catsPagar, setCatsPagar] = useState(CATS_DESPESA_PADRAO)
  const [catsReceber] = useState(CATS_RECEITA_PADRAO)

  // Modal vincular
  const [modalVincular, setModalVincular] = useState(null)
  const [contasDisponiveis, setContasDisponiveis] = useState([])
  const [buscaConta, setBuscaConta] = useState('')

  // Modal criar conta
  const [modalCriar, setModalCriar] = useState(null) // transacao
  const [formCriar, setFormCriar] = useState({})
  const [salvandoCriar, setSalvandoCriar] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [addCategoria, setAddCategoria] = useState(false)
  const [buscaFornecedor, setBuscaFornecedor] = useState('')
  const [fornecedoresSugestoes, setFornecedoresSugestoes] = useState([])
  const [addFornecedor, setAddFornecedor] = useState(false)
  const [novoFornecedor, setNovoFornecedor] = useState({ name:'', phone:'', email:'' })
  const [salvandoFornecedor, setSalvandoFornecedor] = useState(false)

  const fileRef = useRef(null)

  useEffect(() => { carregar() }, [filtro])

  useEffect(() => {
    async function carregarCategorias() {
      const { data } = await supabase.from('payables').select('category').not('category', 'is', null)
      const cats = [...new Set((data||[]).map(p => p.category).filter(Boolean))]
      // Mescla as categorias do banco com as padrão
      const merged = [...new Set([...CATS_DESPESA_PADRAO, ...cats])]
      setCatsPagar(merged)
    }
    carregarCategorias()
  }, [])

  async function carregar() {
    setLoading(true)
    let q = supabase.from('bank_transactions').select('*')
      .order('date', { ascending: false }).range(0, 9999)
    if (filtro && filtro !== 'todos') q = q.eq('status', filtro)
    const { data } = await q
    setTransacoes(data || [])
    setLoading(false)
  }

  async function importarOFX(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportando(true)
    const text = await file.text()
    const parsed = parseOFX(text)
    if (parsed.length === 0) { alert('Nenhuma transação encontrada. Verifique se é um arquivo OFX válido.'); setImportando(false); return }
    const fitids = parsed.map(t => t.fitid).filter(Boolean)
    const { data: existentes } = await supabase.from('bank_transactions').select('fitid').in('fitid', fitids)
    const fitidsExistentes = new Set((existentes || []).map(e => e.fitid))
    const novas = parsed.filter(t => !fitidsExistentes.has(t.fitid))
    if (novas.length === 0) { alert('Todas as transações já foram importadas.'); setImportando(false); return }
    const { error } = await supabase.from('bank_transactions').insert(novas)
    if (error) { alert('Erro ao importar: ' + error.message); setImportando(false); return }
    setImportando(false)
    alert(`${novas.length} transação(ões) importada(s)!${fitidsExistentes.size > 0 ? ` (${fitidsExistentes.size} duplicata(s) ignorada(s))` : ''}`)
    setFiltro('pendente')
    carregar()
    e.target.value = ''
  }

  async function salvarEdicao() {
    setSalvandoEdit(true)
    await supabase.from('bank_transactions').update({
      party_name: formEdit.party_name,
      category: formEdit.category,
      description: formEdit.description,
    }).eq('id', editando)
    setSalvandoEdit(false)
    setEditando(null)
    carregar()
  }

  async function marcarStatus(id, status) {
    await supabase.from('bank_transactions').update({ status }).eq('id', id)
    carregar()
  }

  async function vincularConta(transacao, conta, tipo) {
    const update = tipo === 'receivable'
      ? { receivable_id: conta.id, status: 'conciliado', party_name: conta.description }
      : { payable_id: conta.id, status: 'conciliado', party_name: conta.description }
    await supabase.from('bank_transactions').update(update).eq('id', transacao.id)
    if (tipo === 'receivable') {
      await supabase.from('receivables').update({ status: 'recebido', received_at: transacao.date, received_amount: transacao.amount }).eq('id', conta.id)
    } else {
      await supabase.from('payables').update({ status: 'pago', paid_at: transacao.date }).eq('id', conta.id)
    }
    setModalVincular(null)
    carregar()
  }

  function abrirModalCriar(transacao) {
    setModalCriar(transacao)
    setFormCriar({
      description: transacao.party_name || transacao.description || '',
      party_name: transacao.party_name || '',
      supplier_id: null,
      category: transacao.category || '',
      amount: transacao.amount,
      date: transacao.date,
    })
    setBuscaFornecedor(transacao.party_name || '')
    setFornecedoresSugestoes([])
    setAddFornecedor(false)
    setNovoFornecedor({ name:'', phone:'', email:'' })
  }

  async function confirmarCriarConta() {
    if (!formCriar.description) return alert('Informe a descrição.')
    setSalvandoCriar(true)
    if (modalCriar.type === 'credit') {
      const { data, error } = await supabase.from('receivables').insert({
        description: formCriar.description,
        amount: formCriar.amount,
        due_date: formCriar.date,
        status: 'recebido',
        received_at: formCriar.date,
        received_amount: formCriar.amount,
      }).select().single()
      if (error) { alert('Erro: ' + error.message); setSalvandoCriar(false); return }
      await supabase.from('bank_transactions').update({ receivable_id: data.id, status: 'conciliado', party_name: formCriar.party_name, category: formCriar.category }).eq('id', modalCriar.id)
    } else {
      const { data, error } = await supabase.from('payables').insert({
        description: formCriar.description,
        amount: formCriar.amount,
        due_date: formCriar.date,
        status: 'pago',
        paid_at: formCriar.date,
        category: formCriar.category || null,
        supplier_name: formCriar.party_name || null,
        supplier_id: formCriar.supplier_id || null,
      }).select().single()
      if (error) { alert('Erro: ' + error.message); setSalvandoCriar(false); return }
      await supabase.from('bank_transactions').update({ payable_id: data.id, status: 'conciliado', party_name: formCriar.party_name, category: formCriar.category }).eq('id', modalCriar.id)
    }
    setSalvandoCriar(false)
    setModalCriar(null)
    carregar()
  }

  async function buscarFornecedor(termo) {
    setBuscaFornecedor(termo)
    setFormCriar(f => ({ ...f, party_name: termo, supplier_id: null }))
    if (termo.length < 2) { setFornecedoresSugestoes([]); return }
    const { data } = await supabase.from('suppliers')
      .select('id, name, phone').ilike('name', `%${termo}%`).range(0, 9)
    setFornecedoresSugestoes(data || [])
  }

  function selecionarFornecedor(f) {
    setFormCriar(prev => ({ ...prev, party_name: f.name, supplier_id: f.id }))
    setBuscaFornecedor(f.name)
    setFornecedoresSugestoes([])
  }

  async function cadastrarFornecedor() {
    if (!novoFornecedor.name.trim()) return alert('Informe o nome.')
    setSalvandoFornecedor(true)
    const { data, error } = await supabase.from('suppliers').insert({
      name: novoFornecedor.name.trim(),
      phone: novoFornecedor.phone || null,
      email: novoFornecedor.email || null,
    }).select().single()
    setSalvandoFornecedor(false)
    if (error) { alert('Erro: ' + error.message); return }
    selecionarFornecedor(data)
    setAddFornecedor(false)
    setNovoFornecedor({ name:'', phone:'', email:'' })
  }

  async function buscarContas(transacao) {
    setModalVincular(transacao)
    setBuscaConta('')
    const tipo = transacao.type === 'credit' ? 'receivables' : 'payables'
    const { data } = await supabase.from(tipo)
      .select('id, description, amount, due_date')
      .eq('status', 'em_aberto')
      .order('due_date', { ascending: false })
      .range(0, 99)
    setContasDisponiveis(data || [])
  }

  const filtradas = transacoes.filter(t => {
    if (!busca) return true
    const s = busca.toLowerCase()
    return (t.description||'').toLowerCase().includes(s) || (t.party_name||'').toLowerCase().includes(s) || (t.category||'').toLowerCase().includes(s)
  })

  const totalCredito = filtradas.filter(t=>t.type==='credit').reduce((s,t)=>s+Number(t.amount||0),0)
  const totalDebito = filtradas.filter(t=>t.type==='debit').reduce((s,t)=>s+Number(t.amount||0),0)
  const pendentes = transacoes.filter(t=>t.status==='pendente').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-navy">Conciliação Bancária</h1>
            {pendentes > 0 && <p className="text-xs text-orange-500">{pendentes} transação(ões) pendente(s)</p>}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={importando}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold disabled:opacity-60">
            <Upload size={15}/>{importando ? 'Importando...' : 'Importar OFX'}
          </button>
          <input ref={fileRef} type="file" accept=".ofx,.OFX" className="hidden" onChange={importarOFX}/>
        </div>
        <div className="relative mb-3">
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar transações..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"/>
          <Search size={15} className="absolute left-3 top-3 text-gray-400"/>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[{v:'pendente',l:'Pendentes'},{v:'conciliado',l:'Conciliados'},{v:'ignorado',l:'Ignorados'},{v:'todos',l:'Todos'}].map(f => (
            <button key={f.v} onClick={() => setFiltro(f.v)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${filtro===f.v?'bg-navy text-white':'bg-gray-100 text-gray-600'}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {filtradas.length > 0 && (
        <div className="px-4 pt-3 grid grid-cols-2 gap-2">
          <div className="bg-green-50 rounded-2xl p-3 text-center">
            <p className="text-xs text-green-600 mb-0.5">Entradas</p>
            <p className="text-sm font-bold text-green-700">{fmt(totalCredito)}</p>
          </div>
          <div className="bg-red-50 rounded-2xl p-3 text-center">
            <p className="text-xs text-red-500 mb-0.5">Saídas</p>
            <p className="text-sm font-bold text-red-600">{fmt(totalDebito)}</p>
          </div>
        </div>
      )}

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-12">
            <Upload size={40} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-400 text-sm">Nenhuma transação encontrada</p>
            <p className="text-gray-300 text-xs mt-1">Importe um arquivo OFX do seu banco</p>
          </div>
        ) : filtradas.map(t => {
          const isCredit = t.type === 'credit'
          const isConciliado = t.status === 'conciliado'
          const isIgnorado = t.status === 'ignorado'

          return (
            <div key={t.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${isConciliado?'bg-green-400':isIgnorado?'bg-gray-300':'bg-orange-400'}`}/>
                    <div className="flex-1 min-w-0">
                      {editando === t.id ? (
                        <div className="space-y-2">
                          <input value={formEdit.party_name} onChange={e => setFormEdit(f=>({...f,party_name:e.target.value}))}
                            placeholder="Cliente / Fornecedor"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"/>
                          <input value={formEdit.description} onChange={e => setFormEdit(f=>({...f,description:e.target.value}))}
                            placeholder="Descrição"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary"/>
                          <div className="relative">
                            <select value={formEdit.category} onChange={e => setFormEdit(f=>({...f,category:e.target.value}))}
                              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary appearance-none bg-white">
                              <option value="">Categoria</option>
                              {(isCredit ? catsReceber : catsPagar).map(cat => <option key={cat}>{cat}</option>)}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-2.5 text-gray-400 pointer-events-none"/>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={salvarEdicao} disabled={salvandoEdit}
                              className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
                              {salvandoEdit?'Salvando...':'Salvar'}
                            </button>
                            <button onClick={() => setEditando(null)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2 text-sm">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-gray-900 truncate">{t.party_name || t.description || '—'}</p>
                          {t.party_name && t.description && t.party_name !== t.description && (
                            <p className="text-xs text-gray-400 truncate">{t.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-xs text-gray-400">{fmtData(t.date)}</span>
                            {t.category && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.category}</span>}
                            {isConciliado && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full flex items-center gap-0.5"><CheckCircle2 size={10}/>Conciliado</span>}
                            {isIgnorado && <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Ignorado</span>}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-sm font-bold ${isCredit?'text-green-600':'text-red-500'}`}>
                      {isCredit?'+':'-'}{fmt(t.amount)}
                    </p>
                  </div>
                </div>
              </div>

              {editando !== t.id && (
                <div className="flex border-t border-gray-50 divide-x divide-gray-50">
                  <button onClick={() => { setEditando(t.id); setFormEdit({ party_name: t.party_name||'', description: t.description||'', category: t.category||'' }) }}
                    className="flex-1 py-2.5 text-xs font-medium text-gray-500 hover:bg-gray-50">
                    Editar
                  </button>
                  {!isConciliado && (
                    <>
                      <button onClick={() => buscarContas(t)}
                        className="flex-1 py-2.5 text-xs font-medium text-blue-600 hover:bg-blue-50 flex items-center justify-center gap-1">
                        <Link size={11}/> Vincular
                      </button>
                      <button onClick={() => abrirModalCriar(t)}
                        className="flex-1 py-2.5 text-xs font-medium text-navy hover:bg-navy/5 flex items-center justify-center gap-1">
                        <Plus size={11}/> Criar conta
                      </button>
                      <button onClick={() => marcarStatus(t.id, 'ignorado')}
                        className="flex-1 py-2.5 text-xs font-medium text-gray-400 hover:bg-gray-50">
                        Ignorar
                      </button>
                    </>
                  )}
                  {isConciliado && (
                    <button onClick={() => marcarStatus(t.id, 'pendente')}
                      className="flex-1 py-2.5 text-xs font-medium text-orange-500 hover:bg-orange-50">
                      Desfazer
                    </button>
                  )}
                  {isIgnorado && (
                    <button onClick={() => marcarStatus(t.id, 'pendente')}
                      className="flex-1 py-2.5 text-xs font-medium text-orange-500 hover:bg-orange-50">
                      Reativar
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal criar conta */}
      {modalCriar && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-navy">
                  {modalCriar.type==='credit' ? 'Criar Conta a Receber' : 'Criar Conta a Pagar'}
                </h3>
                <p className="text-xs text-gray-400">
                  {modalCriar.type==='credit'?'+':'-'}{fmt(modalCriar.amount)} · {fmtData(modalCriar.date)}
                </p>
              </div>
              <button onClick={() => setModalCriar(null)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Descrição *</label>
                <input value={formCriar.description} onChange={e => setFormCriar(f=>({...f,description:e.target.value}))}
                  placeholder="Ex: Pagamento de serviço"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">
                    {modalCriar.type==='credit' ? 'Cliente' : 'Fornecedor'}
                  </label>
                  {modalCriar.type !== 'credit' && (
                    <button onClick={() => setAddFornecedor(!addFornecedor)}
                      className="flex items-center gap-1 text-xs text-primary font-semibold">
                      <Plus size={11}/> Novo fornecedor
                    </button>
                  )}
                </div>
                {addFornecedor && modalCriar.type !== 'credit' && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-2">
                    <p className="text-xs font-semibold text-gray-500">Cadastrar novo fornecedor</p>
                    <input value={novoFornecedor.name} onChange={e => setNovoFornecedor(f=>({...f,name:e.target.value}))}
                      placeholder="Nome *" autoFocus
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"/>
                    <input value={novoFornecedor.phone} onChange={e => setNovoFornecedor(f=>({...f,phone:e.target.value}))}
                      placeholder="Telefone"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"/>
                    <input value={novoFornecedor.email} onChange={e => setNovoFornecedor(f=>({...f,email:e.target.value}))}
                      placeholder="E-mail"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white"/>
                    <div className="flex gap-2">
                      <button onClick={cadastrarFornecedor} disabled={salvandoFornecedor}
                        className="flex-1 bg-primary text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
                        {salvandoFornecedor ? 'Salvando...' : 'Cadastrar e Selecionar'}
                      </button>
                      <button onClick={() => setAddFornecedor(false)} className="px-3 bg-gray-200 text-gray-600 rounded-xl py-2 text-sm">Cancelar</button>
                    </div>
                  </div>
                )}
                {modalCriar.type !== 'credit' ? (
                  <div className="relative">
                    <input value={buscaFornecedor}
                      onChange={e => buscarFornecedor(e.target.value)}
                      placeholder="Buscar fornecedor cadastrado..."
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                    {fornecedoresSugestoes.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                        {fornecedoresSugestoes.map(f => (
                          <button key={f.id} onClick={() => selecionarFornecedor(f)}
                            className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0">
                            <p className="text-sm font-medium">{f.name}</p>
                            {f.phone && <p className="text-xs text-gray-400">{f.phone}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                    {formCriar.supplier_id && (
                      <p className="text-xs text-green-600 mt-1">✓ {formCriar.party_name}</p>
                    )}
                  </div>
                ) : (
                  <input value={formCriar.party_name} onChange={e => setFormCriar(f=>({...f,party_name:e.target.value}))}
                    placeholder="Nome do cliente"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-500">Categoria</label>
                  <button onClick={() => setAddCategoria(!addCategoria)}
                    className="flex items-center gap-1 text-xs text-primary font-semibold">
                    <Plus size={11}/> Nova categoria
                  </button>
                </div>
                {addCategoria && (
                  <div className="flex gap-2 mb-2">
                    <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && novaCategoria.trim()) {
                          const nova = novaCategoria.trim()
                          setCatsPagar(prev => [...new Set([...prev, nova])])
                          setFormCriar(f => ({...f, category: nova}))
                          setNovaCategoria('')
                          setAddCategoria(false)
                        }
                      }}
                      placeholder="Ex: Manutenção veículo"
                      className="flex-1 border border-primary rounded-xl px-3 py-2 text-sm focus:outline-none" autoFocus/>
                    <button onClick={() => {
                      const nova = novaCategoria.trim()
                      if (!nova) return
                      setCatsPagar(prev => [...new Set([...prev, nova])])
                      setFormCriar(f => ({...f, category: nova}))
                      setNovaCategoria('')
                      setAddCategoria(false)
                    }} className="bg-primary text-white px-3 rounded-xl text-sm font-semibold">OK</button>
                    <button onClick={() => { setAddCategoria(false); setNovaCategoria('') }}
                      className="bg-gray-100 text-gray-500 px-3 rounded-xl text-sm">✕</button>
                  </div>
                )}
                <div className="relative">
                  <select value={formCriar.category} onChange={e => setFormCriar(f=>({...f,category:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary appearance-none bg-white">
                    <option value="">Selecione...</option>
                    {(modalCriar.type==='credit' ? catsReceber : catsPagar).map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none"/>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex justify-between">
                <span className="text-sm text-gray-600">Valor</span>
                <span className={`text-sm font-bold ${modalCriar.type==='credit'?'text-green-600':'text-red-500'}`}>
                  {modalCriar.type==='credit'?'+':'-'}{fmt(formCriar.amount)}
                </span>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0" style={{paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
              <button onClick={confirmarCriarConta} disabled={salvandoCriar}
                className="w-full bg-primary text-white rounded-2xl py-4 font-bold disabled:opacity-60 flex items-center justify-center gap-2">
                <Save size={18}/>{salvandoCriar ? 'Salvando...' : 'Criar e Conciliar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal vincular */}
      {modalVincular && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <div>
                <h3 className="text-base font-bold text-navy">Vincular a {modalVincular.type==='credit'?'conta a receber':'conta a pagar'}</h3>
                <p className="text-xs text-gray-400">{fmt(modalVincular.amount)} · {fmtData(modalVincular.date)}</p>
              </div>
              <button onClick={() => setModalVincular(null)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
              <input value={buscaConta} onChange={e => setBuscaConta(e.target.value)}
                placeholder="Buscar..." className="w-full bg-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none"/>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {contasDisponiveis
                .filter(c => !buscaConta || (c.description||'').toLowerCase().includes(buscaConta.toLowerCase()))
                .map(c => (
                  <button key={c.id} onClick={() => vincularConta(modalVincular, c, modalVincular.type==='credit'?'receivable':'payable')}
                    className="w-full bg-gray-50 rounded-xl p-3 text-left hover:bg-gray-100 transition">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-900 truncate flex-1">{c.description}</p>
                      <p className="text-sm font-bold text-navy ml-2">{fmt(c.amount)}</p>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Venc: {fmtData(c.due_date)}</p>
                  </button>
                ))
              }
              {contasDisponiveis.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">Nenhuma conta em aberto encontrada</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
