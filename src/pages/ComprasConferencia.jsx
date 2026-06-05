import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronLeft, CheckCircle, Edit2, Save } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const p = s.substring(0,10).split('-')
  return `${p[2]}/${p[1]}/${p[0]}`
}

const UNIDADES = ['un', 'pc', 'cx', 'kg', 'g', 'l', 'ml', 'm', 'par', 'rolo']

export default function ComprasConferencia() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { nfeData, conciliacao } = state || {}
  const [salvando, setSalvando] = useState(false)
  const [precoVenda, setPrecoVenda] = useState(() =>
    Object.fromEntries((conciliacao || []).filter(c => c.modo !== 'ignorar').map((_, i) => [i, '']))
  )

  // Edição dos produtos novos
  const [editandoIdx, setEditandoIdx] = useState(null)
  const [editForm, setEditForm] = useState({})

  if (!nfeData) { navigate('/compras'); return null }

  const itensAtivos = conciliacao.filter(c => c.modo !== 'ignorar')

  function hoje() {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  async function confirmarTudo() {
    setSalvando(true)
    try {
      // 1. Criar ou buscar fornecedor
      let supplierId = null
      if (nfeData.fornecedorNome) {
        const { data: existing } = await supabase.from('suppliers').select('id').ilike('name', nfeData.fornecedorNome).single()
        if (existing) {
          supplierId = existing.id
        } else {
          const { data: novo } = await supabase.from('suppliers').insert({ name: nfeData.fornecedorNome, cnpj: nfeData.fornecedorCnpj }).select().single()
          supplierId = novo?.id
        }
      }

      // 2. Criar a compra
      const { data: compra } = await supabase.from('purchases').insert({
        supplier_id: supplierId,
        supplier_name: nfeData.fornecedorNome,
        nfe_key: nfeData.chave,
        nfe_number: nfeData.numero,
        total_value: nfeData.valorTotal,
        purchase_date: nfeData.dataEmissao || hoje(),
        status: 'confirmada',
      }).select().single()

      // 3. Para cada item — criar produto novo ou atualizar existente
      for (let idx = 0; idx < itensAtivos.length; idx++) {
        const item = itensAtivos[idx]
        const prod = item.produto_nfe
        let stockItemId = item.stock_item_id

        if (item.modo === 'novo') {
          const sale = parseFloat(String(precoVenda[idx] || '0').replace(',','.')) || null
          const { data: novoItem } = await supabase.from('stock_items').insert({
            name: prod.name,
            code: prod.code || null,
            unit: prod.unit || 'un',
            cost_price: prod.unit_price,
            sale_price: sale,
            quantity: prod.quantity,
          }).select().single()
          stockItemId = novoItem?.id

          if (stockItemId) {
            await supabase.from('stock_movements').insert({
              stock_item_id: stockItemId,
              type: 'entrada',
              quantity: prod.quantity,
              reference: `NF-e ${nfeData.numero}`,
            })
          }
        } else if (item.modo === 'existente' && stockItemId) {
          const sale = parseFloat(String(precoVenda[idx] || '0').replace(',','.')) || null
          const { data: estoqueAtual } = await supabase.from('stock_items').select('quantity').eq('id', stockItemId).single()
          const novaQty = (estoqueAtual?.quantity || 0) + prod.quantity
          await supabase.from('stock_items').update({
            quantity: novaQty,
            cost_price: prod.unit_price,
            ...(sale ? { sale_price: sale } : {}),
          }).eq('id', stockItemId)

          await supabase.from('stock_movements').insert({
            stock_item_id: stockItemId,
            type: 'entrada',
            quantity: prod.quantity,
            reference: `NF-e ${nfeData.numero}`,
          })
        }

        // Registra item da compra
        if (compra?.id) {
          await supabase.from('purchase_items').insert({
            purchase_id: compra.id,
            stock_item_id: stockItemId,
            product_name: prod.name,
            product_code: prod.code,
            quantity: prod.quantity,
            unit_price: prod.unit_price,
            total_price: prod.total_price,
          })
        }
      }

      navigate('/compras')
    } catch (err) {
      alert('Erro ao salvar: ' + err.message)
    }
    setSalvando(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <div className="bg-navy text-white px-4 pt-12 pb-5">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-blue-200 text-sm mb-3">
          <ChevronLeft size={18}/> Voltar
        </button>
        <h1 className="text-lg font-bold">Conferência Final</h1>
        <p className="text-blue-200 text-sm mt-1">Revise os dados antes de confirmar a entrada no estoque</p>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Dados do fornecedor */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Fornecedor</p>
          <p className="text-sm font-bold text-gray-900">{nfeData.fornecedorNome}</p>
          {nfeData.fornecedorCnpj && <p className="text-xs text-gray-400 mt-0.5">CNPJ: {nfeData.fornecedorCnpj}</p>}
        </div>

        {/* Dados da NF-e */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Nota Fiscal</p>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-400">Número</p><p className="text-sm font-semibold">{nfeData.numero || '—'}</p></div>
            <div><p className="text-xs text-gray-400">Data</p><p className="text-sm font-semibold">{fmtData(nfeData.dataEmissao)}</p></div>
            <div><p className="text-xs text-gray-400">Total</p><p className="text-sm font-bold text-navy">{fmt(nfeData.valorTotal)}</p></div>
            <div><p className="text-xs text-gray-400">Itens</p><p className="text-sm font-semibold">{itensAtivos.length} produtos</p></div>
          </div>
          {nfeData.chave && (
            <p className="text-[10px] text-gray-300 mt-2 break-all font-mono">{nfeData.chave}</p>
          )}
        </div>

        {/* Produtos */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Produtos ({itensAtivos.length})</p>
          </div>
          <div className="divide-y divide-gray-50">
            {itensAtivos.map((item, idx) => {
              const prod = item.produto_nfe
              return (
                <div key={idx} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          item.modo==='novo' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                        }`}>
                          {item.modo==='novo' ? 'Novo' : 'Existente'}
                        </span>
                        {item.stock_item_name && item.modo==='existente' && (
                          <span className="text-xs text-gray-400">→ {item.stock_item_name}</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 truncate">{prod.name}</p>
                      <div className="flex gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                        {prod.code && <span>#{prod.code}</span>}
                        <span>{prod.quantity} {prod.unit}</span>
                        <span className="text-gray-700 font-medium">Custo: {fmt(prod.unit_price)}/un</span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-gray-900 flex-shrink-0">{fmt(prod.total_price)}</p>
                  </div>
                  {/* Campo preço de venda */}
                  <div className="flex items-center gap-2 bg-orange-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-orange-700 font-medium flex-shrink-0">Preço venda:</span>
                    <input
                      type="number"
                      value={precoVenda[idx] || ''}
                      onChange={e => setPrecoVenda(p => ({...p, [idx]: e.target.value}))}
                      placeholder="R$ 0,00"
                      step="0.01"
                      className="flex-1 bg-transparent text-sm font-semibold text-orange-800 focus:outline-none placeholder-orange-300"
                    />
                    {precoVenda[idx] > 0 && prod.unit_price > 0 && (
                      <span className="text-xs text-green-600 font-semibold flex-shrink-0">
                        +{(((precoVenda[idx] - prod.unit_price) / prod.unit_price) * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="px-4 py-3 bg-gray-50 flex justify-between">
            <span className="text-sm font-bold">Total</span>
            <span className="text-sm font-bold text-navy">{fmt(nfeData.valorTotal)}</span>
          </div>
        </div>

      </div>

      {/* Botão confirmar fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4"
        style={{paddingBottom:'max(16px,env(safe-area-inset-bottom))'}}>
        <button onClick={confirmarTudo} disabled={salvando}
          className="w-full bg-green-600 text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 flex items-center justify-center gap-2">
          <CheckCircle size={20}/>
          {salvando ? 'Salvando...' : 'Confirmar e Dar Entrada no Estoque'}
        </button>
      </div>
    </div>
  )
}
