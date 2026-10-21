// Elige el proveedor de login:
//   VITE_AUTH=cognito  -> AuthCognito (Amazon Cognito con MFA, para la nube)
//   VITE_AUTH=simulada -> AuthSimulada (usuarios de demo en el navegador)
//   VITE_AUTH=api      -> AuthApi (login local del Edge, contrato §6.2)
// Sin VITE_AUTH sigue a la fuente de datos (simulada -> simulada, api -> api).

import { usaSimulacion } from '../api'
import { AuthApi } from './api'
import { AuthCognito } from './cognito'
import { AuthSimulada } from './simulada'
import type { ProveedorAuth } from './tipos'

const modo = import.meta.env.VITE_AUTH ?? (usaSimulacion ? 'simulada' : 'api')

export const usaCognito = modo === 'cognito'

export const authSimulada = modo === 'simulada' ? new AuthSimulada() : null

function crear(): ProveedorAuth {
  if (authSimulada) return authSimulada
  if (usaCognito) {
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
    if (!clientId) throw new Error('Falta VITE_COGNITO_CLIENT_ID en .env.local')
    return new AuthCognito(import.meta.env.VITE_COGNITO_REGION ?? 'us-east-1', clientId)
  }
  return new AuthApi(import.meta.env.VITE_API_URL ?? '/api')
}

export const auth: ProveedorAuth = crear()

export * from './tipos'
