// Autenticación contra la API del Edge (contrato §6.2).
// En la nube se reemplaza por Cognito con la misma interfaz (ProveedorAuth).

import type { ProveedorAuth, RespuestaAuth, Sesion } from './tipos'

interface RespuestaServidor {
  token?: string
  rol?: Sesion['rol']
  locales?: Sesion['locales']
  permisos?: Sesion['permisos']
  expira?: string
  desafio?: 'cambiar_clave' | 'registrar_mfa' | 'codigo_mfa'
  sesion?: string
}

export class AuthApi implements ProveedorAuth {
  private base: string
  private usuarioActual = ''

  constructor(base: string) {
    this.base = base.replace(/\/$/, '')
  }

  private async pedir<T>(ruta: string, cuerpo?: unknown, token?: string): Promise<T> {
    const res = await fetch(`${this.base}${ruta}`, {
      method: cuerpo === undefined && !ruta.endsWith('logout') ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    if (!res.ok) {
      const e = await res.json().catch(() => null)
      throw new Error(e?.error?.mensaje ?? `Error HTTP ${res.status}`)
    }
    return res.status === 204 ? (undefined as T) : res.json()
  }

  private convertir(r: RespuestaServidor): RespuestaAuth {
    if (r.desafio && r.sesion) return { desafio: r.desafio, sesion_temporal: r.sesion }
    return {
      sesion: {
        usuario: this.usuarioActual,
        token: r.token!,
        rol: r.rol!,
        locales: r.locales ?? [],
        permisos: r.permisos ?? [],
        expira: r.expira!,
      },
    }
  }

  async login(usuario: string, clave: string) {
    this.usuarioActual = usuario
    return this.convertir(await this.pedir<RespuestaServidor>('/auth/login', { usuario, clave }))
  }

  async cambiarClave(sesion: string, clave_nueva: string) {
    return this.convertir(await this.pedir<RespuestaServidor>('/auth/cambiar-clave', { sesion, clave_nueva }))
  }

  registrarMfa(sesion: string) {
    return this.pedir<{ qr_uri: string }>('/auth/mfa/registrar', { sesion })
  }

  async verificarMfa(sesion: string, codigo: string) {
    return this.convertir(await this.pedir<RespuestaServidor>('/auth/mfa/verificar', { sesion, codigo }))
  }

  async yo(token: string): Promise<Sesion> {
    const r = await this.pedir<RespuestaServidor & { usuario?: string }>('/auth/yo', undefined, token)
    return {
      usuario: r.usuario ?? this.usuarioActual,
      token,
      rol: r.rol!,
      locales: r.locales ?? [],
      permisos: r.permisos ?? [],
      expira: r.expira!,
    }
  }

  async logout(token: string) {
    await this.pedir<void>('/auth/logout', {}, token)
  }
}
