import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function fmt(valor) {
  if (!valor && valor !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(valor).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function fmtData(str) {
  if (!str) return '—'
  const [y, m, d] = str.substring(0, 10).split('-')
  return `${d}/${m}/${y}`
}

function fmtHora(str) {
  if (!str) return ''
  return str.substring(11, 16)
}

export default function Recibo() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [pecas, setPecas] = useState([])
  const [empresa, setEmpresa] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    async function buscar() {
      let servico = null
      let tipo = null

      const { data: s } = await supabase
        .from('services')
        .select('*, clients(name, phone, address, neighborhood, city, cpf)')
        .eq('id', token)
        .single()

      if (s) { servico = s; tipo = 'service' }

      if (!servico) {
        const { data: os } = await supabase
          .from('workshop_orders')
          .select('*, clients(name, phone, address, neighborhood, city, cpf)')
          .eq('id', token)
          .single()
        if (os) { servico = os; tipo = 'workshop' }
      }

      if (!servico) { setNotFound(true); setLoading(false); return }

      const { data: p } = await supabase
        .from('service_parts')
        .select('*')
        .eq(tipo === 'service' ? 'service_id' : 'workshop_order_id', token)
        .range(0, 9999)

      const { data: cfg } = await supabase
        .from('settings')
        .select('*')
        .single()

      setDados({ ...servico, _tipo: tipo })
      setPecas(p || [])
      setEmpresa(cfg || {})
      setLoading(false)
    }
    buscar()
  }, [token])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-400">
        <p className="text-lg font-medium">Recibo não encontrado</p>
        <p className="text-sm mt-1">Verifique o link e tente novamente</p>
      </div>
    </div>
  )

  const cliente = dados.clients || {}
  const equip = [dados.equipment, dados.brand, dados.model].filter(Boolean).join(' ')
  const totalPecas = pecas.reduce((s, p) => s + (p.quantity * p.unit_price), 0)
  const maoDeObra = parseFloat(dados.labor_price || 0)
  const totalGeral = parseFloat(dados.total_price || 0) || (totalPecas + maoDeObra)
  const dataServico = dados.finished_at || dados.scheduled_at || dados.created_at

  // Lógica: mostrar discriminado só se tiver peças OU mão de obra preenchidos
  const temDiscriminado = totalPecas > 0 || maoDeObra > 0
  // Se só tem total_price sem peças e sem mão de obra → mostra só o total
  const mostrarSomenteTotal = !temDiscriminado && totalGeral > 0

  const nomeEmpresa = empresa.company_name || 'Refrilav Assistência Técnica'
  const telefoneEmpresa = empresa.phone || ''
  const enderecoEmpresa = empresa.address || ''

  return (
    <>
      {/* Estilos de impressão */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #eee; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-md mx-auto">

          {/* Botão imprimir */}
          <button
            onClick={() => window.print()}
            className="no-print w-full bg-navy text-white rounded-2xl py-3.5 font-semibold text-sm mb-4 flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir / Salvar PDF
          </button>

          {/* Cabeçalho empresa */}
          <div className="print-card bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
            <img src="/logo.png" alt="Refrilav" className="h-14 object-contain mx-auto mb-3"
              onError={e => { e.target.style.display='none' }}/>
            <h1 className="text-lg font-bold text-gray-900">{nomeEmpresa}</h1>
            {telefoneEmpresa && <p className="text-sm text-gray-500 mt-0.5">{telefoneEmpresa}</p>}
            {enderecoEmpresa && <p className="text-xs text-gray-400 mt-0.5">{enderecoEmpresa}</p>}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recibo de Serviço</span>
              <p className="text-sm text-gray-600 mt-1">{fmtData(dataServico)} {fmtHora(dataServico)}</p>
            </div>
          </div>

          {/* Cliente */}
          <div className="print-card bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Cliente</h2>
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-gray-900">{cliente.name || '—'}</p>
              {cliente.cpf && <p className="text-xs text-gray-500">CPF: {cliente.cpf}</p>}
              {cliente.phone && <p className="text-xs text-gray-500">{cliente.phone}</p>}
              {(cliente.address || cliente.neighborhood) && (
                <p className="text-xs text-gray-500">
                  {[cliente.address, cliente.neighborhood, cliente.city].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* Serviço */}
          <div className="print-card bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Serviço</h2>
            <div className="space-y-2">
              {equip && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Equipamento</span>
                  <span className="text-xs font-medium text-gray-900">{equip}</span>
                </div>
              )}
              {dados.type && (
                <div className="flex justify-between">
                  <span className="text-xs text-gray-500">Tipo</span>
                  <span className="text-xs font-medium text-gray-900">{dados.type}</span>
                </div>
              )}
              {dados.diagnosis && (
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Diagnóstico</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{dados.diagnosis}</p>
                </div>
              )}
              {dados.work_done && (
                <div className="pt-2 border-t border-gray-50">
                  <p className="text-xs text-gray-500 mb-1">Trabalho realizado</p>
                  <p className="text-xs text-gray-700 leading-relaxed">{dados.work_done}</p>
                </div>
              )}
            </div>
          </div>

          {/* Peças — só mostra se tiver */}
          {pecas.length > 0 && (
            <div className="print-card bg-white rounded-2xl p-5 shadow-sm mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Peças</h2>
              <div className="space-y-2">
                {pecas.map((p, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div>
                      <p className="text-xs font-medium text-gray-900">{p.name || p.description}</p>
                      <p className="text-xs text-gray-400">{p.quantity}x · {fmt(p.unit_price)}</p>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{fmt(p.quantity * p.unit_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valores */}
          <div className="print-card bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Valor</h2>
            {(() => {
              const maoVal = parseFloat(dados.labor_price || 0)
              const pecasComValor = totalPecas > 0
              const discriminar = pecasComValor && maoVal > 0
              const total = parseFloat(dados.total_price || 0) || (totalPecas + maoVal)
              if (discriminar) return (
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-sm text-gray-600">Peças</span><span className="text-sm">{fmt(totalPecas)}</span></div>
                  <div className="flex justify-between"><span className="text-sm text-gray-600">Mão de obra</span><span className="text-sm">{fmt(maoVal)}</span></div>
                  <div className="flex justify-between pt-3 border-t border-gray-100"><span className="text-base font-bold text-gray-900">Total</span><span className="text-base font-bold text-red-600">{fmt(total)}</span></div>
                </div>
              )
              return (
                <div className="flex justify-between items-center py-2">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-base font-bold text-red-600">{fmt(total)}</span>
                </div>
              )
            })()}
            {dados.payment_method && <p className="text-xs text-gray-400 text-right mt-1">{dados.payment_method}</p>}
          </div>

          {/* Assinatura se houver */}
          {dados.auth_signature && (
            <div className="print-card bg-white rounded-2xl p-5 shadow-sm mb-4">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Assinatura</h2>
              <img src={dados.auth_signature} alt="Assinatura" className="w-full h-20 object-contain" />
              {dados.auth_signer_name && (
                <p className="text-xs text-gray-400 text-center mt-1">{dados.auth_signer_name}</p>
              )}
            </div>
          )}

          <p className="text-center text-xs text-gray-300 mt-4 mb-8">
            {nomeEmpresa} · {fmtData(dataServico)}
          </p>
        </div>
      </div>
    </>
  )
}
