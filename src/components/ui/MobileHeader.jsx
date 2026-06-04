import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Calendar } from 'lucide-react'

export default function MobileHeader({ titulo, subtitulo, status, voltarPara }) {
  const navigate = useNavigate()

  return (
    <div className="bg-navy text-white px-4 pt-12 pb-5 safe-top flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => navigate(voltarPara || -1)}
          className="flex items-center gap-1 text-blue-200 text-sm"
        >
          <ChevronLeft size={20} /> Voltar
        </button>
        <button
          onClick={() => navigate('/agenda')}
          className="flex items-center gap-1.5 bg-white/10 text-white text-xs font-medium px-3 py-1.5 rounded-full"
        >
          <Calendar size={13} /> Agenda
        </button>
      </div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{titulo}</h1>
          {subtitulo && <p className="text-blue-200 text-sm mt-0.5">{subtitulo}</p>}
        </div>
        {status}
      </div>
    </div>
  )
}
