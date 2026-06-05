import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

function fmt(v, showSign = false) {
  const n = Number(v || 0)
  const s = Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
  if (showSign && n < 0) return `–${s}`
  return s
}
function fmtR(v) {
  const n = Number(v || 0)
  return 'R$ ' + Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}
function nomeMes(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
function diasNoMes(ano, mes) {
  return new Date(ano, mes + 1, 0).getDate()
}
function pad(n) { return String(n).padStart(2, '0') }

const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function FluxoCaixa() {
  const [mesRef, setMesRef] = useState(new Date())
  const [visao, setVisao] = useState('diario') // 'diario' | 'mensal'
  const [recebimentos, setRecebimentos] = useState([])
  const [pagamentos, setPagamentos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { carregar() }, [mesRef])

  async function carregar() {
    setLoading(true)
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth()

    if (visao === 'diario' || true) {
      const inicio = `${ano}-${pad(mes+1)}-01`
      const fim = `${ano}-${pad(mes+1)}-${pad(diasNoMes(ano, mes))}`

      const [{ data: rec }, { data: pag }] = await Promise.all([
        supabase.from('receivables').select('amount, received_at, due_date, status').eq('status', 'recebido').range(0, 9999),
        supabase.from('payables').select('amount, paid_at, due_date, status').eq('status', 'pago').range(0, 9999),
      ])

      // Filtra em JS usando received_at se existir, senão due_date
      const recFiltrado = (rec || []).filter(r => {
        const data = (r.received_at || r.due_date || '').substring(0, 10)
        return data >= inicio && data <= fim
      })
      const pagFiltrado = (pag || []).filter(p => {
        const data = (p.paid_at || p.due_date || '').substring(0, 10)
        return data >= inicio && data <= fim
      })

      setRecebimentos(recFiltrado)
      setPagamentos(pagFiltrado)
    }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [mesRef, visao])

  function mudarMes(delta) {
    const d = new Date(mesRef)
    d.setMonth(d.getMonth() + delta)
    setMesRef(d)
  }

  // Visão diária — agrupa por dia
  function dadosDiarios() {
    const ano = mesRef.getFullYear()
    const mes = mesRef.getMonth()
    const total = diasNoMes(ano, mes)
    let saldoAcumulado = 0
    const hoje = new Date().toISOString().substring(0, 10)

    return Array.from({ length: total }, (_, i) => {
      const dia = `${ano}-${pad(mes+1)}-${pad(i+1)}`
      const recDia = recebimentos.filter(r => (r.received_at || r.due_date || '').substring(0,10) === dia)
        .reduce((s, r) => s + Number(r.amount || 0), 0)
      const pagDia = pagamentos.filter(p => (p.paid_at || p.due_date || '').substring(0,10) === dia)
        .reduce((s, p) => s + Number(p.amount || 0), 0)
      saldoAcumulado += recDia - pagDia
      return { dia, recDia, pagDia, saldo: saldoAcumulado, isHoje: dia === hoje, temMovimento: recDia > 0 || pagDia > 0 }
    })
  }

  // Visão mensal — agrupa por mês (últimos 12 meses)
  function dadosMensais() {
    const meses = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(mesRef)
      d.setMonth(d.getMonth() - i)
      const ano = d.getFullYear()
      const mes = d.getMonth()
      const inicio = `${ano}-${pad(mes+1)}-01`
      const fim = `${ano}-${pad(mes+1)}-${pad(diasNoMes(ano, mes))}`
      const recMes = recebimentos.filter(r => (r.received_at||'') >= inicio && (r.received_at||'') <= fim)
        .reduce((s, r) => s + Number(r.amount||0), 0)
      const pagMes = pagamentos.filter(p => (p.paid_at||'') >= inicio && (p.paid_at||'') <= fim)
        .reduce((s, p) => s + Number(p.amount||0), 0)
      meses.push({ label: `${MESES_CURTO[mes]}/${ano}`, rec: recMes, pag: pagMes, saldo: recMes - pagMes })
    }
    return meses
  }

  function exportarCSV() {
    const linhas = visao === 'diario'
      ? [['Data','Recebimentos','Pagamentos','Saldo Final'],
         ...dadosDiarios().map(d => [d.dia, d.recDia.toFixed(2), d.pagDia.toFixed(2), d.saldo.toFixed(2)])]
      : [['Mês','Recebimentos','Pagamentos','Saldo'],
         ...dadosMensais().map(m => [m.label, m.rec.toFixed(2), m.pag.toFixed(2), m.saldo.toFixed(2)])]
    const csv = linhas.map(l => l.join(';')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `fluxo-caixa-${nomeMes(mesRef)}.csv`; a.click()
  }

  const diasData = dadosDiarios()
  const mesesData = dadosMensais()
  const totalRec = recebimentos.reduce((s, r) => s + Number(r.amount||0), 0)
  const totalPag = pagamentos.reduce((s, p) => s + Number(p.amount||0), 0)
  const saldoFinal = totalRec - totalPag

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-navy">Fluxo de Caixa</h1>
          <button onClick={exportarCSV}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
            <Download size={15}/> Exportar
          </button>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navegação mês */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <button onClick={() => mudarMes(-1)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex-shrink-0">
              <ChevronLeft size={15} className="text-gray-600"/>
            </button>
            <div className="flex-1 text-center text-sm font-semibold text-navy capitalize truncate px-1">
              {nomeMes(mesRef)}
            </div>
            <button onClick={() => mudarMes(1)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 flex-shrink-0">
              <ChevronRight size={15} className="text-gray-600"/>
            </button>
          </div>

          {/* Toggle visão */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden flex-shrink-0">
            <button onClick={() => setVisao('diario')}
              className={`px-4 py-2 text-sm font-medium transition ${visao==='diario'?'bg-navy text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Diário
            </button>
            <button onClick={() => setVisao('mensal')}
              className={`px-4 py-2 text-sm font-medium transition ${visao==='mensal'?'bg-navy text-white':'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Mensal
            </button>
          </div>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="px-4 pt-4 grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400 mb-1">Recebimentos</p>
          <p className="text-sm font-bold text-green-600">{fmtR(totalRec)}</p>
        </div>
        <div className="bg-white rounded-2xl p-3 shadow-sm text-center">
          <p className="text-xs text-gray-400 mb-1">Pagamentos</p>
          <p className="text-sm font-bold text-red-600">{fmtR(totalPag)}</p>
        </div>
        <div className={`rounded-2xl p-3 shadow-sm text-center ${saldoFinal >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-xs text-gray-400 mb-1">Saldo</p>
          <p className={`text-sm font-bold ${saldoFinal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {saldoFinal < 0 ? '–' : ''}{fmtR(Math.abs(saldoFinal))}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
      ) : visao === 'diario' ? (

        /* VISÃO DIÁRIA */
        <div className="px-4 pb-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Cabeçalho da tabela */}
            <div className="grid grid-cols-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">Data</span>
              <span className="text-xs font-semibold text-gray-500 text-right">Recebimentos</span>
              <span className="text-xs font-semibold text-gray-500 text-right">Pagamentos</span>
              <span className="text-xs font-semibold text-gray-500 text-right">Saldo Final</span>
            </div>
            <div className="divide-y divide-gray-50">
              {diasData.map(({ dia, recDia, pagDia, saldo, isHoje, temMovimento }) => (
                <div key={dia}
                  className={`grid grid-cols-4 px-4 py-3 ${isHoje ? 'bg-blue-50' : ''} ${temMovimento ? 'font-semibold' : ''}`}>
                  <span className={`text-sm ${isHoje ? 'text-blue-700 font-bold' : temMovimento ? 'text-gray-900' : 'text-gray-400'}`}>
                    {dia.substring(8)}/{dia.substring(5,7)}
                  </span>
                  <span className={`text-sm text-right ${recDia > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                    {fmt(recDia)}
                  </span>
                  <span className={`text-sm text-right ${pagDia > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>
                    {fmt(pagDia)}
                  </span>
                  <span className={`text-sm text-right font-semibold ${saldo > 0 ? 'text-gray-900' : saldo < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {saldo < 0 ? '–' : ''}{fmt(Math.abs(saldo))}
                  </span>
                </div>
              ))}
            </div>
            {/* Total */}
            <div className="grid grid-cols-4 px-4 py-3 bg-navy text-white border-t-2 border-navy">
              <span className="text-sm font-bold">Total</span>
              <span className="text-sm font-bold text-right text-green-300">{fmt(totalRec)}</span>
              <span className="text-sm font-bold text-right text-red-300">{fmt(totalPag)}</span>
              <span className={`text-sm font-bold text-right ${saldoFinal >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {saldoFinal < 0 ? '–' : ''}{fmt(Math.abs(saldoFinal))}
              </span>
            </div>
          </div>
        </div>

      ) : (

        /* VISÃO MENSAL */
        <div className="px-4 pb-6">
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="grid grid-cols-4 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500">Mês</span>
              <span className="text-xs font-semibold text-gray-500 text-right">Recebimentos</span>
              <span className="text-xs font-semibold text-gray-500 text-right">Pagamentos</span>
              <span className="text-xs font-semibold text-gray-500 text-right">Saldo</span>
            </div>
            <div className="divide-y divide-gray-50">
              {mesesData.map(({ label, rec, pag, saldo }) => {
                const temMov = rec > 0 || pag > 0
                return (
                  <div key={label} className={`grid grid-cols-4 px-4 py-3 ${temMov ? '' : 'opacity-50'}`}>
                    <span className={`text-sm ${temMov ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>{label}</span>
                    <span className={`text-sm text-right ${rec > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>{fmt(rec)}</span>
                    <span className={`text-sm text-right ${pag > 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{fmt(pag)}</span>
                    <span className={`text-sm text-right font-semibold ${saldo > 0 ? 'text-green-600' : saldo < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {saldo < 0 ? '–' : ''}{fmt(Math.abs(saldo))}
                    </span>
                  </div>
                )
              })}
            </div>
            {/* Total anual */}
            <div className="grid grid-cols-4 px-4 py-3 bg-navy text-white border-t-2 border-navy">
              <span className="text-sm font-bold">12 meses</span>
              <span className="text-sm font-bold text-right text-green-300">{fmt(mesesData.reduce((s,m)=>s+m.rec,0))}</span>
              <span className="text-sm font-bold text-right text-red-300">{fmt(mesesData.reduce((s,m)=>s+m.pag,0))}</span>
              <span className={`text-sm font-bold text-right ${mesesData.reduce((s,m)=>s+m.saldo,0)>=0?'text-green-300':'text-red-300'}`}>
                {(() => { const t = mesesData.reduce((s,m)=>s+m.saldo,0); return `${t<0?'–':''}${fmt(Math.abs(t))}` })()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
