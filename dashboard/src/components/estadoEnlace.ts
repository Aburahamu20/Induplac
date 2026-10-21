import type { EstadoLocal, EstadoRespuesta, LocalId } from '../api'

// Aviso del encabezado. Distingue tres casos que antes se mostraban igual:
//   - el navegador no llega a la API              -> "Sin conexión con el servidor"
//   - en la NUBE, una sede no manda datos hace rato -> "Sin datos de Planta desde 22:30"
//     (desde la nube no se sabe si el Edge está sin internet, apagado o sin sensores: solo que no llegan datos)
//   - en PLANTA (Edge), el Edge no llega a AWS     -> "Sin conexión con la nube"
export type Tono = 'ok' | 'aviso' | 'critico'
export interface Aviso {
  tono: Tono
  texto: string
  detalle?: string
}

const SEDE: Record<LocalId, string> = { local1: 'Planta', local2: 'Oficinas' }

function horaCorta(iso: string): string {
  const d = new Date(iso)
  const zona = { timeZone: 'America/Santiago' } as const
  const hoy = new Date().toLocaleDateString('es-CL', zona) === d.toLocaleDateString('es-CL', zona)
  const hora = d.toLocaleTimeString('es-CL', { ...zona, hour: '2-digit', minute: '2-digit', hour12: false })
  return hoy ? `las ${hora}` : `el ${d.toLocaleDateString('es-CL', { ...zona, day: '2-digit', month: '2-digit' })} a las ${hora}`
}

export function avisoEnlace(
  locales: EstadoLocal[],
  origen: EstadoRespuesta['origen'] | undefined,
  errorServidor: boolean,
): Aviso | undefined {
  if (errorServidor)
    return { tono: 'critico', texto: 'Sin conexión con el servidor', detalle: 'El navegador no logra comunicarse con la API. Revisa tu conexión a internet.' }
  if (!locales.length) return undefined

  const caidas = locales.filter((l) => l.enlace === 'offline')
  if (caidas.length) {
    if (origen !== 'nube')
      return { tono: 'critico', texto: 'Sin conexión con la nube', detalle: 'El Edge sigue guardando y alertando en local; sube los pendientes al volver la conexión.' }
    const nombres = caidas.map((l) => SEDE[l.local_id]).join(' y ')
    const fechas = caidas.map((l) => l.ultimo_dato).filter((x): x is string => !!x).sort()
    const desde = fechas.length ? ` desde ${horaCorta(fechas[fechas.length - 1])}` : ''
    return {
      tono: 'aviso',
      texto: `Sin datos de ${nombres}${desde}`,
      detalle: 'La nube no recibe datos nuevos del Edge: puede estar apagado o sin internet. Los datos guardados en planta se suben al volver.',
    }
  }

  const sync = locales.filter((l) => l.enlace === 'sincronizando')
  if (sync.length) return { tono: 'aviso', texto: `Sincronizando (${sync.reduce((n, l) => n + l.pendientes, 0)} pendientes)` }
  return { tono: 'ok', texto: 'En vivo' }
}
