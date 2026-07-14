import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Download, TrendingUp, TrendingDown, Filter } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y,m,d] = s.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}
function nomeMes(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function pad(n) { return String(n).padStart(2,'0') }

function exportarExcel(dados, nome) {
  import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs').then(XLSX => {
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, nome)
  })
}

export default function Relatorios() {
  const [mesRef, setMesRef] = useState(new Date())
  const [aba, setAba] = useState('pagar') // 'pagar' | 'receber'
  const [statusFiltro, setStatusFiltro] = useState('todos') // 'todos' | 'pago' | 'em_aberto' | 'vencido'
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [contas, setContas] = useState([])
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState([])

  useEffect(() => { carregar() }, [mesRef, aba])

  async function carregar() {
    setLoading(true)
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth() + 1
    const inicio = `${ano}-${pad(mes)}-01`
    const ultimoDia = new Date(ano, mes, 0).getDate()
    const fim = `${ano}-${pad(mes)}-${pad(ultimoDia)}`

    if (aba === 'pagar') {
      const { data } = await supabase.from('payables')
        .select('id, description, amount, due_date, paid_at, status, category, supplier_name, payment_method, recorrencia, discount')
        .gte('due_date', inicio).lte('due_date', fim)
        .order('due_date', { ascending: true }).range(0, 9999)
      setContas(data || [])
      const cats = [...new Set((data||[]).map(p => p.category).filter(Boolean))]
      setCategorias(cats)
    } else {
      const { data } = await supabase.from('receivables')
        .select('id, description, amount, due_date, received_at, status, payment_method, discount, client_id')
        .gte('due_date', inicio).lte('due_date', fim)
        .order('due_date', { ascending: true }).range(0, 9999)
      setContas(data || [])
      setCategorias([])
    }
    setLoading(false)
  }

  function mudarMes(delta) {
    const d = new Date(mesRef)
    d.setMonth(d.getMonth() + delta)
    setMesRef(d)
    setCategoriaFiltro('')
  }

  const hojeStr = new Date().toISOString().substring(0,10)

  function stNorm(c) {
    if (c.status === 'pago' || c.status === 'recebido') return 'pago'
    if (c.due_date && c.due_date < hojeStr) return 'vencido'
    return 'em_aberto'
  }

  const filtradas = contas.filter(c => {
    if (categoriaFiltro && c.category !== categoriaFiltro) return false
    if (statusFiltro === 'pago') return stNorm(c) === 'pago'
    if (statusFiltro === 'em_aberto') return stNorm(c) === 'em_aberto'
    if (statusFiltro === 'vencido') return stNorm(c) === 'vencido'
    return true
  })

  // Totais
  const totalGeral = filtradas.reduce((s,c) => s + Number(c.amount||0), 0)
  const totalPago = filtradas.filter(c => stNorm(c) === 'pago').reduce((s,c) => s + Number(c.amount||0), 0)
  const totalAberto = filtradas.filter(c => stNorm(c) === 'em_aberto').reduce((s,c) => s + Number(c.amount||0), 0)
  const totalVencido = filtradas.filter(c => stNorm(c) === 'vencido').reduce((s,c) => s + Number(c.amount||0), 0)

  // Agrupado por categoria (só pagar)
  const porCategoria = aba === 'pagar' ? categorias.map(cat => ({
    cat,
    total: filtradas.filter(c => c.category === cat).reduce((s,c) => s + Number(c.amount||0), 0),
    pago: filtradas.filter(c => c.category === cat && stNorm(c) === 'pago').reduce((s,c) => s + Number(c.amount||0), 0),
  })) : []

  function doExcel() {
    if (aba === 'pagar') {
      exportarExcel(filtradas.map(c => ({
        Descrição: c.description || '',
        Fornecedor: c.supplier_name || '',
        Categoria: c.category || '',
        Valor: Number(c.amount||0).toFixed(2),
        Vencimento: fmtData(c.due_date),
        'Data Pagamento': fmtData(c.paid_at),
        Status: stNorm(c) === 'pago' ? 'Pago' : stNorm(c) === 'vencido' ? 'Vencido' : 'Em aberto',
        'Forma Pagamento': c.payment_method || '',
        Desconto: c.discount ? Number(c.discount).toFixed(2) : '',
        Recorrência: c.recorrencia || '',
      })), `contas-pagar-${nomeMes(mesRef)}.xlsx`)
    } else {
      exportarExcel(filtradas.map(c => ({
        Descrição: c.description || '',
        Valor: Number(c.amount||0).toFixed(2),
        Vencimento: fmtData(c.due_date),
        'Data Recebimento': fmtData(c.received_at),
        Status: stNorm(c) === 'pago' ? 'Recebido' : stNorm(c) === 'vencido' ? 'Vencido' : 'Em aberto',
        'Forma Recebimento': c.payment_method || '',
        Desconto: c.discount ? Number(c.discount).toFixed(2) : '',
      })), `contas-receber-${nomeMes(mesRef)}.xlsx`)
    }
  }

  const STATUS_STYLE = {
    pago:      { label: aba==='pagar'?'Pago':'Recebido', bg:'bg-green-100', text:'text-green-700' },
    em_aberto: { label: 'Em aberto',  bg:'bg-blue-100',  text:'text-blue-700'  },
    vencido:   { label: 'Vencido',    bg:'bg-red-100',   text:'text-red-700'   },
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Relatórios</h1>
          <button onClick={doExcel}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
            <Download size={15}/> Excel
          </button>
        </div>

        {/* Navegação mês */}
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => mudarMes(-1)} className="p-2 rounded-lg bg-gray-100"><ChevronLeft size={16} className="text-gray-600"/></button>
          <div className="flex-1 text-center text-sm font-semibold text-navy capitalize">{nomeMes(mesRef)}</div>
          <button onClick={() => mudarMes(1)} className="p-2 rounded-lg bg-gray-100"><ChevronRight size={16} className="text-gray-600"/></button>
        </div>

        {/* Toggle Pagar / Receber */}
        <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-3">
          <button onClick={() => { setAba('pagar'); setStatusFiltro('todos'); setCategoriaFiltro('') }}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition ${aba==='pagar'?'bg-navy text-white':'bg-white text-gray-500'}`}>
            <TrendingDown size={13}/> Contas a Pagar
          </button>
          <button onClick={() => { setAba('receber'); setStatusFiltro('todos'); setCategoriaFiltro('') }}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition ${aba==='receber'?'bg-navy text-white':'bg-white text-gray-500'}`}>
            <TrendingUp size={13}/> Contas a Receber
          </button>
        </div>

        {/* Filtro status */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {[
            { v:'todos', l:'Todos' },
            { v:'pago', l: aba==='pagar'?'Pagos':'Recebidos' },
            { v:'em_aberto', l:'Em aberto' },
            { v:'vencido', l:'Vencidos' },
          ].map(f => (
            <button key={f.v} onClick={() => setStatusFiltro(f.v)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${statusFiltro===f.v?'bg-primary text-white':'bg-gray-100 text-gray-600'}`}>
              {f.l}
            </button>
          ))}
          {aba === 'pagar' && categorias.map(cat => (
            <button key={cat} onClick={() => setCategoriaFiltro(categoriaFiltro===cat?'':cat)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${categoriaFiltro===cat?'bg-navy text-white':'bg-gray-100 text-gray-600'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Cards resumo */}
      <div className="px-4 pt-3 grid grid-cols-4 gap-2 mb-3">
        {[
          { l:'Total', v:totalGeral, cor:'text-navy' },
          { l: aba==='pagar'?'Pagos':'Recebidos', v:totalPago, cor:'text-green-600' },
          { l:'Em aberto', v:totalAberto, cor:'text-blue-600' },
          { l:'Vencidos', v:totalVencido, cor:'text-red-600' },
        ].map(({ l, v, cor }) => (
          <div key={l} className="bg-white rounded-2xl p-2.5 shadow-sm text-center">
            <p className="text-[9px] text-gray-400 mb-0.5 leading-tight">{l}</p>
            <p className={`text-xs font-bold ${cor} leading-tight`}>
              {Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}
            </p>
          </div>
        ))}
      </div>

      {/* Resumo por categoria (só pagar) */}
      {aba === 'pagar' && porCategoria.length > 0 && !categoriaFiltro && (
        <div className="px-4 mb-3">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">Por categoria</span>
            </div>
            <div className="divide-y divide-gray-50">
              {porCategoria.sort((a,b) => b.total - a.total).map(({ cat, total, pago }) => (
                <div key={cat} className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{cat}</p>
                    <p className="text-xs text-green-600">Pago: {fmt(pago)}</p>
                  </div>
                  <p className="text-sm font-bold text-navy ml-3">{fmt(total)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista detalhada */}
      <div className="px-4 pb-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
            <span className="text-xs font-semibold text-gray-500">
              {filtradas.length} lançamento{filtradas.length!==1?'s':''}
            </span>
            <span className="text-xs font-semibold text-gray-500">{fmt(totalGeral)}</span>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
          ) : filtradas.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">Nenhum lançamento encontrado</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtradas.map(c => {
                const st = STATUS_STYLE[stNorm(c)]
                const dataRef = aba === 'pagar' ? c.paid_at : c.received_at
                return (
                  <div key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.description || '—'}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {c.category && <span className="text-xs text-gray-400">{c.category}</span>}
                          {c.supplier_name && <span className="text-xs text-blue-500 truncate max-w-[120px]">{c.supplier_name}</span>}
                          {c.recorrencia && <span className="text-xs text-purple-500">↺ {c.recorrencia}</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <span className="text-xs text-gray-400">Venc: {fmtData(c.due_date)}</span>
                          {dataRef && <span className="text-xs text-green-600">{aba==='pagar'?'Pago':'Recebido'}: {fmtData(dataRef)}</span>}
                          {c.payment_method && <span className="text-xs text-gray-400">{c.payment_method}</span>}
                          {c.discount > 0 && <span className="text-xs text-orange-500">Desc: {fmt(c.discount)}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <p className="text-base font-bold text-gray-900">{fmt(c.amount)}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.text}`}>{st.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Rodapé total */}
          {filtradas.length > 0 && (
            <div className="px-4 py-3 bg-navy flex justify-between items-center">
              <span className="text-sm font-bold text-white">Total</span>
              <span className="text-base font-bold text-white">{fmt(totalGeral)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
