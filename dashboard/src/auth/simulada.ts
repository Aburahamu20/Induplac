// Autenticación simulada para la demo: imita el login local del Edge
// (contrato §6.1 y §6.2) sin servidor.
//
// SOLO DEMO: los usuarios iniciales están en este archivo. Las claves se
// comparan como hash SHA-256 y los cambios (clave nueva, secreto MFA) se
// guardan en el navegador. En el Edge real van en SQLite con bcrypt/argon2.

import type { LocalId } from '../api/tipos'
import { nuevoSecreto, uriOtpauth, verificarCodigo } from './totp'
import { PERMISOS_MODIFICAR, type Permiso, type ProveedorAuth, type RespuestaAuth, type Rol, type Sesion } from './tipos'

interface UsuarioDemo {
  usuario: string
  claveInicial: string
  rol: Rol
  locales: LocalId[]
  permisos: Permiso[]
  debeCambiar: boolean
}

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    usuario: 'operario',
    claveInicial: 'operario123',
    rol: 'operario',
    locales: ['local1'],
    permisos: ['ver_actual', 'ver_alertas'],
    debeCambiar: false,
  },
  {
    usuario: 'jefe',
    claveInicial: 'jefe123',
    rol: 'jefe_mantenimiento_operaciones',
    locales: ['local1', 'local2'],
    permisos: ['ver_actual', 'ver_alertas', 'ver_historico', 'ver_general', 'reconocer_alertas'],
    debeCambiar: false,
  },
  {
    usuario: 'admin',
    claveInicial: 'admin123',
    rol: 'administrador',
    locales: ['local1', 'local2'],
    permisos: ['ver_actual', 'ver_alertas', 'ver_historico', 'ver_general', 'reconocer_alertas', 'modificar_umbrales', 'gestionar_usuarios'],
    debeCambiar: false,
  },
  {
    usuario: 'nuevo',
    claveInicial: 'temporal123',
    rol: 'operario',
    locales: ['local2'],
    permisos: ['ver_actual', 'ver_alertas', 'ver_historico'],
    debeCambiar: true,
  },
]

const CLAVE_ALMACEN = 'induplac-demo-usuarios'
const EMISOR_MFA = 'Induplac (planta)'
const DURACION_SESION_MS = 8 * 3_600_000 // un turno
const DURACION_DESAFIO_MS = 5 * 60_000
const MAX_INTENTOS = 5
const BLOQUEO_MS = 5 * 60_000

interface Cambios {
  claveHash?: string
  debeCambiar?: boolean
  mfaSecreto?: string
}

function leer(): Record<string, Cambios> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_ALMACEN) ?? '{}')
  } catch {
    return {}
  }
}

function guardar(c: Record<string, Cambios>) {
  try {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify(c))
  } catch {
    /* sin almacenamiento: los cambios duran hasta recargar */
  }
}

export function restablecerUsuariosDemo() {
  try {
    localStorage.removeItem(CLAVE_ALMACEN)
  } catch {
    /* nada que hacer */
  }
}

async function hash(texto: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const aleatorio = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

const necesitaMfa = (u: UsuarioDemo) => u.permisos.some((p) => PERMISOS_MODIFICAR.includes(p))

export class AuthSimulada implements ProveedorAuth {
  private cambios = leer()
  private desafios = new Map<string, { usuario: string; expira: number; secretoPendiente?: string }>()
  private sesiones = new Map<string, Sesion>()
  private intentos = new Map<string, { fallos: number; bloqueadoHasta: number }>()

  private buscar(usuario: string): UsuarioDemo | undefined {
    return USUARIOS_DEMO.find((u) => u.usuario === usuario.trim().toLowerCase())
  }

  private desafio(u: UsuarioDemo, tipo: 'cambiar_clave' | 'registrar_mfa' | 'codigo_mfa'): RespuestaAuth {
    const id = aleatorio()
    this.desafios.set(id, { usuario: u.usuario, expira: Date.now() + DURACION_DESAFIO_MS })
    return { desafio: tipo, sesion_temporal: id }
  }

  // Decide el siguiente paso del ciclo de vida de la cuenta (contrato §6.1)
  private siguientePaso(u: UsuarioDemo, mfaVerificado: boolean): RespuestaAuth {
    const c = this.cambios[u.usuario] ?? {}
    if (c.debeCambiar ?? u.debeCambiar) return this.desafio(u, 'cambiar_clave')
    if (necesitaMfa(u) && !mfaVerificado) return this.desafio(u, c.mfaSecreto ? 'codigo_mfa' : 'registrar_mfa')
    const sesion: Sesion = {
      usuario: u.usuario,
      token: aleatorio(),
      rol: u.rol,
      locales: u.locales,
      permisos: u.permisos,
      expira: new Date(Date.now() + DURACION_SESION_MS).toISOString(),
    }
    this.sesiones.set(sesion.token, sesion)
    return { sesion }
  }

  private tomarDesafio(id: string) {
    const d = this.desafios.get(id)
    if (!d || d.expira < Date.now()) throw new Error('El paso de inicio de sesión expiró. Vuelve a ingresar.')
    const u = this.buscar(d.usuario)
    if (!u) throw new Error('Usuario no encontrado.')
    return { d, u }
  }

  async login(usuario: string, clave: string): Promise<RespuestaAuth> {
    const nombre = usuario.trim().toLowerCase()
    const reg = this.intentos.get(nombre) ?? { fallos: 0, bloqueadoHasta: 0 }
    if (reg.bloqueadoHasta > Date.now()) {
      const min = Math.ceil((reg.bloqueadoHasta - Date.now()) / 60_000)
      throw new Error(`Cuenta bloqueada por intentos fallidos. Intenta en ${min} min.`)
    }
    const u = this.buscar(nombre)
    const esperado = u ? (this.cambios[u.usuario]?.claveHash ?? (await hash(u.claveInicial))) : null
    if (!u || esperado !== (await hash(clave))) {
      reg.fallos += 1
      if (reg.fallos >= MAX_INTENTOS) {
        reg.bloqueadoHasta = Date.now() + BLOQUEO_MS
        reg.fallos = 0
      }
      this.intentos.set(nombre, reg)
      throw new Error('Usuario o contraseña incorrectos.')
    }
    this.intentos.delete(nombre)
    return this.siguientePaso(u, false)
  }

  async cambiarClave(id: string, claveNueva: string): Promise<RespuestaAuth> {
    const { u } = this.tomarDesafio(id)
    if (claveNueva.length < 10) throw new Error('La contraseña debe tener al menos 10 caracteres.')
    const nuevoHash = await hash(claveNueva)
    const actual = this.cambios[u.usuario]?.claveHash ?? (await hash(u.claveInicial))
    if (nuevoHash === actual) throw new Error('La contraseña nueva debe ser distinta a la temporal.')
    this.cambios[u.usuario] = { ...this.cambios[u.usuario], claveHash: nuevoHash, debeCambiar: false }
    guardar(this.cambios)
    this.desafios.delete(id)
    return this.siguientePaso(u, false)
  }

  async registrarMfa(id: string): Promise<{ qr_uri: string }> {
    const { d, u } = this.tomarDesafio(id)
    d.secretoPendiente ??= nuevoSecreto()
    return { qr_uri: uriOtpauth(u.usuario, d.secretoPendiente, EMISOR_MFA) }
  }

  async verificarMfa(id: string, codigo: string): Promise<RespuestaAuth> {
    const { d, u } = this.tomarDesafio(id)
    const secreto = d.secretoPendiente ?? this.cambios[u.usuario]?.mfaSecreto
    if (!secreto) throw new Error('Primero registra el MFA.')
    if (!(await verificarCodigo(secreto, codigo))) throw new Error('Código incorrecto. Revisa Microsoft Authenticator.')
    if (d.secretoPendiente) {
      this.cambios[u.usuario] = { ...this.cambios[u.usuario], mfaSecreto: d.secretoPendiente }
      guardar(this.cambios)
    }
    this.desafios.delete(id)
    return this.siguientePaso(u, true)
  }

  async yo(token: string): Promise<Sesion> {
    const s = this.sesiones.get(token)
    if (!s || new Date(s.expira).getTime() < Date.now()) throw new Error('Sesión expirada.')
    return s
  }

  async logout(token: string): Promise<void> {
    this.sesiones.delete(token)
  }

  // La simulación no tiene servidor: al recargar la página se acepta la sesión guardada si no expiró
  restaurar(s: Sesion) {
    this.sesiones.set(s.token, s)
  }
}
