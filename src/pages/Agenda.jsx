import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ModalNovoAtendimento from '../components/ui/ModalNovoAtendimento'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MESES_CURTO = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const HORARIOS = []
for (let h = 7; h <= 19; h++) {
  HORARIOS.push(`${String(h).padStart(2,'0')}:00`)
  HORARIOS.push(`${String(h).padStart(2,'0')}:30`)
}

const STATUS_CORES = {
  agendado:     { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-300' },
  em_andamento: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-400' },
  concluido:    { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-300' },
  cancelado:    { bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200' },
}

function hoje() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function dateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function semanaDeData(date) {
  const d = new Date(date)
  const dia = d.getDay()
  const inicio = new Date(d)
  inicio.setDate(d.getDate() - dia)
  return Array.from({length:7}, (_,i) => {
    const dd = new Date(inicio)
    dd.setDate(inicio.getDate() + i)
    return dd
  })
}

export default function Agenda() {
  const navigate = useNavigate()
  const isMobile = window.innerWidth < 1024
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [semana, setSemana] = useState(semanaDeData(new Date()))
  const [servicos, setServicos] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [horarioPreSelecionado, setHorarioPreSelecionado] = useState(null)
  const todayStr = hoje()

  useEffect(() => { buscarServicos() }, [dataSelecionada])

  async function buscarServicos() {
    const dStr = dateStr(dataSelecionada)
    const { data } = await supabase
      .from('services')
      .select('id, scheduled_at, scheduled_end, status, type, equipment, brand, model, problem, labor_price, total_price, clients(name, phone, address, neighborhood, city)')
      .gte('scheduled_at', dStr + 'T00:00')
      .lte('scheduled_at', dStr + 'T23:59')
      .not('scheduled_at', 'is', null)
      .range(0, 999)
    setServicos(data || [])
  }

  function irParaHoje() {
    const d = new Date()
    setDataSelecionada(d)
    setSemana(semanaDeData(d))
  }

  function servicosNoHorario(horario) {
    return servicos.filter(s => {
      if (!s.scheduled_at) return false
      return s.scheduled_at.substring(11,16) === horario
    })
  }

  function abrirModalNoSlot(horario) {
    setHorarioPreSelecionado(horario)
    setModalAberto(true)
  }

  const dStr = dateStr(dataSelecionada)
  const isHoje = dStr === todayStr

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden">
      {/* Cabeçalho semana */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        {/* Linha de meses */}
        <div className="flex text-xs text-gray-500 pt-3 pb-1 px-2">
          {(() => {
            const meses = semana.map(d => d.getMonth())
            const mesUnico = meses.every(m => m === meses[0])
            if (mesUnico) return <span className="flex-1 text-center">{MESES[meses[0]]}</span>
            const corte = meses.findIndex((m, i) => i > 0 && m !== meses[i-1])
            return (
              <>
                <span style={{flex: corte}} className="text-center border-r border-gray-100">{MESES_CURTO[meses[0]]}</span>
                <span style={{flex: 7-corte}} className="text-center">{MESES[meses[meses.length-1]]}</span>
              </>
            )
          })()}
        </div>
        {/* Dias da semana */}
        <div className="grid grid-cols-7 px-1 pb-2">
          {semana.map((d, i) => {
            const ds = dateStr(d)
            const isSelected = ds === dStr
            const isT = ds === todayStr
            return (
              <button key={i} onClick={() => { setDataSelecionada(d); setSemana(semanaDeData(d)) }}
                className="flex flex-col items-center py-1 gap-0.5">
                <span className={`text-xs ${isT ? 'text-gray-500 font-medium' : 'text-gray-400'}`}>
                  {DIAS_SEMANA[i]}
                </span>
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition ${
                  isSelected && isT ? 'bg-primary text-white' :
                  isSelected ? 'bg-navy text-white' :
                  isT ? 'text-primary font-bold' : 'text-gray-800'
                }`}>
                  {d.getDate()}
                </span>
              </button>
            )
          })}
        </div>
        {/* Data por extenso */}
        <div className="text-center pb-3">
          <span className={`text-sm font-semibold ${isHoje ? 'text-primary' : 'text-navy'}`}>
            {isHoje ? 'Hoje, ' : ''}{dataSelecionada.getDate()} de {MESES[dataSelecionada.getMonth()]}, {dataSelecionada.getFullYear()}
          </span>
        </div>
      </div>

      {/* Grade horária */}
      <div className="flex-1 overflow-y-auto relative">
        {HORARIOS.map(h => {
          const items = servicosNoHorario(h)
          const isHH = h.endsWith(':00')
          return (
            <div key={h}
              className={`flex border-b ${isHH ? 'border-gray-150' : 'border-gray-50'} min-h-[40px]`}
              onClick={() => abrirModalNoSlot(`${dStr}T${h}`)}>
              <div className="w-14 flex-shrink-0 flex items-start justify-end pr-2 pt-1">
                <span className={`text-xs ${isHH ? 'text-gray-500' : 'text-gray-300'}`}>{h}</span>
              </div>
              <div className="flex-1 py-0.5 pr-2 space-y-0.5">
                {items.map(s => {
                  const cores = STATUS_CORES[s.status] || STATUS_CORES.agendado
                  return (
                    <div key={s.id}
                      onClick={e => { e.stopPropagation(); navigate(`/m/atendimento/${s.id}`) }}
                      className={`${cores.bg} ${cores.text} border ${cores.border} rounded-lg px-2 py-1.5 text-xs font-medium cursor-pointer active:scale-[0.98] transition`}>
                      <div className="font-semibold truncate">{s.clients?.name || 'Cliente'}</div>
                      {(s.equipment || s.brand) && (
                        <div className="truncate opacity-75 text-[11px]">
                          {[s.equipment, s.brand, s.model].filter(Boolean).join(' ')}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div className="h-20" />
      </div>

      {/* Botão Hoje */}
      {!isHoje && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40">
          <button onClick={irParaHoje} className="bg-navy text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg">
            Hoje
          </button>
        </div>
      )}

      {/* FAB + */}
      <button
        onClick={() => { setHorarioPreSelecionado(null); setModalAberto(true) }}
        className="fixed bottom-24 right-5 z-40 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-xl active:scale-95 transition"
      >
        <Plus size={26} color="white" strokeWidth={2.5} />
      </button>

      {modalAberto && (
        <ModalNovoAtendimento
          dataHora={horarioPreSelecionado}
          onClose={() => setModalAberto(false)}
          onSalvo={() => { setModalAberto(false); buscarServicos() }}
        />
      )}
    </div>
  )
}
