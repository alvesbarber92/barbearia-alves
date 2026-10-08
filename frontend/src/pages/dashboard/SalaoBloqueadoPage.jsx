import { Lock, MessageCircle, LogOut } from 'lucide-react'
import { useAuth } from '../../context/useAuth'
import { linkWhatsappSuporte } from '../../lib/contato'

export default function SalaoBloqueadoPage() {
  const { salon, session, signOut } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-concreto">
      <div className="w-full max-w-md">

        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-chapa flex items-center justify-center mx-auto mb-4 bg-danger-fundo">
            <Lock size={24} className="text-danger" />
          </div>
          <h1 className="font-display text-tela text-cal">
            Barbearia bloqueada
          </h1>
          {salon?.nome && (
            <p className="text-apoio mt-1 text-cal-2">{salon.nome}</p>
          )}
        </div>

        <div className="card space-y-5 text-center">
          <p className="text-corpo leading-relaxed text-cal-2">
            O acesso a esta barbearia está temporariamente suspenso. Seus dados continuam
            guardados — nada foi apagado. Entre em contato com o suporte para
            regularizar e liberar o acesso.
          </p>

          <a
            href={linkWhatsappSuporte({ salao: salon?.nome, email: session?.user?.email })}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          >
            <MessageCircle size={17} /> Falar com o suporte
          </a>

          <button onClick={signOut}
            className="text-apoio inline-flex items-center gap-1.5 mx-auto text-cal-2 hover:text-cal transition-colors">
            <LogOut size={14} /> Sair da conta
          </button>
        </div>

      </div>
    </div>
  )
}
