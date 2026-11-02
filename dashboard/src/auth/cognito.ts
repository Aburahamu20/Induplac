// Login con Amazon Cognito (contrato §6, CONTEXTO §4.8).
//
// Habla directo con la API pública de Cognito (cognito-idp) por HTTPS, sin
// librerías: InitiateAuth (USER_PASSWORD_AUTH), RespondToAuthChallenge,
// AssociateSoftwareToken y VerifySoftwareToken. El app client debe ser
// público (sin secreto) y tener habilitado ALLOW_USER_PASSWORD_AUTH.
//
// Cognito dice QUIÉN es el usuario y maneja la clave temporal y el MFA.
// QUÉ puede hacer sale del grupo de Cognito y DÓNDE, del atributo custom:sede
// (ver rolDesdeToken más abajo).

import type { LocalId } from '../api/tipos'
import { uriOtpauth } from './totp'
import type { Permiso, ProveedorAuth, RespuestaAuth, Rol, Sesion } from './tipos'

interface Plantilla {
  rol: Rol
  permisos: Permiso[]
  // true: ve ambas sedes sin mirar custom:sede
  todasLasSedes?: boolean
}

const PERMISOS_ADMIN: Permiso[] = ['ver_actual', 'ver_alertas', 'ver_historico', 'ver_general', 'reconocer_alertas', 'modificar_umbrales', 'gestionar_usuarios']
const PERMISOS_JEFE: Permiso[] = ['ver_actual', 'ver_alertas', 'ver_historico', 'ver_general', 'reconocer_alertas']
const PERMISOS_OPERARIO: Permiso[] = ['ver_actual', 'ver_alertas']

// Grupos de Cognito. El grupo dice QUÉ puede hacer; custom:sede dice DÓNDE.
const PLANTILLAS: Record<string, Plantilla> = {
  'admin-general': { rol: 'admin_general', permisos: PERMISOS_ADMIN, todasLasSedes: true },
  // Grupo antiguo: se mantiene mientras se migra a admin-general
  administrador: { rol: 'administrador', permisos: PERMISOS_ADMIN, todasLasSedes: true },
  'admin-sede': { rol: 'admin_sede', permisos: PERMISOS_ADMIN },
  jefe: { rol: 'jefe_mantenimiento_operaciones', permisos: PERMISOS_JEFE },
  operario: { rol: 'operario', permisos: PERMISOS_OPERARIO },
}
// Si el usuario está en varios grupos, gana el primero de esta lista
const ORDEN_GRUPOS = ['admin-general', 'administrador', 'admin-sede', 'jefe', 'operario']

// Valores de custom:sede (legibles para el equipo) -> locales internos (RDS y Edge)
const SEDES: Record<string, LocalId[]> = {
  planta: ['local1'],
  oficinas: ['local2'],
  todas: ['local1', 'local2'],
}

// Roles que deben tener MFA. El user pool está en modo Opcional, así que la
// obligación la pone el dashboard: si entran sin MFA, se les pide registrarlo.
const ROLES_CON_MFA: Rol[] = ['admin_general', 'administrador', 'admin_sede', 'jefe_mantenimiento_operaciones']
export const requiereMfa = (rol: Rol) => ROLES_CON_MFA.includes(rol)

const SIN_SEDE = 'Tu cuenta no tiene una sede válida asignada. Pídele al administrador que la revise.'
const SIN_GRUPO = 'Tu cuenta no tiene un rol asignado. Pídele al administrador que la revise.'

// Traduce el payload del IdToken a rol, locales y permisos.
// Sin grupo conocido o sin sede válida no se entra: es mejor no ver nada que ver de más.
export function rolDesdeToken(datos: Record<string, unknown>): { rol: Rol; locales: LocalId[]; permisos: Permiso[] } {
  const grupos = (datos['cognito:groups'] as string[] | undefined) ?? []
  const grupo = ORDEN_GRUPOS.find((g) => grupos.includes(g))
  if (!grupo) throw new Error(SIN_GRUPO)
  const p = PLANTILLAS[grupo]
  let locales: LocalId[]
  if (p.todasLasSedes) locales = ['local1', 'local2']
  else {
    const sede = String(datos['custom:sede'] ?? '').trim().toLowerCase()
    const encontrados = SEDES[sede]
    if (!encontrados) throw new Error(SIN_SEDE)
    locales = encontrados
  }
  return { rol: p.rol, locales: [...locales], permisos: [...p.permisos] }
}

const EMISOR_MFA = 'Induplac (nube)'

// MFA_OBLIGATORIO no es un reto de Cognito: lo agrega el dashboard cuando un
// jefe o admin entra sin MFA (posible porque el user pool está en Opcional)
type Reto = 'NEW_PASSWORD_REQUIRED' | 'MFA_SETUP' | 'SOFTWARE_TOKEN_MFA' | 'MFA_OBLIGATORIO'

type Tokens = { IdToken: string; AccessToken: string; ExpiresIn: number }

interface Pendiente {
  usuario: string
  reto: Reto
  session: string
  tokens?: Tokens
}

interface RespuestaCognito {
  AuthenticationResult?: Tokens
  UserMFASettingList?: string[]
  ChallengeName?: string
  Session?: string
  SecretCode?: string
  Status?: string
}

const MENSAJES: Record<string, string> = {
  NotAuthorizedException: 'Usuario o contraseña incorrectos.',
  UserNotFoundException: 'Usuario o contraseña incorrectos.',
  PasswordResetRequiredException: 'Debes restablecer tu contraseña. Pídeselo al administrador.',
  InvalidPasswordException: 'La contraseña no cumple la política: mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.',
  CodeMismatchException: 'Código incorrecto. Revisa Microsoft Authenticator.',
  EnableSoftwareTokenMFAException: 'Código incorrecto. Revisa Microsoft Authenticator.',
  ExpiredCodeException: 'El código ya se usó o venció. Espera el siguiente.',
  TooManyRequestsException: 'Demasiados intentos. Espera un momento.',
  LimitExceededException: 'Demasiados intentos. Espera un momento.',
}

function payloadJwt(jwt: string): Record<string, unknown> {
  const b64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = decodeURIComponent(
    [...atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))]
      .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join(''),
  )
  return JSON.parse(json)
}

const aleatorio = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('')

export class AuthCognito implements ProveedorAuth {
  private readonly url: string
  private readonly clientId: string
  private pendientes = new Map<string, Pendiente>()
  private accessTokens = new Map<string, string>()

  constructor(region: string, clientId: string) {
    this.url = `https://cognito-idp.${region}.amazonaws.com/`
    this.clientId = clientId
  }

  private async llamar(accion: string, cuerpo: object): Promise<RespuestaCognito> {
    let r: Response
    try {
      r = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': `AWSCognitoIdentityProviderService.${accion}`,
        },
        body: JSON.stringify(cuerpo),
      })
    } catch {
      throw new Error('No se pudo conectar con el servicio de inicio de sesión. Revisa la conexión.')
    }
    const datos = await r.json().catch(() => ({}))
    if (!r.ok) {
      const tipo = String(datos.__type ?? '').split('#').pop() ?? ''
      console.warn('[Cognito]', accion, tipo, datos.message)
      if (tipo === 'InvalidParameterException' && String(datos.message).includes('USER_PASSWORD_AUTH'))
        throw new Error(`Cognito rechazó el inicio de sesión: ${datos.message}. Revisa que el app client tenga ALLOW_USER_PASSWORD_AUTH.`)
      throw new Error(MENSAJES[tipo] ?? datos.message ?? 'Error al iniciar sesión.')
    }
    return datos
  }

  // ¿El usuario tiene una app autenticadora (TOTP) registrada y activa?
  private async tieneMfa(accessToken: string): Promise<boolean> {
    const u = await this.llamar('GetUser', { AccessToken: accessToken })
    return (u.UserMFASettingList ?? []).includes('SOFTWARE_TOKEN_MFA')
  }

  // Convierte la respuesta de Cognito en el siguiente paso del login.
  // conMfa: true si el usuario acaba de pasar un paso de MFA en este login.
  private async siguiente(usuario: string, r: RespuestaCognito, conMfa = false): Promise<RespuestaAuth> {
    if (r.AuthenticationResult) {
      const res = r.AuthenticationResult
      const { rol } = rolDesdeToken(payloadJwt(res.IdToken))
      const mfa = conMfa || (await this.tieneMfa(res.AccessToken))
      if (!mfa && requiereMfa(rol)) {
        const id = aleatorio()
        this.pendientes.set(id, { usuario, reto: 'MFA_OBLIGATORIO', session: '', tokens: res })
        return { desafio: 'registrar_mfa', sesion_temporal: id }
      }
      return { sesion: this.crearSesion(usuario, res, mfa) }
    }
    const reto = r.ChallengeName as Reto
    const desafio = reto === 'NEW_PASSWORD_REQUIRED' ? 'cambiar_clave' : reto === 'MFA_SETUP' ? 'registrar_mfa' : reto === 'SOFTWARE_TOKEN_MFA' ? 'codigo_mfa' : null
    if (!desafio || !r.Session) throw new Error(`Paso de inicio de sesión no soportado: ${r.ChallengeName ?? 'desconocido'}.`)
    const id = aleatorio()
    this.pendientes.set(id, { usuario, reto, session: r.Session })
    return { desafio, sesion_temporal: id }
  }

  private crearSesion(usuario: string, res: Tokens, mfa: boolean): Sesion {
    const datos = payloadJwt(res.IdToken)
    const p = rolDesdeToken(datos)
    const sesion: Sesion = {
      usuario: String(datos['cognito:username'] ?? usuario),
      token: res.IdToken,
      rol: p.rol,
      locales: p.locales,
      permisos: p.permisos,
      expira: new Date(Date.now() + res.ExpiresIn * 1000).toISOString(),
      mfa,
    }
    this.accessTokens.set(sesion.token, res.AccessToken)
    return sesion
  }

  private tomar(id: string): Pendiente {
    const p = this.pendientes.get(id)
    if (!p) throw new Error('El paso de inicio de sesión expiró. Vuelve a ingresar.')
    return p
  }

  async login(usuario: string, clave: string): Promise<RespuestaAuth> {
    const nombre = usuario.trim()
    const r = await this.llamar('InitiateAuth', {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: this.clientId,
      AuthParameters: { USERNAME: nombre, PASSWORD: clave },
    })
    return this.siguiente(nombre, r)
  }

  async cambiarClave(id: string, claveNueva: string): Promise<RespuestaAuth> {
    const p = this.tomar(id)
    const r = await this.llamar('RespondToAuthChallenge', {
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      ClientId: this.clientId,
      Session: p.session,
      ChallengeResponses: { USERNAME: p.usuario, NEW_PASSWORD: claveNueva },
    })
    this.pendientes.delete(id)
    return this.siguiente(p.usuario, r)
  }

  async registrarMfa(id: string): Promise<{ qr_uri: string }> {
    const p = this.tomar(id)
    const r = await this.llamar('AssociateSoftwareToken', p.tokens ? { AccessToken: p.tokens.AccessToken } : { Session: p.session })
    if (!r.SecretCode) throw new Error('Cognito no entregó el secreto del MFA.')
    if (r.Session) p.session = r.Session
    return { qr_uri: uriOtpauth(p.usuario, r.SecretCode, EMISOR_MFA) }
  }

  // Registra la app autenticadora con el AccessToken y la deja como MFA preferido
  private async confirmarTotp(accessToken: string, codigo: string): Promise<void> {
    const v = await this.llamar('VerifySoftwareToken', { AccessToken: accessToken, UserCode: codigo, FriendlyDeviceName: 'Microsoft Authenticator' })
    if (v.Status !== 'SUCCESS') throw new Error('Código incorrecto. Revisa Microsoft Authenticator.')
    await this.llamar('SetUserMFAPreference', { AccessToken: accessToken, SoftwareTokenMfaSettings: { Enabled: true, PreferredMfa: true } })
  }

  async verificarMfa(id: string, codigo: string): Promise<RespuestaAuth> {
    const p = this.tomar(id)
    if (p.reto === 'MFA_OBLIGATORIO' && p.tokens) {
      await this.confirmarTotp(p.tokens.AccessToken, codigo)
      this.pendientes.delete(id)
      return { sesion: this.crearSesion(p.usuario, p.tokens, true) }
    }
    if (p.reto === 'MFA_SETUP') {
      const v = await this.llamar('VerifySoftwareToken', { Session: p.session, UserCode: codigo, FriendlyDeviceName: 'Microsoft Authenticator' })
      if (v.Status !== 'SUCCESS') throw new Error('Código incorrecto. Revisa Microsoft Authenticator.')
      const r = await this.llamar('RespondToAuthChallenge', {
        ChallengeName: 'MFA_SETUP',
        ClientId: this.clientId,
        Session: v.Session ?? p.session,
        ChallengeResponses: { USERNAME: p.usuario },
      })
      this.pendientes.delete(id)
      return this.siguiente(p.usuario, r, true)
    }
    const r = await this.llamar('RespondToAuthChallenge', {
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      ClientId: this.clientId,
      Session: p.session,
      ChallengeResponses: { USERNAME: p.usuario, SOFTWARE_TOKEN_MFA_CODE: codigo },
    })
    this.pendientes.delete(id)
    return this.siguiente(p.usuario, r, true)
  }

  async yo(token: string): Promise<Sesion> {
    const datos = payloadJwt(token)
    if (Number(datos.exp) * 1000 < Date.now()) throw new Error('Sesión expirada.')
    const p = rolDesdeToken(datos)
    return { usuario: String(datos['cognito:username']), token, rol: p.rol, locales: p.locales, permisos: p.permisos, expira: new Date(Number(datos.exp) * 1000).toISOString() }
  }

  // MFA opcional (operarios): activarlo desde la sesión ya abierta
  async activarMfa(token: string): Promise<{ qr_uri: string }> {
    const access = this.accessTokens.get(token)
    if (!access) throw new Error('Vuelve a iniciar sesión para activar el MFA.')
    const r = await this.llamar('AssociateSoftwareToken', { AccessToken: access })
    if (!r.SecretCode) throw new Error('Cognito no entregó el secreto del MFA.')
    return { qr_uri: uriOtpauth(String(payloadJwt(token)['cognito:username']), r.SecretCode, EMISOR_MFA) }
  }

  async confirmarActivacionMfa(token: string, codigo: string): Promise<void> {
    const access = this.accessTokens.get(token)
    if (!access) throw new Error('Vuelve a iniciar sesión para activar el MFA.')
    await this.confirmarTotp(access, codigo)
  }

  async logout(token: string): Promise<void> {
    const access = this.accessTokens.get(token)
    this.accessTokens.delete(token)
    if (access) await this.llamar('GlobalSignOut', { AccessToken: access }).catch(() => {})
  }
}
