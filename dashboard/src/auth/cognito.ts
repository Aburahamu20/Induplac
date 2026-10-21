// Login con Amazon Cognito (contrato §6, CONTEXTO §4.8).
//
// Habla directo con la API pública de Cognito (cognito-idp) por HTTPS, sin
// librerías: InitiateAuth (USER_PASSWORD_AUTH), RespondToAuthChallenge,
// AssociateSoftwareToken y VerifySoftwareToken. El app client debe ser
// público (sin secreto) y tener habilitado ALLOW_USER_PASSWORD_AUTH.
//
// Cognito dice QUIÉN es el usuario y maneja la clave temporal y el MFA.
// QUÉ puede hacer sale del grupo de Cognito (administrador / jefe / operario),
// que se traduce a la misma plantilla de permisos que el login de demo.

import type { LocalId } from '../api/tipos'
import { uriOtpauth } from './totp'
import type { Permiso, ProveedorAuth, RespuestaAuth, Rol, Sesion } from './tipos'

interface Plantilla {
  rol: Rol
  locales: LocalId[]
  permisos: Permiso[]
}

// Mismas plantillas que los usuarios de demo (auth/simulada.ts)
const PLANTILLAS: Record<string, Plantilla> = {
  administrador: {
    rol: 'administrador',
    locales: ['local1', 'local2'],
    permisos: ['ver_actual', 'ver_alertas', 'ver_historico', 'ver_general', 'reconocer_alertas', 'modificar_umbrales', 'gestionar_usuarios'],
  },
  jefe: {
    rol: 'jefe_mantenimiento_operaciones',
    locales: ['local1', 'local2'],
    permisos: ['ver_actual', 'ver_alertas', 'ver_historico', 'ver_general', 'reconocer_alertas'],
  },
  operario: {
    rol: 'operario',
    locales: ['local1'],
    permisos: ['ver_actual', 'ver_alertas'],
  },
}
// Si un usuario no tiene grupo, entra con lo mínimo
const ORDEN_GRUPOS = ['administrador', 'jefe', 'operario']

const EMISOR_MFA = 'Induplac (nube)'

type Reto = 'NEW_PASSWORD_REQUIRED' | 'MFA_SETUP' | 'SOFTWARE_TOKEN_MFA'

interface Pendiente {
  usuario: string
  reto: Reto
  session: string
}

interface RespuestaCognito {
  AuthenticationResult?: { IdToken: string; AccessToken: string; ExpiresIn: number }
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
        throw new Error('El app client de Cognito no tiene habilitado ALLOW_USER_PASSWORD_AUTH.')
      throw new Error(MENSAJES[tipo] ?? datos.message ?? 'Error al iniciar sesión.')
    }
    return datos
  }

  // Convierte la respuesta de Cognito en el siguiente paso del login
  private siguiente(usuario: string, r: RespuestaCognito): RespuestaAuth {
    if (r.AuthenticationResult) return { sesion: this.crearSesion(usuario, r.AuthenticationResult) }
    const reto = r.ChallengeName as Reto
    const desafio = reto === 'NEW_PASSWORD_REQUIRED' ? 'cambiar_clave' : reto === 'MFA_SETUP' ? 'registrar_mfa' : reto === 'SOFTWARE_TOKEN_MFA' ? 'codigo_mfa' : null
    if (!desafio || !r.Session) throw new Error(`Paso de inicio de sesión no soportado: ${r.ChallengeName ?? 'desconocido'}.`)
    const id = aleatorio()
    this.pendientes.set(id, { usuario, reto, session: r.Session })
    return { desafio, sesion_temporal: id }
  }

  private crearSesion(usuario: string, res: { IdToken: string; AccessToken: string; ExpiresIn: number }): Sesion {
    const datos = payloadJwt(res.IdToken)
    const grupos = (datos['cognito:groups'] as string[] | undefined) ?? []
    const grupo = ORDEN_GRUPOS.find((g) => grupos.includes(g)) ?? 'operario'
    const p = PLANTILLAS[grupo]
    const sesion: Sesion = {
      usuario: String(datos['cognito:username'] ?? usuario),
      token: res.IdToken,
      rol: p.rol,
      locales: p.locales,
      permisos: p.permisos,
      expira: new Date(Date.now() + res.ExpiresIn * 1000).toISOString(),
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
    const r = await this.llamar('AssociateSoftwareToken', { Session: p.session })
    if (!r.SecretCode) throw new Error('Cognito no entregó el secreto del MFA.')
    if (r.Session) p.session = r.Session
    return { qr_uri: uriOtpauth(p.usuario, r.SecretCode, EMISOR_MFA) }
  }

  async verificarMfa(id: string, codigo: string): Promise<RespuestaAuth> {
    const p = this.tomar(id)
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
      return this.siguiente(p.usuario, r)
    }
    const r = await this.llamar('RespondToAuthChallenge', {
      ChallengeName: 'SOFTWARE_TOKEN_MFA',
      ClientId: this.clientId,
      Session: p.session,
      ChallengeResponses: { USERNAME: p.usuario, SOFTWARE_TOKEN_MFA_CODE: codigo },
    })
    this.pendientes.delete(id)
    return this.siguiente(p.usuario, r)
  }

  async yo(token: string): Promise<Sesion> {
    const datos = payloadJwt(token)
    if (Number(datos.exp) * 1000 < Date.now()) throw new Error('Sesión expirada.')
    const grupos = (datos['cognito:groups'] as string[] | undefined) ?? []
    const p = PLANTILLAS[ORDEN_GRUPOS.find((g) => grupos.includes(g)) ?? 'operario']
    return { usuario: String(datos['cognito:username']), token, rol: p.rol, locales: p.locales, permisos: p.permisos, expira: new Date(Number(datos.exp) * 1000).toISOString() }
  }

  async logout(token: string): Promise<void> {
    const access = this.accessTokens.get(token)
    this.accessTokens.delete(token)
    if (access) await this.llamar('GlobalSignOut', { AccessToken: access }).catch(() => {})
  }
}
