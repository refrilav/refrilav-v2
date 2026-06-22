import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, User, Phone, MapPin, X, Download, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'

function exportarExcel(dados, nomeArquivo) {
  import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs').then(XLSX => {
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, nomeArquivo)
  })
}

const FORM_VAZIO = { name:'', phone:'', address:'', neighborhood:'', city:'' }

export default function Clientes() {
  const navigate = useNavigate()
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalNovo, setModalNovo] = useState(false)
  const [formNovo, setFormNovo] = useState(FORM_VAZIO)
  const [salvandoNovo, setSalvandoNovo] = useState(false)
  const buscaTimeout = useRef(null)

  useEffect(() => {
    if (busca.length === 0) { buscarTodos(); return }
    clearTimeout(buscaTimeout.current)
    buscaTimeout.current = setTimeout(() => buscarPorTermo(busca), 300)
    return () => clearTimeout(buscaTimeout.current)
  }, [busca])

  async function buscarTodos() {
    setLoading(true)
    const { data } = await supabase.from('clients')
      .select('id, name, phone, address, neighborhood, city')
      .order('name', { ascending: true }).range(0, 9999)
    setClientes(data || [])
    setLoading(false)
  }

  async function buscarPorTermo(termo) {
    setLoading(true)
    const { data } = await supabase.from('clients')
      .select('id, name, phone, address, neighborhood, city')
      .or(`name.ilike.%${termo}%,phone.ilike.%${termo}%,address.ilike.%${termo}%,neighborhood.ilike.%${termo}%`)
      .order('name', { ascending: true }).range(0, 9999)
    setClientes(data || [])
    setLoading(false)
  }

  async function criarCliente() {
    if (!formNovo.name.trim()) return alert('Informe o nome do cliente.')
    setSalvandoNovo(true)
    await supabase.from('clients').insert({
      name: formNovo.name.trim(),
      phone: formNovo.phone || null,
      address: formNovo.address || null,
      neighborhood: formNovo.neighborhood || null,
      city: formNovo.city || null,
    })
    setSalvandoNovo(false)
    setModalNovo(false)
    setFormNovo(FORM_VAZIO)
    busca ? buscarPorTermo(busca) : buscarTodos()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Clientes</h1>
          <div className="flex gap-2">
            <button onClick={() => { setFormNovo(FORM_VAZIO); setModalNovo(true) }}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Plus size={13}/> Novo
            </button>
            <button onClick={() => exportarExcel(clientes.map(c => ({
              Nome: c.name||'', Telefone: c.phone||'', Endereço: c.address||'',
              Bairro: c.neighborhood||'', Cidade: c.city||'',
            })), 'clientes.xlsx')}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">
              <Download size={13}/> Excel
            </button>
          </div>
        </div>
        <div className="relative">
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou endereço..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none"/>
          <Search size={15} className="absolute left-3 top-3 text-gray-400"/>
          {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-2.5"><X size={16} className="text-gray-400"/></button>}
        </div>
        <p className="text-xs text-gray-400 mt-2">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum cliente encontrado</div>
        ) : clientes.map(c => (
          <div key={c.id} onClick={() => navigate(`/clientes/${c.id}`)}
            className="bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer active:scale-[0.99] transition">
            <div className="flex items-start gap-3 px-4 py-3">
              <div className="w-9 h-9 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <User size={16} className="text-navy"/>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                {c.phone && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone size={11} className="text-gray-400 flex-shrink-0"/>
                    <span className="text-xs text-gray-500 truncate">{c.phone}</span>
                  </div>
                )}
                {(c.address || c.neighborhood || c.city) && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin size={11} className="text-gray-400 flex-shrink-0"/>
                    <span className="text-xs text-gray-400 truncate">
                      {[c.address, c.neighborhood, c.city].filter(Boolean).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              <div className="text-gray-300 flex-shrink-0 mt-1">›</div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal novo cliente */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4" style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Novo Cliente</h3>
              <button onClick={() => setModalNovo(false)}><X size={20} className="text-gray-400"/></button>
            </div>
            <input value={formNovo.name} onChange={e => setFormNovo(f=>({...f,name:e.target.value}))}
              placeholder="Nome *" autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={formNovo.phone} onChange={e => setFormNovo(f=>({...f,phone:e.target.value}))}
              placeholder="Telefone"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <input value={formNovo.address} onChange={e => setFormNovo(f=>({...f,address:e.target.value}))}
              placeholder="Endereço"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            <div className="grid grid-cols-2 gap-2">
              <input value={formNovo.neighborhood} onChange={e => setFormNovo(f=>({...f,neighborhood:e.target.value}))}
                placeholder="Bairro"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              <input value={formNovo.city} onChange={e => setFormNovo(f=>({...f,city:e.target.value}))}
                placeholder="Cidade"
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
            </div>
            <button onClick={criarCliente} disabled={salvandoNovo}
              className="w-full bg-primary text-white rounded-2xl py-4 font-bold disabled:opacity-60">
              {salvandoNovo ? 'Salvando...' : 'Cadastrar Cliente'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
