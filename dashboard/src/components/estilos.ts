import type { LocalId, Nivel } from '../api'

export type Tono = 'ok' | 'aviso' | 'critico' | 'neutro'

export const TONO_TEXTO: Record<Tono, string> = {
  ok: 'text-ok',
  aviso: 'text-aviso',
  critico: 'text-critico',
  neutro: 'text-tinta-2',
}

export const TONO_BARRA: Record<Tono, string> = {
  ok: 'bg-ok',
  aviso: 'bg-aviso',
  critico: 'bg-critico',
  neutro: 'bg-oficinas',
}

export const tonoDeNivel = (n: Nivel): Tono => (n === 'critico' ? 'critico' : n === 'advertencia' ? 'aviso' : 'ok')

export const SEDES: Record<LocalId, { nombre: string; color: string }> = {
  local2: { nombre: 'Oficinas', color: '#4f8ef7' },
  local1: { nombre: 'Planta', color: '#e8663a' },
}

