import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import CampoSenha from '../../components/ui/CampoSenha'
import { AvisoLegal } from '../../components/AvisoLegal'
import toast from 'react-hot-toast'
import { mascararTelefone, telefoneValido, MSG_TELEFONE_INVALIDO, propsCampoTelefone } from '../../lib/telefone'

export default function CadastroClientePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ nome: '', email: '', password: '', telefone: '' })
  const [loading, setLoading] = useState(false)

  const handle = (e) => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: name === 'telefone' ? mascararTelefone(value) : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!telefoneValido(form.telefone)) { toast.error(MSG_TELEFONE_INVALIDO); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { nome: form.nome, telefone: form.telefone, role: 'cliente' },
        },
      })

      if (error) {
        toast.error(error.message)
        return
      }

      if (!data.session) {
        toast.success('Cadastro realizado! Verifique seu e-mail para confirmar.')
        return
      }

      toast.success('Conta criada')
      navigate('/minha-conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-concreto">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <img src="/logo.png" alt="" className="w-12 h-12 mb-3" />
          <h1 className="font-display text-tela">Crie sua conta</h1>
          <p className="text-apoio text-cal-2 mt-1">Agende serviços na sua barbearia favorita</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cli-nome">Nome completo</label>
            <input
              id="cli-nome" name="nome" value={form.nome} onChange={handle}
              className="input-base" placeholder="Seu nome" autoComplete="name" required
            />
          </div>
          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cli-email">E-mail</label>
            <input
              id="cli-email" name="email" type="email" value={form.email} onChange={handle}
              className="input-base" placeholder="seu@email.com" autoComplete="email" required
            />
          </div>
          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cli-senha">Senha</label>
            <CampoSenha
              id="cli-senha" name="password" value={form.password} onChange={handle}
              placeholder="Mínimo 8 caracteres" autoComplete="new-password" minLength={8} required
            />
          </div>
          <div className="space-y-1">
            <label className="text-apoio font-semibold text-cal-2" htmlFor="cli-fone">WhatsApp</label>
            <input
              id="cli-fone" name="telefone" {...propsCampoTelefone} value={form.telefone} onChange={handle}
              className="input-base num"
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Criando conta...' : 'Criar conta'}
          </button>

          <AvisoLegal />
          <p className="text-center text-apoio text-cal-2">
            Já tem conta?{' '}
            <Link to="/login" className="font-semibold text-gelo">
              Entrar
            </Link>
          </p>
          <p className="text-center text-apoio text-cal-2">
            É dono de barbearia?{' '}
            <Link to="/cadastro" className="font-semibold text-gelo">
              Cadastre sua barbearia
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
