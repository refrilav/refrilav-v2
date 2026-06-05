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
  agendado:     { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  em_andamento: { bg: '#ffedd5', text: '#c2410c', border: '#fb923c' },
  concluido:    { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  recolhido:    { bg: '#f3e8ff', text: '#7e22ce', border: '#c084fc' },
  cancelado:    { bg: '#f3f4f6', text: '#6b7280', border: '#d1d5db' },
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
  const inicio = new Date(d)
  inicio.setDate(d.getDate() - d.getDay())
  return Array.from({length:7}, (_,i) => {
    const dd = new Date(inicio)
    dd.setDate(inicio.getDate() + i)
    return dd
  })
}

// Retorna HH:MM de uma string de data
function getHHMM(str) {
  if (!str) return null
  // Suporta tanto "2026-06-04T14:30" quanto "2026-06-04T14:30:00" quanto "2026-06-04T14:30:00+00:00"
  const match = str.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : null
}

// Retorna YYYY-MM-DD de uma string de data
function getDataParte(str) {
  if (!str) return null
  return str.substring(0, 10)
}

// Agrupa serviços que se sobrepõem no tempo em colunas
function distribuirEmColunas(servicos) {
  if (servicos.length === 0) return []
  const cols = []
  servicos.forEach(s => {
    const inicio = getHHMM(s.scheduled_at)
    const fim = getHHMM(s.scheduled_end) || inicio
    let colocado = false
    for (let col of cols) {
      const ultimo = col[col.length - 1]
      const fimUltimo = getHHMM(ultimo.scheduled_end) || getHHMM(ultimo.scheduled_at)
      if (fimUltimo <= inicio) {
        col.push(s)
        colocado = true
        break
      }
    }
    if (!colocado) cols.push([s])
  })
  return cols
}

export default function Agenda() {
  const navigate = useNavigate()
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [semana, setSemana] = useState(semanaDeData(new Date()))
  const [servicos, setServicos] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [horarioPreSelecionado, setHorarioPreSelecionado] = useState(null)
  const todayStr = hoje()

  useEffect(() => { buscarServicos() }, [dataSelecionada])

  async function buscarServicos() {
    const dStr = dateStr(dataSelecionada)
    // Busca com margem de 1 dia para pegar registros com timezone
    const d = new Date(dataSelecionada)
    const antes = new Date(d); antes.setDate(d.getDate() - 1)
    const depois = new Date(d); depois.setDate(d.getDate() + 1)
    const { data } = await supabase
      .from('services')
      .select('id, scheduled_at, scheduled_end, status, type, equipment, brand, model, clients(name)')
      .gte('scheduled_at', dateStr(antes) + 'T00:00')
      .lte('scheduled_at', dateStr(depois) + 'T23:59')
      .not('scheduled_at', 'is', null)
      .range(0, 9999)

    // Filtra apenas os do dia correto (resolve problema de timezone)
    const dodia = (data || []).filter(s => getDataParte(s.scheduled_at) === dStr)
    setServicos(dodia)
  }

  function irParaHoje() {
    const d = new Date()
    setDataSelecionada(d)
    setSemana(semanaDeData(d))
  }

  const dStr = dateStr(dataSelecionada)
  const isHoje = dStr === todayStr

  return (
    <div className="flex flex-col bg-white" style={{height:'100dvh', overflow:'hidden'}}>

      {/* Header semana */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex text-xs text-gray-500 pt-3 pb-1 px-2">
          {(() => {
            const meses = semana.map(d => d.getMonth())
            const mesUnico = meses.every(m => m === meses[0])
            if (mesUnico) return <span className="flex-1 text-center">{MESES[meses[0]]}</span>
            const corte = meses.findIndex((m,i) => i > 0 && m !== meses[i-1])
            return (
              <>
                <span style={{flex:corte}} className="text-center border-r border-gray-100">{MESES_CURTO[meses[0]]}</span>
                <span style={{flex:7-corte}} className="text-center">{MESES[meses[meses.length-1]]}</span>
              </>
            )
          })()}
        </div>
        <div className="grid grid-cols-7 px-1 pb-2">
          {semana.map((d, i) => {
            const ds = dateStr(d)
            const isSelected = ds === dStr
            const isT = ds === todayStr
            return (
              <button key={i} onClick={() => { setDataSelecionada(d); setSemana(semanaDeData(d)) }}
                className="flex flex-col items-center py-1 gap-0.5">
                <span className={`text-xs ${isT ? 'font-medium text-gray-500' : 'text-gray-400'}`}>{DIAS_SEMANA[i]}</span>
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition ${
                  isSelected && isT ? 'bg-primary text-white' :
                  isSelected ? 'bg-navy text-white' :
                  isT ? 'text-primary font-bold' : 'text-gray-800'
                }`}>{d.getDate()}</span>
              </button>
            )
          })}
        </div>
        <div className="text-center pb-3">
          <span className={`text-sm font-semibold ${isHoje ? 'text-primary' : 'text-navy'}`}>
            {isHoje ? 'Hoje, ' : ''}{dataSelecionada.getDate()} de {MESES[dataSelecionada.getMonth()]}, {dataSelecionada.getFullYear()}
          </span>
        </div>
      </div>

      {/* Grade horária com posicionamento proporcional — 1min = 1px, 1h = 60px */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative" style={{paddingLeft:'56px', height: HORARIOS.length * 30 + 80}}>

          {/* Linhas e labels de hora */}
          {HORARIOS.map((h, idx) => {
            const isHH = h.endsWith(':00')
            return (
              <div key={h} style={{position:'absolute', top: idx*30, left:0, right:0, height:30, pointerEvents:'none', zIndex:1}}>
                <div style={{position:'absolute', left:0, width:52, top:0, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:6, paddingTop:2}}>
                  <span style={{fontSize:11, color: isHH ? '#6b7280' : '#d1d5db'}}>{h}</span>
                </div>
                <div style={{position:'absolute', left:52, right:0, top:0, height:1, background: isHH ? '#e5e7eb' : '#f9fafb'}}/>
              </div>
            )
          })}

          {/* Área clicável por slot */}
          {HORARIOS.map((h, idx) => (
            <div key={'click-'+h}
              style={{position:'absolute', top: idx*30, left:52, right:0, height:30, zIndex:2, cursor:'pointer'}}
              onClick={() => { setHorarioPreSelecionado(`${dStr}T${h}`); setModalAberto(true) }}
            />
          ))}

          {/* Atendimentos posicionados com altura proporcional */}
          {servicos.map(s => {
            const hhmm = getHHMM(s.scheduled_at)
            if (!hhmm) return null
            const [ah, am] = hhmm.split(':').map(Number)
            const inicioMin = ah * 60 + am
            const GRADE_INICIO = 7 * 60 // começa às 07:00

            let duracaoMin = 60
            if (s.scheduled_end) {
              const fimHHMM = getHHMM(s.scheduled_end)
              if (fimHHMM) {
                const [fh, fm] = fimHHMM.split(':').map(Number)
                duracaoMin = Math.max(30, (fh * 60 + fm) - inicioMin)
              }
            }

            const topPx = ((inicioMin - GRADE_INICIO) / 30) * 30 + 1
            const heightPx = Math.max(26, (duracaoMin / 30) * 30 - 2)
            const cor = STATUS_CORES[s.status] || STATUS_CORES.agendado

            return (
              <div key={s.id}
                onClick={e => { e.stopPropagation(); navigate(`/m/atendimento/${s.id}`) }}
                style={{
                  position:'absolute', top: topPx, left:56, right:6, height: heightPx,
                  background: cor.bg, color: cor.text, border: `1px solid ${cor.border}`,
                  borderRadius:8, padding:'4px 8px', cursor:'pointer', zIndex:3,
                  overflow:'hidden', boxSizing:'border-box',
                }}>
                <div style={{fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                  {s.clients?.name || 'Cliente'}
                </div>
                {duracaoMin >= 45 && (s.equipment || s.brand) && (
                  <div style={{fontSize:11, opacity:0.75, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
                    {[s.equipment, s.brand, s.model].filter(Boolean).join(' ')}
                  </div>
                )}
                {duracaoMin >= 60 && (
                  <div style={{fontSize:10, opacity:0.6, marginTop:2}}>
                    {hhmm}{s.scheduled_end ? ` – ${getHHMM(s.scheduled_end)}` : ''}
                  </div>
                )}
              </div>
            )
          })}

        </div>
      </div>

      {/* Botão Hoje */}
      {!isHoje && (
        <div style={{position:'fixed', bottom:'96px', left:'50%', transform:'translateX(-50%)', zIndex:40}}>
          <button onClick={irParaHoje} className="bg-navy text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg">
            Hoje
          </button>
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setHorarioPreSelecionado(null); setModalAberto(true) }}
        style={{position:'fixed', bottom:'96px', right:'20px', zIndex:40, width:'56px', height:'56px', background:'#D72638', borderRadius:'50%', border:'none', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(0,0,0,0.3)', cursor:'pointer'}}
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
