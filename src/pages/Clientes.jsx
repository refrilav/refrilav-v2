import { useState, useEffect, useRef } from 'react'
import { Search, User, Phone, MapPin, Edit2, Trash2, X, Save, Download } from 'lucide-react'
import { supabase } from '../lib/supabase'

function exportarExcel(dados, nomeArquivo) {
  import('https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs').then(XLSX => {
    const ws = XLSX.utils.json_to_sheet(dados)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Dados')
    XLSX.writeFile(wb, nomeArquivo)
  })
}

export default function Clientes() {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(false)
  const [editando, setEditando] = useState(null) // cliente sendo editado
  const [form, setForm] = useState({})
  const [salvando, setSalvando] = useState(false)
  const buscaTimeout = useRef(null)

  useEffect(() => {
    if (busca.length === 0) {
      buscarTodos()
      return
    }
    clearTimeout(buscaTimeout.current)
    buscaTimeout.current = setTimeout(() => buscarPorTermo(busca), 300)
    return () => clearTimeout(buscaTimeout.current)
  }, [busca])

  async function buscarTodos() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, address, neighborhood, city')
      .order('name', { ascending: true })
      .range(0, 9999)
    setClientes(data || [])
    setLoading(false)
  }

  async function buscarPorTermo(termo) {
    setLoading(true)
    // Busca por nome, telefone ou endereço
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, address, neighborhood, city')
      .or(`name.ilike.%${termo}%,phone.ilike.%${termo}%,address.ilike.%${termo}%,neighborhood.ilike.%${termo}%`)
      .order('name', { ascending: true })
      .range(0, 9999)
    setClientes(data || [])
    setLoading(false)
  }

  function abrirEdicao(c) {
    setEditando(c.id)
    setForm({ name: c.name || '', phone: c.phone || '', address: c.address || '', neighborhood: c.neighborhood || '', city: c.city || '' })
  }

  async function salvarEdicao(id) {
    setSalvando(true)
    await supabase.from('clients').update({
      name: form.name,
      phone: form.phone,
      address: form.address,
      neighborhood: form.neighborhood,
      city: form.city,
    }).eq('id', id)
    setSalvando(false)
    setEditando(null)
    busca ? buscarPorTermo(busca) : buscarTodos()
  }

  async function excluir(id, nome) {
    if (!window.confirm(`Excluir o cliente "${nome}"? Esta ação não pode ser desfeita.`)) return
    await supabase.from('clients').delete().eq('id', id)
    busca ? buscarPorTermo(busca) : buscarTodos()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 safe-top sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Clientes</h1>
          <button
            onClick={() => exportarExcel(clientes.map(c => ({
              Nome: c.name || '',
              Telefone: c.phone || '',
              Endereço: c.address || '',
              Bairro: c.neighborhood || '',
              Cidade: c.city || '',
            })), 'clientes.xlsx')}
            className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Download size={13} /> Excel
          </button>
        </div>
        <div className="relative">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, telefone ou endereço..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Search size={15} className="absolute left-3 top-3 text-gray-400" />
          {busca && (
            <button onClick={() => setBusca('')} className="absolute right-3 top-2.5">
              <X size={16} className="text-gray-400" />
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">{clientes.length} cliente{clientes.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Lista */}
      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Nenhum cliente encontrado</div>
        ) : clientes.map(c => (
          <div key={c.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {editando === c.id ? (
              /* Formulário de edição */
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Editando</span>
                  <button onClick={() => setEditando(null)}><X size={16} className="text-gray-400" /></button>
                </div>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                  placeholder="Nome" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                <input value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                  placeholder="Telefone" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                <input value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))}
                  placeholder="Endereço" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.neighborhood} onChange={e => setForm(f => ({...f, neighborhood: e.target.value}))}
                    placeholder="Bairro" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                  <input value={form.city} onChange={e => setForm(f => ({...f, city: e.target.value}))}
                    placeholder="Cidade" className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary" />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => salvarEdicao(c.id)} disabled={salvando}
                    className="flex-1 bg-primary text-white rounded-xl py-2.5 text-sm font-semibold flex items-center justify-center gap-1 disabled:opacity-60">
                    <Save size={14} /> {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button onClick={() => setEditando(null)}
                    className="px-4 bg-gray-100 text-gray-600 rounded-xl py-2.5 text-sm">Cancelar</button>
                </div>
              </div>
            ) : (
              /* Visualização */
              <div className="flex items-start gap-3 px-4 py-3">
                <div className="w-9 h-9 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={16} className="text-navy" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
                  {c.phone && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone size={11} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-500 truncate">{c.phone}</span>
                    </div>
                  )}
                  {(c.address || c.neighborhood || c.city) && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <MapPin size={11} className="text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400 truncate">
                        {[c.address, c.neighborhood, c.city].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => abrirEdicao(c)}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
                    <Edit2 size={14} className="text-gray-500" />
                  </button>
                  <button onClick={() => excluir(c.id, c.name)}
                    className="p-2 rounded-lg bg-red-50 hover:bg-red-100 transition">
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
