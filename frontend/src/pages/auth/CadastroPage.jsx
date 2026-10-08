import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/useAuth'
import { generateSlug, slugReservado } from '../../utils/slug'
import { AceiteTermos } from '../../components/AvisoLegal'
import { TERMOS_VERSAO } from '../../legal'
import CampoSenha from '../../components/ui/CampoSenha'
import { Check, X, Ticket } from 'lucide-react'
import toast from 'react-hot-toast'

const ERROS = {
  convite_invalido: 'Convite inválido ou já utilizado. Peça um novo.',
  convite_expirado: 'Este convite expirou. Peça um novo.',
  ja_tem_salao:     'Esta conta já tem uma barbearia.',
  nome_obrigatorio: 'Informe o nome da barbearia.',
  slug_obrigatorio: 'Informe o nome da barbearia.',
  slug_reservado:   'Esse nome não pode virar o link da barbearia. Use um nome mais completo, como "Barbearia do Zé".',
}

const mensagemErro = (err) => {
  const bruto = String(err?.message || '')
  const chave = Object.keys(ERROS).find(k => bruto.includes(k))
  return chave ? ERROS[chave] : 'Erro ao criar a barbearia. Tente novamente.'
}

export default function CadastroPage() {
  const navigate = useNavigate()
  const { setSalon } = useAuth()
  const [params] = useSearchParams()

  const [form, setForm] = useState({ nome_salao: '', email: '', password: '' })
  const [convite, setConvite] = useState((params.get('convite') || '').toUpperCase())
  const [resultado, setResultado] = useState({ codigo: null, ok: false })
  const [loading, setLoading] = useState(false)
  const [aceite, setAceite] = useState(false)

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const codigo = convite.trim()
  const conviteOk  = resultado.codigo === codigo ? resultado.ok : null
  const conferindo = codigo.length >= 8 && conviteOk === null

  useEffect(() => {
    if (codigo.length < 8) return

    let cancelado = false
    const t = setTimeout(() => {
      supabase.rpc('convite_valido', { p_codigo: codigo }).then(({ data, error }) => {
        if (!cancelado) setResultado({ codigo, ok: !error && data === true })
      })
    }, 400)

    return () => { cancelado = true; clearTimeout(t) }
  }, [codigo])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!aceite) { toast.error('É preciso aceitar os Termos de Uso para criar a conta'); return }
    if (conviteOk !== true) { toast.error('Informe um convite válido para criar a barbearia'); return }
    const slug = generateSlug(form.nome_salao)
    if (!slug || slugReservado(slug)) {
      toast.error('Esse nome não pode virar o link da barbearia. Use um nome mais completo, como "Barbearia do Zé".')
      return
    }
    setLoading(true)

    try {
      const aceitoEm = new Date().toISOString()

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            termos_aceitos_em: aceitoEm,
            termos_versao: TERMOS_VERSAO,
            convite: codigo,
          },
        },
      })

      if (authError) { toast.error(authError.message); return }

      if (!authData.session) {
        toast.success('Conta criada! Verifique seu e-mail para confirmar o cadastro.')
        return
      }

      const { data: criado, error: salonError } = await supabase
        .rpc('criar_salao_com_convite', {
          p_nome: form.nome_salao,
          p_slug: generateSlug(form.nome_salao),
          p_codigo: codigo,
          p_termos_aceitos_em: aceitoEm,
          p_termos_versao: TERMOS_VERSAO,
        })

      if (salonError) { toast.error(mensagemErro(salonError)); return }

      const salonData = Array.isArray(criado) ? criado[0] : criado

      setSalon(salonData)
      toast.success('Conta criada! Vamos configurar sua barbearia.')
      navigate('/onboarding')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-concreto">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/logo.png" alt="" className="w-12 h-12 mb-3" />
          <h1 className="font-display text-tela">Crie sua barbearia</h1>
          <p className="text-apoio text-cal-2 mt-1">Use o convite que você recebeu</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">

          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-convite">
              Código do convite
            </label>
            <div className="relative">
              <Ticket size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
              <input
                id="cad-convite" name="convite"
                value={convite}
                onChange={e => setConvite(e.target.value.toUpperCase())}
                className="input-base pl-9 pr-9"
                placeholder="XXXX-XXXX" autoComplete="off" spellCheck={false} required
                aria-describedby="cad-convite-aviso"
              />
              {!conferindo && conviteOk === true && (
                <Check size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ok" aria-hidden />
              )}
              {!conferindo && conviteOk === false && (
                <X size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-danger" aria-hidden />
              )}
            </div>
            <p id="cad-convite-aviso" className={`text-micro ${conviteOk === false ? "text-danger" : "text-cal-2"}`}>
              {conferindo    ? 'Conferindo…'
               : conviteOk === false ? 'Convite inválido, já usado ou expirado.'
               : conviteOk === true  ? 'Convite válido.'
               : 'O convite vale por poucos minutos depois de emitido.'}
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-salao">Nome da barbearia</label>
            <input
              id="cad-salao" name="nome_salao" value={form.nome_salao} onChange={handle}
              className="input-base" placeholder="Ex: Barbearia do Zé" autoComplete="organization" required
            />
          </div>
          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-email">Seu e-mail</label>
            <input
              id="cad-email" name="email" type="email" value={form.email} onChange={handle}
              className="input-base" placeholder="seu@email.com" autoComplete="email" required
            />
          </div>
          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cad-senha">Senha</label>
            <CampoSenha
              id="cad-senha" name="password" value={form.password} onChange={handle}
              placeholder="Mínimo 8 caracteres" autoComplete="new-password" minLength={8} required
            />
          </div>
          <AceiteTermos checked={aceite} onChange={setAceite} id="cad-aceite" />

          <button type="submit" className="btn-primary w-full"
            disabled={loading || !aceite || conviteOk !== true}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>

          <p className="text-center text-apoio text-cal-2">
            Não tem convite?{' '}
            <Link to="/quero-meu-salao" className="font-semibold text-gelo">
              Fale com a gente
            </Link>
          </p>
          <p className="text-center text-apoio text-cal-2">
            Já tem conta?{' '}
            <Link to="/login" className="font-semibold text-gelo">
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
