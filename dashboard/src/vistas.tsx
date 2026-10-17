// Las cuatro pestañas del dashboard.

import type { ReactNode } from 'react'
import { fuente, type ActualRespuesta, type Alerta, type LocalId, type VariableId } from './api'
import { VARIABLES, formatear } from './api/variables'
import { SEDES } from './components/estilos'
import { GraficoAgua, GraficoEnergia } from './components/graficos'
import {
  TarjetaAgua,
  TarjetaCaudal,
  TarjetaEnergia,
  TarjetaHH,
  TarjetaProduccion,
  TarjetaSubconsumo,
  TarjetaUv,
} from './components/tarjetas'
import { usePolling } from './hooks/usePolling'

// Umbral de alerta de agua diaria por local (CONTEXTO §8.2), para la barra
const UMBRAL_AGUA: Record<LocalId, number> = { local1: 14, local2: 2.5 }

function useActual(local: LocalId) {
  return usePolling(() => fuente.actual(local), 5_000, [local]).datos
}

const val = (a: ActualRespuesta | null, id: VariableId) => a?.variables.find((v) => v.id === id)

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-tinta-2">{titulo}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}

function Cargando() {
  return <p className="py-10 text-center text-tinta-3">Cargando datos…</p>
}

// ---------- Resumen general ----------

export function VistaResumen() {
  const of = useActual('local2')
  const pl = useActual('local1')
  if (!of || !pl) return <Cargando />

  return (
    <>
      <Seccion titulo="Energía eléctrica y agua — ambas sedes">
        <TarjetaEnergia titulo="Consumo actual — Oficinas" v={val(of, 'energia_kw')!} />
        <TarjetaEnergia titulo="Consumo actual — Planta" v={val(pl, 'energia_kw')!} />
        <TarjetaAgua titulo="Agua hoy — Oficinas" v={val(of, 'agua_m3_dia')!} umbral={UMBRAL_AGUA.local2} />
        <TarjetaAgua titulo="Agua hoy — Planta" v={val(pl, 'agua_m3_dia')!} umbral={UMBRAL_AGUA.local1} />
      </Seccion>
      <Seccion titulo="Indicadores operacionales">
        <TarjetaProduccion titulo="Tableros fabricados — mes" v={val(pl, 'produccion_mes')!} periodo="mensual" />
        <TarjetaProduccion titulo="Tableros — acumulado año" v={val(pl, 'produccion_anual')!} periodo="anual" />
        <TarjetaHH titulo="HH sin incidentes — Planta" hh={val(pl, 'hh_sin_incidentes')!} dias={val(pl, 'dias_sin_incidentes')} />
        <TarjetaUv titulo="Índice UV — hoy" v={val(pl, 'uv_index')!} />
      </Seccion>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
        <GraficoEnergia locales={['local2', 'local1']} />
        <GraficoAgua locales={['local2', 'local1']} />
      </div>
    </>
  )
}

// ---------- Oficinas (Local 2) ----------

export function VistaOficinas() {
  const a = useActual('local2')
  if (!a) return <Cargando />
  return (
    <>
      <Seccion titulo="Energía eléctrica">
        <TarjetaEnergia titulo="Consumo actual" v={val(a, 'energia_kw')!} />
        <TarjetaSubconsumo titulo="Climatización" v={val(a, 'energia_climatizacion_kw')!} />
        <TarjetaSubconsumo titulo="Iluminación" v={val(a, 'energia_iluminacion_kw')!} />
      </Seccion>
      <Seccion titulo="Agua y seguridad">
        <TarjetaAgua titulo="Agua consumida hoy" v={val(a, 'agua_m3_dia')!} umbral={UMBRAL_AGUA.local2} />
        <TarjetaCaudal titulo="Caudal de agua" v={val(a, 'agua_m3h')!} />
        <TarjetaHH titulo="HH sin incidentes" hh={val(a, 'hh_sin_incidentes')!} dias={val(a, 'dias_sin_incidentes')} />
      </Seccion>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
        <GraficoEnergia locales={['local2']} />
        <GraficoAgua locales={['local2']} />
      </div>
    </>
  )
}

// ---------- Planta (Local 1) ----------

export function VistaPlanta() {
  const a = useActual('local1')
  if (!a) return <Cargando />
  return (
    <>
      <Seccion titulo="Energía, agua y ambiente">
        <TarjetaEnergia titulo="Consumo actual" v={val(a, 'energia_kw')!} />
        <TarjetaAgua titulo="Agua consumida hoy" v={val(a, 'agua_m3_dia')!} umbral={UMBRAL_AGUA.local1} />
        <TarjetaCaudal titulo="Caudal de agua" v={val(a, 'agua_m3h')!} />
        <TarjetaUv titulo="Índice UV — patio de carga" v={val(a, 'uv_index')!} />
      </Seccion>
      <Seccion titulo="Producción y seguridad">
        <TarjetaProduccion titulo="Tableros fabricados — mes" v={val(a, 'produccion_mes')!} periodo="mensual" />
        <TarjetaProduccion titulo="Tableros — acumulado año" v={val(a, 'produccion_anual')!} periodo="anual" />
        <TarjetaHH titulo="HH sin incidentes" hh={val(a, 'hh_sin_incidentes')!} dias={val(a, 'dias_sin_incidentes')} />
      </Seccion>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
        <GraficoEnergia locales={['local1']} />
        <GraficoAgua locales={['local1']} />
      </div>
    </>
  )
}

// ---------- Alertas ----------

const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', {
    timeZone: 'America/Santiago',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

function TarjetaAlerta({ a }: { a: Alerta }) {
  const v = VARIABLES[a.variable]
  return (
    <article className="rounded-lg border border-critico/40 border-l-4 border-l-critico bg-critico/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold text-critico">
            ▲ {v.nombre} — {SEDES[a.local_id].nombre}
          </h3>
          <p className="mt-1 text-sm text-tinta-2">{a.regla}</p>
        </div>
        <span className="rounded-full border border-borde px-2 py-0.5 text-xs text-tinta-2">
          {a.origen === 'edge' ? 'Generada en planta (sin internet)' : 'Generada en la nube'}
        </span>
      </div>
      <p className="mt-3 text-sm">
        Valor <b className="tabular-nums">{formatear(a.variable, a.valor)} {v.unidad}</b> · umbral{' '}
        <span className="tabular-nums">{formatear(a.variable, a.umbral)} {v.unidad}</span> · desde las{' '}
        {fechaHora(a.inicio_intervalo)}
      </p>
    </article>
  )
}

export function VistaAlertas() {
  const { datos } = usePolling(() => fuente.alertas(), 5_000)
  if (!datos) return <Cargando />
  const activas = datos.filter((a) => a.estado === 'activa')
  const otras = datos.filter((a) => a.estado !== 'activa')

  return (
    <>
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-tinta-2">Alertas activas ({activas.length})</h2>
      {activas.length === 0 ? (
        <p className="rounded-lg border border-borde bg-panel p-6 text-center text-ok">✓ Sin alertas activas en ninguna sede</p>
      ) : (
        <div className="grid gap-3">
          {activas.map((a) => (
            <TarjetaAlerta key={a.id} a={a} />
          ))}
        </div>
      )}
      {otras.length > 0 && (
        <p className="mt-4 text-sm text-tinta-3">{otras.length} alertas reconocidas o cerradas.</p>
      )}
    </>
  )
}
