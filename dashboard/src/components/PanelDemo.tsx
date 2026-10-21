// Panel del simulador de fallas para la presentación (CONTEXTO §8.1).
// Usa los controles de demo de la fuente (contrato §5): en modo simulado
// actúa en memoria; en modo api llama a POST /api/demo/*.

import { useState } from 'react'
import { fuente, type EstadoLocal, type LocalId, type VariableId } from '../api'
import { refrescarTodo, usePolling } from '../hooks/usePolling'

const GUION = [
  'Todo en verde: "En vivo".',
  'Cortar internet de la Planta: el indicador pasa a rojo, pero los datos siguen llegando.',
  'Inyectar UV alto: la alerta aparece igual, generada en planta.',
  'Mostrar los pendientes acumulándose.',
  'Restablecer internet: "Sincronizando" con los pendientes bajando.',
  'Vuelve "En vivo": no se perdió ningún dato ni se duplicó la alerta.',
]

const INYECCIONES: { etiqueta: string; detalle: string; local: LocalId; variable: VariableId; valor: number }[] = [
  { etiqueta: 'UV alto', detalle: 'Planta · 9,5 UVI', local: 'local1', variable: 'uv_index', valor: 9.5 },
  { etiqueta: 'Sobreconsumo', detalle: 'Planta · 60 kW', local: 'local1', variable: 'energia_kw', valor: 60 },
  { etiqueta: 'Posible fuga', detalle: 'Oficinas · 0,4 m³/h', local: 'local2', variable: 'agua_m3h', valor: 0.4 },
]

const NOMBRE: Record<LocalId, string> = { local1: 'Planta', local2: 'Oficinas' }

const COLOR_ESTADO = {
  online: 'text-ok',
  offline: 'text-critico',
  sincronizando: 'text-aviso',
}

function FilaEnlace({ e, onCambiar }: { e: EstadoLocal; onCambiar: (conectado: boolean) => void }) {
  const caido = e.enlace === 'offline'
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-fondo px-3 py-2">
      <div>
        <p className="text-sm font-bold">{NOMBRE[e.local_id]}</p>
        <p className={`text-xs ${COLOR_ESTADO[e.enlace]}`}>
          {e.enlace === 'online' ? 'En vivo' : e.enlace === 'offline' ? 'Sin internet' : 'Sincronizando'}
          {e.pendientes > 0 && ` · ${e.pendientes} pendientes`}
        </p>
      </div>
      <button
        onClick={() => onCambiar(caido)}
        disabled={e.enlace === 'sincronizando'}
        className={`rounded-md px-3 py-1.5 text-xs font-bold disabled:opacity-40 ${
          caido ? 'bg-ok text-fondo hover:brightness-110' : 'bg-critico text-white hover:brightness-110'
        }`}
      >
        {caido ? 'Restablecer internet' : 'Cortar internet'}
      </button>
    </div>
  )
}

export function PanelDemo() {
  const [abierto, setAbierto] = useState(false)
  const { datos: estado } = usePolling(() => fuente.estado(), 1_000)
  const demo = fuente.demo
  if (!demo) return null

  const ejecutar = async (accion: () => Promise<void>) => {
    await accion()
    refrescarTodo()
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {abierto && (
        <aside className="max-h-[80vh] w-[min(360px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-borde bg-panel p-4 shadow-2xl shadow-black/50">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Simulador de fallas</h2>
            <button onClick={() => setAbierto(false)} className="text-tinta-2 hover:text-tinta" aria-label="Cerrar">
              ✕
            </button>
          </div>

          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-tinta-2">Enlace Edge → AWS</h3>
          <div className="mb-4 grid gap-2">
            {estado?.locales.map((e) => (
              <FilaEnlace key={e.local_id} e={e} onCambiar={(c) => ejecutar(() => demo.enlace(e.local_id, c))} />
            ))}
          </div>

          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-tinta-2">Inyectar lectura (90 s)</h3>
          <div className="mb-2 grid grid-cols-3 gap-2">
            {INYECCIONES.map((i) => (
              <button
                key={i.etiqueta}
                onClick={() => ejecutar(() => demo.inyectar(i.local, i.variable, i.valor))}
                className="rounded-md border border-critico/40 bg-critico/10 px-2 py-2 text-left hover:bg-critico/20"
              >
                <span className="block text-xs font-bold text-critico">{i.etiqueta}</span>
                <span className="block text-[11px] text-tinta-2">{i.detalle}</span>
              </button>
            ))}
          </div>
          {demo.limpiar && (
            <button onClick={() => ejecutar(() => demo.limpiar!())} className="mb-4 text-xs text-tinta-2 underline hover:text-tinta">
              Volver a valores normales
            </button>
          )}

          <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-tinta-2">Guion del showcase</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-tinta-2">
            {GUION.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-tinta-3">
            Demo acelerada: cada lectura sin internet cuenta como un intervalo de 15 min pendiente de subir.
          </p>
        </aside>
      )}
      <button
        onClick={() => setAbierto((a) => !a)}
        className="rounded-full border border-borde bg-panel px-4 py-2 text-sm font-bold shadow-lg shadow-black/40 hover:border-tinta-3"
      >
        {abierto ? 'Ocultar demo' : '🎬 Demo'}
      </button>
    </div>
  )
}
