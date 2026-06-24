import { useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { RotateCcw, Check, ChevronRight, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import MobileHeader from '../../components/ui/MobileHeader'

export default function RecolherEquipamento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [desenhando, setDesenhando] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(false)
  const [coletarAssinatura, setColetarAssinatura] = useState(false)
  const [servico, setServico] = useState(null)
  const [empresa, setEmpresa] = useState({})
  const [salvando, setSalvando] = useState(false)
  const [osCriada, setOsCriada] = useState(null)
  const [assinaturaImg, setAssinaturaImg] = useState(null)

  useEffect(() => {
    async function buscar() {
      const [{ data: s }, { data: cfg }] = await Promise.all([
        supabase.from('services').select('*, clients(name, phone, address, neighborhood, city)').eq('id', id).single(),
        supabase.from('settings').select('*').single(),
      ])
      setServico(s)
      setEmpresa(cfg || {})
    }
    buscar()
  }, [id])

  useEffect(() => {
    if (!coletarAssinatura) return
    const canvas = canvasRef.current
    if (!canvas) return
    setTimeout(() => {
      const ctx = canvas.getContext('2d')
      canvas.width = canvas.offsetWidth * window.devicePixelRatio
      canvas.height = canvas.offsetHeight * window.devicePixelRatio
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      ctx.strokeStyle = '#1B2A4A'
      ctx.lineWidth = 2.5
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }, 50)
  }, [coletarAssinatura])

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect()
    const source = e.touches ? e.touches[0] : e
    return { x: source.clientX - rect.left, y: source.clientY - rect.top }
  }

  function iniciarDesenho(e) {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDesenhando(true)
  }

  function desenhar(e) {
    e.preventDefault()
    if (!desenhando) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setTemAssinatura(true)
  }

  function pararDesenho(e) {
    e.preventDefault()
    setDesenhando(false)
  }

  function limpar() {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setTemAssinatura(false)
    setAssinaturaImg(null)
  }

  async function criarOS(assinaturaBase64 = null) {
    setSalvando(true)
    const now = new Date()
    const nowStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

    const osPayload = {
      client_id: servico.client_id,
      service_id: id,
      equipment: servico.equipment,
      brand: servico.brand,
      model: servico.model,
      problem: servico.problem,
      etapa: 'recolhido',
      status: 'aberto',
      ...(assinaturaBase64 && {
        auth_signature: assinaturaBase64,
        auth_signed_at: nowStr,
        auth_signer_name: servico.clients?.name || '',
      }),
    }

    const { data: os, error } = await supabase.from('workshop_orders').insert(osPayload).select().single()
    if (error) { alert('Erro ao criar OS: ' + error.message); setSalvando(false); return }

    await supabase.from('services').update({ status: 'recolhido', workshop_order_id: os.id }).eq('id', id)

    setSalvando(false)
    setOsCriada(os)
    if (assinaturaBase64) setAssinaturaImg(assinaturaBase64)
  }

  function gerarRecibo() {
    const nomeEmpresa = empresa.company_name || 'Refrilav Assistência Técnica'
    const nomeCliente = cliente.name || '—'
    const equipStr = equip || '—'
    const now = new Date()
    const dataStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()}`
    const enderecoStr = [cliente.address, cliente.neighborhood, cliente.city].filter(Boolean).join(', ')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Recibo de Recolhimento - ${nomeCliente}</title>
<style>
  @page { margin: 20mm; }
  * { box-sizing: border-box; font-family: Arial, sans-serif; }
  body { background: white; color: #111; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #1B2A4A; padding-bottom: 16px; }
  .header img { height: 60px; object-fit: contain; margin-bottom: 8px; }
  .header h1 { margin: 0; font-size: 18px; color: #1B2A4A; }
  .header p { margin: 4px 0 0; font-size: 13px; color: #6b7280; }
  .titulo { font-size: 16px; font-weight: bold; text-align: center; margin: 20px 0; color: #1B2A4A; text-transform: uppercase; letter-spacing: 1px; }
  .termo { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.7; color: #374151; margin-bottom: 20px; }
  .dados { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
  .dado { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
  .dado label { font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 4px; }
  .dado span { font-size: 13px; color: #111; font-weight: 600; }
  .assinatura { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
  .assinatura h3 { font-size: 12px; color: #9ca3af; text-transform: uppercase; margin: 0 0 12px; }
  .assinatura img { max-width: 300px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; display: block; }
  .sem-assinatura { border: 1px dashed #d1d5db; border-radius: 8px; height: 80px; display: flex; align-items: center; justify-content: center; color: #9ca3af; font-size: 12px; }
  .rodape { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px; }
</style>
</head>
<body>
<div class="header">
  <img src="/logo.png" onerror="this.style.display='none'" />
  <h1>${nomeEmpresa}</h1>
  ${empresa.phone ? `<p>${empresa.phone}</p>` : ''}
</div>

<div class="titulo">Recibo de Recolhimento de Equipamento</div>

<div class="termo">
  A <strong>${nomeEmpresa}</strong> retirou o equipamento <strong>${equipStr}</strong> pertencente a <strong>${nomeCliente}</strong>${enderecoStr ? `, residente em ${enderecoStr},` : ''} para conserto em oficina. O cliente será informado sobre o orçamento antes de qualquer reparo ser realizado.
</div>

<div class="dados">
  <div class="dado"><label>Cliente</label><span>${nomeCliente}</span></div>
  <div class="dado"><label>Data</label><span>${dataStr}</span></div>
  <div class="dado"><label>Equipamento</label><span>${equipStr}</span></div>
  ${servico?.problem ? `<div class="dado"><label>Problema relatado</label><span>${servico.problem}</span></div>` : ''}
</div>

<div class="assinatura">
  <h3>Assinatura do cliente</h3>
  ${assinaturaImg
    ? `<img src="${assinaturaImg}" alt="Assinatura" />`
    : `<div class="sem-assinatura">Sem assinatura coletada</div>`
  }
</div>

<div class="rodape">${nomeEmpresa} · ${dataStr}</div>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.document.title = `Recibo de Recolhimento - ${nomeCliente}`
    setTimeout(() => win.print(), 500)
  }

  async function confirmarSemAssinatura() { await criarOS(null) }
  async function confirmarComAssinatura() {
    if (!temAssinatura) return
    const canvas = canvasRef.current
    const assinaturaBase64 = canvas.toDataURL('image/png')
    await criarOS(assinaturaBase64)
  }

  const cliente = servico?.clients || {}
  const equip = [servico?.equipment, servico?.brand, servico?.model].filter(Boolean).join(' ')

  // Se OS já foi criada, mostrar opções
  if (osCriada) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <MobileHeader titulo={cliente.name || '—'} subtitulo={equip}/>
        <div className="flex-1 px-4 py-6 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check size={24} className="text-green-600"/>
            </div>
            <p className="text-base font-bold text-green-800">Equipamento recolhido!</p>
            <p className="text-sm text-green-600 mt-1">OS criada com sucesso</p>
          </div>

          <button onClick={gerarRecibo}
            className="w-full bg-navy text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2">
            <FileText size={20}/> Gerar Recibo de Recolhimento
          </button>

          <button onClick={() => navigate(`/m/oficina/${osCriada.id}`)}
            className="w-full border border-gray-200 bg-white text-gray-700 rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2">
            Ir para a OS →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MobileHeader titulo={cliente.name || '—'} subtitulo={equip || '—'}/>

      <div className="flex-1 px-4 py-5 space-y-4">
        {/* Termo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-navy text-sm mb-2">Termo de Retirada</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            A <strong>{empresa.company_name || 'Refrilav Assistência Técnica'}</strong> está retirando o equipamento <strong>{equip || '—'}</strong> de <strong>{cliente.name || '—'}</strong> para conserto em oficina. O cliente será informado sobre o orçamento antes de qualquer reparo.
          </p>
          {cliente.address && (
            <p className="text-xs text-gray-400 mt-2">
              {[cliente.address, cliente.neighborhood, cliente.city].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Assinatura */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button onClick={() => setColetarAssinatura(!coletarAssinatura)}
            className="w-full flex items-center justify-between px-4 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Coletar assinatura do cliente</span>
              <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Opcional</span>
            </div>
            <ChevronRight size={16} className={`text-gray-300 transition-transform ${coletarAssinatura ? 'rotate-90' : ''}`}/>
          </button>

          {coletarAssinatura && (
            <div className="px-4 pb-4 border-t border-gray-50">
              <div className="flex items-center justify-between py-2 mb-1">
                <span className="text-xs text-gray-400">Peça ao cliente para assinar abaixo</span>
                <button onClick={limpar} className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg">
                  <RotateCcw size={12}/> Limpar
                </button>
              </div>
              <canvas ref={canvasRef}
                className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl touch-none bg-gray-50"
                onMouseDown={iniciarDesenho} onMouseMove={desenhar} onMouseUp={pararDesenho} onMouseLeave={pararDesenho}
                onTouchStart={iniciarDesenho} onTouchMove={desenhar} onTouchEnd={pararDesenho}/>
              {temAssinatura && (
                <button onClick={confirmarComAssinatura} disabled={salvando}
                  className="w-full mt-3 bg-navy text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2">
                  <Check size={16}/>
                  {salvando ? 'Criando OS...' : 'Confirmar com assinatura'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pb-8 safe-bottom flex-shrink-0 space-y-3">
        <button onClick={confirmarSemAssinatura} disabled={salvando}
          className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2">
          <Check size={20}/>
          {salvando ? 'Criando OS...' : 'Recolher e Criar OS'}
        </button>
        <p className="text-center text-xs text-gray-400">A assinatura pode ser coletada depois dentro da OS</p>
      </div>
    </div>
  )
}
