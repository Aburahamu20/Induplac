// Estado de la sesión compartido por toda la app.

import { createContext, useContext } from 'react'
import type { LocalId } from '../api/tipos'
import type { Permiso, Sesion } from './tipos'

export interface ContextoSesion {
  sesion: Sesion
  puede: (p: Permiso) => boolean
  ve: (local: LocalId) => boolean
  cerrar: () => void
}

export const SesionCtx = createContext<ContextoSesion | null>(null)

export function useSesion(): ContextoSesion {
  const c = useContext(SesionCtx)
  if (!c) throw new Error('useSesion fuera de la sesión')
  return c
}

const CLAVE = 'induplac-sesion'

export function sesionGuardada(): Sesion | null {
  try {
    const s = JSON.parse(localStorage.getItem(CLAVE) ?? 'null') as Sesion | null
    return s && new Date(s.expira).getTime() > Date.now() ? s : null
  } catch {
    return null
  }
}

export function guardarSesion(s: Sesion | null) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* sin almacenamiento: la sesión dura hasta recargar */
  }
}
