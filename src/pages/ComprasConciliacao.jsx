import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronLeft, Search, CheckCircle, Plus, ChevronRight } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export default function ComprasConciliacao() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const nfeData = state?.nfeData

  const [estoqueItens, setEstoqueItens] = useState([])
  const [conciliacao, setConciliacao] = useState([]) // [{produto_nfe, modo: 'novo'|'existente'|'ignorar', stock_item_id, stock_item_name}]
  const [buscas, setBuscas] = useState({}) // {idx: string}
  const [resultados, setResultados] = useState({}) // {idx: [items]}
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!nfeData) { navigate('/compras'); return }
    carregar()
  }, [])

  async function carregar() {
    const { data } = await supabase.from('stock_items').select('id, name, code, brand, quantity').order('name').range(0, 9999)
    setEstoqueItens(data || [])

    // Tenta auto-conciliar por código ou nome similar
    const conc = nfeData.produtos.map(prod => {
      const porCodigo = (data||[]).find(s => s.code && s.code.toLowerCase() === prod.code.toLowerCase())
      const porNome = (data||[]).find(s => s.name.toLowerCase() === prod.name.toLowerCase())
      const encontrado = porCodigo || porNome
      return {
        produto_nfe: prod,
        modo: encontrado ? 'existente' : 'novo',
        stock_item_id: encontrado?.id || null,
        stock_item_name: encontrado?.name || null,
      }
    })
    setConciliacao(conc)
    setLoading(false)
  }

  async function buscarEstoque(idx, termo) {
    setBuscas(b => ({...b, [idx]: termo}))
    if (termo.length < 2) { setResultados(r => ({...r, [idx]: []})); return }
    const { data } = await supabase.from('stock_items').select('id, name, code, brand')
      .or(`name.ilike.%${termo}%,code.ilike.%${termo}%`).range(0, 9)
    setResultados(r => ({...r, [idx]: data || []}))
  }

  function vincular(idx, item) {
    setConciliacao(c => c.map((el, i) => i === idx ? {...el, modo:'existente', stock_item_id:item.id, stock_item_name:item.name} : el))
    setBuscas(b => ({...b, [idx]: item.name}))
    setResultados(r => ({...r, [idx]: []}))
  }

  function setModo(idx, modo) {
    setConciliacao(c => c.map((el, i) => i === idx ? {...el, modo, stock_item_id: modo==='novo'?null:el.stock_item_id, stock_item_name: modo==='novo'?null:el.stock_item_name} : el))
  }

  function avancar() {
    // Verifica se todos estão conciliados
    const pendente = conciliacao.find(c => c.modo === 'existente' && !c.stock_item_id)
    if (pendente) return alert('Selecione um produto do estoque ou escolha "Novo produto" para todos os itens.')
    navigate('/compras/conferencia', { state: { nfeData, conciliacao } })
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-navy text-white px-4 pt-12 pb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-blue-200 text-sm mb-3">
          <ChevronLeft size={18}/> Voltar
        </button>
        <h1 className="text-lg font-bold">Conciliação de Produtos</h1>
        <p className="text-blue-200 text-sm mt-1">Confirme como cada produto da NF-e será registrado no estoque</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {conciliacao.map((item, idx) => {
          const prod = item.produto_nfe
          return (
            <div key={idx} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* Produto da NF-e */}
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Produto na NF-e</p>
                <p className="text-sm font-bold text-gray-900">{prod.name}</p>
                <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  <span>Cód: {prod.code}</span>
                  <span>Qtd: {prod.quantity} {prod.unit}</span>
                  <span>Unit: {fmt(prod.unit_price)}</span>
                  <span className="font-semibold text-gray-700">Total: {fmt(prod.total_price)}</span>
                </div>
              </div>

              {/* Opções */}
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Como registrar?</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { value:'existente', label:'Produto existente' },
                    { value:'novo', label:'Novo produto' },
                    { value:'ignorar', label:'Ignorar' },
                  ].map(opt => (
                    <button key={opt.value} onClick={() => setModo(idx, opt.value)}
                      className={`py-2 px-1 rounded-xl text-xs font-medium border transition text-center ${
                        item.modo === opt.value ? 'bg-navy text-white border-navy' : 'bg-white text-gray-600 border-gray-200'
                      }`}>{opt.label}</button>
                  ))}
                </div>

                {/* Vincular a produto existente */}
                {item.modo === 'existente' && (
                  <div>
                    {item.stock_item_id ? (
                      <div className="flex items-center justify-between bg-green-50 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-600 flex-shrink-0"/>
                          <p className="text-sm font-medium text-green-800">{item.stock_item_name}</p>
                        </div>
                        <button onClick={() => setConciliacao(c => c.map((el,i) => i===idx?{...el,stock_item_id:null,stock_item_name:null}:el))}
                          className="text-xs text-gray-400">Trocar</button>
                      </div>
                    ) : (
                      <div className="relative">
                        <input value={buscas[idx]||''} onChange={e => buscarEstoque(idx, e.target.value)}
                          placeholder="Buscar produto no estoque..."
                          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary pr-8"/>
                        <Search size={14} className="absolute right-3 top-3 text-gray-400"/>
                        {(resultados[idx]||[]).length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-10 overflow-hidden">
                            {resultados[idx].map(s => (
                              <button key={s.id} onClick={() => vincular(idx, s)}
                                className="w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0">
                                <p className="font-medium">{s.name}</p>
                                {s.code && <p className="text-xs text-gray-400">#{s.code}</p>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {item.modo === 'novo' && (
                  <div className="bg-blue-50 rounded-xl px-3 py-2.5 flex items-center gap-2">
                    <Plus size={15} className="text-blue-600 flex-shrink-0"/>
                    <p className="text-xs text-blue-700">Será criado como novo produto: <strong>{prod.name}</strong></p>
                  </div>
                )}

                {item.modo === 'ignorar' && (
                  <div className="bg-gray-100 rounded-xl px-3 py-2.5">
                    <p className="text-xs text-gray-500">Este produto não será adicionado ao estoque</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Botão avançar fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4"
        style={{paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
        <button onClick={avancar}
          className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2">
          Avançar para Conferência <ChevronRight size={20}/>
        </button>
      </div>
    </div>
  )
}
