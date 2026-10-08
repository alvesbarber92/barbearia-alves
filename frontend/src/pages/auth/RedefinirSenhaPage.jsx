import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, hashInicial } from '../../lib/supabase'
import { useAuth } from '../../context/useAuth'
import { caminhoInterno, destinoAposLogin } from '../../lib/destinoAposLogin'
import TelaAcesso from '../../components/ui/TelaAcesso'
import CampoSenha from '../../components/ui/CampoSenha'
import toast from 'react-hot-toast'

const linkComErro = new URLSearchParams(hashInicial.slice(1)).has('error_code')

export default function RedefinirSenhaPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = caminhoInterno(params.get('voltar'))
  const { session, loading } = useAuth()
  const [form, setForm] = useState({ senha: '', confirmacao: '' })
  const [salvando, setSalvando] = useState(false)

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.senha !== form.confirmacao) {
      toast.error('As duas senhas não são iguais')
      return
    }
    setSalvando(true)
    const { data, error } = await supabase.auth.updateUser({ password: form.senha })
    if (error) {
      console.error('[redefinir-senha]', error)
      setSalvando(false)
      if (error.code === 'same_password') {
        toast.error('A senha nova precisa ser diferente da anterior')
      } else if (error.code === 'weak_password') {
        toast.error('Senha fraca. Use uma senha mais longa, com letras e números.')
      } else if (error.status === 401 || error.code === 'session_not_found') {
        toast.error('O link expirou. Peça um novo.')
      } else {
        toast.error('Não foi possível salvar a senha. Tente novamente.')
      }
      return
    }
    toast.success('Senha alterada')
    navigate(voltar ?? await destinoAposLogin(data.user), { replace: true })
  }

  if (loading) return null

  if (linkComErro || !session) {
    return (
      <TelaAcesso>
        <h1 className="font-display text-tela">Este link não vale mais</h1>
        <p className="text-apoio text-cal-2 mt-2">
          O link para criar senha nova expira depois de um tempo e só pode ser usado
          uma vez. Peça outro; ele chega no mesmo e-mail.
        </p>
        <button
          type="button" className="btn-primary w-full mt-6"
          onClick={() => navigate('/esqueci-senha', { state: { voltar } })}
        >
          Pedir novo link
        </button>
        <p className="mt-5 text-center text-apoio text-cal-2">
          <Link to={voltar ?? '/login'} className="font-semibold text-gelo">
            Voltar para o login
          </Link>
        </p>
      </TelaAcesso>
    )
  }

  return (
    <TelaAcesso>
      <h1 className="font-display text-tela">Crie uma senha nova</h1>
      <p className="text-apoio text-cal-2 mt-1 mb-6">
        Para a conta{' '}
        <span className="font-semibold text-cal break-all">{session.user.email}</span>
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-apoio font-semibold text-cal-2" htmlFor="redef-senha">Senha nova</label>
          <CampoSenha
            id="redef-senha" name="senha" value={form.senha} onChange={handle}
            placeholder="Mínimo 8 caracteres" autoComplete="new-password"
            minLength={8} required comCadeado
          />
        </div>
        <div className="space-y-1">
          <label className="text-apoio font-semibold text-cal-2" htmlFor="redef-confirmacao">Repita a senha</label>
          <CampoSenha
            id="redef-confirmacao" name="confirmacao" value={form.confirmacao} onChange={handle}
            placeholder="••••••••" autoComplete="new-password"
            minLength={8} required comCadeado
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar senha'}
        </button>
      </form>
    </TelaAcesso>
  )
}
