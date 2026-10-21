import { useEffect, useState } from 'react'
import type { Aviso } from './estadoEnlace'
import { NOMBRE_ROL } from '../auth'
import { useSesion } from '../auth/sesion'

const PILDORA = {
  ok: { clase: 'border-ok/40 bg-ok/10 text-ok', punto: 'bg-ok' },
  aviso: { clase: 'border-aviso/40 bg-aviso/10 text-aviso', punto: 'bg-aviso' },
  critico: { clase: 'border-critico/40 bg-critico/10 text-critico', punto: 'bg-critico' },
}

function useReloj() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])
  return ahora
}

export function Encabezado({ aviso, simulado }: { aviso?: Aviso; simulado: boolean }) {
  const ahora = useReloj()
  const { sesion, cerrar } = useSesion()
  const p = aviso ? PILDORA[aviso.tono] : null

  return (
    <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-oficinas text-sm font-bold text-white">IP</div>
        <div>
          <h1 className="font-bold leading-tight">Induplac — Panel IoT</h1>
          <p className="text-xs text-tinta-2">
            Visibilidad operacional en tiempo real
            {simulado && <span className="ml-2 rounded bg-borde px-1.5 py-0.5 text-[10px] text-tinta-2">DATOS SIMULADOS</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-tinta-2">
          {ahora.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour12: false })}
        </span>
        {p && aviso && (
          <span
            title={aviso.detalle}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${p.clase}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${p.punto} ${aviso.tono !== 'critico' ? 'latido' : ''}`} />
            {aviso.texto}
          </span>
        )}
        <div className="flex items-center gap-2 border-l border-borde pl-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-bold">{sesion.usuario}</p>
            <p className="text-[11px] text-tinta-2">{NOMBRE_ROL[sesion.rol]}</p>
          </div>
          <button
            onClick={cerrar}
            className="rounded-md border border-borde px-2.5 py-1 text-xs text-tinta-2 hover:border-tinta-3 hover:text-tinta"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  )
}
