// Elige el proveedor de login según la fuente de datos:
//   simulada -> AuthSimulada (usuarios de demo en el navegador)
//   api      -> AuthApi (login local del Edge, contrato §6.2)
// Para la nube se agrega un proveedor de Cognito con la misma interfaz.

import { usaSimulacion } from '../api'
import { AuthApi } from './api'
import { AuthSimulada } from './simulada'
import type { ProveedorAuth } from './tipos'

export const authSimulada = usaSimulacion ? new AuthSimulada() : null

export const auth: ProveedorAuth = authSimulada ?? new AuthApi(import.meta.env.VITE_API_URL ?? '/api')

export * from './tipos'
