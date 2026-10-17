// Elige la fuente de datos según las variables de entorno de Vite:
//   VITE_FUENTE=simulada (por defecto) | api
//   VITE_API_URL=/api (planta) o la URL de API Gateway (nube)

import type { Fuente } from './fuente'
import { FuenteApi } from './real'
import { FuenteSimulada } from './simulada'

export const usaSimulacion = import.meta.env.VITE_FUENTE !== 'api'

export const fuente: Fuente = usaSimulacion
  ? new FuenteSimulada()
  : new FuenteApi(import.meta.env.VITE_API_URL ?? '/api')

export type { Fuente } from './fuente'
export * from './tipos'
