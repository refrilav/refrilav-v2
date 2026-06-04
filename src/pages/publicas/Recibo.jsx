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
      // Busca por ID direto (token = id do serviço ou OS)
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
        .range(0, 999)

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
  const totalGeral = dados.total_price || (totalPecas + parseFloat(dados.labor_price || 0))
  const dataServico = dados.finished_at || dados.scheduled_at || dados.created_at
  const nomeEmpresa = empresa.company_name || 'Refrilav Assistência Técnica'
  const telefoneEmpresa = empresa.phone || ''
  const enderecoEmpresa = empresa.address || ''

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-md mx-auto">
        {/* Cabeçalho da empresa */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
          <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <h1 className="text-lg font-bold text-gray-900">{nomeEmpresa}</h1>
          {telefoneEmpresa && <p className="text-sm text-gray-500 mt-0.5">{telefoneEmpresa}</p>}
          {enderecoEmpresa && <p className="text-xs text-gray-400 mt-0.5">{enderecoEmpresa}</p>}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recibo de Serviço</span>
            <p className="text-sm text-gray-600 mt-1">{fmtData(dataServico)} {fmtHora(dataServico)}</p>
          </div>
        </div>

        {/* Dados do cliente */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
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
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
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

        {/* Peças */}
        {pecas.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Peças</h2>
            <div className="space-y-2">
              {pecas.map((p, i) => (
                <div key={i} className="flex justify-between items-center">
                  <div>
                    <p className="text-xs font-medium text-gray-900">{p.description}</p>
                    <p className="text-xs text-gray-400">{p.quantity}x · {fmt(p.unit_price)}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{fmt(p.quantity * p.unit_price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total */}
        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Valores</h2>
          <div className="space-y-2">
            {totalPecas > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Peças</span>
                <span className="text-sm text-gray-900">{fmt(totalPecas)}</span>
              </div>
            )}
            {dados.labor_price > 0 && (
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Mão de obra</span>
                <span className="text-sm text-gray-900">{fmt(dados.labor_price)}</span>
              </div>
            )}
            <div className="flex justify-between pt-3 border-t border-gray-100">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-base font-bold text-red-600">{fmt(totalGeral)}</span>
            </div>
            {dados.payment_method && (
              <p className="text-xs text-gray-400 text-right">{dados.payment_method}</p>
            )}
          </div>
        </div>

        {/* Assinatura se houver */}
        {dados.auth_signature && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Assinatura</h2>
            <img src={dados.auth_signature} alt="Assinatura" className="w-full h-20 object-contain" />
            {dados.auth_signer_name && (
              <p className="text-xs text-gray-400 text-center mt-1">{dados.auth_signer_name}</p>
            )}
          </div>
        )}

        {/* Rodapé */}
        <p className="text-center text-xs text-gray-300 mt-4 mb-8">
          {nomeEmpresa} · {fmtData(dataServico)}
        </p>
      </div>
    </div>
  )
}
