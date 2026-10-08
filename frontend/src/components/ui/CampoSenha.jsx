import { useState } from 'react'
import { Lock, Eye, EyeOff } from 'lucide-react'

export default function CampoSenha({ comCadeado = false, className = '', ...props }) {
  const [visivel, setVisivel] = useState(false)

  return (
    <div className="relative">
      {comCadeado && (
        <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
      )}

      <input
        {...props}
        type={visivel ? 'text' : 'password'}
        className={`input-base pr-10 ${comCadeado ? 'pl-9' : ''} ${className}`.trim()}
      />

      <button
        type="button"
        onClick={() => setVisivel(v => !v)}
        aria-label={visivel ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visivel}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-controle transition-colors text-cal-3 hover:bg-elevado hover:text-cal"
      >
        {visivel ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
