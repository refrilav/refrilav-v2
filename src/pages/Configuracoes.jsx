import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Save, Plus, Trash2, Eye, EyeOff, Building2, Users, FileText } from 'lucide-react'

export default function Configuracoes() {
  const [aba, setAba] = useState('empresa')
  const [empresa, setEmpresa] = useState({ company_name:'', phone:'', address:'', cnpj:'', quote_text:'' })
  const [logoUrl, setLogoUrl] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [salvoOk, setSalvoOk] = useState(false)
  const fileRef = useRef()

  // Usuários
  const [usuarios, setUsuarios] = useState([])
  const [novoEmail, setNovoEmail] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [novoNome, setNovoNome] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [criandoUser, setCriandoUser] = useState(false)

  useEffect(() => { carregarEmpresa(); carregarUsuarios() }, [])

  async function carregarEmpresa() {
    const { data } = await supabase.from('settings').select('*').single()
    if (data) setEmpresa({
      company_name: data.company_name || '',
      phone: data.phone || '',
      address: data.address || '',
      cnpj: data.cnpj || '',
      quote_text: data.quote_text || '',
    })
  }

  async function carregarUsuarios() {
    const { data } = await supabase.auth.admin?.listUsers?.() || {}
    if (data?.users) setUsuarios(data.users)
  }

  async function salvarEmpresa() {
    setSalvando(true)
    const { data: existing } = await supabase.from('settings').select('id').single()
    if (existing) {
      await supabase.from('settings').update(empresa).eq('id', existing.id)
    } else {
      await supabase.from('settings').insert(empresa)
    }
    setSalvando(false)
    setSalvoOk(true)
    setTimeout(() => setSalvoOk(false), 2000)
  }

  async function criarUsuario() {
    if (!novoEmail || !novaSenha) return alert('Preencha e-mail e senha.')
    setCriandoUser(true)
    const { error } = await supabase.auth.signUp({
      email: novoEmail,
      password: novaSenha,
      options: { data: { name: novoNome } }
    })
    setCriandoUser(false)
    if (error) return alert('Erro: ' + error.message)
    alert(`Usuário ${novoEmail} criado! Ele receberá um e-mail de confirmação.`)
    setNovoEmail(''); setNovaSenha(''); setNovoNome('')
  }

  const ABAS = [
    { id: 'empresa', label: 'Empresa', icon: Building2 },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'orcamento', label: 'Orçamento', icon: FileText },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-navy mb-3">Configurações</h1>
        <div className="flex gap-1">
          {ABAS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setAba(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                aba === id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={15}/>{label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg">

        {/* ABA EMPRESA */}
        {aba === 'empresa' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-bold text-navy">Dados da Empresa</h2>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nome da empresa</label>
                <input value={empresa.company_name} onChange={e => setEmpresa(f=>({...f,company_name:e.target.value}))}
                  placeholder="Ex: Refrilav Assistência Técnica"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">CNPJ</label>
                  <input value={empresa.cnpj} onChange={e => setEmpresa(f=>({...f,cnpj:e.target.value}))}
                    placeholder="00.000.000/0000-00"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Telefone</label>
                  <input value={empresa.phone} onChange={e => setEmpresa(f=>({...f,phone:e.target.value}))}
                    placeholder="(51) 99999-9999"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Endereço</label>
                <input value={empresa.address} onChange={e => setEmpresa(f=>({...f,address:e.target.value}))}
                  placeholder="Rua, número, bairro, cidade"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>

              <button onClick={salvarEmpresa} disabled={salvando}
                className={`w-full rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition ${
                  salvoOk ? 'bg-green-600 text-white' : 'bg-primary text-white disabled:opacity-60'
                }`}>
                <Save size={16}/>
                {salvando ? 'Salvando...' : salvoOk ? '✓ Salvo!' : 'Salvar dados da empresa'}
              </button>
            </div>
          </div>
        )}

        {/* ABA USUÁRIOS */}
        {aba === 'usuarios' && (
          <div className="space-y-4">
            {/* Criar novo usuário */}
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-bold text-navy">Adicionar Usuário</h2>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Nome</label>
                <input value={novoNome} onChange={e => setNovoNome(e.target.value)}
                  placeholder="Ex: João Técnico"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">E-mail *</label>
                <input type="email" value={novoEmail} onChange={e => setNovoEmail(e.target.value)}
                  placeholder="tecnico@refrilav.com.br"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary"/>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Senha *</label>
                <div className="relative">
                  <input type={mostrarSenha ? 'text' : 'password'} value={novaSenha} onChange={e => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary pr-10"/>
                  <button onClick={() => setMostrarSenha(!mostrarSenha)} className="absolute right-3 top-3">
                    {mostrarSenha ? <EyeOff size={16} className="text-gray-400"/> : <Eye size={16} className="text-gray-400"/>}
                  </button>
                </div>
              </div>
              <button onClick={criarUsuario} disabled={criandoUser}
                className="w-full bg-navy text-white rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                <Plus size={16}/>
                {criandoUser ? 'Criando...' : 'Criar Usuário'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                O usuário receberá um e-mail de confirmação para ativar o acesso.
              </p>
            </div>
          </div>
        )}

        {/* ABA ORÇAMENTO */}
        {aba === 'orcamento' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-bold text-navy">Texto Padrão do Orçamento</h2>
              <p className="text-xs text-gray-400">Este texto aparecerá na seção "Serviços incluídos" dos orçamentos enviados ao cliente.</p>
              <textarea
                value={empresa.quote_text}
                onChange={e => setEmpresa(f=>({...f,quote_text:e.target.value}))}
                rows={6}
                placeholder="Ex: Serviço inclui mão de obra especializada, garantia de 90 dias nas peças substituídas e deslocamento na cidade de Santa Cruz do Sul."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-none"/>
              <button onClick={salvarEmpresa} disabled={salvando}
                className={`w-full rounded-2xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 transition ${
                  salvoOk ? 'bg-green-600 text-white' : 'bg-primary text-white disabled:opacity-60'
                }`}>
                <Save size={16}/>
                {salvando ? 'Salvando...' : salvoOk ? '✓ Salvo!' : 'Salvar'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
