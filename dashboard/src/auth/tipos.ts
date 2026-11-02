// Tipos de sesión y permisos (contrato docs/api-dashboard.md §6).

import type { LocalId } from '../api/tipos'

export type Permiso =
  | 'ver_actual'
  | 'ver_alertas'
  | 'ver_historico'
  | 'ver_general'
  | 'reconocer_alertas'
  | 'modificar_umbrales'
  | 'gestionar_usuarios'

export const PERMISOS_MODIFICAR: Permiso[] = ['reconocer_alertas', 'modificar_umbrales', 'gestionar_usuarios']

export type Rol = 'operario' | 'jefe_mantenimiento_operaciones' | 'administrador' | 'admin_general' | 'admin_sede'

export const NOMBRE_ROL: Record<Rol, string> = {
  operario: 'Operario',
  jefe_mantenimiento_operaciones: 'Jefe de Mantenimiento/Operaciones',
  administrador: 'Administrador',
  admin_general: 'Admin general',
  admin_sede: 'Admin de sede',
}

// Texto corto de las sedes que ve el usuario, para mostrar junto al rol
export function nombreSedes(locales: LocalId[]): string {
  if (locales.includes('local1') && locales.includes('local2')) return 'Ambas sedes'
  if (locales.includes('local1')) return 'Planta'
  if (locales.includes('local2')) return 'Oficinas'
  return 'Sin sede'
}

export interface Sesion {
  usuario: string
  token: string
  rol: Rol
  locales: LocalId[]
  permisos: Permiso[]
  expira: string
  // Solo con Cognito: si la cuenta tiene MFA activo (undefined = no se sabe)
  mfa?: boolean
}

export type Desafio = 'cambiar_clave' | 'registrar_mfa' | 'codigo_mfa'

// Respuesta de los endpoints de sesión: o la sesión, o el siguiente paso
export type RespuestaAuth = { sesion: Sesion } | { desafio: Desafio; sesion_temporal: string }

export interface ProveedorAuth {
  login(usuario: string, clave: string): Promise<RespuestaAuth>
  cambiarClave(sesionTemporal: string, claveNueva: string): Promise<RespuestaAuth>
  registrarMfa(sesionTemporal: string): Promise<{ qr_uri: string }>
  verificarMfa(sesionTemporal: string, codigo: string): Promise<RespuestaAuth>
  yo(token: string): Promise<Sesion>
  logout(token: string): Promise<void>
}
