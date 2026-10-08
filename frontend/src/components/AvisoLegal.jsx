import { Link } from 'react-router-dom'

function LinkLegal({ to, children }) {
  return (
    <Link
      to={to} target="_blank" rel="noopener noreferrer"
      className="font-semibold underline decoration-1 underline-offset-2 text-acento-texto"
    >
      {children}
    </Link>
  )
}

export function AvisoLegal({ nomeSalao }) {
  return (
    <p className="text-micro leading-relaxed text-center text-cal-2">
      Ao continuar, você concorda com os <LinkLegal to="/termos">Termos</LinkLegal>{' '}
      e com o compartilhamento dos seus dados com{' '}
      {nomeSalao ? <span className="text-cal-2">{nomeSalao}</span> : 'a barbearia'}.{' '}
      Veja a <LinkLegal to="/privacidade">Política de Privacidade</LinkLegal>.
    </p>
  )
}

export function AceiteTermos({ checked, onChange, id = 'aceite-termos' }) {
  return (
    <label htmlFor={id} className="flex items-start gap-2.5 cursor-pointer select-none">
      <input
        id={id} type="checkbox" checked={checked} required
        onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 shrink-0 cursor-pointer accent-acento-marca"
      />
      <span className="text-micro leading-relaxed text-cal-2">
        Li e aceito os <LinkLegal to="/termos">Termos de Uso</LinkLegal> e a{' '}
        <LinkLegal to="/privacidade">Política de Privacidade</LinkLegal>.
      </span>
    </label>
  )
}
