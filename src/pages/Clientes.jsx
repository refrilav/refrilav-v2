import { useState, useEffect } from 'react'
import { Search, User, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Clientes() {
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (busca.length < 2) { setClientes([]); return }
    const t = setTimeout(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('clients')
        .select('id, name, phone, neighborhood, city')
        .ilike('name', `%${busca}%`)
        .range(0, 29)
      setClientes(data || [])
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busca])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 safe-top sticky top-0 z-10">
        <h1 className="text-lg font-bold text-navy mb-3">Clientes</h1>
        <div className="relative">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar cliente..."
            className="w-full bg-gray-100 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Search size={15} className="absolute left-3 top-3 text-gray-400" />
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {busca.length < 2 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Digite o nome para buscar</div>
        ) : loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clientes.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Nenhum cliente encontrado</div>
        ) : clientes.map(c => (
          <div key={c.id} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 bg-navy/10 rounded-full flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-navy" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-900 truncate">{c.name}</div>
              <div className="text-xs text-gray-400">
                {[c.phone, c.neighborhood, c.city].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
