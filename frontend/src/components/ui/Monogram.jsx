import { useState } from 'react'

export default function Monogram({ nome, logoUrl, size = 'sm' }) {
  const [urlQueFalhou, setUrlQueFalhou] = useState(null)
  const letra = (nome || 'B').trim().charAt(0).toUpperCase()
  const caixas = {
    sm: 'w-9 h-9',
    md: 'w-12 h-12',
    lg: 'w-20 h-20',
  }
  const textos = {
    sm: 'text-apoio',
    md: 'text-card',
    lg: 'text-grande',
  }

  if (logoUrl && logoUrl !== urlQueFalhou) {
    return (
      <img
        src={logoUrl}
        alt=""
        aria-hidden="true"
        onError={() => setUrlQueFalhou(logoUrl)}
        className={`${caixas[size]} rounded-chapa border border-junta bg-bancada object-contain flex-shrink-0`}
      />
    )
  }

  return (
    <div
      className={`${caixas[size]} ${textos[size]} rounded-chapa border border-acento-filete bg-acento/15 text-acento-texto font-display flex items-center justify-center flex-shrink-0`}
      aria-hidden="true"
    >
      {letra}
    </div>
  )
}
