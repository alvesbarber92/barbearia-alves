import { useCallback, useEffect, useRef, useState } from 'react'

const ESPERA_MS = 3500

export function useConfirmacao(espera = ESPERA_MS) {
  const [armado, setArmado] = useState(null)
  const timer = useRef(null)

  const limpar = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => limpar, [limpar])

  const armar = useCallback((id) => {
    setArmado(id)
    limpar()
    timer.current = setTimeout(() => setArmado(null), espera)
  }, [espera, limpar])

  const desarmar = useCallback(() => {
    limpar()
    setArmado(null)
  }, [limpar])

  return { armado, armar, desarmar }
}
