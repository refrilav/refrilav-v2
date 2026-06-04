import { useRef, useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, RotateCcw, Check, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function RecolherEquipamento() {
  const { id } = useParams()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const [desenhando, setDesenhando] = useState(false)
  const [temAssinatura, setTemAssinatura] = useState(false)
  const [coletarAssinatura, setColetarAssinatura] = useState(false)
  const [servico, setServico] = useState(null)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    async function buscar() {
      const { data } = await supabase
        .from('services')
        .select('*, clients(name, phone, address, neighborhood, city)')
        .eq('id', id)
        .single()
      setServico(data)
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

    const { data: os, error } = await supabase
      .from('workshop_orders')
      .insert(osPayload)
      .select()
      .single()

    if (error) {
      alert('Erro ao criar OS: ' + error.message)
      setSalvando(false)
      return
    }

    await supabase
      .from('services')
      .update({ status: 'recolhido', workshop_order_id: os.id })
      .eq('id', id)

    setSalvando(false)
    navigate(`/m/oficina/${os.id}`)
  }

  async function confirmarSemAssinatura() {
    await criarOS(null)
  }

  async function confirmarComAssinatura() {
    if (!temAssinatura) return
    const canvas = canvasRef.current
    const assinaturaBase64 = canvas.toDataURL('image/png')
    await criarOS(assinaturaBase64)
  }

  const cliente = servico?.clients || {}
  const equip = [servico?.equipment, servico?.brand, servico?.model].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-navy text-white px-4 pt-12 pb-5 safe-top flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate(-1)} className="p-1 -ml-1">
            <ChevronLeft size={24} />
          </button>
          <span className="text-sm text-blue-200">Recolher Equipamento</span>
        </div>
        <h1 className="text-lg font-bold">{cliente.name || '—'}</h1>
        <p className="text-blue-200 text-sm mt-0.5">{equip || '—'}</p>
      </div>

      <div className="flex-1 px-4 py-5 space-y-4">
        {/* Termo */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-semibold text-navy text-sm mb-2">Termo de Retirada</h2>
          <p className="text-xs text-gray-600 leading-relaxed">
            A <strong>Refrilav Assistência Técnica</strong> está retirando o equipamento <strong>{equip || '—'}</strong> de <strong>{cliente.name || '—'}</strong> para conserto em oficina. O cliente será informado sobre o orçamento antes de qualquer reparo.
          </p>
          {cliente.address && (
            <p className="text-xs text-gray-400 mt-2">
              {[cliente.address, cliente.neighborhood, cliente.city].filter(Boolean).join(', ')}
            </p>
          )}
        </div>

        {/* Assinatura — opcional, expansível */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={() => setColetarAssinatura(!coletarAssinatura)}
            className="w-full flex items-center justify-between px-4 py-3.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Coletar assinatura do cliente</span>
              <span className="text-[10px] bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Opcional</span>
            </div>
            <ChevronRight size={16} className={`text-gray-300 transition-transform ${coletarAssinatura ? 'rotate-90' : ''}`} />
          </button>

          {coletarAssinatura && (
            <div className="px-4 pb-4 border-t border-gray-50">
              <div className="flex items-center justify-between py-2 mb-1">
                <span className="text-xs text-gray-400">Peça ao cliente para assinar abaixo</span>
                <button onClick={limpar} className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 px-2.5 py-1.5 rounded-lg">
                  <RotateCcw size={12} /> Limpar
                </button>
              </div>
              <canvas
                ref={canvasRef}
                className="w-full h-36 border-2 border-dashed border-gray-200 rounded-xl touch-none bg-gray-50"
                onMouseDown={iniciarDesenho}
                onMouseMove={desenhar}
                onMouseUp={pararDesenho}
                onMouseLeave={pararDesenho}
                onTouchStart={iniciarDesenho}
                onTouchMove={desenhar}
                onTouchEnd={pararDesenho}
              />
              {temAssinatura && (
                <button
                  onClick={confirmarComAssinatura}
                  disabled={salvando}
                  className="w-full mt-3 bg-navy text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  {salvando ? 'Criando OS...' : 'Confirmar com assinatura'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Botão principal — sempre disponível */}
      <div className="px-4 pb-8 safe-bottom flex-shrink-0 space-y-3">
        <button
          onClick={confirmarSemAssinatura}
          disabled={salvando}
          className="w-full bg-primary text-white rounded-2xl py-4 font-bold text-base disabled:opacity-60 active:scale-[0.98] transition shadow-lg flex items-center justify-center gap-2"
        >
          <Check size={20} />
          {salvando ? 'Criando OS...' : 'Recolher e Criar OS'}
        </button>
        <p className="text-center text-xs text-gray-400">
          A assinatura pode ser coletada depois dentro da OS
        </p>
      </div>
    </div>
  )
}
