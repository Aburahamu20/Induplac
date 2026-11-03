// Pantalla Histórico (bocetos aprobados, tarea 30 parte 2).
//
// Elige variable, período (día, semana, mes o año) y FECHA, para poder ver por
// ejemplo "un día específico de hace 3 meses", y lo compara con el período
// anterior o con el mismo período del año pasado. Usa GET /api/historico (§3.6).
//
// Energía: la API entrega kW promedio por hora o por día. Aquí se pasa a kWh
// (kW promedio × horas que cubre cada punto) y se suma por hora, día o mes.

import { Chart as ChartJS, type ChartOptions, type ScriptableLineSegmentContext } from 'chart.js'
import { useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import { fuente, type HistoricoRespuesta, type LocalId } from '../api'
import { useSesion } from '../auth/sesion'
import { usePolling } from '../hooks/usePolling'
import { SEDES } from './estilos'
import './graficos' // registra los elementos de Chart.js

type Variable = 'energia' | 'agua'
type Periodo = 'dia' | 'semana' | 'mes' | 'anio'
type Comparar = 'anterior' | 'anio_pasado' | 'ninguno'

const ZONA = { timeZone: 'America/Santiago' } as const
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const VARIABLES: Record<Variable, { nombre: string; unidad: string }> = {
  energia: { nombre: 'Energía (kWh)', unidad: 'kWh' },
  agua: { nombre: 'Agua (m³)', unidad: 'm³' },
}
const PERIODOS: { id: Periodo; nombre: string }[] = [
  { id: 'dia', nombre: 'Día' },
  { id: 'semana', nombre: 'Semana' },
  { id: 'mes', nombre: 'Mes' },
  { id: 'anio', nombre: 'Año' },
]

const hoyTexto = () => new Date().toLocaleDateString('sv-SE', ZONA) // AAAA-MM-DD

// Rango [desde, hasta) del período elegido, en hora local
function rango(periodo: Periodo, fecha: string, desplazar: Comparar = 'ninguno'): { desde: Date; hasta: Date } {
  const [a, m, d] = fecha.split('-').map(Number)
  let desde: Date, hasta: Date
  if (periodo === 'dia') {
    desde = new Date(a, m - 1, d)
    hasta = new Date(a, m - 1, d + 1)
  } else if (periodo === 'semana') {
    hasta = new Date(a, m - 1, d + 1) // la semana TERMINA en la fecha elegida
    desde = new Date(a, m - 1, d - 6)
  } else if (periodo === 'mes') {
    desde = new Date(a, m - 1, 1)
    hasta = new Date(a, m, 1)
  } else {
    desde = new Date(a, 0, 1)
    hasta = new Date(a + 1, 0, 1)
  }
  if (desplazar === 'anio_pasado') {
    desde = new Date(desde.getFullYear() - 1, desde.getMonth(), desde.getDate())
    hasta = new Date(hasta.getFullYear() - 1, hasta.getMonth(), hasta.getDate())
  } else if (desplazar === 'anterior') {
    const [aa, mm, dd] = { dia: [0, 0, 1], semana: [0, 0, 7], mes: [0, 1, 0], anio: [1, 0, 0] }[periodo]
    const mover = (x: Date) => new Date(x.getFullYear() - aa, x.getMonth() - mm, x.getDate() - dd)
    desde = mover(desde)
    hasta = mover(hasta)
  }
  return { desde, hasta }
}

// Clave del "casillero" (hora, día o mes) y su etiqueta para el eje
function casillero(periodo: Periodo, inicio: Date): { clave: string; etiqueta: string } {
  const p = new Intl.DateTimeFormat('es-CL', { ...ZONA, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false })
    .formatToParts(inicio)
    .reduce<Record<string, string>>((o, x) => ({ ...o, [x.type]: x.value }), {})
  if (periodo === 'dia') return { clave: p.hour, etiqueta: `${p.hour}:00` }
  if (periodo === 'anio') return { clave: p.month, etiqueta: MESES[Number(p.month) - 1] }
  return { clave: `${p.month}-${p.day}`, etiqueta: `${Number(p.day)}/${Number(p.month)}` }
}

interface Serie {
  local_id: LocalId
  valores: Map<string, number> // clave del casillero -> total
  etiquetas: Map<string, string>
}

function agregar(r: HistoricoRespuesta | null | undefined, periodo: Periodo, variable: Variable): Serie[] {
  if (!r) return []
  return r.series.map((s) => {
    const valores = new Map<string, number>()
    const etiquetas = new Map<string, string>()
    // Horas que cubre cada punto: lo que separa a dos puntos seguidos (la API agrupa por hora o por día)
    const t = s.puntos.map((p) => new Date(p.inicio).getTime())
    const horas = t.length > 1 ? Math.max(1, Math.round((t[1] - t[0]) / 3_600_000)) : r.agrupacion === 'dia' ? 24 : 1
    for (const p of s.puntos) {
      const v = variable === 'energia' ? (p.promedio == null ? null : p.promedio * horas) : p.total
      if (v == null) continue
      const c = casillero(periodo, new Date(p.inicio))
      valores.set(c.clave, (valores.get(c.clave) ?? 0) + v)
      etiquetas.set(c.clave, c.etiqueta)
    }
    return { local_id: s.local_id, valores, etiquetas }
  })
}

function nombrePeriodo(periodo: Periodo, desde: Date): string {
  if (periodo === 'dia') return desde.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
  if (periodo === 'semana') return `semana al ${new Date(desde.getTime() + 6 * 86_400_000).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}`
  if (periodo === 'mes') return desde.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  return String(desde.getFullYear())
}

const fmt = (n: number, dec = 0) => n.toLocaleString('es-CL', { maximumFractionDigits: dec })

// Verde (bajo) -> ámbar -> rojo (alto), como en los bocetos
function colorNivel(f: number): string {
  const tramo = (a: number[], b: number[], t: number) => a.map((x, i) => Math.round(x + (b[i] - x) * t))
  const [r, g, b] = f < 0.5 ? tramo([52, 194, 107], [229, 168, 35], f * 2) : tramo([229, 168, 35], [239, 79, 79], (f - 0.5) * 2)
  return `rgb(${r},${g},${b})`
}

export function VistaHistorico() {
  const { ve } = useSesion()
  const sedesUsuario = (['local1', 'local2'] as LocalId[]).filter(ve)
  const [variable, setVariable] = useState<Variable>('energia')
  const [periodo, setPeriodo] = useState<Periodo>('semana')
  const [fecha, setFecha] = useState(hoyTexto)
  const [comparar, setComparar] = useState<Comparar>('anterior')
  const [elegidas, setElegidas] = useState<LocalId[]>(sedesUsuario)
  const sedes = sedesUsuario.filter((l) => elegidas.includes(l))
  const periodoEfectivo: Periodo = variable === 'agua' && periodo === 'dia' ? 'semana' : periodo

  // El período actual llega hasta ahora (no se piden datos del futuro)
  const completo = rango(periodoEfectivo, fecha)
  const [ahora] = useState(() => new Date())
  const actual = { desde: completo.desde, hasta: completo.hasta > ahora ? ahora : completo.hasta }
  // La comparación cubre el mismo largo que el actual (si el mes va en el día 3, se compara con los 3 primeros días)
  const previoCompleto = comparar === 'ninguno' ? null : rango(periodoEfectivo, fecha, comparar)
  const previo = previoCompleto && {
    desde: previoCompleto.desde,
    hasta: new Date(Math.min(previoCompleto.hasta.getTime(), previoCompleto.desde.getTime() + (actual.hasta.getTime() - actual.desde.getTime()))),
  }
  const consulta = (r: { desde: Date; hasta: Date }) =>
    fuente.historico({
      local_ids: sedes,
      variable: variable === 'energia' ? 'energia_kw' : 'agua_m3_dia',
      desde: r.desde.toISOString(),
      hasta: new Date(r.hasta.getTime() - 1).toISOString(),
      agrupacion: variable === 'agua' || periodoEfectivo !== 'dia' ? 'dia' : 'hora',
    })
  const deps = [variable, periodoEfectivo, fecha, comparar, sedes.join()]
  const { datos, error } = usePolling(() => (sedes.length ? consulta(actual) : Promise.resolve(undefined)), 120_000, deps)
  const { datos: datosPrevios } = usePolling(
    () => (sedes.length && previo ? consulta(previo) : Promise.resolve(undefined)),
    600_000,
    deps,
  )

  const series = useMemo(() => agregar(datos, periodoEfectivo, variable), [datos, periodoEfectivo, variable])
  const seriesPrevias = useMemo(() => agregar(datosPrevios, periodoEfectivo, variable), [datosPrevios, periodoEfectivo, variable])
  const unidad = VARIABLES[variable].unidad
  const nombreActual = nombrePeriodo(periodoEfectivo, actual.desde)
  const nombrePrevio = previo ? nombrePeriodo(periodoEfectivo, previo.desde) : ''
  const total = (s?: Serie) => (s ? [...s.valores.values()].reduce((a, b) => a + b, 0) : 0)

  // Casillero con el mayor valor entre las sedes elegidas
  let pico: { sede: LocalId; etiqueta: string; valor: number } | null = null
  for (const s of series)
    for (const [k, v] of s.valores) if (!pico || v > pico.valor) pico = { sede: s.local_id, etiqueta: s.etiquetas.get(k) ?? k, valor: v }

  const descargar = () => {
    const filas = [['sede', 'periodo', 'casillero', unidad]]
    for (const [lista, nombre] of [[series, nombreActual], [seriesPrevias, nombrePrevio]] as const)
      for (const s of lista) for (const [k, v] of s.valores) filas.push([SEDES[s.local_id].nombre, nombre, s.etiquetas.get(k) ?? k, v.toFixed(2)])
    const url = URL.createObjectURL(new Blob([filas.map((f) => f.join(';')).join('\n')], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `induplac-historico-${variable}-${fecha}.csv` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const boton = (activo: boolean) =>
    `rounded-md border px-3 py-1.5 text-sm ${activo ? 'border-oficinas bg-oficinas/15 font-bold text-tinta' : 'border-borde text-tinta-2 hover:text-tinta'}`
  const campo = 'rounded-md border border-borde bg-fondo px-2.5 py-1.5 text-sm text-tinta outline-none focus:border-oficinas'

  return (
    <div className="grid gap-5">
      {/* Filtros */}
      <section className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-lg border border-borde bg-panel p-4">
        <label className="grid gap-1 text-xs text-tinta-2">
          Variable
          <select className={campo} value={variable} onChange={(e) => setVariable(e.target.value as Variable)}>
            {Object.entries(VARIABLES).map(([id, v]) => (
              <option key={id} value={id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className="grid gap-1 text-xs text-tinta-2">
          Período
          <div className="flex flex-wrap gap-1.5">
            {PERIODOS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriodo(p.id)}
                disabled={variable === 'agua' && p.id === 'dia'}
                title={variable === 'agua' && p.id === 'dia' ? 'El agua se mide por día completo' : undefined}
                className={`${boton(periodoEfectivo === p.id)} disabled:opacity-40`}
              >
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
        <label className="grid gap-1 text-xs text-tinta-2">
          {periodoEfectivo === 'semana' ? 'Semana que termina el' : periodoEfectivo === 'anio' ? 'Año' : periodoEfectivo === 'mes' ? 'Mes' : 'Fecha'}
          {periodoEfectivo === 'mes' ? (
            <input type="month" className={campo} value={fecha.slice(0, 7)} max={hoyTexto().slice(0, 7)} onChange={(e) => e.target.value && setFecha(`${e.target.value}-01`)} />
          ) : periodoEfectivo === 'anio' ? (
            <select className={campo} value={fecha.slice(0, 4)} onChange={(e) => setFecha(`${e.target.value}-01-01`)}>
              {[0, 1, 2, 3].map((n) => {
                const a = Number(hoyTexto().slice(0, 4)) - n
                return <option key={a}>{a}</option>
              })}
            </select>
          ) : (
            <input type="date" className={campo} value={fecha} max={hoyTexto()} onChange={(e) => e.target.value && setFecha(e.target.value)} />
          )}
        </label>
        <label className="grid gap-1 text-xs text-tinta-2">
          Comparar con
          <select className={campo} value={comparar} onChange={(e) => setComparar(e.target.value as Comparar)}>
            <option value="anterior">{{ dia: 'Día anterior', semana: 'Semana anterior', mes: 'Mes anterior', anio: 'Año anterior' }[periodoEfectivo]}</option>
            {periodoEfectivo !== 'anio' && <option value="anio_pasado">Mismo período del año pasado</option>}
            <option value="ninguno">Sin comparar</option>
          </select>
        </label>
        {sedesUsuario.length > 1 && (
          <div className="grid gap-1 text-xs text-tinta-2">
            Sedes
            <div className="flex gap-3 py-1.5">
              {sedesUsuario.map((l) => (
                <label key={l} className="flex items-center gap-1.5 text-sm text-tinta">
                  <input
                    type="checkbox"
                    checked={elegidas.includes(l)}
                    onChange={(e) => setElegidas(e.target.checked ? [...elegidas, l] : elegidas.filter((x) => x !== l))}
                    style={{ accentColor: SEDES[l].color }}
                  />
                  {SEDES[l].nombre}
                </label>
              ))}
            </div>
          </div>
        )}
        <button onClick={descargar} disabled={!series.length} className="ml-auto rounded-md border border-borde px-3 py-1.5 text-sm hover:border-tinta-3 disabled:opacity-40">
          Descargar CSV
        </button>
      </section>

      {/* Resumen */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {series.map((s) => {
          const t = total(s)
          const tp = total(seriesPrevias.find((x) => x.local_id === s.local_id))
          const delta = tp ? ((t - tp) / tp) * 100 : null
          return (
            <article key={s.local_id} className="rounded-lg border border-borde bg-panel p-4">
              <p className="text-sm text-tinta-2">
                {SEDES[s.local_id].nombre} · {nombreActual}
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums">
                {fmt(t, variable === 'agua' ? 1 : 0)} <span className="text-sm font-normal text-tinta-2">{unidad}</span>
              </p>
              {delta != null && Number.isFinite(delta) && (
                <p className={`mt-1 text-sm ${Math.abs(delta) < 0.05 ? 'text-tinta-2' : delta > 0 ? 'text-aviso' : 'text-ok'}`}>
                  {Math.abs(delta) < 0.05 ? '= igual que' : `${delta > 0 ? '▲' : '▼'} ${fmt(Math.abs(delta), 1)} % vs.`} {nombrePrevio}
                </p>
              )}
              {periodoEfectivo !== 'dia' && completo.hasta > ahora && s.valores.size > 0 && (
                <p className="mt-1 text-xs text-tinta-3">Período en curso: hasta hoy</p>
              )}
              {!s.valores.size && <p className="mt-1 text-sm text-tinta-3">Sin datos en este período</p>}
            </article>
          )
        })}
        {pico && (
          <article className="rounded-lg border border-borde bg-panel p-4">
            <p className="text-sm text-tinta-2">{periodoEfectivo === 'dia' ? 'Hora' : periodoEfectivo === 'anio' ? 'Mes' : 'Día'} de mayor consumo</p>
            <p className="mt-1 font-display text-3xl font-bold capitalize">{pico.etiqueta}</p>
            <p className="mt-1 text-sm text-tinta-2">
              {SEDES[pico.sede].nombre} · {fmt(pico.valor, variable === 'agua' ? 1 : 0)} {unidad}
            </p>
          </article>
        )}
      </section>

      {/* Gráficos: cada sede con su propia escala */}
      {error && <p className="rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">No se pudo cargar el histórico: {error}</p>}
      {!sedes.length && <p className="text-sm text-tinta-2">Elige al menos una sede.</p>}
      <div className={`grid gap-4 ${series.length > 1 ? 'xl:grid-cols-2' : ''}`}>
        {series.map((s) => (
          <GraficoPeriodo
            key={s.local_id}
            serie={s}
            previa={seriesPrevias.find((x) => x.local_id === s.local_id)}
            unidad={unidad}
            nombreActual={nombreActual}
            nombrePrevio={nombrePrevio}
            enCurso={completo.hasta > ahora}
          />
        ))}
      </div>
      {series.length > 1 && <p className="text-xs text-tinta-3">Cada sede tiene su propia escala, porque Planta consume varias veces más que Oficinas.</p>}
    </div>
  )
}

function GraficoPeriodo({
  serie,
  previa,
  unidad,
  nombreActual,
  nombrePrevio,
  enCurso,
}: {
  serie: Serie
  previa?: Serie
  unidad: string
  nombreActual: string
  nombrePrevio: string
  enCurso: boolean
}) {
  // Eje común: los casilleros del período actual, en orden; la comparación se alinea por posición
  const claves = [...serie.etiquetas.keys()]
  const clavesPrevias = previa ? [...previa.etiquetas.keys()] : []
  const valores = claves.map((k) => serie.valores.get(k) ?? null)
  const comparados = claves.map((_, i) => (previa && clavesPrevias[i] ? (previa.valores.get(clavesPrevias[i]) ?? null) : null))
  const numeros = valores.filter((v): v is number => v != null)
  const min = Math.min(...numeros)
  const max = Math.max(...numeros)
  const sede = SEDES[serie.local_id]
  const colorEn = (v: number | undefined) => colorNivel(max > min && v != null ? (v - min) / (max - min) : 0.3)

  const opciones: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0d0f13',
        borderColor: '#2a2f39',
        borderWidth: 1,
        padding: 10,
        callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(Number(c.parsed.y), 1)} ${unidad}` },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(42,47,57,0.6)' }, ticks: { maxRotation: 0, autoSkipPadding: 14 } },
      y: { grid: { color: 'rgba(42,47,57,0.6)' }, ticks: { callback: (v) => fmt(Number(v)) } },
    },
  }

  return (
    <section className="rounded-lg border border-borde bg-panel p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold" style={{ color: sede.color }}>
          {sede.nombre}
        </h3>
        <p className="flex items-center gap-3 text-xs text-tinta-2">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-5 rounded" style={{ background: 'linear-gradient(90deg,#34c26b,#e5a823,#ef4f4f)' }} />
            {nombreActual} (verde bajo → rojo alto)
          </span>
          {previa && (
            <span className="flex items-center gap-1.5">
              <span className="w-5 border-t-2 border-dashed border-oficinas" />
              {nombrePrevio}
            </span>
          )}
        </p>
      </div>
      {numeros.length ? (
        <div className="h-64">
          <Line
            options={opciones}
            data={{
              labels: claves.map((k) => serie.etiquetas.get(k) ?? k),
              datasets: [
                {
                  label: nombreActual,
                  data: valores,
                  borderWidth: 2.5,
                  tension: 0.25,
                  pointRadius: 0,
                  pointHoverRadius: 5,
                  fill: true,
                  backgroundColor: `${sede.color}22`,
                  segment: {
                    borderColor: (c: ScriptableLineSegmentContext) => colorEn(Math.max(c.p0.parsed.y ?? 0, c.p1.parsed.y ?? 0)),
                    // La última hora, día o mes todavía no termina: su tramo va punteado
                    borderDash: (c: ScriptableLineSegmentContext) => (enCurso && c.p1DataIndex === valores.length - 1 ? [4, 4] : undefined),
                  },
                  borderColor: colorEn(max),
                },
                ...(previa
                  ? [
                      {
                        label: nombrePrevio,
                        data: comparados,
                        borderColor: '#4f8ef7',
                        borderDash: [5, 5],
                        borderWidth: 1.5,
                        tension: 0.25,
                        pointRadius: 0,
                        fill: false,
                      },
                    ]
                  : []),
              ],
            }}
          />
        </div>
      ) : (
        <p className="grid h-40 place-items-center text-sm text-tinta-3">Sin datos en este período</p>
      )}
      {enCurso && numeros.length > 0 && (
        <p className="mt-2 text-xs text-tinta-3">El último tramo (punteado) todavía no termina: por eso se ve más bajo.</p>
      )}
    </section>
  )
}

// Evita que el tree-shaking quite el registro de Chart.js si se usa solo esta pantalla
void ChartJS
