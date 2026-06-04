import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, MapPin, Clock, Wrench, Package, CheckCircle, Edit2, Plus, Trash2, FileText } from 'lucide-react'
import MobileHeader from '../../components/ui/MobileHeader'
import { supabase } from '../../lib/supabase'

const STATUS_INFO = {
  agendado:     { label: 'Agendado',     bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   },
  em_andamento: { label: 'Em andamento', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  concluido:    { label: 'Concluído',    bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  },
  recolhido:    { label: 'Recolhido',    bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  cancelado:    { label: 'Cancelado',    bg: 'bg-gray-100',   text: 'text-gray-500',   dot: 'bg-gray-400'   },
}

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtHora(s) { return s ? s.substring(11,16) : '—' }
function fmtData(s) {
  if (!s) return '—'
  const [y,m,d] = s.substring(0,10).split('-')
  return `${d}/${m}/${y}`
}

export default function AtendimentoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [servico, setServico] = useState(null)
  const [pecas, setPecas] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [editDiag, setEditDiag] = useState(false)
  const [diag, setDiag] = useState('')
  const [editTrab, setEditTrab] = useState(false)
  const [trab, setTrab] = useState('')
  const [editVal, setEditVal] = useState(false)
  const [mao, setMao] = useState('')
  const [totalDireto, setTotalDireto] = useState('')
  const [addPeca, setAddPeca] = useState(false)
  const [novaPeca, setNovaPeca] = useState({ description:'', quantity:1, unit_price:'' })

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const { data: s } = await supabase
      .from('services')
      .select('*, clients(name, phone, address, neighborhood, city)')
      .eq('id', id).single()
    const { data: p } = await supabase
      .from('service_parts').select('*').eq('service_id', id).range(0,999)
    setServico(s)
    setPecas(p || [])
    setDiag(s?.diagnosis || '')
    setTrab(s?.work_done || '')
    setMao(s?.labor_price || '')
    setLoading(false)
  }

  async function excluir() {
    if (!window.confirm('Excluir este atendimento? Esta ação não pode ser desfeita.')) return
    setSalvando(true)
    await supabase.from('service_parts').delete().eq('service_id', id)
    await supabase.from('services').delete().eq('id', id)
    setSalvando(false)
    navigate('/atendimentos')
  }

  async function iniciar() {
    setSalvando(true)
    await supabase.from('services').update({ status: 'em_andamento' }).eq('id', id)
    await carregar()
    setSalvando(false)
  }

  async function concluir() {
    if (!window.confirm('Concluir atendimento e gerar cobrança?')) return
    setSalvando(true)
    const now = new Date()
    const ts = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    await supabase.from('services').update({ status: 'concluido', finished_at: ts }).eq('id', id)
    if (servico?.total_price > 0) {
      await supabase.from('receivables').insert({
        service_id: id,
        client_id: servico.client_id,
        description: `Atendimento - ${servico.clients?.name || ''} - ${[servico.equipment,servico.brand,servico.model].filter(Boolean).join(' ')}`,
        amount: servico.total_price,
        due_date: ts.substring(0,10),
        status: 'pendente',
      })
    }
    setSalvando(false)
    carregar()
  }

  async function salvarDiag() {
    await supabase.from('services').update({ diagnosis: diag }).eq('id', id)
    setEditDiag(false); carregar()
  }
  async function salvarTrab() {
    await supabase.from('services').update({ work_done: trab }).eq('id', id)
    setEditTrab(false); carregar()
  }
  async function salvarValores() {
    if (totalDireto) {
      const val = parseFloat(totalDireto.replace(',','.')) || 0
      await supabase.from('services').update({ labor_price: null, total_price: val }).eq('id', id)
    } else {
      const val = parseFloat(String(mao).replace(',','.')) || 0
      const tp = pecas.reduce((s,p) => s+(p.quantity*p.unit_price), 0)
      await supabase.from('services').update({ labor_price: val||null, total_price: (val+tp)||null }).eq('id', id)
    }
    setEditVal(false); setTotalDireto(''); carregar()
  }
  async function salvarPeca() {
    if (!novaPeca.description) return
    const preco = parseFloat(String(novaPeca.unit_price).replace(',','.')) || 0
    await supabase.from('service_parts').insert({ service_id: id, description: novaPeca.description, quantity: novaPeca.quantity, unit_price: preco })
    const tp = [...pecas, {quantity:novaPeca.quantity, unit_price:preco}].reduce((s,p)=>s+(p.quantity*p.unit_price),0)
    await supabase.from('services').update({ total_price: tp + parseFloat(servico?.labor_price||0) }).eq('id', id)
    setNovaPeca({description:'',quantity:1,unit_price:''}); setAddPeca(false); carregar()
  }
  async function removerPeca(pid) {
    await supabase.from('service_parts').delete().eq('id', pid); carregar()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!servico) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Não encontrado</div>

  const cli = servico.clients || {}
  const st = STATUS_INFO[servico.status] || STATUS_INFO.agendado
  const tp = pecas.reduce((s,p)=>s+(p.quantity*p.unit_price),0)
  const podeEditar = servico.status !== 'concluido' && servico.status !== 'cancelado'

  return (
    <div style={{minHeight:'100dvh', display:'flex', flexDirection:'column', background:'#f9fafb'}}>

      <MobileHeader
        titulo={cli.name || '—'}
        subtitulo={[servico.equipment,servico.brand,servico.model].filter(Boolean).join(' · ')}
        voltarPara="/atendimentos"
        acoes={
          <button
            onClick={excluir}
            className="flex items-center justify-center w-8 h-8 bg-white/10 rounded-full"
          >
            <Trash2 size={15} className="text-red-300" />
          </button>
        }
        status={
          <span className={`${st.bg} ${st.text} text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>
            {st.label}
          </span>
        }
      />

      {/* SCROLL */}
      <div style={{flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:'12px'}}>

        {/* Cliente */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente</span></div>
          {cli.phone && (
            <a href={`tel:${cli.phone}`} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center"><Phone size={16} className="text-green-700"/></div>
              <div><div className="text-sm font-medium">{cli.phone}</div><div className="text-xs text-gray-400">Toque para ligar</div></div>
            </a>
          )}
          {(cli.address||cli.neighborhood) && (
            <button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent([cli.address,cli.neighborhood,cli.city].filter(Boolean).join(', '))}`, '_blank')}
              className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center"><MapPin size={16} className="text-blue-700"/></div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{[cli.address,cli.neighborhood].filter(Boolean).join(', ')}</div>
                <div className="text-xs text-blue-600">Abrir no Google Maps →</div>
              </div>
            </button>
          )}
        </div>

        {/* Serviço */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50"><span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Serviço</span></div>
          <div className="divide-y divide-gray-50">
            <div className="flex items-center gap-3 px-4 py-3">
              <Clock size={16} className="text-gray-400"/>
              <div><div className="text-xs text-gray-400">Agendado para</div><div className="text-sm font-medium">{fmtData(servico.scheduled_at)} às {fmtHora(servico.scheduled_at)}</div></div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Wrench size={16} className="text-gray-400"/>
              <div><div className="text-xs text-gray-400">Tipo</div><div className="text-sm font-medium">{servico.type||'—'}</div></div>
            </div>
            {servico.problem && <div className="px-4 py-3"><div className="text-xs text-gray-400 mb-1">Problema</div><div className="text-sm text-gray-700">{servico.problem}</div></div>}
          </div>
        </div>

        {/* Diagnóstico */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Diagnóstico</span>
            {podeEditar && !editDiag && <button onClick={()=>setEditDiag(true)} className="p-1.5 rounded-lg bg-gray-100"><Edit2 size={14} className="text-gray-500"/></button>}
          </div>
          <div className="px-4 py-3">
            {editDiag ? (
              <div className="space-y-2">
                <textarea value={diag} onChange={e=>setDiag(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" autoFocus/>
                <div className="flex gap-2">
                  <button onClick={salvarDiag} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                  <button onClick={()=>setEditDiag(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : <p className="text-sm text-gray-700">{servico.diagnosis || <span className="text-gray-300 italic">Nenhum diagnóstico</span>}</p>}
          </div>
        </div>

        {/* Trabalho */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Trabalho realizado</span>
            {podeEditar && !editTrab && <button onClick={()=>setEditTrab(true)} className="p-1.5 rounded-lg bg-gray-100"><Edit2 size={14} className="text-gray-500"/></button>}
          </div>
          <div className="px-4 py-3">
            {editTrab ? (
              <div className="space-y-2">
                <textarea value={trab} onChange={e=>setTrab(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" autoFocus/>
                <div className="flex gap-2">
                  <button onClick={salvarTrab} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                  <button onClick={()=>setEditTrab(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : <p className="text-sm text-gray-700">{servico.work_done || <span className="text-gray-300 italic">Nenhum trabalho registrado</span>}</p>}
          </div>
        </div>

        {/* Peças */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Peças utilizadas</span>
            {podeEditar && <button onClick={()=>setAddPeca(true)} className="flex items-center gap-1 bg-navy/10 text-navy rounded-lg px-2.5 py-1.5 text-xs font-semibold"><Plus size={13}/> Adicionar</button>}
          </div>
          {addPeca && (
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
              <input value={novaPeca.description} onChange={e=>setNovaPeca(p=>({...p,description:e.target.value}))} placeholder="Nome da peça" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" autoFocus/>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={novaPeca.quantity} onChange={e=>setNovaPeca(p=>({...p,quantity:parseInt(e.target.value)||1}))} placeholder="Qtd" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"/>
                <input type="number" value={novaPeca.unit_price} onChange={e=>setNovaPeca(p=>({...p,unit_price:e.target.value}))} placeholder="Valor unitário" step="0.01" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"/>
              </div>
              <div className="flex gap-2">
                <button onClick={salvarPeca} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Adicionar</button>
                <button onClick={()=>{setAddPeca(false);setNovaPeca({description:'',quantity:1,unit_price:''})}} className="px-4 bg-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
              </div>
            </div>
          )}
          <div className="divide-y divide-gray-50">
            {pecas.length === 0
              ? <p className="px-4 py-3 text-sm text-gray-300 italic">Nenhuma peça adicionada</p>
              : pecas.map(p=>(
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{p.description}</div>
                    <div className="text-xs text-gray-400">{p.quantity}x · {fmt(p.unit_price)}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{fmt(p.quantity*p.unit_price)}</span>
                    {podeEditar && <button onClick={()=>removerPeca(p.id)} className="p-1.5 rounded-lg bg-red-50"><Trash2 size={14} className="text-red-500"/></button>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Valores */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Valores</span>
            {podeEditar && !editVal && <button onClick={()=>setEditVal(true)} className="p-1.5 rounded-lg bg-gray-100"><Edit2 size={14} className="text-gray-500"/></button>}
          </div>
          {editVal ? (
            <div className="px-4 py-4 space-y-3">
              {tp > 0 && <div className="flex justify-between text-sm"><span className="text-gray-500">Peças</span><span>{fmt(tp)}</span></div>}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Mão de obra</label>
                <input type="number" value={mao} onChange={e=>setMao(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" step="0.01" placeholder="0,00"/>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-3">
                <label className="text-xs text-gray-500 mb-1 block">Ou total direto (sem discriminar)</label>
                <input type="number" value={totalDireto} onChange={e=>setTotalDireto(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" step="0.01" placeholder="Ex: 150,00"/>
              </div>
              <div className="flex gap-2">
                <button onClick={salvarValores} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                <button onClick={()=>setEditVal(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {tp > 0 && <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-600">Peças</span><span className="text-sm font-medium">{fmt(tp)}</span></div>}
              {servico.labor_price > 0 && <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-600">Mão de obra</span><span className="text-sm font-medium">{fmt(servico.labor_price)}</span></div>}
              <div className="flex justify-between px-4 py-3 bg-gray-50"><span className="text-sm font-bold">Total</span><span className="text-base font-bold text-navy">{fmt(servico.total_price || (tp + parseFloat(servico.labor_price||0)))}</span></div>
            </div>
          )}
        </div>

        {/* Recolher */}
        {podeEditar && (
          <button onClick={()=>navigate(`/m/recolher/${id}`)} className="w-full bg-navy/10 text-navy rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2">
            <Package size={18}/> Recolher Equipamento
          </button>
        )}

        {/* Recibo */}
        <button onClick={()=>window.open(`/recibo/${id}`,'_blank')} className="w-full border border-gray-200 bg-white text-gray-700 rounded-2xl py-4 font-semibold text-sm flex items-center justify-center gap-2">
          <FileText size={18}/> Ver Recibo
        </button>

      </div>

      {/* BOTÕES DE AÇÃO — sempre visíveis no rodapé */}
      <div style={{background:'white', borderTop:'1px solid #f3f4f6', padding:'16px', paddingBottom:'max(16px, env(safe-area-inset-bottom))'}}>

        {servico.status === 'agendado' && (
          <div style={{display:'flex', gap:'12px'}}>
            <button
              onClick={iniciar}
              disabled={salvando}
              style={{flex:1, background:'#1B2A4A', color:'white', border:'none', borderRadius:'16px', padding:'16px', fontWeight:'700', fontSize:'15px', cursor:'pointer'}}
            >
              {salvando ? '...' : '▶ Iniciar'}
            </button>
            <button
              onClick={concluir}
              disabled={salvando}
              style={{flex:1, background:'#16a34a', color:'white', border:'none', borderRadius:'16px', padding:'16px', fontWeight:'700', fontSize:'15px', cursor:'pointer'}}
            >
              {salvando ? '...' : '✓ Concluir'}
            </button>
          </div>
        )}

        {servico.status === 'em_andamento' && (
          <button
            onClick={concluir}
            disabled={salvando}
            style={{width:'100%', background:'#16a34a', color:'white', border:'none', borderRadius:'16px', padding:'16px', fontWeight:'700', fontSize:'15px', cursor:'pointer'}}
          >
            {salvando ? 'Salvando...' : '✓ Concluir e Gerar Cobrança'}
          </button>
        )}

        {servico.status === 'concluido' && (
          <div style={{background:'#f0fdf4', color:'#15803d', borderRadius:'16px', padding:'16px', textAlign:'center', fontWeight:'600', fontSize:'14px'}}>
            ✓ Concluído em {fmtData(servico.finished_at)}
          </div>
        )}

      </div>
    </div>
  )
}
