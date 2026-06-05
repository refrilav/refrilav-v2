import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronRight, ShoppingBag, Trash2, X, CheckCircle, User } from 'lucide-react'

const FORMAS_PAGAMENTO = ['Dinheiro', 'Pix', 'Cartão de débito', 'Cartão de crédito', 'Transferência']

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('pt-BR')
}

export default function Vendas() {
  const navigate = useNavigate()
  const [vendas, setVendas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)

  // Formulário nova venda
  const [buscaCliente, setBuscaCliente] = useState('')
  const [clientesSugestoes, setClientesSugestoes] = useState([])
  const [clienteSelecionado, setClienteSelecionado] = useState(null)
  const [itens, setItens] = useState([])
  const [buscaPeca, setBuscaPeca] = useState('')
  const [pecasSugestoes, setPecasSugestoes] = useState([])
  const [formaPgto, setFormaPgto] = useState('Dinheiro')
  const [desconto, setDesconto] = useState('')
  const [notas, setNotas] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Item sendo adicionado
  const [itemTemp, setItemTemp] = useState({ stock_item_id:'', name:'', quantity:1, unit_price:'', _estoque_qty:0 })
  const [adicionandoItem, setAdicionandoItem] = useState(false)

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    if (buscaCliente.length < 2) { setClientesSugestoes([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('clients').select('id,name,phone').ilike('name', `%${buscaCliente}%`).range(0,9)
      setClientesSugestoes(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [buscaCliente])

  useEffect(() => {
    if (buscaPeca.length < 2) { setPecasSugestoes([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('stock_items')
        .select('id,name,sale_price,cost_price,quantity,unit')
        .ilike('name', `%${buscaPeca}%`).range(0,9)
      setPecasSugestoes(data || [])
    }, 300)
    return () => clearTimeout(t)
  }, [buscaPeca])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).range(0,9999)
    setVendas(data || [])
    setLoading(false)
  }

  function selecionarPeca(p) {
    setItemTemp({ stock_item_id: p.id, name: p.name, quantity: 1, unit_price: p.sale_price || p.cost_price || 0, _estoque_qty: p.quantity })
    setBuscaPeca(p.name)
    setPecasSugestoes([])
  }

  function adicionarItem() {
    if (!itemTemp.name || !itemTemp.unit_price) return alert('Preencha peça e valor.')
    const qty = parseFloat(itemTemp.quantity) || 1
    const price = parseFloat(String(itemTemp.unit_price).replace(',','.')) || 0
    setItens(i => [...i, { ...itemTemp, quantity: qty, unit_price: price, total_price: qty * price }])
    setItemTemp({ stock_item_id:'', name:'', quantity:1, unit_price:'', _estoque_qty:0 })
    setBuscaPeca('')
    setAdicionandoItem(false)
  }

  function removerItem(idx) {
    setItens(i => i.filter((_,j) => j !== idx))
  }

  const subtotal = itens.reduce((s,i) => s + i.total_price, 0)
  const descontoVal = parseFloat(String(desconto).replace(',','.')) || 0
  const total = Math.max(0, subtotal - descontoVal)

  async function finalizarVenda() {
    if (itens.length === 0) return alert('Adicione pelo menos uma peça.')
    setSalvando(true)
    try {
      const now = new Date()
      const nowStr = now.toISOString().substring(0,10)

      // Cria a venda
      const { data: venda, error: errVenda } = await supabase.from('sales').insert({
        client_id: clienteSelecionado?.id || null,
        client_name: clienteSelecionado?.name || buscaCliente || 'Venda balcão',
        total,
        discount: descontoVal || null,
        payment_method: formaPgto,
        notes: notas || null,
        status: 'concluida',
      }).select().single()

      if (errVenda || !venda) throw new Error('Erro ao criar venda: ' + (errVenda?.message || 'resposta vazia'))

      // Itens da venda + desconto do estoque
      for (const item of itens) {
        await supabase.from('sale_items').insert({
          sale_id: venda.id,
          stock_item_id: item.stock_item_id || null,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        })

        // Desconta do estoque
        if (item.stock_item_id) {
          const { data: est } = await supabase.from('stock_items').select('quantity').eq('id', item.stock_item_id).single()
          if (est) {
            await supabase.from('stock_items').update({ quantity: Math.max(0, (est.quantity||0) - item.quantity) }).eq('id', item.stock_item_id)
            await supabase.from('stock_movements').insert({ stock_item_id: item.stock_item_id, type:'saida', quantity: item.quantity, reference: `Venda avulsa` })
          }
        }
      }

      // Gera conta a receber
      await supabase.from('receivables').insert({
        client_id: clienteSelecionado?.id || null,
        description: `Venda - ${clienteSelecionado?.name || buscaCliente || 'Balcão'} - ${itens.map(i=>i.name).join(', ').substring(0,60)}`,
        amount: total,
        due_date: nowStr,
        status: formaPgto === 'A prazo' ? 'em_aberto' : 'recebido',
        received_at: nowStr,
        payment_method: formaPgto,
      })

      setSalvando(false)
      setModalAberto(false)
      resetForm()
      carregar()
    } catch(e) {
      alert('Erro: ' + e.message)
      setSalvando(false)
    }
  }

  function resetForm() {
    setBuscaCliente(''); setClienteSelecionado(null); setItens([])
    setFormaPgto('Dinheiro'); setDesconto(''); setNotas('')
    setAdicionandoItem(false); setBuscaPeca('')
  }

  function abrirModal() { resetForm(); setModalAberto(true) }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-navy">Vendas Avulsas</h1>
          <button onClick={abrirModal}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Plus size={15}/> Nova Venda
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : vendas.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag size={40} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-400 text-sm">Nenhuma venda avulsa registrada</p>
          </div>
        ) : vendas.map(v => (
          <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{v.client_name || 'Venda balcão'}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-400">{fmtData(v.created_at)}</span>
                  {v.payment_method && <span className="text-xs text-gray-400">{v.payment_method}</span>}
                </div>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-navy">{fmt(v.total)}</p>
                {v.discount > 0 && <p className="text-xs text-green-600">-{fmt(v.discount)} desc.</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL nova venda */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl max-h-[95vh] flex flex-col">
            {/* Header fixo */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-bold text-navy">Nova Venda Avulsa</h3>
              <button onClick={() => setModalAberto(false)}><X size={20} className="text-gray-400"/></button>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              {/* Cliente (opcional) */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Cliente <span className="text-gray-300">(opcional — deixe vazio para venda balcão)</span></label>
                <div className="relative">
                  <input value={buscaCliente}
                    onChange={e => { setBuscaCliente(e.target.value); setClienteSelecionado(null) }}
                    placeholder="Buscar cliente ou deixar em branco"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary pr-8"/>
                  <User size={15} className="absolute right-3 top-3 text-gray-400"/>
                  {clientesSugestoes.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                      {clientesSugestoes.map(c => (
                        <button key={c.id} onClick={() => { setClienteSelecionado(c); setBuscaCliente(c.name); setClientesSugestoes([]) }}
                          className="w-full px-4 py-3 text-left text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                          <p className="font-medium">{c.name}</p>
                          {c.phone && <p className="text-xs text-gray-400">{c.phone}</p>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {clienteSelecionado && <p className="text-xs text-green-600 mt-1">✓ {clienteSelecionado.name}</p>}
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-500">Peças / Produtos *</label>
                  <button onClick={() => setAdicionandoItem(true)}
                    className="flex items-center gap-1 bg-navy/10 text-navy rounded-lg px-2.5 py-1.5 text-xs font-semibold">
                    <Plus size={13}/> Adicionar
                  </button>
                </div>

                {adicionandoItem && (
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-2">
                    <div className="relative">
                      <input value={buscaPeca} onChange={e => { setBuscaPeca(e.target.value); setItemTemp(t=>({...t,name:e.target.value,stock_item_id:''})) }}
                        placeholder="Buscar no estoque ou digitar nome"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-primary" autoFocus/>
                      {pecasSugestoes.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                          {pecasSugestoes.map(p => (
                            <button key={p.id} onClick={() => selecionarPeca(p)}
                              className="w-full px-3 py-2.5 text-left hover:bg-gray-50 border-b border-gray-50 last:border-0">
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-gray-400">Estoque: {p.quantity} · Venda: {fmt(p.sale_price || p.cost_price)}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {itemTemp.stock_item_id && <p className="text-xs text-green-600">✓ Do estoque — {itemTemp._estoque_qty} disponíveis</p>}
                    <div className="grid grid-cols-2 gap-2">
                      <input type="number" value={itemTemp.quantity} onChange={e => setItemTemp(t=>({...t,quantity:e.target.value}))}
                        placeholder="Qtd" min={1} className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"/>
                      <input type="number" value={itemTemp.unit_price} onChange={e => setItemTemp(t=>({...t,unit_price:e.target.value}))}
                        placeholder="Valor unitário" step="0.01" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"/>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={adicionarItem} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Adicionar</button>
                      <button onClick={() => { setAdicionandoItem(false); setBuscaPeca('') }} className="px-4 bg-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                    </div>
                  </div>
                )}

                {itens.length === 0 ? (
                  <p className="text-sm text-gray-300 italic py-2">Nenhuma peça adicionada</p>
                ) : (
                  <div className="space-y-1">
                    {itens.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.quantity}x · {fmt(item.unit_price)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{fmt(item.total_price)}</span>
                          <button onClick={() => removerItem(idx)} className="p-1 rounded-lg bg-red-50">
                            <Trash2 size={13} className="text-red-500"/>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Desconto */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Desconto (opcional)</label>
                <input type="number" value={desconto} onChange={e => setDesconto(e.target.value)}
                  placeholder="R$ 0,00" step="0.01"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>

              {/* Forma de pagamento */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Forma de pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAS_PAGAMENTO.map(f => (
                    <button key={f} onClick={() => setFormaPgto(f)}
                      className={`py-2 px-1 rounded-xl text-xs font-medium border transition text-center ${formaPgto===f?'bg-navy text-white border-navy':'bg-white text-gray-600 border-gray-200'}`}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Observações (opcional)</label>
                <input value={notas} onChange={e => setNotas(e.target.value)}
                  placeholder="Ex: Entregue na loja"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>

              {/* Resumo */}
              {itens.length > 0 && (
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {descontoVal > 0 && <div className="flex justify-between text-sm"><span className="text-green-600">Desconto</span><span className="text-green-600">-{fmt(descontoVal)}</span></div>}
                  <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
                    <span>Total</span><span className="text-navy">{fmt(total)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Botão fixo */}
            <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0"
              style={{paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
              <button onClick={finalizarVenda} disabled={salvando || itens.length === 0}
                className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2">
                <CheckCircle size={20}/>
                {salvando ? 'Salvando...' : `Finalizar Venda · ${fmt(total)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
