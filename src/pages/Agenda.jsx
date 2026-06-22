import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
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
function getHHMM(str) {
  if (!str) return null
  const match = str.match(/T(\d{2}:\d{2})/)
  return match ? match[1] : null
}
function getDataParte(str) {
  if (!str) return null
  return str.substring(0, 10)
}

const GRADE_INICIO = 7 * 60
const PX_POR_SLOT = 30 // 30px por slot de 30min

export default function Agenda() {
  const navigate = useNavigate()
  const [visao, setVisao] = useState('dia') // 'dia' | 'semana'
  const [dataSelecionada, setDataSelecionada] = useState(new Date())
  const [semana, setSemana] = useState(semanaDeData(new Date()))
  const [servicos, setServicos] = useState([])
  const [servicosSemana, setServicosSemana] = useState([])
  const [modalAberto, setModalAberto] = useState(false)
  const [horarioPreSelecionado, setHorarioPreSelecionado] = useState(null)
  const todayStr = hoje()

  useEffect(() => { buscarServicos() }, [dataSelecionada])
  useEffect(() => { buscarServicosSemana() }, [semana])

  async function buscarServicos() {
    const dStr = dateStr(dataSelecionada)
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
    setServicos((data || []).filter(s => getDataParte(s.scheduled_at) === dStr))
  }

  async function buscarServicosSemana() {
    const inicio = dateStr(semana[0])
    const fim = dateStr(semana[6])
    const { data } = await supabase
      .from('services')
      .select('id, scheduled_at, scheduled_end, status, type, equipment, brand, model, clients(name)')
      .gte('scheduled_at', inicio + 'T00:00')
      .lte('scheduled_at', fim + 'T23:59')
      .not('scheduled_at', 'is', null)
      .range(0, 9999)
    setServicosSemana(data || [])
  }

  function irParaHoje() {
    const d = new Date()
    setDataSelecionada(d)
    setSemana(semanaDeData(d))
  }

  function mudarSemana(delta) {
    const nova = semana.map(d => { const n = new Date(d); n.setDate(d.getDate() + delta * 7); return n })
    setSemana(nova)
    setDataSelecionada(nova[0])
  }

  const dStr = dateStr(dataSelecionada)
  const isHoje = dStr === todayStr
  const alturaGrade = HORARIOS.length * PX_POR_SLOT + 80

  function calcTop(hhmm) {
    if (!hhmm) return 0
    const [h, m] = hhmm.split(':').map(Number)
    return ((h * 60 + m - GRADE_INICIO) / 30) * PX_POR_SLOT + 1
  }
  function calcHeight(hhmm_inicio, hhmm_fim) {
    if (!hhmm_fim) return Math.max(26, PX_POR_SLOT - 2)
    const [hi, mi] = hhmm_inicio.split(':').map(Number)
    const [hf, mf] = hhmm_fim.split(':').map(Number)
    const dur = Math.max(30, (hf * 60 + mf) - (hi * 60 + mi))
    return Math.max(26, (dur / 30) * PX_POR_SLOT - 2)
  }

  return (
    <div className="flex flex-col bg-white" style={{height:'100dvh', overflow:'hidden'}}>

      {/* Header */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0">
        {/* Toggle visão + navegação */}
        <div className="flex items-center px-2 pt-3 pb-1 gap-1">
          <button onClick={() => mudarSemana(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <ChevronLeft size={16} className="text-gray-500"/>
          </button>
          <div className="flex-1 text-center text-xs text-gray-500">
            {(() => {
              const meses = semana.map(d => d.getMonth())
              const mesUnico = meses.every(m => m === meses[0])
              if (mesUnico) return `${MESES[meses[0]]} ${semana[0].getFullYear()}`
              return `${MESES_CURTO[meses[0]]} / ${MESES_CURTO[meses[meses.length-1]]} ${semana[6].getFullYear()}`
            })()}
          </div>
          <button onClick={irParaHoje} className="text-xs text-primary font-semibold px-2 py-1 rounded-lg hover:bg-primary/10 flex-shrink-0">
            Hoje
          </button>
          <button onClick={() => mudarSemana(1)} className="p-1.5 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <ChevronRight size={16} className="text-gray-500"/>
          </button>
        </div>

        {/* Dias da semana */}
        <div className="grid grid-cols-7 px-1 pb-1">
          {semana.map((d, i) => {
            const ds = dateStr(d)
            const isSelected = ds === dStr
            const isT = ds === todayStr
            const temAtend = servicosSemana.some(s => getDataParte(s.scheduled_at) === ds)
            return (
              <button key={i} onClick={() => { setDataSelecionada(d); setSemana(semanaDeData(d)); setVisao('dia') }}
                className="flex flex-col items-center py-1 gap-0.5 relative">
                <span className={`text-xs ${isT ? 'font-medium text-gray-500' : 'text-gray-400'}`}>{DIAS_SEMANA[i]}</span>
                <span className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-semibold transition ${
                  isSelected && isT ? 'bg-primary text-white' :
                  isSelected ? 'bg-navy text-white' :
                  isT ? 'text-primary font-bold' : 'text-gray-800'
                }`}>{d.getDate()}</span>
                {temAtend && <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-primary'}`}/>}
              </button>
            )
          })}
        </div>

        {/* Toggle Dia / Semana */}
        <div className="flex justify-center pb-2">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setVisao('dia')}
              className={`px-5 py-1.5 text-xs font-semibold transition ${visao==='dia'?'bg-navy text-white':'bg-white text-gray-500'}`}>
              Dia
            </button>
            <button onClick={() => setVisao('semana')}
              className={`px-5 py-1.5 text-xs font-semibold transition ${visao==='semana'?'bg-navy text-white':'bg-white text-gray-500'}`}>
              Semana
            </button>
          </div>
        </div>

        {visao === 'dia' && (
          <div className="text-center pb-2">
            <span className={`text-sm font-semibold ${isHoje ? 'text-primary' : 'text-navy'}`}>
              {isHoje ? 'Hoje, ' : ''}{dataSelecionada.getDate()} de {MESES[dataSelecionada.getMonth()]}, {dataSelecionada.getFullYear()}
            </span>
          </div>
        )}
      </div>

      {/* VISÃO DIA */}
      {visao === 'dia' && (
        <div className="flex-1 overflow-y-auto">
          <div className="relative" style={{paddingLeft:'56px', height: alturaGrade}}>
            {HORARIOS.map((h, idx) => {
              const isHH = h.endsWith(':00')
              return (
                <div key={h} style={{position:'absolute', top: idx*PX_POR_SLOT, left:0, right:0, height:PX_POR_SLOT, pointerEvents:'none', zIndex:1}}>
                  <div style={{position:'absolute', left:0, width:52, top:0, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:6, paddingTop:2}}>
                    <span style={{fontSize:11, color: isHH ? '#6b7280' : '#d1d5db'}}>{h}</span>
                  </div>
                  <div style={{position:'absolute', left:52, right:0, top:0, height:1, background: isHH ? '#e5e7eb' : '#f9fafb'}}/>
                </div>
              )
            })}
            {HORARIOS.map((h, idx) => (
              <div key={'click-'+h}
                style={{position:'absolute', top: idx*PX_POR_SLOT, left:52, right:0, height:PX_POR_SLOT, zIndex:2, cursor:'pointer'}}
                onClick={() => { setHorarioPreSelecionado(`${dStr}T${h}`); setModalAberto(true) }}
              />
            ))}
            {servicos.map(s => {
              const hhmm = getHHMM(s.scheduled_at)
              if (!hhmm) return null
              const cor = STATUS_CORES[s.status] || STATUS_CORES.agendado
              const top = calcTop(hhmm)
              const height = calcHeight(hhmm, getHHMM(s.scheduled_end))
              const durMin = s.scheduled_end ? (() => { const [hi,mi]=hhmm.split(':').map(Number); const fim=getHHMM(s.scheduled_end); const [hf,mf]=fim.split(':').map(Number); return (hf*60+mf)-(hi*60+mi) })() : 60
              return (
                <div key={s.id} onClick={e => { e.stopPropagation(); navigate(`/m/atendimento/${s.id}`) }}
                  style={{position:'absolute', top, left:56, right:6, height, background:cor.bg, color:cor.text, border:`1px solid ${cor.border}`, borderRadius:8, padding:'4px 8px', cursor:'pointer', zIndex:3, overflow:'hidden', boxSizing:'border-box'}}>
                  <div style={{fontSize:12, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{s.clients?.name || 'Cliente'}</div>
                  {durMin >= 45 && (s.equipment || s.brand) && <div style={{fontSize:11, opacity:0.75, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{[s.equipment,s.brand,s.model].filter(Boolean).join(' ')}</div>}
                  {durMin >= 60 && <div style={{fontSize:10, opacity:0.6, marginTop:2}}>{hhmm}{s.scheduled_end ? ` – ${getHHMM(s.scheduled_end)}` : ''}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* VISÃO SEMANA */}
      {visao === 'semana' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex" style={{minHeight: alturaGrade}}>
            {/* Labels de hora */}
            <div className="flex-shrink-0 relative" style={{width:40, height: alturaGrade}}>
              {HORARIOS.map((h, idx) => {
                const isHH = h.endsWith(':00')
                return (
                  <div key={h} style={{position:'absolute', top: idx*PX_POR_SLOT, left:0, width:40, height:PX_POR_SLOT}}>
                    <span style={{position:'absolute', right:4, top:2, fontSize:9, color: isHH ? '#9ca3af' : '#e5e7eb'}}>{isHH ? h : ''}</span>
                  </div>
                )
              })}
            </div>

            {/* Colunas dos dias */}
            {semana.map((dia, diaIdx) => {
              const ds = dateStr(dia)
              const isT = ds === todayStr
              const servicosDia = servicosSemana.filter(s => getDataParte(s.scheduled_at) === ds)
              return (
                <div key={diaIdx} className="flex-1 relative border-l border-gray-100" style={{height: alturaGrade}}>
                  {/* Linhas horizontais */}
                  {HORARIOS.map((h, idx) => {
                    const isHH = h.endsWith(':00')
                    return (
                      <div key={h} style={{position:'absolute', top: idx*PX_POR_SLOT, left:0, right:0, height:1, background: isHH ? '#e5e7eb' : '#f9fafb', zIndex:1}}/>
                    )
                  })}
                  {/* Fundo hoje */}
                  {isT && <div style={{position:'absolute', inset:0, background:'rgba(214,38,56,0.03)', zIndex:0}}/>}
                  {/* Slots clicáveis */}
                  {HORARIOS.map((h, idx) => (
                    <div key={'c'+h} style={{position:'absolute', top: idx*PX_POR_SLOT, left:0, right:0, height:PX_POR_SLOT, zIndex:2, cursor:'pointer'}}
                      onClick={() => { setHorarioPreSelecionado(`${ds}T${h}`); setModalAberto(true) }}/>
                  ))}
                  {/* Atendimentos */}
                  {servicosDia.map(s => {
                    const hhmm = getHHMM(s.scheduled_at)
                    if (!hhmm) return null
                    const cor = STATUS_CORES[s.status] || STATUS_CORES.agendado
                    const top = calcTop(hhmm)
                    const height = calcHeight(hhmm, getHHMM(s.scheduled_end))
                    return (
                      <div key={s.id} onClick={e => { e.stopPropagation(); navigate(`/m/atendimento/${s.id}`) }}
                        style={{position:'absolute', top, left:1, right:1, height, background:cor.bg, color:cor.text, border:`1px solid ${cor.border}`, borderRadius:4, padding:'2px 4px', cursor:'pointer', zIndex:3, overflow:'hidden', boxSizing:'border-box'}}>
                        <div style={{fontSize:10, fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', lineHeight:1.3}}>
                          {s.clients?.name || 'Cliente'}
                        </div>
                        {height >= 40 && hhmm && (
                          <div style={{fontSize:9, opacity:0.7}}>{hhmm}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Botão Hoje flutuante */}
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
        style={{position:'fixed', bottom:'96px', right:'20px', zIndex:40, width:'56px', height:'56px', background:'#D72638', borderRadius:'50%', border:'none', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(0,0,0,0.3)', cursor:'pointer'}}>
        <Plus size={26} color="white" strokeWidth={2.5}/>
      </button>

      {modalAberto && (
        <ModalNovoAtendimento
          dataHora={horarioPreSelecionado}
          onClose={() => setModalAberto(false)}
          onSalvo={() => { setModalAberto(false); buscarServicos(); buscarServicosSemana() }}
        />
      )}
    </div>
  )
}
