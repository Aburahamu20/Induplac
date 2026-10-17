// La "fuente de datos" que usan las pantallas.
// Hoy: FuenteSimulada (datos ficticios en el navegador).
// Después: FuenteApi (fetch a la API del Edge o de AWS), con las mismas funciones.

import type {
  ActualRespuesta,
  Alerta,
  ConsultaHistorico,
  EstadoRespuesta,
  HistoricoRespuesta,
  LocalId,
  LocalInfo,
} from './tipos'

export interface Fuente {
  estado(): Promise<EstadoRespuesta>
  locales(): Promise<LocalInfo[]>
  actual(local: LocalId): Promise<ActualRespuesta>
  alertas(filtro?: { local_id?: LocalId; estado?: Alerta['estado'] }): Promise<Alerta[]>
  historico(consulta: ConsultaHistorico): Promise<HistoricoRespuesta>
}
