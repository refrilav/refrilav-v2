import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const [y,m,d] = s.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

export default function Orcamento() {
  const { token } = useParams()
  const [dados, setDados] = useState(null)
  const [pecas, setPecas] = useState([])
  const [empresa, setEmpresa] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [respondendo, setRespondendo] = useState(false)
  const [resposta, setResposta] = useState(null) // 'aprovado' | 'recusado'

  useEffect(() => {
    async function buscar() {
      const { data: s } = await supabase
        .from('services')
        .select('*, clients(name, phone, address, neighborhood, city, cpf)')
        .eq('id', token)
        .single()

      if (!s) { setNotFound(true); setLoading(false); return }

      const { data: p } = await supabase
        .from('service_parts')
        .select('*')
        .eq('service_id', token)
        .range(0, 999)

      const { data: cfg } = await supabase
        .from('settings')
        .select('*')
        .single()

      setDados(s)
      setPecas(p || [])
      setEmpresa(cfg || {})
      // Se já tem resposta, mostra direto
      if (s.quote_status) setResposta(s.quote_status)
      setLoading(false)
    }
    buscar()
  }, [token])

  async function responder(status) {
    setRespondendo(true)
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    await supabase.from('services').update({
      quote_status: status,
      quote_responded_at: nowStr,
    }).eq('id', token)
    setResposta(status)
    setRespondendo(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center text-gray-400">
        <p className="text-lg font-medium">Orçamento não encontrado</p>
        <p className="text-sm mt-1">Verifique o link e tente novamente</p>
      </div>
    </div>
  )

  const cliente = dados.clients || {}
  const totalPecas = pecas.reduce((s,p) => s+(p.quantity*p.unit_price), 0)
  const maoVal = parseFloat(dados.labor_price || 0)
  const total = parseFloat(dados.total_price || 0) || (totalPecas + maoVal)
  const discriminar = totalPecas > 0 && maoVal > 0
  const nomeEmpresa = empresa.company_name || 'Refrilav Assistência Técnica'
  const telefoneEmpresa = empresa.phone || ''
  const dataServico = dados.scheduled_at || dados.created_at

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-card { box-shadow: none !important; border: 1px solid #eee; }
        }
        * { box-sizing: border-box; }
      `}</style>

      <div style={{minHeight:'100vh', background:'#f9fafb', padding:'24px 16px'}}>
        <div style={{maxWidth:'480px', margin:'0 auto'}}>

          {/* Botões de ação — só na tela, não no PDF */}
          <div className="no-print" style={{display:'flex', gap:'8px', marginBottom:'16px'}}>
            <button
              onClick={() => window.print()}
              style={{flex:1, background:'#1B2A4A', color:'white', border:'none', borderRadius:'12px', padding:'12px', fontWeight:'600', fontSize:'14px', cursor:'pointer'}}
            >
              🖨 Salvar PDF
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                alert('Link copiado!')
              }}
              style={{flex:1, background:'white', color:'#1B2A4A', border:'1px solid #e5e7eb', borderRadius:'12px', padding:'12px', fontWeight:'600', fontSize:'14px', cursor:'pointer'}}
            >
              🔗 Copiar link
            </button>
          </div>

          {/* Cabeçalho empresa */}
          <div className="print-card" style={{background:'white', borderRadius:'16px', padding:'24px', marginBottom:'12px', textAlign:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
            <div style={{width:'56px', height:'56px', background:'#D72638', borderRadius:'14px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px'}}>
              <span style={{color:'white', fontWeight:'700', fontSize:'20px'}}>R</span>
            </div>
            <h1 style={{margin:'0 0 4px', fontSize:'18px', fontWeight:'700', color:'#1B2A4A'}}>{nomeEmpresa}</h1>
            {telefoneEmpresa && <p style={{margin:'0', fontSize:'13px', color:'#6b7280'}}>{telefoneEmpresa}</p>}
            <div style={{marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #f3f4f6'}}>
              <span style={{fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em'}}>Orçamento</span>
              <p style={{margin:'4px 0 0', fontSize:'13px', color:'#6b7280'}}>{fmtData(dataServico)}</p>
            </div>
          </div>

          {/* Cliente */}
          <div className="print-card" style={{background:'white', borderRadius:'16px', padding:'20px', marginBottom:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
            <p style={{margin:'0 0 12px', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em'}}>Cliente</p>
            <p style={{margin:'0 0 4px', fontSize:'14px', fontWeight:'600', color:'#111827'}}>{cliente.name || '—'}</p>
            {cliente.cpf && <p style={{margin:'0 0 2px', fontSize:'12px', color:'#6b7280'}}>CPF: {cliente.cpf}</p>}
            {cliente.phone && <p style={{margin:'0 0 2px', fontSize:'12px', color:'#6b7280'}}>{cliente.phone}</p>}
            {(cliente.address || cliente.neighborhood) && (
              <p style={{margin:'0', fontSize:'12px', color:'#6b7280'}}>
                {[cliente.address, cliente.neighborhood, cliente.city].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {/* Serviço */}
          <div className="print-card" style={{background:'white', borderRadius:'16px', padding:'20px', marginBottom:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
            <p style={{margin:'0 0 12px', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em'}}>Serviço</p>
            <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
              {[dados.equipment, dados.brand, dados.model].filter(Boolean).length > 0 && (
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{fontSize:'13px', color:'#6b7280'}}>Equipamento</span>
                  <span style={{fontSize:'13px', fontWeight:'500', color:'#111827'}}>{[dados.equipment, dados.brand, dados.model].filter(Boolean).join(' ')}</span>
                </div>
              )}
              {dados.type && (
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{fontSize:'13px', color:'#6b7280'}}>Tipo</span>
                  <span style={{fontSize:'13px', fontWeight:'500', color:'#111827'}}>{dados.type}</span>
                </div>
              )}
              {dados.problem && (
                <div style={{paddingTop:'8px', borderTop:'1px solid #f9fafb'}}>
                  <p style={{margin:'0 0 4px', fontSize:'12px', color:'#9ca3af'}}>Problema relatado</p>
                  <p style={{margin:'0', fontSize:'13px', color:'#374151', lineHeight:'1.5'}}>{dados.problem}</p>
                </div>
              )}
              {dados.diagnosis && (
                <div style={{paddingTop:'8px', borderTop:'1px solid #f9fafb'}}>
                  <p style={{margin:'0 0 4px', fontSize:'12px', color:'#9ca3af'}}>Diagnóstico</p>
                  <p style={{margin:'0', fontSize:'13px', color:'#374151', lineHeight:'1.5'}}>{dados.diagnosis}</p>
                </div>
              )}
            </div>
          </div>

          {/* Peças */}
          {pecas.length > 0 && (
            <div className="print-card" style={{background:'white', borderRadius:'16px', padding:'20px', marginBottom:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
              <p style={{margin:'0 0 12px', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em'}}>Peças</p>
              <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {pecas.map((p, i) => (
                  <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <p style={{margin:'0 0 2px', fontSize:'13px', fontWeight:'500', color:'#111827'}}>{p.name || p.description}</p>
                      <p style={{margin:'0', fontSize:'12px', color:'#9ca3af'}}>{p.quantity}x · {fmt(p.unit_price)}</p>
                    </div>
                    <span style={{fontSize:'13px', fontWeight:'600', color:'#111827'}}>{fmt(p.quantity * p.unit_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valores */}
          <div className="print-card" style={{background:'white', borderRadius:'16px', padding:'20px', marginBottom:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}}>
            <p style={{margin:'0 0 12px', fontSize:'11px', fontWeight:'600', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em'}}>Valor</p>
            {discriminar ? (
              <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{fontSize:'13px', color:'#6b7280'}}>Peças</span>
                  <span style={{fontSize:'13px', color:'#111827'}}>{fmt(totalPecas)}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{fontSize:'13px', color:'#6b7280'}}>Mão de obra</span>
                  <span style={{fontSize:'13px', color:'#111827'}}>{fmt(maoVal)}</span>
                </div>
                <div style={{display:'flex', justifyContent:'space-between', paddingTop:'12px', borderTop:'1px solid #f3f4f6'}}>
                  <span style={{fontSize:'15px', fontWeight:'700', color:'#111827'}}>Total</span>
                  <span style={{fontSize:'16px', fontWeight:'700', color:'#D72638'}}>{fmt(total)}</span>
                </div>
              </div>
            ) : (
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span style={{fontSize:'15px', fontWeight:'700', color:'#111827'}}>Total</span>
                <span style={{fontSize:'16px', fontWeight:'700', color:'#D72638'}}>{fmt(total)}</span>
              </div>
            )}
          </div>

          {/* Status da resposta */}
          {resposta === 'aprovado' && (
            <div style={{background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'16px', padding:'20px', marginBottom:'12px', textAlign:'center'}}>
              <p style={{margin:'0 0 4px', fontSize:'16px', fontWeight:'700', color:'#15803d'}}>✓ Orçamento Aprovado</p>
              <p style={{margin:'0', fontSize:'13px', color:'#16a34a'}}>Entraremos em contato em breve.</p>
            </div>
          )}

          {resposta === 'recusado' && (
            <div style={{background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'16px', padding:'20px', marginBottom:'12px', textAlign:'center'}}>
              <p style={{margin:'0 0 4px', fontSize:'16px', fontWeight:'700', color:'#dc2626'}}>✗ Orçamento Recusado</p>
              <p style={{margin:'0', fontSize:'13px', color:'#ef4444'}}>Obrigado pelo retorno.</p>
            </div>
          )}

          {/* Botões aprovar/recusar — só se ainda não respondeu */}
          {!resposta && (
            <div className="no-print" style={{display:'flex', gap:'10px', marginBottom:'24px'}}>
              <button
                onClick={() => responder('recusado')}
                disabled={respondendo}
                style={{flex:1, background:'white', color:'#dc2626', border:'1px solid #fca5a5', borderRadius:'16px', padding:'16px', fontWeight:'700', fontSize:'15px', cursor:'pointer'}}
              >
                {respondendo ? '...' : '✗ Recusar'}
              </button>
              <button
                onClick={() => responder('aprovado')}
                disabled={respondendo}
                style={{flex:1, background:'#16a34a', color:'white', border:'none', borderRadius:'16px', padding:'16px', fontWeight:'700', fontSize:'15px', cursor:'pointer'}}
              >
                {respondendo ? '...' : '✓ Aprovar'}
              </button>
            </div>
          )}

          <p style={{textAlign:'center', fontSize:'12px', color:'#d1d5db', marginBottom:'32px'}}>
            {nomeEmpresa} · {fmtData(dataServico)}
          </p>

        </div>
      </div>
    </>
  )
}
