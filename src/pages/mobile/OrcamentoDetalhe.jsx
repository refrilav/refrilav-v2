import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Edit2, Plus, Trash2, Save } from 'lucide-react'
import MobileHeader from '../../components/ui/MobileHeader'
import { supabase } from '../../lib/supabase'

function fmt(v) {
  if (!v && v !== 0) return '—'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

export default function OrcamentoDetalhe() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [orc, setOrc] = useState(null)
  const [pecas, setPecas] = useState([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)

  const [editDiag, setEditDiag] = useState(false)
  const [diag, setDiag] = useState('')
  const [editDesc, setEditDesc] = useState(false)
  const [desc, setDesc] = useState('')
  const [editVal, setEditVal] = useState(false)
  const [mao, setMao] = useState('')
  const [addPeca, setAddPeca] = useState(false)
  const [novaPeca, setNovaPeca] = useState({ name:'', quantity:1, unit_price:'' })

  useEffect(() => { carregar() }, [id])

  async function carregar() {
    setLoading(true)
    const { data: o } = await supabase
      .from('quotes')
      .select('*, clients(name, phone, address, neighborhood, city)')
      .eq('id', id).single()
    const { data: p } = await supabase
      .from('quote_parts').select('*').eq('quote_id', id).range(0, 9999)
    setOrc(o); setPecas(p||[])
    setDiag(o?.diagnosis || '')
    setDesc(o?.services_description || '')
    setMao(o?.labor_price || '')
    setLoading(false)
  }

  async function salvarDiag() {
    await supabase.from('quotes').update({ diagnosis: diag }).eq('id', id)
    setEditDiag(false); carregar()
  }
  async function salvarDesc() {
    await supabase.from('quotes').update({ services_description: desc }).eq('id', id)
    setEditDesc(false); carregar()
  }
  async function salvarValores() {
    const val = parseFloat(String(mao).replace(',','.')) || 0
    const { data: pecasAtuais } = await supabase
      .from('quote_parts').select('quantity, unit_price').eq('quote_id', id)
    const totalPecas = (pecasAtuais||[]).reduce((s,p)=>s+(p.quantity*p.unit_price),0)
    await supabase.from('quotes').update({
      labor_price: val || null,
      total_price: (val + totalPecas) || null,
    }).eq('id', id)
    setEditVal(false); carregar()
  }
  async function salvarPeca() {
    if (!novaPeca.name) return
    const preco = parseFloat(String(novaPeca.unit_price).replace(',','.')) || 0
    await supabase.from('quote_parts').insert({
      quote_id: id, name: novaPeca.name,
      quantity: novaPeca.quantity, unit_price: preco,
    })
    const { data: pecasAtuais } = await supabase
      .from('quote_parts').select('quantity, unit_price').eq('quote_id', id)
    const totalPecas = (pecasAtuais||[]).reduce((s,p)=>s+(p.quantity*p.unit_price),0)
    const maoAtual = parseFloat(orc?.labor_price||0)
    await supabase.from('quotes').update({ total_price: totalPecas + maoAtual || null }).eq('id', id)
    setNovaPeca({name:'',quantity:1,unit_price:''}); setAddPeca(false); carregar()
  }
  async function removerPeca(pid) {
    await supabase.from('quote_parts').delete().eq('id', pid)
    const { data: pecasAtuais } = await supabase
      .from('quote_parts').select('quantity, unit_price').eq('quote_id', id)
    const totalPecas = (pecasAtuais||[]).reduce((s,p)=>s+(p.quantity*p.unit_price),0)
    const maoAtual = parseFloat(orc?.labor_price||0)
    await supabase.from('quotes').update({ total_price: totalPecas + maoAtual || null }).eq('id', id)
    carregar()
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"/></div>
  if (!orc) return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Orçamento não encontrado</div>

  const cli = orc.clients || {}
  const tp = pecas.reduce((s,p)=>s+(p.quantity*p.unit_price),0)
  const maoVal = parseFloat(orc.labor_price||0)
  const total = orc.total_price || (tp + maoVal)
  const discriminar = tp > 0 && maoVal > 0
  const equip = [orc.equipment, orc.brand, orc.model].filter(Boolean).join(' · ')
  const podeEditar = orc.status !== 'aprovado' && orc.status !== 'recusado'

  return (
    <div style={{minHeight:'100dvh', display:'flex', flexDirection:'column', background:'#f9fafb'}}>
      <MobileHeader
        titulo={cli.name || '—'}
        subtitulo={equip}
        voltarPara="/orcamentos"
        acoes={
          <button onClick={() => window.open(`/orcamento/${id}`, '_blank')}
            className="text-xs bg-white/10 text-white px-3 py-1.5 rounded-full font-medium">
            Ver / Enviar
          </button>
        }
        status={
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
            orc.status === 'aprovado' ? 'bg-green-100 text-green-700' :
            orc.status === 'recusado' ? 'bg-red-100 text-red-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>
            {orc.status === 'aprovado' ? 'Aprovado' : orc.status === 'recusado' ? 'Recusado' : 'Pendente'}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 space-y-3 mt-4 pb-6">

          {/* Cliente */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Cliente</span>
            </div>
            <div className="px-4 py-3 space-y-1">
              <p className="text-sm font-semibold text-gray-900">{cli.name}</p>
              {cli.phone && <p className="text-xs text-gray-500">{cli.phone}</p>}
              {equip && <p className="text-xs text-gray-500">{equip}</p>}
              {orc.problem && <p className="text-xs text-gray-400 mt-1">{orc.problem}</p>}
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
                  <textarea value={diag} onChange={e=>setDiag(e.target.value)} rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" autoFocus/>
                  <div className="flex gap-2">
                    <button onClick={salvarDiag} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                    <button onClick={()=>setEditDiag(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                  </div>
                </div>
              ) : <p className="text-sm text-gray-700">{orc.diagnosis || <span className="text-gray-300 italic">Nenhum diagnóstico</span>}</p>}
            </div>
          </div>

          {/* Descrição dos serviços */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Serviços incluídos</span>
              {podeEditar && !editDesc && <button onClick={()=>setEditDesc(true)} className="p-1.5 rounded-lg bg-gray-100"><Edit2 size={14} className="text-gray-500"/></button>}
            </div>
            <div className="px-4 py-3">
              {editDesc ? (
                <div className="space-y-2">
                  <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none" autoFocus/>
                  <div className="flex gap-2">
                    <button onClick={salvarDesc} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                    <button onClick={()=>setEditDesc(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                  </div>
                </div>
              ) : <p className="text-sm text-gray-700">{orc.services_description || <span className="text-gray-300 italic">Nenhuma descrição</span>}</p>}
            </div>
          </div>

          {/* Peças */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Peças</span>
              {podeEditar && <button onClick={()=>setAddPeca(true)} className="flex items-center gap-1 bg-navy/10 text-navy rounded-lg px-2.5 py-1.5 text-xs font-semibold"><Plus size={13}/> Adicionar</button>}
            </div>
            {addPeca && (
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 space-y-2">
                <input value={novaPeca.name} onChange={e=>setNovaPeca(p=>({...p,name:e.target.value}))}
                  placeholder="Nome da peça" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white" autoFocus/>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={novaPeca.quantity} onChange={e=>setNovaPeca(p=>({...p,quantity:parseInt(e.target.value)||1}))}
                    placeholder="Qtd" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"/>
                  <input type="number" value={novaPeca.unit_price} onChange={e=>setNovaPeca(p=>({...p,unit_price:e.target.value}))}
                    placeholder="Valor unitário" step="0.01" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white"/>
                </div>
                <div className="flex gap-2">
                  <button onClick={salvarPeca} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Adicionar</button>
                  <button onClick={()=>{setAddPeca(false);setNovaPeca({name:'',quantity:1,unit_price:''})}}
                    className="px-4 bg-gray-200 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            )}
            <div className="divide-y divide-gray-50">
              {pecas.length === 0
                ? <p className="px-4 py-3 text-sm text-gray-300 italic">Nenhuma peça</p>
                : pecas.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
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
                  <input type="number" value={mao} onChange={e=>setMao(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" step="0.01" placeholder="0,00"/>
                </div>
                <div className="flex gap-2">
                  <button onClick={salvarValores} className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold">Salvar</button>
                  <button onClick={()=>setEditVal(false)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {discriminar && <>
                  <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-600">Peças</span><span className="text-sm font-medium">{fmt(tp)}</span></div>
                  <div className="flex justify-between px-4 py-3"><span className="text-sm text-gray-600">Mão de obra</span><span className="text-sm font-medium">{fmt(maoVal)}</span></div>
                </>}
                <div className="flex justify-between px-4 py-3.5 bg-gray-50">
                  <span className="text-sm font-bold">Total</span>
                  <span className="text-base font-bold text-navy">{fmt(total)}</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
