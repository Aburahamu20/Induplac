// Tarjeta KPI del diseño: título, número grande, línea de estado y barra inferior.

import type { ReactNode } from 'react'
import { TONO_BARRA, TONO_TEXTO, type Tono } from './estilos'

interface Props {
  titulo: string
  valor: string
  unidad: string
  estado?: { texto: string; tono: Tono }
  barra?: { pct: number; tono: Tono }
  alerta?: boolean
  children?: ReactNode
}

export function KpiCard({ titulo, valor, unidad, estado, barra, alerta, children }: Props) {
  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-borde bg-panel">
      {alerta && (
        <span className="latido absolute right-3 top-3 h-2 w-2 rounded-full bg-critico" title="Nivel crítico" />
      )}
      <div className="flex-1 px-4 pb-4 pt-3.5">
        <h3 className="text-sm text-tinta-2">{titulo}</h3>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="text-3xl font-bold tabular-nums tracking-tight">{valor}</span>
          <span className="text-sm text-tinta-2">{unidad}</span>
        </p>
        {estado && <p className={`mt-1.5 text-sm ${TONO_TEXTO[estado.tono]}`}>{estado.texto}</p>}
        {children}
      </div>
      {barra && (
        <div className="h-1 w-full bg-borde/70">
          <div
            className={`h-full rounded-r-full transition-[width] duration-700 ${TONO_BARRA[barra.tono]}`}
            style={{ width: `${Math.max(2, Math.min(100, barra.pct))}%` }}
          />
        </div>
      )}
    </article>
  )
}
