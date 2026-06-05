import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ChevronLeft, Package } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y,m,d] = s.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

export default function CompraDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [compra, setCompra] = useState(null)
  const [itens, setItens] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const { data: c } = await supabase.from('purchases').select('*').eq('id', id).single()
    const { data: i } = await supabase.from('purchase_items').select('*').eq('purchase_id', id).range(0, 9999)
    setCompra(c)
    setItens(i || [])
    setLoading(false)
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>
  if (!compra) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Compra não encontrada</div>

  const total = itens.reduce((s, i) => s + Number(i.total_price || 0), 0) || compra.total_value || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-navy text-white px-4 pt-12 pb-5">
        <button onClick={() => navigate('/compras')} className="flex items-center gap-1 text-blue-200 text-sm mb-3">
          <ChevronLeft size={18}/> Compras
        </button>
        <h1 className="text-lg font-bold">{compra.supplier_name || '—'}</h1>
        {compra.nfe_number && <p className="text-blue-200 text-sm mt-0.5">NF-e {compra.nfe_number}</p>}
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Dados da compra */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Informações</p>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-gray-400">Data</p><p className="text-sm font-semibold">{fmtData(compra.purchase_date)}</p></div>
            <div><p className="text-xs text-gray-400">Total</p><p className="text-sm font-bold text-navy">{fmt(compra.total_value)}</p></div>
            {compra.nfe_number && <div><p className="text-xs text-gray-400">Nº NF-e</p><p className="text-sm font-semibold">{compra.nfe_number}</p></div>}
            <div><p className="text-xs text-gray-400">Itens</p><p className="text-sm font-semibold">{itens.length}</p></div>
          </div>
          {compra.nfe_key && (
            <div className="mt-3 pt-3 border-t border-gray-50">
              <p className="text-xs text-gray-400 mb-1">Chave de acesso</p>
              <p className="text-[10px] text-gray-400 font-mono break-all">{compra.nfe_key}</p>
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Produtos ({itens.length})</p>
          </div>
          {itens.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <Package size={32} className="text-gray-200 mx-auto mb-2"/>
              <p className="text-sm text-gray-400">Nenhum item registrado</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {itens.map((item, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.product_name || '—'}</p>
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                      {item.product_code && <span>#{item.product_code}</span>}
                      <span>{item.quantity} un</span>
                      <span>{fmt(item.unit_price)}/un</span>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-gray-900 flex-shrink-0 ml-2">{fmt(item.total_price)}</p>
                </div>
              ))}
            </div>
          )}
          <div className="px-4 py-3 bg-gray-50 flex justify-between border-t border-gray-100">
            <span className="text-sm font-bold">Total</span>
            <span className="text-sm font-bold text-navy">{fmt(total)}</span>
          </div>
        </div>

      </div>
    </div>
  )
}
