// Elige el proveedor de login según la fuente de datos:
//   simulada -> AuthSimulada (usuarios de demo en el navegador)
//   api      -> AuthApi (login local del Edge, contrato §6.2)
// Para la nube se agrega un proveedor de Cognito con la misma interfaz.

import { usaSimulacion } from '../api'

// VITE_AUTH=simulada permite usar el login de demo aunque los datos vengan de la API real
// (mientras no exista Cognito en la nube). Por defecto sigue a la fuente de datos.
const loginSimulado = import.meta.env.VITE_AUTH ? import.meta.env.VITE_AUTH === 'simulada' : usaSimulacion
import { AuthApi } from './api'
import { AuthSimulada } from './simulada'
import type { ProveedorAuth } from './tipos'

export const authSimulada = loginSimulado ? new AuthSimulada() : null

export const auth: ProveedorAuth = authSimulada ?? new AuthApi(import.meta.env.VITE_API_URL ?? '/api')

export * from './tipos'
