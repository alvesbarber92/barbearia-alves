import { useEffect } from 'react'

export const COR_PADRAO = '#5FC4DC'

const PICHE = '#121110'
const CAL = '#F0ECE4'
const FUNDOS = ['#151412', '#232120', '#2E2B26']

const META_TEXTO = 4.6
const META_MARCA = 3.1

const paraLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function linear(hex) {
  let h = String(hex).replace('#', '')
  if (h.length === 3) h = [...h].map(c => c + c).join('')
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null
  return [0, 2, 4].map(i => paraLinear(parseInt(h.slice(i, i + 2), 16) / 255))
}

const luminancia = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function contraste(a, b) {
  const [claro, escuro] = a > b ? [a, b] : [b, a]
  return (claro + 0.05) / (escuro + 0.05)
}

function piorContraste(lin) {
  const l = luminancia(lin)
  return Math.min(...FUNDOS.map(f => contraste(l, luminancia(linear(f)))))
}

function paraOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ]
}

function deOklab([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ]
}

function misturaComCal(lin, p) {
  const A = paraOklab(lin), B = paraOklab(linear(CAL))
  return deOklab(A.map((x, i) => x * p + B[i] * (1 - p))).map(c => {
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055
    return paraLinear(Math.round(Math.min(1, Math.max(0, g)) * 255) / 255)
  })
}

function porcentagem(lin, teto, meta) {
  for (let p = teto; p > 0; p--) {
    if (piorContraste(misturaComCal(lin, p / 100)) >= meta) return p
  }
  return 0
}

export function derivados(cor) {
  const lin = linear(cor) ?? linear(COR_PADRAO)
  const l = luminancia(lin)
  const piche = contraste(l, luminancia(linear(PICHE))) >= contraste(l, luminancia(linear(CAL)))
  return {
    ink: piche ? PICHE : CAL,
    contra: piche ? CAL : PICHE,
    mixInk: porcentagem(lin, 78, META_TEXTO),
    mixMarca: porcentagem(lin, 100, META_MARCA),
    contorno: piorContraste(lin) < META_MARCA,
  }
}

const pilha = []

function aplicar() {
  const topo = pilha[pilha.length - 1]
  const cor = topo?.cor || COR_PADRAO
  const d = derivados(cor)
  const raiz = document.documentElement.style
  raiz.setProperty('--cor-primaria', cor)
  raiz.setProperty('--cor-primaria-ink', d.ink)
  raiz.setProperty('--cor-primaria-contra', d.contra)
  raiz.setProperty('--mix-ink', `${d.mixInk}%`)
  raiz.setProperty('--mix-marca', `${d.mixMarca}%`)
  raiz.setProperty('--acento-contorno', d.contorno ? 'var(--accent-marca)' : 'transparent')
}

export function useAccent(cor) {
  useEffect(() => {
    const dono = { cor }
    pilha.push(dono)
    aplicar()
    return () => {
      pilha.splice(pilha.indexOf(dono), 1)
      aplicar()
    }
  }, [cor])
}
