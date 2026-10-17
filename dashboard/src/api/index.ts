// Elige la fuente de datos según las variables de entorno de Vite:
//   VITE_FUENTE=simulada (por defecto) | api
//   VITE_API_URL=/api (planta) o la URL de API Gateway (nube)

import type { Fuente } from './fuente'
import { FuenteApi } from './real'
import { FuenteSimulada } from './simulada'

export const usaSimulacion = import.meta.env.VITE_FUENTE !== 'api'

// Panel de demo: visible salvo que VITE_DEMO=false (en producción se apaga)
export const conDemo = import.meta.env.VITE_DEMO !== 'false'

export const fuente: Fuente = usaSimulacion
  ? new FuenteSimulada()
  : new FuenteApi(import.meta.env.VITE_API_URL ?? '/api', () => null, conDemo)

export type { ControlDemo, Fuente } from './fuente'
export * from './tipos'
