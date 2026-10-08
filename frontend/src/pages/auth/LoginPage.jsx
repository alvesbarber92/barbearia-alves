import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { destinoAposLogin } from '../../lib/destinoAposLogin'
import TelaAcesso from '../../components/ui/TelaAcesso'
import CampoSenha from '../../components/ui/CampoSenha'
import toast from 'react-hot-toast'
import { Mail } from 'lucide-react'

export default function LoginPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const handle = (e) => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const { data: authData, error } = await supabase.auth.signInWithPassword(form)
    if (error) {
      console.error('[login]', error)
      if (error.code === 'email_not_confirmed') {
        toast.error('Confirme seu e-mail antes de entrar')
      } else if (error.code === 'invalid_credentials') {
        toast.error('Email ou senha inválidos')
      } else {
        toast.error(error.message)
      }
    } else {
      navigate(await destinoAposLogin(authData.user))
    }
    setLoading(false)
  }

  return (
    <TelaAcesso>
      <h1 className="font-display text-tela">Bem-vindo de volta</h1>
      <p className="text-apoio text-cal-2 mt-1 mb-6">Entre na sua conta para continuar</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-apoio font-semibold text-cal-2" htmlFor="login-email">E-mail</label>
          <div className="relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-cal-3" />
            <input
              id="login-email" name="email" type="email" value={form.email} onChange={handle}
              className="input-base pl-9" placeholder="seu@email.com"
              autoComplete="email" required
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-apoio font-semibold text-cal-2" htmlFor="login-senha">Senha</label>
          <CampoSenha
            id="login-senha" name="password" value={form.password} onChange={handle}
            placeholder="••••••••" autoComplete="current-password" required comCadeado
          />
          <div className="text-right">
            <Link to="/esqueci-senha" state={{ email: form.email }} className="text-apoio font-semibold text-gelo">
              Esqueci minha senha
            </Link>
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <div className="mt-5 space-y-1.5 text-center text-apoio text-cal-2">
        <p>
          Não tem conta?{' '}
          <Link to="/quero-meu-salao" className="font-semibold text-gelo">
            Cadastre sua barbearia
          </Link>
        </p>
        <p>
          É cliente?{' '}
          <Link to="/cadastro-cliente" className="font-semibold text-gelo">
            Cadastre-se aqui
          </Link>
        </p>
      </div>
    </TelaAcesso>
  )
}
