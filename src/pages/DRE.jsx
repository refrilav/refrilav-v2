// DRE — Demonstrativo de Resultado do Exercício
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/helpers'
import { TrendingUp, TrendingDown, DollarSign, Package, FileText, ChevronDown, Download } from 'lucide-react'

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function Linha({ label, valor, nivel = 0, destaque = false, negativo = false, expandivel = false, expandido = false, onToggle, cor }) {
  const indent = nivel * 16
  const corValor = cor ? cor : valor >= 0 ? 'text-green-600' : 'text-red-500'
  return (
    <div
      onClick={expandivel ? onToggle : undefined}
      className={[
        'flex items-center justify-between py-2.5 px-4 border-b border-gray-50 transition-colors',
        destaque ? 'bg-navy/5 font-bold' : 'hover:bg-gray-50',
        expandivel ? 'cursor-pointer' : '',
      ].join(' ')}
      style={{ paddingLeft: 16 + indent }}
    >
      <div className="flex items-center gap-2">
        {expandivel && (<ChevronDown size={14} className={'text-gray-400 transition-transform ' + (expandido ? 'rotate-180' : '')} />)}
        <span className={['text-sm', destaque ? 'text-navy font-bold' : 'text-gray-700', nivel > 0 ? 'text-gray-500' : ''].join(' ')}>
          {label}
        </span>
      </div>
      <span className={['text-sm font-semibold', destaque ? 'text-navy text-base' : corValor].join(' ')}>
        {negativo && valor > 0 ? '(' + formatCurrency(valor) + ')' : formatCurrency(Math.abs(valor))}
      </span>
    </div>
  )
}

export default function DRE() {
  const [ano, setAno] = useState(new Date().getFullYear())
  const [mes, setMes] = useState(null) // null = ano todo
  const [dados, setDados] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState({ receitas: true, custos: true, despesas: true })
  const [impostoPerc, setImpostoPerc] = useState(6) // % simples nacional padrão

  useEffect(() => { carregar() }, [ano, mes, impostoPerc])

  const toggle = (key) => setExpandidos(p => ({ ...p, [key]: !p[key] }))

  const carregar = async () => {
    setLoading(true)
    try {
      // Datas do período
      const dataInicio = mes !== null
        ? new Date(ano, mes, 1).toISOString()
        : new Date(ano, 0, 1).toISOString()
      const dataFim = mes !== null
        ? new Date(ano, mes + 1, 0, 23, 59, 59).toISOString()
        : new Date(ano, 11, 31, 23, 59, 59).toISOString()

      // Buscar dados em paralelo
      const [
        { data: servicos },
        { data: pecasUsadas },
        { data: compras },
        { data: despesas },
      ] = await Promise.all([
        supabase.from('services').select('total_price, labor_price, type, finished_at, scheduled_at, created_at')
          .eq('status', 'Finalizado').gte('finished_at', dataInicio).lte('finished_at', dataFim),
        supabase.from('service_parts').select('quantity, unit_price, services!inner(finished_at)')
          .gte('services.finished_at', dataInicio).lte('services.finished_at', dataFim),
        supabase.from('purchases').select('total_amount, created_at')
          .gte('created_at', dataInicio).lte('created_at', dataFim),
        supabase.from('payables').select('amount, category, status, due_date')
          .gte('due_date', dataInicio.split('T')[0]).lte('due_date', dataFim.split('T')[0]),
      ])

      // ── RECEITAS ──
      const faturamentoTotal = (servicos || []).reduce((a, s) => a + (s.total_price || 0), 0)
      const receitaMaoObra = (servicos || []).reduce((a, s) => a + (s.labor_price || 0), 0)
      const receitaPecas = faturamentoTotal - receitaMaoObra

      // Por tipo de serviço
      const porTipo = {}
      ;(servicos || []).forEach(s => {
        if (!s.type) return
        if (!porTipo[s.type]) porTipo[s.type] = 0
        porTipo[s.type] += (s.total_price || 0)
      })

      // ── CUSTOS ──
      const custoPecasUsadas = (pecasUsadas || []).reduce((a, p) => a + ((p.quantity || 0) * (p.unit_price || 0)), 0)
      const custoCompras = (compras || []).reduce((a, c) => a + (c.total_amount || 0), 0)
      const lucroBruto = faturamentoTotal - custoPecasUsadas

      // ── IMPOSTOS ──
      const impostos = faturamentoTotal * (impostoPerc / 100)

      // ── DESPESAS ──
      const despesasPorCategoria = {}
      ;(despesas || []).forEach(d => {
        const cat = d.category || 'Outros'
        if (!despesasPorCategoria[cat]) despesasPorCategoria[cat] = 0
        despesasPorCategoria[cat] += (d.amount || 0)
      })
      const totalDespesas = Object.values(despesasPorCategoria).reduce((a, v) => a + v, 0)

      // ── RESULTADO ──
      const ebitda = lucroBruto - totalDespesas
      const lucroLiquido = ebitda - impostos
      const margemBruta = faturamentoTotal > 0 ? (lucroBruto / faturamentoTotal) * 100 : 0
      const margemLiquida = faturamentoTotal > 0 ? (lucroLiquido / faturamentoTotal) * 100 : 0

      // Mensal — faturamento por mês para gráfico
      const porMes = MESES.map((_, i) => {
        const fat = (servicos || [])
          .filter(s => s.finished_at && new Date(s.finished_at).getMonth() === i)
          .reduce((a, s) => a + (s.total_price || 0), 0)
        return fat
      })

      setDados({
        faturamentoTotal, receitaMaoObra, receitaPecas, porTipo,
        custoPecasUsadas, custoCompras, lucroBruto,
        impostos, totalDespesas, despesasPorCategoria,
        ebitda, lucroLiquido, margemBruta, margemLiquida,
        totalServicos: servicos?.length || 0,
        porMes,
      })
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  const exportarExcel = async () => {
    if (!dados) return
    const XLSX = await import('xlsx')
    const linhas = [
      ['DRE — Refrilav Assistência Técnica'],
      ['Período:', mes !== null ? MESES[mes] + '/' + ano : 'Ano ' + ano],
      [],
      ['RECEITAS', ''],
      ['Faturamento Total', dados.faturamentoTotal],
      ['  Mão de obra', dados.receitaMaoObra],
      ['  Peças', dados.receitaPecas],
      ...Object.entries(dados.porTipo).map(([k,v]) => ['  ' + k, v]),
      [],
      ['CUSTOS', ''],
      ['Custo de Peças Utilizadas', -dados.custoPecasUsadas],
      ['LUCRO BRUTO', dados.lucroBruto],
      ['Margem Bruta %', dados.margemBruta.toFixed(1) + '%'],
      [],
      ['DESPESAS', ''],
      ...Object.entries(dados.despesasPorCategoria).map(([k,v]) => [k, -v]),
      ['Total Despesas', -dados.totalDespesas],
      [],
      ['EBITDA', dados.ebitda],
      ['Impostos (' + impostoPerc + '%)', -dados.impostos],
      [],
      ['LUCRO LÍQUIDO', dados.lucroLiquido],
      ['Margem Líquida %', dados.margemLiquida.toFixed(1) + '%'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'DRE')
    XLSX.writeFile(wb, 'DRE_Refrilav_' + (mes !== null ? MESES[mes] + '_' : '') + ano + '.xlsx')
  }

  if (loading) return (
    <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}</div>
  )

  if (!dados) return null

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setAno(a => a - 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">‹</button>
          <span className="font-bold text-navy w-12 text-center">{ano}</span>
          <button onClick={() => setAno(a => a + 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">›</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setMes(null)}
            className={['px-3 py-1.5 rounded-lg text-xs font-medium transition-all', mes === null ? 'bg-navy text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}>
            Ano todo
          </button>
          {MESES.map((m, i) => (
            <button key={i} onClick={() => setMes(mes === i ? null : i)}
              className={['px-3 py-1.5 rounded-lg text-xs font-medium transition-all', mes === i ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'].join(' ')}>
              {m.substring(0, 3)}
            </button>
          ))}
        </div>
        <button onClick={exportarExcel} className="ml-auto flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg font-medium transition-colors">
          <Download size={13} /> Excel
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Faturamento', valor: dados.faturamentoTotal, icone: TrendingUp, cor: 'text-green-600', bg: 'bg-green-100' },
          { label: 'Lucro Bruto', valor: dados.lucroBruto, icone: DollarSign, cor: dados.lucroBruto >= 0 ? 'text-blue-600' : 'text-red-500', bg: dados.lucroBruto >= 0 ? 'bg-blue-100' : 'bg-red-100' },
          { label: 'Despesas', valor: dados.totalDespesas + dados.impostos, icone: TrendingDown, cor: 'text-red-500', bg: 'bg-red-100' },
          { label: 'Lucro Líquido', valor: dados.lucroLiquido, icone: FileText, cor: dados.lucroLiquido >= 0 ? 'text-navy' : 'text-red-600', bg: dados.lucroLiquido >= 0 ? 'bg-navy/10' : 'bg-red-100' },
        ].map(({ label, valor, icone: Icon, cor, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className={['w-9 h-9 rounded-lg flex items-center justify-center mb-2', bg].join(' ')}>
              <Icon size={17} className={cor} />
            </div>
            <p className={['text-lg font-bold', cor].join(' ')}>{formatCurrency(valor)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* DRE completo */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-navy text-white font-bold text-sm">
          DRE — {mes !== null ? MESES[mes] + ' ' + ano : 'Exercício ' + ano}
        </div>

        {/* RECEITAS */}
        <Linha label="RECEITAS BRUTAS" valor={dados.faturamentoTotal} destaque expandivel
          expandido={expandidos.receitas} onToggle={() => toggle('receitas')} cor="text-green-600" />
        {expandidos.receitas && <>
          <Linha label="Mão de obra" valor={dados.receitaMaoObra} nivel={1} cor="text-green-600" />
          <Linha label="Peças e materiais" valor={dados.receitaPecas} nivel={1} cor="text-green-600" />
          {Object.entries(dados.porTipo).sort((a,b) => b[1]-a[1]).map(([tipo, val]) => (
            <Linha key={tipo} label={tipo} valor={val} nivel={2} cor="text-gray-600" />
          ))}
        </>}

        {/* CUSTOS */}
        <div className="px-4 py-1.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">Custos Variáveis</div>
        <Linha label="Custo de Peças" valor={-dados.custoPecasUsadas} nivel={0} negativo cor="text-red-500" />

        {/* LUCRO BRUTO */}
        <Linha label="LUCRO BRUTO" valor={dados.lucroBruto} destaque cor={dados.lucroBruto >= 0 ? 'text-blue-600' : 'text-red-600'} />
        <div className="px-4 py-1 text-xs text-gray-400 border-b border-gray-50">
          Margem bruta: <span className="font-semibold text-gray-600">{dados.margemBruta.toFixed(1)}%</span>
        </div>

        {/* DESPESAS */}
        <div className="px-4 py-1.5 bg-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wide">Despesas Operacionais</div>
        <Linha label="Total Despesas" valor={-dados.totalDespesas} destaque expandivel negativo
          expandido={expandidos.despesas} onToggle={() => toggle('despesas')} cor="text-red-500" />
        {expandidos.despesas && Object.entries(dados.despesasPorCategoria).sort((a,b) => b[1]-a[1]).map(([cat, val]) => (
          <Linha key={cat} label={cat} valor={-val} nivel={1} negativo cor="text-red-400" />
        ))}

        {/* EBITDA */}
        <Linha label="EBITDA" valor={dados.ebitda} destaque cor={dados.ebitda >= 0 ? 'text-navy' : 'text-red-600'} />

        {/* IMPOSTOS */}
        <div className="px-4 py-2 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Impostos / Simples Nacional</span>
            <div className="flex items-center gap-1">
              <input type="number" min="0" max="30" step="0.1" value={impostoPerc}
                onChange={e => setImpostoPerc(Number(e.target.value))}
                className="w-14 px-2 py-0.5 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary/30" />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </div>
          <span className="text-sm font-semibold text-red-500">({formatCurrency(dados.impostos)})</span>
        </div>

        {/* LUCRO LÍQUIDO */}
        <Linha label="LUCRO LÍQUIDO" valor={dados.lucroLiquido} destaque cor={dados.lucroLiquido >= 0 ? 'text-green-600' : 'text-red-600'} />
        <div className="px-4 py-2 text-xs text-gray-400 flex justify-between">
          <span>Margem líquida:</span>
          <span className={['font-semibold', dados.margemLiquida >= 0 ? 'text-gray-600' : 'text-red-500'].join(' ')}>
            {dados.margemLiquida.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Gráfico de barras mensal — só no modo anual */}
      {mes === null && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-navy mb-4 text-sm">Faturamento Mensal {ano}</h3>
          <div className="flex items-end gap-1 h-32">
            {dados.porMes.map((val, i) => {
              const maxVal = Math.max(...dados.porMes, 1)
              const h = (val / maxVal) * 100
              const ehAtual = i === new Date().getMonth() && ano === new Date().getFullYear()
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  {val > 0 && (
                    <div className="hidden group-hover:block absolute -top-7 bg-navy text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                      {formatCurrency(val)}
                    </div>
                  )}
                  <div className={['w-full rounded-t transition-all', ehAtual ? 'bg-primary' : 'bg-primary/40 hover:bg-primary/60'].join(' ')}
                    style={{ height: `${Math.max(h, val > 0 ? 3 : 0)}%` }} />
                  <span className={['text-xs', ehAtual ? 'text-primary font-bold' : 'text-gray-400'].join(' ')}>
                    {MESES[i].substring(0,3)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Alerta se sem dados */}
      {dados.faturamentoTotal === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
          ⚠️ Nenhum atendimento finalizado no período selecionado. O DRE reflete apenas serviços com status "Finalizado".
        </div>
      )}
    </div>
  )
}
