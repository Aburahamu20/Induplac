// Pantallas del menú y quién ve cada una (contrato §6.4). Separado de Menu.tsx para
// que ese archivo exporte solo componentes.

import type { ReactNode } from 'react'
import type { EstadoLocal, LocalId } from '../api'
import type { ContextoSesion } from '../auth/sesion'

export type Pantalla = 'resumen' | 'planta' | 'oficinas' | 'alertas' | 'historico' | 'umbrales' | 'usuarios' | 'auditoria' | 'estado'

export interface Entrada {
  id: Pantalla
  nombre: string
  icono: ReactNode
  grupo: 'monitoreo' | 'gestion' | 'sistema'
  visible: (c: ContextoSesion) => boolean
}

// Íconos de trazo simple (24×24), del mismo estilo que los bocetos
const trazo = (d: string) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
export const ICONOS = {
  resumen: trazo('M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z'),
  planta: trazo('M3 21V10l5 3V10l5 3V7l8 4v10zM7 17h2M12 17h2M17 17h2'),
  oficinas: trazo('M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M4 21h16'),
  alertas: trazo('M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0'),
  historico: trazo('M3 3v18h18M7 15l4-4 3 3 5-6'),
  umbrales: trazo('M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4'),
  usuarios: trazo('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75'),
  auditoria: trazo('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h8M8 9h2'),
  estado: trazo('M3 5h18v6H3zM3 13h18v6H3zM7 8h0M7 16h0'),
}

const esAdmin = (c: ContextoSesion) => c.puede('gestionar_usuarios')

export const ENTRADAS: Entrada[] = [
  { id: 'resumen', nombre: 'Resumen general', icono: ICONOS.resumen, grupo: 'monitoreo', visible: (c) => c.puede('ver_general') && c.ve('local1') && c.ve('local2') },
  { id: 'planta', nombre: 'Planta de fabricación', icono: ICONOS.planta, grupo: 'monitoreo', visible: (c) => c.puede('ver_actual') && c.ve('local1') },
  { id: 'oficinas', nombre: 'Oficinas administrativas', icono: ICONOS.oficinas, grupo: 'monitoreo', visible: (c) => c.puede('ver_actual') && c.ve('local2') },
  { id: 'alertas', nombre: 'Alertas', icono: ICONOS.alertas, grupo: 'monitoreo', visible: (c) => c.puede('ver_alertas') },
  { id: 'historico', nombre: 'Histórico', icono: ICONOS.historico, grupo: 'monitoreo', visible: (c) => c.puede('ver_historico') },
  { id: 'umbrales', nombre: 'Umbrales de alerta', icono: ICONOS.umbrales, grupo: 'gestion', visible: (c) => c.puede('modificar_umbrales') },
  { id: 'usuarios', nombre: 'Usuarios y permisos', icono: ICONOS.usuarios, grupo: 'gestion', visible: esAdmin },
  { id: 'auditoria', nombre: 'Auditoría', icono: ICONOS.auditoria, grupo: 'gestion', visible: esAdmin },
  { id: 'estado', nombre: 'Estado de las sedes', icono: ICONOS.estado, grupo: 'sistema', visible: () => true },
]

export const SEDE: Record<LocalId, string> = { local1: 'Planta', local2: 'Oficinas' }

export function nombreEntrada(id: Pantalla, ctx: ContextoSesion): string {
  if (id === 'estado' && ctx.sesion.locales.length === 1) return 'Estado de la sede'
  return ENTRADAS.find((e) => e.id === id)?.nombre ?? ''
}

function fechaCorta(iso: string | null): string {
  if (!iso) return 'sin datos'
  return new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit' })
}

// Estado corto de una sede para el pie del menú y para la marca junto a su entrada
export function estadoCorto(l: EstadoLocal): { tono: 'ok' | 'aviso'; texto: string; marca?: string } {
  if (l.enlace === 'sincronizando') return { tono: 'aviso', texto: `${SEDE[l.local_id]} · subiendo ${l.pendientes} pendientes`, marca: 'Sync' }
  if (l.enlace === 'offline') return { tono: 'aviso', texto: `${SEDE[l.local_id]} · sin datos desde ${fechaCorta(l.ultimo_dato)}`, marca: 'Sin datos' }
  return { tono: 'ok', texto: `${SEDE[l.local_id]} · al día` }
}

