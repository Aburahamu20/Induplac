// Capa 2: tabla simple para comprobar que los datos llegan y se mueven.
// En la Capa 3 se reemplaza por tarjetas KPI.

import { fuente, type LocalId, type Nivel } from '../api'
import { VARIABLES, formatear } from '../api/variables'
import { usePolling } from '../hooks/usePolling'

const PUNTO: Record<Nivel, string> = {
  normal: 'bg-green-500',
  advertencia: 'bg-amber-400',
  critico: 'bg-red-600',
}

export function TablaValores({ local, titulo }: { local: LocalId; titulo?: string }) {
  const { datos, error } = usePolling(() => fuente.actual(local), 5_000, [local])

  if (error) return <p className="text-red-700">Error: {error}</p>
  if (!datos) return <p className="text-slate-500">Cargando…</p>

  return (
    <section className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {titulo && <h3 className="mb-3 font-display text-lg font-bold">{titulo}</h3>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-normal">Variable</th>
              <th className="py-1 pr-3 text-right font-normal">Valor</th>
              <th className="py-1 pr-3 text-right font-normal">Referencia</th>
              <th className="py-1 font-normal">Nivel</th>
            </tr>
          </thead>
          <tbody>
            {datos.variables.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="py-1.5 pr-3">{VARIABLES[v.id].nombre}</td>
                <td className="py-1.5 pr-3 text-right font-bold tabular-nums">
                  {formatear(v.id, v.valor)} <span className="font-normal text-slate-500">{VARIABLES[v.id].unidad}</span>
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums text-slate-500">
                  {v.referencia === null ? '—' : formatear(v.id, v.referencia)}
                </td>
                <td className="py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${PUNTO[v.nivel]}`} />
                    {v.nivel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Última lectura: {new Date(datos.ts).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago' })}
      </p>
    </section>
  )
}
