// Funções utilitárias usadas em todo o sistema

// Formata valor em reais
export const formatCurrency = (value) => {
  if (!value && value !== 0) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

// Formata data para exibição
export const formatDate = (date) => {
  if (!date) return '—'
  // Ler direto da string para evitar conversão de fuso UTC
  const s = String(date)
  if (s.length >= 10) {
    const [ano, mes, dia] = s.substring(0, 10).split('-')
    return `${dia}/${mes}/${ano}`
  }
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date))
}

// Formata data e hora
export const formatDateTime = (date) => {
  if (!date) return '—'
  // Ler direto da string para evitar conversão de fuso UTC
  const s = String(date)
  if (s.length >= 16) {
    const [ano, mes, dia] = s.substring(0, 10).split('-')
    const hora = s.substring(11, 16)
    return `${dia}/${mes}/${ano} ${hora}`
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date))
}

// Formata telefone para WhatsApp (remove caracteres especiais)
export const phoneToWhatsApp = (phone) => {
  return phone?.replace(/\D/g, '') || ''
}

// Abre WhatsApp com mensagem
export const openWhatsApp = (phone, message = '') => {
  const number = phoneToWhatsApp(phone)
  const text = encodeURIComponent(message)
  window.open(`https://wa.me/55${number}?text=${text}`, '_blank')
}

// Gera token aleatório seguro
export const generateToken = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// Status do funil com cores
export const STATUS_FUNIL = {
  'Lead Novo': { color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  'Primeiro Contato Feito': { color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-400' },
  'Agendado': { color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
  'Orçamento Enviado': { color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400' },
  'Orçamento Aprovado': { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  'Serviço Aprovado': { color: 'bg-teal-100 text-teal-700', dot: 'bg-teal-400' },
  'Em Execução': { color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-400' },
  'Finalizado': { color: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
  'Pós-venda Enviado': { color: 'bg-purple-100 text-purple-700', dot: 'bg-purple-400' },
  'Próxima Manutenção Agendada': { color: 'bg-pink-100 text-pink-700', dot: 'bg-pink-400' },
}

// Tipos de equipamento
export const EQUIPAMENTOS = [
  'Ar-condicionado', 'Lavadora', 'Lava e Seca', 'Secadora', 'Bebedouro', 'Forno', 'Micro-ondas'
]

// Tipos de serviço
export const TIPOS_SERVICO = [
  'Instalação', 'Manutenção Preventiva', 'Reparo', 'Higienização', 'Orçamento'
]

// Origens de lead
export const ORIGENS = [
  'WhatsApp', 'Google Ads', 'Meta Ads', 'Indicação', 'Cliente Antigo', 'Instagram'
]

// Formas de pagamento
export const FORMAS_PAGAMENTO = [
  'Dinheiro', 'PIX', 'Cartão Crédito', 'Cartão Débito', 'Parcelado'
]
