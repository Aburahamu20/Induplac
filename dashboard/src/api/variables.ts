// Nombres en pantalla y unidades (docs/api-dashboard.md §4).
// Propuesta del contrato (§7 punto 3): los nombres viven en el dashboard.

import type { VariableId } from './tipos'

export const VARIABLES: Record<VariableId, { nombre: string; unidad: string; decimales: number }> = {
  energia_kw: { nombre: 'Energía (potencia actual)', unidad: 'kW', decimales: 1 },
  energia_climatizacion_kw: { nombre: 'Climatización', unidad: 'kW', decimales: 1 },
  energia_iluminacion_kw: { nombre: 'Iluminación', unidad: 'kW', decimales: 1 },
  agua_m3h: { nombre: 'Caudal de agua', unidad: 'm³/h', decimales: 2 },
  agua_m3_dia: { nombre: 'Agua consumida hoy', unidad: 'm³', decimales: 2 },
  uv_index: { nombre: 'Índice UV', unidad: 'UVI', decimales: 1 },
  produccion_mes: { nombre: 'Tableros del mes', unidad: 'unid.', decimales: 0 },
  produccion_anual: { nombre: 'Tableros del año', unidad: 'unid.', decimales: 0 },
  hh_sin_incidentes: { nombre: 'Horas hombre sin incidentes', unidad: 'h', decimales: 0 },
  dias_sin_incidentes: { nombre: 'Días sin incidentes', unidad: 'días', decimales: 0 },
}

export function formatear(id: VariableId, valor: number): string {
  return valor.toLocaleString('es-CL', {
    minimumFractionDigits: VARIABLES[id].decimales,
    maximumFractionDigits: VARIABLES[id].decimales,
  })
}
