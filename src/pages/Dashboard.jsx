import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Calendar, ClipboardList, CheckCircle, DollarSign } from 'lucide-react'

export default function Dashboard() {
  const [stats, setStats] = useState({ agendados: 0, emAndamento: 0, concluidosHoje: 0, receber: 0 })

  useEffect(() => {
    async function buscar() {
      const hoje = new Date()
      const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`

      const [{ count: agendados }, { count: emAndamento }, { count: concluidosHoje }] = await Promise.all([
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('status', 'agendado'),
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('status', 'em_andamento'),
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('status', 'concluido').gte('finished_at', hojeStr),
      ])
      const { data: rec } = await supabase.from('receivables').select('amount').eq('status', 'pendente').range(0, 9999)
      const receber = (rec || []).reduce((s, r) => s + Number(r.amount || 0), 0)
      setStats({ agendados: agendados || 0, emAndamento: emAndamento || 0, concluidosHoje: concluidosHoje || 0, receber })
    }
    buscar()
  }, [])

  const cards = [
    { label: 'Agendados', value: stats.agendados, icon: Calendar, color: 'bg-blue-100 text-blue-700' },
    { label: 'Em andamento', value: stats.emAndamento, icon: ClipboardList, color: 'bg-yellow-100 text-yellow-700' },
    { label: 'Concluídos hoje', value: stats.concluidosHoje, icon: CheckCircle, color: 'bg-green-100 text-green-700' },
    { label: 'A receber', value: `R$ ${stats.receber.toFixed(2).replace('.',',')}`, icon: DollarSign, color: 'bg-red-100 text-primary' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4">
        <h1 className="text-lg font-bold text-navy">Dashboard</h1>
        <p className="text-xs text-gray-400 mt-0.5">Visão geral de hoje</p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}>
              <Icon size={20} />
            </div>
            <div className="text-xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
