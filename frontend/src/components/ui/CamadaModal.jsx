import { createPortal } from 'react-dom'

export default function CamadaModal({ onFundo, className = '', children }) {
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-piche/80 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] ${className}`}
      onClick={e => e.target === e.currentTarget && onFundo?.()}
    >
      {children}
    </div>,
    document.body,
  )
}
