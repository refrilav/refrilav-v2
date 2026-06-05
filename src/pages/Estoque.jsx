import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, Search, Edit2, Trash2, X, Save, Package, TrendingDown, TrendingUp } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const UNIDADES = ['un', 'pc', 'cx', 'kg', 'g', 'l', 'ml', 'm', 'par', 'rolo']

export default function Estoque() {
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalItem, setModalItem] = useState(null)
  const [modalMovimento, setModalMovimento] = useState(null)
  const [form, setForm] = useState({ name:'', code:'', brand:'', unit:'un', quantity:'', cost_price:'' })
  const [movForm, setMovForm] = useState({ type:'entrada', quantity:'', reference:'' })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('stock_items')
      .select('*')
      .order('name', { ascending: true })
      .range(0, 9999)
    setItens(data || [])
    setLoading(false)
  }

  const filtrados = itens.filter(i => {
    if (!busca) return true
    const nome = (i.name || '').toLowerCase()
    const cod = (i.code || '').toLowerCase()
    const marca = (i.brand || '').toLowerCase()
    return nome.includes(busca.toLowerCase()) || cod.includes(busca.toLowerCase()) || marca.includes(busca.toLowerCase())
  })

  function abrirNovo() {
    setForm({ name:'', code:'', brand:'', unit:'un', quantity:'0', cost_price:'0' })
    setModalItem('novo')
  }
  function abrirEditar(item) {
    setForm({ name: item.name||'', code: item.code||'', brand: item.brand||'', unit: item.unit||'un', quantity: item.quantity||0, cost_price: item.cost_price||0 })
    setModalItem(item)
  }

  async function salvar() {
    if (!form.name) return alert('Preencha o nome do produto.')
    setSalvando(true)
    const payload = {
      name: form.name,
      code: form.code || null,
      brand: form.brand || null,
      unit: form.unit || 'un',
      quantity: parseFloat(String(form.quantity).replace(',','.')) || 0,
      cost_price: parseFloat(String(form.cost_price).replace(',','.')) || 0,
    }
    if (modalItem === 'novo') {
      await supabase.from('stock_items').insert(payload)
    } else {
      await supabase.from('stock_items').update(payload).eq('id', modalItem.id)
    }
    setSalvando(false)
    setModalItem(null)
    carregar()
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este produto do estoque?')) return
    await supabase.from('stock_items').delete().eq('id', id)
    carregar()
  }

  async function registrarMovimento() {
    if (!movForm.quantity) return alert('Informe a quantidade.')
    setSalvando(true)
    const qty = parseFloat(String(movForm.quantity).replace(',','.')) || 0
    const item = modalMovimento
    const novaQty = movForm.type === 'entrada' ? item.quantity + qty : Math.max(0, item.quantity - qty)

    await supabase.from('stock_items').update({ quantity: novaQty }).eq('id', item.id)
    await supabase.from('stock_movements').insert({
      stock_item_id: item.id,
      type: movForm.type,
      quantity: qty,
      reference: movForm.reference || null,
    })
    setSalvando(false)
    setModalMovimento(null)
    setMovForm({ type:'entrada', quantity:'', reference:'' })
    carregar()
  }

  const totalItens = itens.length
  const semEstoque = itens.filter(i => (i.quantity || 0) <= 0).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Estoque</h1>
          <button onClick={abrirNovo}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Plus size={15} /> Novo
          </button>
        </div>
        <div className="flex gap-3 mb-3">
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-xs text-gray-400">Produtos</p>
            <p className="text-lg font-bold text-navy">{totalItens}</p>
          </div>
          <div className={`flex-1 rounded-xl p-3 text-center ${semEstoque > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
            <p className="text-xs text-gray-400">Sem estoque</p>
            <p className={`text-lg font-bold ${semEstoque > 0 ? 'text-red-600' : 'text-green-600'}`}>{semEstoque}</p>
          </div>
        </div>
        <div className="relative">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, código ou marca..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none"/>
          <Search size={15} className="absolute left-3 top-3 text-gray-400"/>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : filtrados.length === 0 ? (
          <div className="text-center py-12">
            <Package size={40} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-400 text-sm">Nenhum produto no estoque</p>
          </div>
        ) : filtrados.map(item => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                (item.quantity||0) <= 0 ? 'bg-red-100' : 'bg-green-100'
              }`}>
                <Package size={18} className={(item.quantity||0) <= 0 ? 'text-red-500' : 'text-green-600'}/>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  {item.code && <span className="text-xs text-gray-400">#{item.code}</span>}
                  {item.brand && <span className="text-xs text-gray-400">{item.brand}</span>}
                  {item.cost_price > 0 && <span className="text-xs text-gray-400">{fmt(item.cost_price)}/{item.unit||'un'}</span>}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-lg font-bold ${(item.quantity||0) <= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {item.quantity || 0}
                </p>
                <p className="text-xs text-gray-400">{item.unit || 'un'}</p>
              </div>
            </div>
            <div className="flex border-t border-gray-50">
              <button onClick={() => { setModalMovimento(item); setMovForm({ type:'entrada', quantity:'', reference:'' }) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-green-600 hover:bg-green-50">
                <TrendingUp size={13}/> Entrada
              </button>
              <div className="w-px bg-gray-50"/>
              <button onClick={() => { setModalMovimento(item); setMovForm({ type:'saida', quantity:'', reference:'' }) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-orange-600 hover:bg-orange-50">
                <TrendingDown size={13}/> Saída
              </button>
              <div className="w-px bg-gray-50"/>
              <button onClick={() => abrirEditar(item)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50">
                <Edit2 size={13}/> Editar
              </button>
              <div className="w-px bg-gray-50"/>
              <button onClick={() => excluir(item.id)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-50">
                <Trash2 size={13}/> Excluir
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal novo/editar produto */}
      {modalItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">{modalItem==='novo'?'Novo Produto':'Editar Produto'}</h3>
              <button onClick={() => setModalItem(null)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Nome *</label>
              <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))}
                placeholder="Ex: Correia Lavadora"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Código</label>
                <input value={form.code} onChange={e => setForm(f=>({...f,code:e.target.value}))}
                  placeholder="Ex: 3130"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Marca/Fabricante</label>
                <input value={form.brand} onChange={e => setForm(f=>({...f,brand:e.target.value}))}
                  placeholder="Ex: Emicol"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">Unidade</label>
                <div className="flex flex-wrap gap-1.5">
                  {UNIDADES.map(u => (
                    <button key={u} onClick={() => setForm(f=>({...f,unit:u}))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${form.unit===u?'bg-navy text-white border-navy':'bg-white text-gray-600 border-gray-200'}`}>
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Quantidade atual</label>
                  <input type="number" value={form.quantity} onChange={e => setForm(f=>({...f,quantity:e.target.value}))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Custo unitário</label>
                  <input type="number" value={form.cost_price} onChange={e => setForm(f=>({...f,cost_price:e.target.value}))}
                    step="0.01" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
              </div>
            </div>
            <button onClick={salvar} disabled={salvando}
              className="w-full bg-primary text-white rounded-2xl py-4 font-bold disabled:opacity-60 flex items-center justify-center gap-2">
              <Save size={18}/>{salvando?'Salvando...':modalItem==='novo'?'Adicionar ao Estoque':'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Modal movimentação */}
      {modalMovimento && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4"
            style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Movimentação</h3>
              <button onClick={() => setModalMovimento(null)}><X size={20} className="text-gray-400"/></button>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-semibold">{modalMovimento.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">Estoque atual: <strong>{modalMovimento.quantity} {modalMovimento.unit||'un'}</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setMovForm(f=>({...f,type:'entrada'}))}
                className={`py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${movForm.type==='entrada'?'bg-green-600 text-white':'bg-gray-100 text-gray-600'}`}>
                <TrendingUp size={16}/> Entrada
              </button>
              <button onClick={() => setMovForm(f=>({...f,type:'saida'}))}
                className={`py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${movForm.type==='saida'?'bg-orange-500 text-white':'bg-gray-100 text-gray-600'}`}>
                <TrendingDown size={16}/> Saída
              </button>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Quantidade *</label>
              <input type="number" value={movForm.quantity} onChange={e => setMovForm(f=>({...f,quantity:e.target.value}))}
                placeholder="0" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" autoFocus/>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Referência (opcional)</label>
              <input value={movForm.reference} onChange={e => setMovForm(f=>({...f,reference:e.target.value}))}
                placeholder="Ex: NF 2582012, Atendimento João..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <button onClick={registrarMovimento} disabled={salvando}
              className={`w-full rounded-2xl py-4 font-bold disabled:opacity-60 flex items-center justify-center gap-2 text-white ${movForm.type==='entrada'?'bg-green-600':'bg-orange-500'}`}>
              {salvando?'Salvando...':`Registrar ${movForm.type==='entrada'?'Entrada':'Saída'}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
