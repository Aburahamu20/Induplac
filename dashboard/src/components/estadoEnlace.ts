import type { EstadoLocal } from '../api'

// En la vista General se muestra el peor estado de los dos locales
export function peorEstado(locales: EstadoLocal[]): Pick<EstadoLocal, 'enlace' | 'pendientes'> {
  const offline = locales.find((l) => l.enlace === 'offline')
  if (offline) return offline
  const sync = locales.filter((l) => l.enlace === 'sincronizando')
  if (sync.length) return { enlace: 'sincronizando', pendientes: sync.reduce((n, l) => n + l.pendientes, 0) }
  return { enlace: 'online', pendientes: 0 }
}
