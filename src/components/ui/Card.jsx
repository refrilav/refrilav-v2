// Card de conteúdo reutilizável
export default function Card({ children, className = '', title, action }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          {title && <h2 className="font-semibold text-navy text-base">{title}</h2>}
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={title || action ? 'p-5' : 'p-5'}>
        {children}
      </div>
    </div>
  )
}
