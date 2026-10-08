import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

export default class ErrorBoundary extends Component {
  state = { erro: null }

  static getDerivedStateFromError(erro) {
    return { erro }
  }

  componentDidCatch(erro, info) {
    console.error('[erro de render]', erro, info.componentStack)
  }

  render() {
    if (!this.state.erro) return this.props.children

    return (
      <div className="min-h-screen bg-concreto flex items-center justify-center p-6">
        <div className="card w-full max-w-sm text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-chapa bg-danger-fundo flex items-center justify-center">
            <AlertTriangle size={22} className="text-danger" />
          </div>

          <div>
            <h1 className="font-display text-card">Algo saiu do lugar</h1>
            <p className="text-apoio text-cal-2 mt-1">
              Esta tela não conseguiu carregar. Recarregar costuma resolver.
            </p>
          </div>

          {import.meta.env.DEV && (
            <pre className="text-micro text-left overflow-x-auto p-3 rounded-controle bg-elevado text-cal-2">
              {String(this.state.erro?.message || this.state.erro)}
            </pre>
          )}

          <button className="btn-primary w-full" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </div>
      </div>
    )
  }
}
