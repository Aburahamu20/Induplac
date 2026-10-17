import { useState } from 'react'
import { fuente, usaSimulacion } from './api'
import { Encabezado } from './components/Encabezado'
import { peorEstado } from './components/estadoEnlace'
import { usePolling } from './hooks/usePolling'
import { VistaAlertas, VistaOficinas, VistaPlanta, VistaResumen } from './vistas'

type Pestana = 'resumen' | 'oficinas' | 'planta' | 'alertas'

const PESTANAS: { id: Pestana; nombre: string }[] = [
  { id: 'resumen', nombre: 'Resumen general' },
  { id: 'oficinas', nombre: 'Oficinas administrativas' },
  { id: 'planta', nombre: 'Planta de fabricación' },
  { id: 'alertas', nombre: 'Alertas' },
]

export default function App() {
  const [pestana, setPestana] = useState<Pestana>('resumen')
  const { datos: estado } = usePolling(() => fuente.estado(), 5_000)
  const { datos: alertas } = usePolling(() => fuente.alertas({ estado: 'activa' }), 5_000)

  const enlace = estado
    ? pestana === 'oficinas'
      ? estado.locales.find((l) => l.local_id === 'local2')
      : pestana === 'planta'
        ? estado.locales.find((l) => l.local_id === 'local1')
        : peorEstado(estado.locales)
    : undefined

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde">
        <Encabezado enlace={enlace} simulado={usaSimulacion} />
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 pb-0">
          {PESTANAS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap rounded-t-md border px-4 py-2 text-sm ${
                pestana === p.id
                  ? 'border-borde border-b-fondo bg-fondo font-bold text-tinta'
                  : 'border-transparent text-tinta-2 hover:text-tinta'
              }`}
            >
              {p.nombre}
              {p.id === 'alertas' && alertas && alertas.length > 0 && (
                <span className="rounded-full bg-critico px-1.5 text-xs font-bold text-white">{alertas.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        {pestana === 'resumen' && <VistaResumen />}
        {pestana === 'oficinas' && <VistaOficinas />}
        {pestana === 'planta' && <VistaPlanta />}
        {pestana === 'alertas' && <VistaAlertas />}
      </main>
    </div>
  )
}
