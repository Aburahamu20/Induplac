// La "fuente de datos" que usan las pantallas.
// Hoy: FuenteSimulada (datos ficticios en el navegador).
// Después: FuenteApi (fetch a la API del Edge o de AWS), con las mismas funciones.

import type {
  ActualRespuesta,
  VariableId,
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
  reconocerAlerta(id: string): Promise<Alerta>
  // Solo en la demo (contrato §5). Undefined en producción.
  demo?: ControlDemo
}

export interface ControlDemo {
  enlace(local: LocalId, conectado: boolean): Promise<void>
  inyectar(local: LocalId, variable: VariableId, valor: number): Promise<void>
  limpiar?(): Promise<void>
}
