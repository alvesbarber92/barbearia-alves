import { X } from 'lucide-react'
import { useEffect } from 'react'
import CamadaModal from './CamadaModal'

export default function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <CamadaModal onFundo={onClose}>
      <div
        className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-bancada border border-junta rounded-superficie shadow-flutua"
        role="dialog" aria-modal="true" aria-label={title}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-junta">
          <h2 className="font-display text-card">{title}</h2>
          <button onClick={onClose} aria-label="Fechar"
            className="p-1.5 rounded-controle text-cal-3 transition-colors hover:bg-elevado hover:text-cal">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </CamadaModal>
  )
}
