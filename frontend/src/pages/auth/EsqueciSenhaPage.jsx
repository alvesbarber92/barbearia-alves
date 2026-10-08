import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { caminhoInterno } from '../../lib/destinoAposLogin'
import TelaAcesso from '../../components/ui/TelaAcesso'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'

export default function EsqueciSenhaPage() {
  const { state } = useLocation()
  const voltar = caminhoInterno(state?.voltar)
  const [email, setEmail] = useState(state?.email ?? '')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const destino = new URL('/redefinir-senha', window.location.origin)
    if (voltar) destino.searchParams.set('voltar', voltar)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: destino.toString(),
    })
    setLoading(false)

    if (error) {
      console.error('[esqueci-senha]', error)
      if (error.status === 429) {
        toast.error('Muitos pedidos seguidos. Espere alguns minutos e tente de novo.')
      } else {
        toast.error('Não foi possível enviar o e-mail. Tente novamente.')
      }
      return
    }

    setEnviado(true)
  }

  return (
    <TelaAcesso>
      {enviado ? (
        <div role="status">
          <h1 className="font-display text-tela">Confira seu e-mail</h1>
          <p className="text-apoio text-cal-2 mt-2">
            Se existir uma conta com{' '}
            <span className="font-semibold text-cal break-all">{email.trim()}</span>,
            enviamos um link para criar uma senha nova.
          </p>
          <p className="text-apoio text-cal-2 mt-3">
            Não chegou em alguns minutos? Veja a caixa de spam ou peça de novo.
          </p>
          <button type="button" className="btn-secondary w-full mt-6" onClick={() => setEnviado(false)}>
            Pedir de novo
          </button>
        </div>
      ) : (
        <>
          <h1 className="font-display text-tela">Esqueceu a senha?</h1>
          <p className="text-apoio text-cal-2 mt-1 mb-6">
            Informe o e-mail da conta. Enviamos um link para você criar uma senha nova.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="esqueci-email">E-mail</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
                <input
                  id="esqueci-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="input-base pl-9" placeholder="seu@email.com"
                  autoComplete="email" required
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar link'}
            </button>
          </form>
        </>
      )}

      <p className="mt-5 text-center text-apoio text-cal-2">
        <Link to={voltar ?? '/login'} className="font-semibold text-gelo">
          Voltar para o login
        </Link>
      </p>
    </TelaAcesso>
  )
}
