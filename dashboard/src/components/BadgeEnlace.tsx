import type { EstadoLocal } from '../api'

const ESTILOS = {
  online: 'bg-green-100 text-green-800 ring-green-600/30',
  offline: 'bg-red-100 text-red-800 ring-red-600/30',
  sincronizando: 'bg-amber-100 text-amber-800 ring-amber-600/30',
}

export function BadgeEnlace({ estado }: { estado: Pick<EstadoLocal, 'enlace' | 'pendientes'> }) {
  const texto =
    estado.enlace === 'online'
      ? '🟢 ONLINE'
      : estado.enlace === 'offline'
        ? '🔴 OFFLINE'
        : `🟡 SINCRONIZANDO (${estado.pendientes} pendientes)`

  return (
    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold ring-1 ${ESTILOS[estado.enlace]}`}>
      {texto}
    </span>
  )
}
