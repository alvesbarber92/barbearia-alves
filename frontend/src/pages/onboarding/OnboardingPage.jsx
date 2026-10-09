import { useState, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import { generateSlug, slugReservado } from '../../utils/slug'
import { TERMOS_VERSAO } from '../../legal'
import { useAccent, COR_PADRAO } from '../../hooks/useAccent'
import toast from 'react-hot-toast'
import { mascararTelefone, telefoneValido, MSG_TELEFONE_INVALIDO, propsCampoTelefone } from '../../lib/telefone'
import { TETO_PRECO, MSG_TETO_PRECO } from '../../lib/agenda'
import { Check, Share2 } from 'lucide-react'

const STEPS = ['Dados', 'Visual', 'Serviços']

const COLORS = ['#5FC4DC', '#7FA2F5', '#E8615A', '#A9B4C2', '#E6E0D4', '#C79BF2']

export default function OnboardingPage() {
  const { session, salon, setSalon } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const [edicao, setEdicao] = useState(null)
  const dados = edicao ?? {
    nome: salon?.nome || '',
    slug: salon?.slug || '',
    whatsapp: mascararTelefone(salon?.whatsapp),
  }
  const [corEscolhida, setCorEscolhida] = useState(null)
  const cor = corEscolhida ?? salon?.cor_primaria ?? COR_PADRAO
  useAccent(cor)
  const [servico, setServico] = useState({ nome: '', duracao: '30', preco: '' })

  const handleNomeChange = (e) => {
    const nome = e.target.value
    setEdicao({ ...dados, nome, slug: generateSlug(nome) })
  }

  const saveStep0 = async () => {
    if (!dados.nome) { toast.error('Informe o nome da barbearia'); return }
    if (!telefoneValido(dados.whatsapp)) { toast.error(MSG_TELEFONE_INVALIDO); return }
    const slug = generateSlug(dados.slug) || generateSlug(dados.nome)
    if (!slug) { toast.error('O link precisa ter letras ou números'); return }
    if (slugReservado(slug)) { toast.error('Esse link é usado pelo sistema. Escolha outro.'); return }
    setLoading(true)
    try {
      let salonAtualizado
      if (salon) {
        const { data, error } = await supabase
          .from('salons')
          .update({ nome: dados.nome, slug, whatsapp: dados.whatsapp })
          .eq('id', salon.id)
          .select().single()
        if (error) { toast.error('Erro ao salvar'); return }
        salonAtualizado = data
        setEdicao({ ...dados, slug: data.slug })
      } else {
        if (!session?.user) { toast.error('Sessão inválida, faça login novamente'); return }
        const convite = session.user.user_metadata?.convite
        if (!convite) {
          toast.error('Não encontramos seu convite. Use o link que você recebeu para criar a barbearia.')
          return
        }
        const { data, error } = await supabase.rpc('criar_salao_com_convite', {
          p_nome: dados.nome,
          p_slug: dados.slug || generateSlug(dados.nome),
          p_codigo: convite,
          p_whatsapp: dados.whatsapp,
          p_termos_aceitos_em: session.user.user_metadata?.termos_aceitos_em || new Date().toISOString(),
          p_termos_versao: session.user.user_metadata?.termos_versao || TERMOS_VERSAO,
        })
        if (error) {
          const bruto = String(error.message || '')
          toast.error(
            bruto.includes('convite_expirado') ? 'Seu convite expirou. Peça um novo.'
            : bruto.includes('convite_invalido') ? 'Convite inválido ou já utilizado. Peça um novo.'
            : bruto.includes('ja_tem_salao') ? 'Esta conta já tem uma barbearia.'
            : 'Erro ao criar a barbearia'
          )
          return
        }
        salonAtualizado = Array.isArray(data) ? data[0] : data
        setEdicao({ ...dados, slug: salonAtualizado.slug })
      }
      setSalon(salonAtualizado)
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  const saveStep1 = async () => {
    if (!salon) { toast.error('Aguarde, carregando dados...'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('salons').update({ cor_primaria: cor }).eq('id', salon.id)
      if (error) { toast.error('Erro ao salvar'); return }
      setSalon(s => ({ ...s, cor_primaria: cor }))
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const saveStep2 = async () => {
    if (!servico.nome || !servico.preco) { toast.error('Preencha nome e preço'); return }
    const duracao = parseInt(servico.duracao)
    if (!(duracao >= 5)) { toast.error('Informe o tempo do serviço (mínimo 5 minutos)'); return }
    if (parseFloat(servico.preco) > TETO_PRECO) { toast.error(MSG_TETO_PRECO); return }
    if (!salon) { toast.error('Aguarde, carregando dados...'); return }
    setLoading(true)
    try {
      const { error } = await supabase.from('servicos').insert({
        salon_id: salon.id,
        nome: servico.nome,
        preco: parseFloat(servico.preco),
        duracao,
        ativo: true,
      })
      if (error) { toast.error('Erro ao salvar'); return }
      setDone(true)
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    const url = `${window.location.origin}/${dados.slug}`
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-concreto">
        <div className="card max-w-sm w-full text-center space-y-4 p-8">
          <div className="w-14 h-14 rounded-chapa mx-auto flex items-center justify-center anim-pop bg-ok-fundo">
            <Check size={26} strokeWidth={2.5} className="text-ok" />
          </div>
          <h2 className="font-display text-xl font-semibold text-cal">Sua barbearia está no ar</h2>
          <p className="text-sm text-cal-3">
            Compartilhe o link com seus clientes e receba os primeiros agendamentos:
          </p>
          <div className="rounded-superficie px-4 py-3 text-apoio break-all border bg-elevado text-cal-2 border-junta">
            {url}
          </div>
          <div className="flex flex-col gap-2">
            <a
              href={`https://wa.me/?text=Agende%20seu%20hor%C3%A1rio%20online%3A%20${encodeURIComponent(url)}`}
              target="_blank" rel="noreferrer"
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Share2 size={16} /> Compartilhar no WhatsApp
            </a>
            <button
              onClick={() => navigate(`/${dados.slug}/dashboard`)}
              className="btn-secondary"
            >
              Ir para o Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-concreto">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6 text-micro" aria-label={`Etapa ${step + 1} de 3: ${STEPS[step]}`}>
          {STEPS.map((s, i) => (
            <Fragment key={s}>
              <span className={`inline-flex items-center gap-1 ${i === step ? 'font-semibold text-acento-texto' : i < step ? 'text-cal-2' : 'text-cal-3'}`}>
                {i < step && <Check size={11} aria-hidden />}
                {s}
              </span>
              {i < STEPS.length - 1 && <span aria-hidden className="text-cal-3">›</span>}
            </Fragment>
          ))}
        </div>

        <div className="card space-y-5 p-6">
          {step === 0 && (
            <>
              <h2 className="font-display text-card text-cal">Sobre a sua barbearia</h2>
              <div className="space-y-1">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="onb-nome">Nome da barbearia</label>
                <input id="onb-nome" value={dados.nome} onChange={handleNomeChange} className="input-base" placeholder="Barbearia do Zé" />
              </div>
              <div className="space-y-1">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="onb-slug">Seu link único</label>
                <div className="flex items-center input-base gap-1 py-0 px-0 overflow-hidden">
                  <span className="px-3 py-2 text-apoio border-r whitespace-nowrap bg-elevado text-cal-2 border-junta-forte">
                    seuapp.com.br/
                  </span>
                  <input
                    id="onb-slug"
                    value={dados.slug}
                    onChange={e => setEdicao({ ...dados, slug: e.target.value })}
                    className="flex-1 px-3 py-2 outline-none bg-transparent text-cal"
                    placeholder="barbearia-do-ze"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="onb-whats">WhatsApp</label>
                <input id="onb-whats" {...propsCampoTelefone} value={dados.whatsapp} onChange={e => setEdicao({ ...dados, whatsapp: mascararTelefone(e.target.value) })}
                  className="input-base num" />
              </div>
              <button className="btn-primary w-full" onClick={saveStep0} disabled={loading || !dados.nome}>
                {loading ? 'Salvando...' : 'Continuar'}
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-display text-card text-cal">A cor da sua barbearia</h2>
              <div className="flex gap-3 flex-wrap" role="radiogroup" aria-label="Cor da barbearia">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setCorEscolhida(c)}
                    role="radio" aria-checked={cor === c} aria-label={`Cor ${c}`}
                    className="w-10 h-10 rounded-chapa flex items-center justify-center transition-shadow hover:outline hover:outline-2 hover:outline-offset-2 hover:outline-latao"
                    style={{
                      backgroundColor: c,
                      boxShadow: cor === c ? `0 0 0 2px var(--color-bancada), 0 0 0 4px ${c}` : 'none',
                    }}
                  >
                    {cor === c && <Check size={16} strokeWidth={3} className="text-sobre-acento" />}
                  </button>
                ))}
                <input type="color" value={cor} onChange={e => setCorEscolhida(e.target.value)}
                  className="w-10 h-10 rounded-chapa cursor-pointer border-0" title="Cor personalizada" aria-label="Cor personalizada" />
              </div>

              <div className="rounded-superficie p-4 space-y-3 border border-junta bg-elevado">
                <p className="text-micro font-semibold text-cal-2">Seus clientes verão assim:</p>
                <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
                  <span className="relative num px-3.5 py-1.5 rounded-controle text-apoio font-semibold border border-acento-filete bg-bancada text-cal">
                    09:30
                    <span className="absolute left-0 right-0 bottom-0 h-[3px] rounded-b-controle bg-acento-marca" />
                  </span>
                  <span className="num px-3.5 py-1.5 rounded-controle text-apoio border border-junta-forte text-cal-2 bg-bancada">
                    10:00
                  </span>
                  <span className="num px-3.5 py-1.5 rounded-controle text-apoio border border-junta-forte text-cal-2 bg-bancada">
                    10:30
                  </span>
                </div>
                <div className="btn-primary w-full" aria-hidden="true">Confirmar agendamento</div>
              </div>

              <button className="btn-primary w-full" onClick={saveStep1} disabled={loading}>
                {loading ? 'Salvando...' : 'Continuar'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-card text-cal">Seu primeiro serviço</h2>
              <div className="space-y-1">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="onb-servico">Nome do serviço</label>
                <input id="onb-servico" value={servico.nome} onChange={e => setServico(p => ({ ...p, nome: e.target.value }))}
                  className="input-base" placeholder="Ex: Corte e barba" />
              </div>
              <div className="space-y-1">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="onb-duracao">Tempo (minutos)</label>
                <input id="onb-duracao" type="number" min="5" step="5" value={servico.duracao}
                  onChange={e => setServico(p => ({ ...p, duracao: e.target.value }))}
                  className="input-base num" placeholder="30" />
              </div>
              <div className="space-y-1">
                <label className="text-apoio font-semibold text-cal-2" htmlFor="onb-preco">Preço (R$)</label>
                <input id="onb-preco" type="number" min="0" max="99999.99" step="0.01" value={servico.preco}
                  onChange={e => setServico(p => ({ ...p, preco: e.target.value }))}
                  className="input-base num" placeholder="80.00" />
              </div>
              <button className="btn-primary w-full" onClick={saveStep2} disabled={loading}>
                {loading ? 'Finalizando...' : 'Concluir configuração'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
