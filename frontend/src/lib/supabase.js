import { createClient } from '@supabase/supabase-js'
import toast from 'react-hot-toast'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const hashInicial = window.location.hash

let modoObservacao = false
export function definirModoObservacao(ativo) { modoObservacao = ativo }

const METODOS_DE_ESCRITA = new Set(['POST', 'PATCH', 'PUT', 'DELETE'])

function ehEscritaBloqueada(url, metodo) {
  if (!modoObservacao || !METODOS_DE_ESCRITA.has(metodo)) return false
  const alvo = String(url)
  if (alvo.includes('/rest/v1/') && !alvo.includes('/rest/v1/rpc/')) return true
  if (alvo.includes('/storage/v1/object')) return true
  return false
}

function fetchComGuarda(url, opcoes = {}) {
  const metodo = String(opcoes?.method || 'GET').toUpperCase()

  if (ehEscritaBloqueada(url, metodo)) {
    toast.error('Somente leitura: você está vendo esta barbearia como plataforma.',
      { id: 'somente-leitura-observacao' })
    return Promise.resolve(new Response(
      JSON.stringify({
        message: 'somente_leitura_observacao',
        details: 'Admin da plataforma em modo de observação não grava nesta barbearia.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    ))
  }

  return fetch(url, opcoes)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchComGuarda },
})
