import { useCallback, useEffect, useState } from 'react'
import { supabase, definirModoObservacao } from '../lib/supabase'
import { AuthContext } from './useAuth'

const SEM_MODULOS = []

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined)
  const [salonInfo, setSalonInfo] = useState({ userId: null, salon: null })
  const [modulosInfo, setModulosInfo] = useState({ salonId: null, modulos: SEM_MODULOS })

  useEffect(() => {
    const manterSeIgual = (nova) => setSession(atual =>
      atual && nova && atual.user?.id === nova.user?.id && atual.access_token === nova.access_token
        ? atual
        : nova
    )

    supabase.auth.getSession().then(({ data: { session } }) => {
      manterSeIgual(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') manterSeIgual(session)
      else setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const userId = session?.user?.id

  useEffect(() => {
    if (!userId) return
    let cancelado = false
    supabase.rpc('salao_atual').then(({ data }) => {
      if (cancelado) return
      setSalonInfo({ userId, salon: data?.salon ?? null, observando: !!data?.observando })
    })
    return () => { cancelado = true }
  }, [userId])

  const salon = userId && salonInfo.userId === userId ? salonInfo.salon : null
  const salonCarregando = !!userId && salonInfo.userId !== userId

  const observando = userId && salonInfo.userId === userId ? !!salonInfo.observando : false

  useEffect(() => { definirModoObservacao(observando) }, [observando])

  const setSalon = useCallback((atualizacao) => {
    setSalonInfo(prev => ({
      ...prev,
      userId: userId ?? prev.userId,
      salon: typeof atualizacao === 'function' ? atualizacao(prev.salon) : atualizacao,
    }))
  }, [userId])

  useEffect(() => {
    const salonId = salon?.id
    if (!salonId) return
    let cancelado = false
    supabase
      .from('salon_modulos')
      .select('*')
      .eq('salon_id', salonId)
      .then(({ data, error }) => {
        if (cancelado) return
        if (error) {
          console.error('Erro ao carregar salon_modulos:', error)
          setModulosInfo({ salonId, modulos: SEM_MODULOS })
          return
        }
        setModulosInfo({ salonId, modulos: data || SEM_MODULOS })
      })
    return () => { cancelado = true }
  }, [salon?.id])

  const modulos = salon && modulosInfo.salonId === salon.id ? modulosInfo.modulos : SEM_MODULOS

  const modulosCarregando =
    salonCarregando ||
    (!!salon && modulosInfo.salonId !== salon.id)

  const moduloLiberado = useCallback((chave) => {
    if (modulosCarregando) return false
    const m = modulos.find(x => x.modulo === chave)
    return !!m && m.disponivel === true && m.ativo === true
  }, [modulos, modulosCarregando])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{
      session, salon, setSalon, signOut, loading: session === undefined,
      salonCarregando, observando, modulos, moduloLiberado, modulosCarregando,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
