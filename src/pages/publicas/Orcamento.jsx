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
  const [resposta, setResposta] = useState(null)

  useEffect(() => {
    async function buscar() {
      const { data: o } = await supabase
        .from('quotes')
        .select('*, clients(name, phone, address, neighborhood, city, cpf)')
        .eq('id', token)
        .single()

      if (!o) { setNotFound(true); setLoading(false); return }

      const { data: p } = await supabase
        .from('quote_parts').select('*').eq('quote_id', token).range(0, 9999)

      const { data: cfg } = await supabase
        .from('settings').select('*').single()

      setDados(o)
      setPecas(p || [])
      setEmpresa(cfg || {})
      if (o.status && o.status !== 'pendente') setResposta(o.status)
      setLoading(false)
    }
    buscar()
  }, [token])

  async function responder(status) {
    setRespondendo(true)
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    await supabase.from('quotes').update({ status, quote_responded_at: nowStr }).eq('id', token)
    setResposta(status)
    setRespondendo(false)
  }

  if (loading) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f9fafb'}}>
      <div style={{width:32,height:32,border:'4px solid #D72638',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (notFound) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f9fafb'}}>
      <div style={{textAlign:'center',color:'#9ca3af'}}>
        <p style={{fontSize:18,fontWeight:600,margin:'0 0 4px'}}>Orçamento não encontrado</p>
        <p style={{fontSize:14,margin:0}}>Verifique o link e tente novamente</p>
      </div>
    </div>
  )

  const cliente = dados.clients || {}
  const totalPecas = pecas.reduce((s,p) => s+(p.quantity*p.unit_price), 0)
  const maoVal = parseFloat(dados.labor_price || 0)
  const total = parseFloat(dados.total_price || 0) || (totalPecas + maoVal)
  const discriminar = totalPecas > 0 && maoVal > 0
  const nomeEmpresa = empresa.company_name || 'Refrilav Assistência Técnica'
  const equip = [dados.equipment, dados.brand, dados.model].filter(Boolean).join(' ')

  const card = {background:'white', borderRadius:16, padding:20, marginBottom:12, boxShadow:'0 1px 3px rgba(0,0,0,0.08)'}
  const label = {margin:'0 0 12px', fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.05em'}

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
        }
        * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      <div style={{minHeight:'100vh', background:'#f9fafb', padding:'24px 16px'}}>
        <div style={{maxWidth:480, margin:'0 auto'}}>

          {/* Ações — só na tela */}
          <div className="no-print" style={{display:'flex', gap:8, marginBottom:16}}>
            <button onClick={() => window.print()}
              style={{flex:1, background:'#1B2A4A', color:'white', border:'none', borderRadius:12, padding:'12px', fontWeight:600, fontSize:14, cursor:'pointer'}}>
              🖨 Salvar PDF
            </button>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copiado!') }}
              style={{flex:1, background:'white', color:'#1B2A4A', border:'1px solid #e5e7eb', borderRadius:12, padding:'12px', fontWeight:600, fontSize:14, cursor:'pointer'}}>
              🔗 Copiar link
            </button>
          </div>

          {/* Cabeçalho */}
          <div style={{...card, textAlign:'center'}}>
            <div style={{width:56,height:56,background:'#D72638',borderRadius:14,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px'}}>
              <span style={{color:'white',fontWeight:700,fontSize:20}}>R</span>
            </div>
            <h1 style={{margin:'0 0 4px',fontSize:18,fontWeight:700,color:'#1B2A4A'}}>{nomeEmpresa}</h1>
            {empresa.phone && <p style={{margin:0,fontSize:13,color:'#6b7280'}}>{empresa.phone}</p>}
            <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid #f3f4f6'}}>
              <p style={{...label, marginBottom:4}}>Orçamento</p>
              <p style={{margin:0,fontSize:13,color:'#6b7280'}}>{fmtData(dados.created_at)}</p>
            </div>
          </div>

          {/* Cliente */}
          <div style={card}>
            <p style={label}>Cliente</p>
            <p style={{margin:'0 0 4px',fontSize:14,fontWeight:600,color:'#111827'}}>{cliente.name || '—'}</p>
            {cliente.cpf && <p style={{margin:'0 0 2px',fontSize:12,color:'#6b7280'}}>CPF: {cliente.cpf}</p>}
            {cliente.phone && <p style={{margin:'0 0 2px',fontSize:12,color:'#6b7280'}}>{cliente.phone}</p>}
            {(cliente.address||cliente.neighborhood) && <p style={{margin:0,fontSize:12,color:'#6b7280'}}>{[cliente.address,cliente.neighborhood,cliente.city].filter(Boolean).join(', ')}</p>}
          </div>

          {/* Serviço */}
          <div style={card}>
            <p style={label}>Serviço</p>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {equip && <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#6b7280'}}>Equipamento</span><span style={{fontSize:13,fontWeight:500,color:'#111827'}}>{equip}</span></div>}
              {dados.problem && <div style={{paddingTop:8,borderTop:'1px solid #f9fafb'}}><p style={{margin:'0 0 4px',fontSize:12,color:'#9ca3af'}}>Problema</p><p style={{margin:0,fontSize:13,color:'#374151',lineHeight:1.5}}>{dados.problem}</p></div>}
              {dados.diagnosis && <div style={{paddingTop:8,borderTop:'1px solid #f9fafb'}}><p style={{margin:'0 0 4px',fontSize:12,color:'#9ca3af'}}>Diagnóstico</p><p style={{margin:0,fontSize:13,color:'#374151',lineHeight:1.5}}>{dados.diagnosis}</p></div>}
              {dados.services_description && <div style={{paddingTop:8,borderTop:'1px solid #f9fafb'}}><p style={{margin:'0 0 4px',fontSize:12,color:'#9ca3af'}}>Serviços incluídos</p><p style={{margin:0,fontSize:13,color:'#374151',lineHeight:1.5}}>{dados.services_description}</p></div>}
            </div>
          </div>

          {/* Peças */}
          {pecas.length > 0 && (
            <div style={card}>
              <p style={label}>Peças</p>
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {pecas.map((p,i) => (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>
                      <p style={{margin:'0 0 2px',fontSize:13,fontWeight:500,color:'#111827'}}>{p.name}</p>
                      <p style={{margin:0,fontSize:12,color:'#9ca3af'}}>{p.quantity}x · {fmt(p.unit_price)}</p>
                    </div>
                    <span style={{fontSize:13,fontWeight:600,color:'#111827'}}>{fmt(p.quantity*p.unit_price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valores */}
          <div style={card}>
            <p style={label}>Valor</p>
            {discriminar ? (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#6b7280'}}>Peças</span><span style={{fontSize:13,color:'#111827'}}>{fmt(totalPecas)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:13,color:'#6b7280'}}>Mão de obra</span><span style={{fontSize:13,color:'#111827'}}>{fmt(maoVal)}</span></div>
                <div style={{display:'flex',justifyContent:'space-between',paddingTop:12,borderTop:'1px solid #f3f4f6'}}><span style={{fontSize:15,fontWeight:700,color:'#111827'}}>Total</span><span style={{fontSize:16,fontWeight:700,color:'#D72638'}}>{fmt(total)}</span></div>
              </div>
            ) : (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:15,fontWeight:700,color:'#111827'}}>Total</span>
                <span style={{fontSize:16,fontWeight:700,color:'#D72638'}}>{fmt(total)}</span>
              </div>
            )}
          </div>

          {/* Status aprovado/recusado */}
          {resposta === 'aprovado' && (
            <div style={{background:'#f0fdf4',border:'1px solid #86efac',borderRadius:16,padding:20,marginBottom:12,textAlign:'center'}}>
              <p style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:'#15803d'}}>✓ Orçamento Aprovado</p>
              <p style={{margin:0,fontSize:13,color:'#16a34a'}}>Entraremos em contato em breve.</p>
            </div>
          )}
          {resposta === 'recusado' && (
            <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:16,padding:20,marginBottom:12,textAlign:'center'}}>
              <p style={{margin:'0 0 4px',fontSize:16,fontWeight:700,color:'#dc2626'}}>✗ Orçamento Recusado</p>
              <p style={{margin:0,fontSize:13,color:'#ef4444'}}>Obrigado pelo retorno.</p>
            </div>
          )}

          {/* Botões aprovar/recusar — só na tela, não no PDF */}
          {!resposta && (
            <div className="no-print" style={{display:'flex',gap:10,marginBottom:24}}>
              <button onClick={() => responder('recusado')} disabled={respondendo}
                style={{flex:1,background:'white',color:'#dc2626',border:'1px solid #fca5a5',borderRadius:16,padding:16,fontWeight:700,fontSize:15,cursor:'pointer'}}>
                {respondendo ? '...' : '✗ Recusar'}
              </button>
              <button onClick={() => responder('aprovado')} disabled={respondendo}
                style={{flex:1,background:'#16a34a',color:'white',border:'none',borderRadius:16,padding:16,fontWeight:700,fontSize:15,cursor:'pointer'}}>
                {respondendo ? '...' : '✓ Aprovar'}
              </button>
            </div>
          )}

          <p style={{textAlign:'center',fontSize:12,color:'#d1d5db',marginBottom:32}}>
            {nomeEmpresa} · {fmtData(dados.created_at)}
          </p>
        </div>
      </div>
    </>
  )
}
