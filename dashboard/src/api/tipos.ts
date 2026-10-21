// Tipos del contrato de datos (docs/api-dashboard.md).
// Si el contrato cambia, se cambia aquí primero.

export type LocalId = 'local1' | 'local2'

export type Nivel = 'normal' | 'advertencia' | 'critico'

export type EstadoEnlace = 'online' | 'offline' | 'sincronizando'

export type VariableId =
  | 'energia_kw'
  | 'energia_climatizacion_kw'
  | 'energia_iluminacion_kw'
  | 'agua_m3h'
  | 'agua_m3_dia'
  | 'uv_index'
  | 'produccion_mes'
  | 'produccion_anual'
  | 'hh_sin_incidentes'
  | 'dias_sin_incidentes'

// §3.1 GET /api/estado
export interface EstadoLocal {
  local_id: LocalId
  enlace: EstadoEnlace
  pendientes: number
  ultima_sincronizacion: string | null
  ultimo_dato: string | null
}

export interface EstadoRespuesta {
  origen: 'edge' | 'nube' | 'simulada'
  hora_servidor: string
  locales: EstadoLocal[]
}

// §3.2 GET /api/locales
export interface LocalInfo {
  local_id: LocalId
  nombre: string
  variables: VariableId[]
}

// §3.3 GET /api/locales/{id}/actual
export interface ValorVariable {
  id: VariableId
  valor: number
  referencia: number | null
  nivel: Nivel
}

export interface ActualRespuesta {
  local_id: LocalId
  ts: string
  variables: ValorVariable[]
}

// §3.4 GET /api/alertas
export interface Alerta {
  id: string
  local_id: LocalId
  variable: VariableId
  nivel: Nivel
  valor: number
  umbral: number
  regla: string
  inicio_intervalo: string
  estado: 'activa' | 'reconocida' | 'cerrada'
  origen: 'edge' | 'lambda'
  reconocida_en: string | null
}

// §3.6 GET /api/historico
export type Agrupacion = '15min' | 'hora' | 'dia' | 'mes'

export interface ConsultaHistorico {
  local_ids: LocalId[]
  variable: VariableId
  desde: string
  hasta: string
  agrupacion: Agrupacion
}

export interface PuntoHistorico {
  inicio: string
  promedio: number | null
  maximo: number | null
  total: number | null
}

export interface HistoricoRespuesta {
  variable: VariableId
  agrupacion: Agrupacion
  series: { local_id: LocalId; puntos: PuntoHistorico[] }[]
}
