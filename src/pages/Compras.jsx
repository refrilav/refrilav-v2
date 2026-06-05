import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Search, ChevronRight, Upload, FileText, X, Trash2 } from 'lucide-react'

function fmt(v) {
  if (!v && v !== 0) return 'R$ 0,00'
  return 'R$ ' + Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}
function fmtData(s) {
  if (!s) return '—'
  const p = s.substring(0,10).split('-')
  return `${p[2]}/${p[1]}/${p[0]}`
}

// Parser XML da NF-e
function parseNFe(xmlText) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const get = (el, tag) => el?.getElementsByTagName(tag)?.[0]?.textContent || ''

  const ide = doc.getElementsByTagName('ide')[0]
  const emit = doc.getElementsByTagName('emit')[0]
  const total = doc.getElementsByTagName('ICMSTot')[0]

  const chave = get(doc, 'chNFe') || doc.getElementsByTagName('infNFe')[0]?.getAttribute('Id')?.replace('NFe','') || ''
  const numero = get(ide, 'nNF')
  const dataEmissao = get(ide, 'dhEmi') || get(ide, 'dEmi')
  const fornecedorNome = get(emit, 'xNome')
  const fornecedorCnpj = get(emit, 'CNPJ')
  const valorTotal = parseFloat(get(total, 'vNF') || '0')

  const dets = Array.from(doc.getElementsByTagName('det'))
  const produtos = dets.map(det => {
    const prod = det.getElementsByTagName('prod')[0]
    return {
      code: get(prod, 'cProd'),
      name: get(prod, 'xProd'),
      ncm: get(prod, 'NCM'),
      ean: get(prod, 'cEAN'),
      unit: get(prod, 'uCom'),
      quantity: parseFloat(get(prod, 'qCom') || '0'),
      unit_price: parseFloat(get(prod, 'vUnCom') || '0'),
      total_price: parseFloat(get(prod, 'vProd') || '0'),
    }
  })

  return { chave, numero, dataEmissao: dataEmissao?.substring(0,10), fornecedorNome, fornecedorCnpj, valorTotal, produtos }
}

export default function Compras() {
  const navigate = useNavigate()
  const [compras, setCompras] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalImport, setModalImport] = useState(false)
  const [chaveNFe, setChaveNFe] = useState('')
  const [xmlData, setXmlData] = useState(null)
  const [erroImport, setErroImport] = useState('')
  const fileRef = useRef()

  useEffect(() => { carregar() }, [])

  async function carregar() {
    setLoading(true)
    const { data } = await supabase
      .from('purchases')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 9999)
    setCompras(data || [])
    setLoading(false)
  }

  function handleXmlUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseNFe(ev.target.result)
        if (!parsed.fornecedorNome) throw new Error('XML inválido ou não reconhecido')
        setXmlData(parsed)
        setErroImport('')
      } catch (err) {
        setErroImport('Arquivo XML inválido: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  async function buscarPorChave() {
    if (chaveNFe.length !== 44) return setErroImport('A chave deve ter 44 dígitos.')
    setErroImport('Buscando...')
    try {
      const res = await fetch(`https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&tipoConteudo=7PhJ+gAVw2g=&nfe=${chaveNFe}`)
      setErroImport('Consulta por chave não disponível neste ambiente. Use o upload do XML.')
    } catch {
      setErroImport('Não foi possível consultar a SEFAZ. Use o upload do XML.')
    }
  }

  function irParaConciliacao() {
    if (!xmlData) return
    navigate('/compras/conciliacao', { state: { nfeData: xmlData } })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-navy">Compras</h1>
          <div className="flex gap-2">
            <button onClick={() => setModalImport(true)}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-xl text-sm font-semibold">
              <Upload size={15}/> Importar NF-e
            </button>
            <button onClick={() => navigate('/compras/nova')}
              className="flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl text-sm font-semibold">
              <Plus size={15}/> Manual
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin"/></div>
        ) : compras.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={40} className="text-gray-200 mx-auto mb-3"/>
            <p className="text-gray-400 text-sm">Nenhuma compra registrada</p>
            <p className="text-gray-300 text-xs mt-1">Importe uma NF-e ou adicione manualmente</p>
          </div>
        ) : compras.map(c => (
          <div key={c.id} onClick={() => navigate(`/compras/${c.id}`)}
            className="bg-white rounded-2xl p-4 shadow-sm cursor-pointer active:scale-[0.99] transition">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.supplier_name || '—'}</p>
                {c.nfe_number && <p className="text-xs text-gray-400 mt-0.5">NF-e {c.nfe_number}</p>}
                <p className="text-xs text-gray-400 mt-0.5">{fmtData(c.purchase_date)}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="text-base font-bold text-navy">{fmt(c.total_value)}</p>
                <ChevronRight size={16} className="text-gray-300"/>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal importar NF-e */}
      {modalImport && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-navy">Importar NF-e</h3>
              <button onClick={() => { setModalImport(false); setXmlData(null); setChaveNFe(''); setErroImport('') }}>
                <X size={20} className="text-gray-400"/>
              </button>
            </div>

            {/* Upload XML */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-2 block">Upload do arquivo XML</label>
              <button onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-primary transition">
                <Upload size={24} className="text-gray-300 mx-auto mb-2"/>
                <p className="text-sm text-gray-500">Clique para selecionar o arquivo XML da NF-e</p>
              </button>
              <input ref={fileRef} type="file" accept=".xml" className="hidden" onChange={handleXmlUpload}/>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100"/>
              <span className="text-xs text-gray-400">ou</span>
              <div className="flex-1 h-px bg-gray-100"/>
            </div>

            {/* Chave de acesso */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Chave de acesso (44 dígitos)</label>
              <div className="flex gap-2">
                <input value={chaveNFe} onChange={e => setChaveNFe(e.target.value.replace(/\D/g,'').substring(0,44))}
                  placeholder="00000000000000000000000000000000000000000000"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-primary font-mono"/>
                <button onClick={buscarPorChave}
                  className="bg-blue-600 text-white px-3 rounded-xl text-sm font-semibold">Buscar</button>
              </div>
              <p className="text-xs text-gray-400 mt-1">{chaveNFe.length}/44 dígitos</p>
            </div>

            {erroImport && (
              <p className={`text-sm rounded-xl px-3 py-2 ${erroImport.startsWith('Buscando') ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                {erroImport}
              </p>
            )}

            {/* Preview da NF-e */}
            {xmlData && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-bold text-green-800">✓ NF-e lida com sucesso!</p>
                <div className="space-y-1 text-xs text-green-700">
                  <p><strong>Fornecedor:</strong> {xmlData.fornecedorNome}</p>
                  <p><strong>NF-e:</strong> {xmlData.numero} — Chave: {xmlData.chave?.substring(0,20)}...</p>
                  <p><strong>Data:</strong> {fmtData(xmlData.dataEmissao)}</p>
                  <p><strong>Produtos:</strong> {xmlData.produtos.length} itens</p>
                  <p><strong>Total:</strong> {fmt(xmlData.valorTotal)}</p>
                </div>
                <button onClick={irParaConciliacao}
                  className="w-full bg-green-600 text-white rounded-xl py-3 font-bold text-sm mt-2">
                  Avançar para Conciliação →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
