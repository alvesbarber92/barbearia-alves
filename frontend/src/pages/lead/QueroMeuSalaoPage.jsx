import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Check, ArrowLeft } from 'lucide-react'
import { linkWhatsappInteresse } from '../../lib/contato'

const beneficios = [
  'Agenda online com link próprio da sua barbearia',
  'Ficha dos clientes e histórico de atendimentos',
  'Financeiro do mês sem planilha',
]

export default function QueroMeuSalaoPage() {
  const [dados, setDados] = useState({ nome: '', salao: '' })

  const handle = (e) => setDados(p => ({ ...p, [e.target.name]: e.target.value }))

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-concreto">
      <div className="w-full max-w-md">

        <div className="text-center mb-6">
          <img src="/logo.png" alt="" className="w-11 h-11 mx-auto mb-4" />
          <p className="text-apoio font-semibold text-cal-2">BarberVez</p>
          <h1 className="font-display text-tela mt-1">
            Quero minha barbearia no sistema
          </h1>
          <p className="text-apoio text-cal-2 mt-2">
            A gente abre a conta da sua barbearia para você. Chame no WhatsApp e
            explicamos como funciona — sem compromisso.
          </p>
        </div>

        <div className="card space-y-5">

          <ul className="space-y-2.5">
            {beneficios.map(texto => (
              <li key={texto} className="flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-chapa bg-gelo/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check size={11} className="text-gelo" />
                </div>
                <span className="text-apoio text-cal-2">{texto}</span>
              </li>
            ))}
          </ul>

          <div className="h-px bg-junta" />

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="lead-nome">
                Seu nome <span className="text-cal-3">(opcional)</span>
              </label>
              <input id="lead-nome" name="nome" value={dados.nome} onChange={handle}
                className="input-base" placeholder="Como podemos te chamar?" autoComplete="name" />
            </div>
            <div className="space-y-1">
              <label className="text-apoio font-semibold text-cal-2" htmlFor="lead-salao">
                Nome da barbearia <span className="text-cal-3">(opcional)</span>
              </label>
              <input id="lead-salao" name="salao" value={dados.salao} onChange={handle}
                className="input-base" placeholder="Ex.: Barbearia do Zé" />
            </div>
          </div>

          <a
            href={linkWhatsappInteresse(dados)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full"
          >
            <MessageCircle size={17} /> Chamar no WhatsApp
          </a>

          <p className="text-micro text-center text-cal-2">
            Abre a conversa com a mensagem pronta. Você revisa antes de enviar.
          </p>
        </div>

        <div className="mt-5 text-center text-sm">
          <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-cal-2 hover:text-cal transition-colors">
            <ArrowLeft size={14} /> Voltar para o login
          </Link>
        </div>

      </div>
    </div>
  )
}
