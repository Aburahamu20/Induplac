import { useState } from 'react'
import { fuente, usaSimulacion, type LocalId } from './api'
import { BadgeEnlace } from './components/BadgeEnlace'
import { peorEstado } from './components/estadoEnlace'
import { TablaValores } from './components/TablaValores'
import { usePolling } from './hooks/usePolling'

type Vista = 'general' | LocalId

const VISTAS: { id: Vista; nombre: string; detalle: string }[] = [
  { id: 'general', nombre: 'General', detalle: 'Vista consolidada de ambas sedes' },
  { id: 'local1', nombre: 'Local 1 · Planta', detalle: 'Maquinaria, agua industrial, UV y producción' },
  { id: 'local2', nombre: 'Local 2 · Oficinas', detalle: 'Climatización, iluminación y agua sanitaria' },
]

export default function App() {
  const [vista, setVista] = useState<Vista>('general')
  const { datos: estado } = usePolling(() => fuente.estado(), 5_000)

  const actual = VISTAS.find((v) => v.id === vista)!
  const enlace = estado
    ? vista === 'general'
      ? peorEstado(estado.locales)
      : estado.locales.find((l) => l.local_id === vista)
    : undefined

  return (
    <div className="min-h-screen">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide">Induplac IoT</h1>
            {usaSimulacion && <p className="text-xs text-slate-400">Datos simulados</p>}
          </div>
          {enlace && <BadgeEnlace estado={enlace} />}
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {VISTAS.map((v) => (
            <button
              key={v.id}
              onClick={() => setVista(v.id)}
              className={`whitespace-nowrap rounded-t-md px-4 py-2 font-display font-semibold ${
                vista === v.id ? 'bg-slate-100 text-slate-900' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {v.nombre}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <h2 className="font-display text-xl font-bold">{actual.nombre}</h2>
        <p className="mb-6 text-slate-600">{actual.detalle}</p>

        {vista === 'general' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <TablaValores local="local1" titulo="Local 1 · Planta" />
            <TablaValores local="local2" titulo="Local 2 · Oficinas" />
          </div>
        ) : (
          <TablaValores local={vista} />
        )}
      </main>
    </div>
  )
}
