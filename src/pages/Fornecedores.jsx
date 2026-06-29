import { useState, useEffect, useRef } from 'react'
import { Search, Plus, X, Save, Edit2, Trash2, Phone, Mail, MapPin, User } from 'lucide-react'
import { supabase } from '../lib/supabase'

const FORM_VAZIO = { name:'', phone:'', email:'', address:'', city:'', notes:'' }

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalNovo, setModalNovo] = useState(false)
  const [formNovo, setFormNovo] = useState(FORM_VAZIO)
  const [salvando, setSalvando] = useState(false)
  const [editando, setEditando] = useState(null)
  const [formEdit, setFormEdit] = useState({})
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const buscaTimeout = useRef(null)

  useEffect(() => {
    if (busca.length === 0) { buscarTodos(); return }
    clearTimeout(buscaTimeout.current)
    buscaTimeout.current = setTimeout(() => buscarPorTermo(busca), 300)
    return () => clearTimeout(buscaTimeout.current)
  }, [busca])

  async function buscarTodos() {
    setLoading(true)
    const { data } = await supabase.from('suppliers')
      .select('*').order('name', { ascending: true }).range(0, 9999)
    setFornecedores(data || [])
    setLoading(false)
  }

  async function buscarPorTermo(termo) {
    setLoading(true)
    const { data } = await supabase.from('suppliers')
      .select('*')
      .or(`name.ilike.%${termo}%,phone.ilike.%${termo}%,email.ilike.%${termo}%`)
      .order('name', { ascending: true }).range(0, 9999)
    setFornecedores(data || [])
    setLoading(false)
  }

  async function criar() {
    if (!formNovo.name.trim()) return alert('Informe o nome.')
    setSalvando(true)
    const { error } = await supabase.from('suppliers').insert({
      name: formNovo.name.trim(),
      phone: formNovo.phone || null,
      email: formNovo.email || null,
      address: formNovo.address || null,
      city: formNovo.city || null,
      notes: formNovo.notes || null,
    })
    setSalvando(false)
    if (error) return alert('Erro: ' + error.message)
    setModalNovo(false)
    setFormNovo(FORM_VAZIO)
    busca ? buscarPorTermo(busca) : buscarTodos()
  }

  async function salvarEdicao(id) {
    setSalvandoEdit(true)
    await supabase.from('suppliers').update({
      name: formEdit.name,
      phone: formEdit.phone || null,
      email: formEdit.email || null,
      address: formEdit.address || null,
      city: formEdit.city || null,
      notes: formEdit.notes || null,
    }).eq('id', id)
    setSalvandoEdit(false)
    setEditando(null)
    busca ? buscarPorTermo(busca) : buscarTodos()
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir o fornecedor "${nome}"?`)) return
    await supabase.from('suppliers').delete().eq('id', id)
    busca ? buscarPorTermo(busca) : buscarTodos()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Fornecedores</h1>
          <button onClick={() => { setFormNovo(FORM_VAZIO); setModalNovo(true) }}
            className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
            <Plus size={13}/> Novo
          </button>
        </div>
        <div className="relative">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou e-mail..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none"/>
          <Search size={15} className="absolute left-3 top-3 text-gray-400"/>
          {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-2.5"><X size={16} className="text-gray-400"/></button>}
        </div>
        <p className="text-xs text-gray-400 mt-2">{fornecedores.length} fornecedor{fornecedores.length !== 1 ? 'es' : ''}</p>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : fornecedores.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum fornecedor encontrado</div>
        ) : fornecedores.map(f => (
          <div key={f.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {editando === f.id ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Editando</span>
                  <button onClick={() => setEditando(null)}><X size={16} className="text-gray-400"/></button>
                </div>
                <input value={formEdit.name} onChange={e => setFormEdit(f=>({...f,name:e.target.value}))}
                  placeholder="Nome *" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                <div className="grid grid-cols-2 gap-2">
                  <input value={formEdit.phone} onChange={e => setFormEdit(f=>({...f,phone:e.target.value}))}
                    placeholder="Telefone" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                  <input value={formEdit.email} onChange={e => setFormEdit(f=>({...f,email:e.target.value}))}
                    placeholder="E-mail" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
                <input value={formEdit.address} onChange={e => setFormEdit(f=>({...f,address:e.target.value}))}
                  placeholder="Endereço" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                <input value={formEdit.city} onChange={e => setFormEdit(f=>({...f,city:e.target.value}))}
                  placeholder="Cidade" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                <textarea value={formEdit.notes} onChange={e => setFormEdit(f=>({...f,notes:e.target.value}))}
                  placeholder="Observações" rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"/>
                <div className="flex gap-2">
                  <button onClick={() => salvarEdicao(f.id)} disabled={salvandoEdit}
                    className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-60">
                    <Save size={14}/>{salvandoEdit ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditando(null)} className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-9 h-9 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={16} className="text-navy"/>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{f.name}</div>
                  {f.phone && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone size={11} className="text-gray-400 flex-shrink-0"/>
                      <span className="text-xs text-gray-500">{f.phone}</span>
                    </div>
                  )}
                  {f.email && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Mail size={11} className="text-gray-400 flex-shrink-0"/>
                      <span className="text-xs text-gray-500 truncate">{f.email}</span>
                    </div>
                  )}
                  {(f.address || f.city) && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-gray-400 flex-shrink-0"/>
                      <span className="text-xs text-gray-400 truncate">{[f.address, f.city].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {f.notes && <p className="text-xs text-gray-400 mt-1 italic">{f.notes}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setEditando(f.id); setFormEdit({ name:f.name||'', phone:f.phone||'', email:f.email||'', address:f.address||'', city:f.city||'', notes:f.notes||'' }) }}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
                    <Edit2 size={14} className="text-gray-500"/>
                  </button>
                  <button onClick={() => excluir(f.id, f.name)}
                    className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition">
                    <Trash2 size={14} className="text-red-500"/>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal novo fornecedor */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-3" style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Novo Fornecedor</h3>
              <button onClick={() => setModalNovo(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <input value={formNovo.name} onChange={e => setFormNovo(f=>({...f,name:e.target.value}))}
              placeholder="Nome *" autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <div className="grid grid-cols-2 gap-2">
              <input value={formNovo.phone} onChange={e => setFormNovo(f=>({...f,phone:e.target.value}))}
                placeholder="Telefone"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              <input value={formNovo.email} onChange={e => setFormNovo(f=>({...f,email:e.target.value}))}
                placeholder="E-mail"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <input value={formNovo.address} onChange={e => setFormNovo(f=>({...f,address:e.target.value}))}
              placeholder="Endereço"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={formNovo.city} onChange={e => setFormNovo(f=>({...f,city:e.target.value}))}
              placeholder="Cidade"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <textarea value={formNovo.notes} onChange={e => setFormNovo(f=>({...f,notes:e.target.value}))}
              placeholder="Observações" rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"/>
            <button onClick={criar} disabled={salvando}
              className="w-full bg-primary text-white rounded-2xl py-4 font-bold disabled:opacity-60">
              {salvando ? 'Salvando...' : 'Cadastrar Fornecedor'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
