// Pantalla Estado de las sedes (bocetos aprobados, tarea 30 parte 6). La ven todos los roles.
//
// Responde "¿está llegando todo bien?" sin entrar a AWS ni a la Raspberry:
//   - por sede: si está al día, subiendo pendientes o sin datos (GET /api/estado, §3.1),
//     cuántas horas de las últimas 24 tienen datos (histórico por hora), qué sensores
//     reportaron en el último dato y cuántas alertas siguen activas;
//   - del sistema: si el servidor responde y en cuánto tiempo, dónde corre el panel,
//     si el reloj del equipo está desfasado y, para quien edita umbrales, si RDS está encendido.

import { useEffect, useMemo, useState } from 'react'
import { fuente, type Alerta, type EstadoLocal, type EstadoRespuesta, type LocalId } from '../api'
import { admin } from '../api/admin'
import { formatear, VARIABLES } from '../api/variables'
import { useSesion } from '../auth/sesion'
import { usePolling } from '../hooks/usePolling'

const ZONA = 'America/Santiago'
const NOMBRE: Record<LocalId, string> = { local1: 'Planta de fabricación', local2: 'Oficinas administrativas' }
const COLOR: Record<LocalId, string> = { local1: 'text-planta', local2: 'text-oficinas' }
const HORA = 3_600_000
// Lo que mide un sensor (los KPI como tableros u horas hombre vienen de otro lado)
const SENSORES = new Set(['energia_kw', 'energia_climatizacion_kw', 'energia_iluminacion_kw', 'agua_m3h', 'uv_index'])

const horaMin = (iso: string) => new Date(iso).toLocaleTimeString('es-CL', { timeZone: ZONA, hour: '2-digit', minute: '2-digit', hour12: false })
const fechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { timeZone: ZONA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })

function hace(iso: string | null, ahora: number): string {
  if (!iso) return 'nunca'
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `hace ${h} h`
  return `hace ${Math.floor(h / 24)} días`
}

const TONO = {
  ok: { borde: 'border-ok/40', fondo: 'bg-ok/10', texto: 'text-ok', punto: 'bg-ok' },
  aviso: { borde: 'border-aviso/40', fondo: 'bg-aviso/10', texto: 'text-aviso', punto: 'bg-aviso' },
  critico: { borde: 'border-critico/40', fondo: 'bg-critico/10', texto: 'text-critico', punto: 'bg-critico' },
}

function resumenSede(l: EstadoLocal, origen: EstadoRespuesta['origen'], ahora: number) {
  if (l.enlace === 'sincronizando')
    return { tono: 'aviso' as const, titulo: `Subiendo ${l.pendientes} pendientes`, texto: 'Volvió la conexión y el Edge está enviando a la nube lo que guardó mientras no había internet.' }
  if (l.enlace === 'offline')
    return origen === 'nube'
      ? {
          tono: 'aviso' as const,
          titulo: l.ultimo_dato ? `Sin datos desde el ${fechaHora(l.ultimo_dato)}` : 'Nunca ha enviado datos',
          texto: 'La nube no recibe datos de esta sede hace más de 30 minutos. El Edge puede estar apagado o sin internet; lo que guarde en planta se sube al volver.',
        }
      : {
          tono: 'critico' as const,
          titulo: 'Sin conexión con la nube',
          texto: `El Edge sigue midiendo, guardando y alertando en planta. Tiene ${l.pendientes} ${l.pendientes === 1 ? 'registro esperando' : 'registros esperando'} para subir cuando vuelva internet.`,
        }
  return { tono: 'ok' as const, titulo: 'Al día', texto: `Recibiendo datos normalmente. Último dato ${hace(l.ultimo_dato, ahora)}.` }
}

export function VistaEstado({ estado, errorEstado }: { estado: EstadoRespuesta | null; errorEstado: string | null }) {
  const ctx = useSesion()
  // Reloj propio para que "hace X min" avance solo
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])
  const misLocales = useMemo(
    () => (estado?.locales.filter((l) => ctx.ve(l.local_id)) ?? []).sort((a, b) => a.local_id.localeCompare(b.local_id)),
    [estado, ctx],
  )
  const ids = misLocales.map((l) => l.local_id)
  const clave = ids.join(',')

  // Horas con datos en las últimas 24 h (energía, que mandan las dos sedes cada 15 min)
  const { datos: cobertura } = usePolling(
    () => {
      const fin = Math.floor(Date.now() / HORA) * HORA + HORA
      return ids.length
        ? fuente.historico({ local_ids: ids, variable: 'energia_kw', desde: new Date(fin - 24 * HORA).toISOString(), hasta: new Date(fin).toISOString(), agrupacion: 'hora' }).then((r) => ({ fin, r }))
        : Promise.resolve(null)
    },
    300_000,
    [clave],
  )
  const { datos: alertas } = usePolling(() => (ctx.puede('ver_alertas') ? fuente.alertas({ estado: 'activa' }) : Promise.resolve([] as Alerta[])), 30_000)
  const { datos: ultimos } = usePolling(
    () => Promise.all(ids.map((id) => fuente.actual(id).catch(() => null))),
    60_000,
    [clave],
  )
  // Cuánto demora el servidor en responder, medido desde este navegador
  const { datos: latencia, error: errorLatencia } = usePolling(async () => {
    const t = performance.now()
    await fuente.estado()
    return Math.round(performance.now() - t)
  }, 15_000)
  const editaUmbrales = ctx.puede('modificar_umbrales') && estado?.origen !== 'edge'
  const { datos: rds } = usePolling(() => (editaUmbrales ? admin.configDisponible() : Promise.resolve(null)), 120_000, [editaUmbrales])

  const desfaseMin = estado ? Math.round((ahora - new Date(estado.hora_servidor).getTime()) / 60_000) : 0
  const origen = estado?.origen
  const dondeCorre = origen === 'nube' ? 'Nube (AWS)' : origen === 'edge' ? 'Edge en planta (Raspberry)' : 'Datos simulados'

  return (
    <div className="grid gap-5">
      <p className="text-sm text-tinta-2">
        ¿Está llegando todo bien? Aquí se ve sin entrar a AWS ni a la Raspberry. Se actualiza solo.
      </p>

      {errorEstado && (
        <section className={`rounded-lg border p-4 ${TONO.critico.borde} ${TONO.critico.fondo}`}>
          <p className="font-display text-xl font-bold text-critico">Sin conexión con el servidor</p>
          <p className="mt-1 text-sm">Este navegador no logra comunicarse con la API. Revisa tu internet; si el resto de las páginas carga, avisa al admin.</p>
        </section>
      )}

      <section className={`grid gap-4 ${misLocales.length > 1 ? 'lg:grid-cols-2' : ''}`}>
        {misLocales.map((l, i) => {
          const r = resumenSede(l, origen ?? 'simulada', ahora)
          const t = TONO[r.tono]
          const serie = cobertura?.r.series.find((s) => s.local_id === l.local_id)
          const horas = cobertura
            ? Array.from({ length: 24 }, (_, h) => {
                const inicio = cobertura.fin - (24 - h) * HORA
                return { inicio, conDatos: !!serie?.puntos.some((p) => p.promedio != null && Math.abs(new Date(p.inicio).getTime() - inicio) < HORA / 2) }
              })
            : null
          const conDatos = horas?.filter((h) => h.conDatos).length ?? 0
          const ultimo = ultimos?.[i]
          const activas = alertas?.filter((a) => a.local_id === l.local_id) ?? []
          const criticas = activas.filter((a) => a.nivel === 'critico').length
          return (
            <article key={l.local_id} className="grid gap-4 rounded-xl border border-borde bg-panel p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className={`font-display text-2xl font-bold ${COLOR[l.local_id]}`}>{NOMBRE[l.local_id]}</h2>
                <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${t.borde} ${t.fondo} ${t.texto}`}>
                  <span className={`h-2 w-2 rounded-full ${t.punto} ${r.tono === 'ok' ? 'latido' : ''}`} />
                  {r.tono === 'ok' ? 'Al día' : r.tono === 'critico' ? 'Sin nube' : l.enlace === 'sincronizando' ? 'Subiendo' : 'Sin datos'}
                </span>
              </div>

              <div className={`rounded-lg border p-3 ${t.borde} ${t.fondo}`}>
                {r.tono !== 'ok' && <p className={`mb-1 font-bold ${t.texto}`}>{r.titulo}</p>}
                <p className="text-sm text-tinta-2">{r.texto}</p>
              </div>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-borde p-3">
                  <dt className="text-tinta-2">Último dato</dt>
                  <dd className="mt-1 font-display text-xl font-bold">{l.ultimo_dato ? hace(l.ultimo_dato, ahora) : '—'}</dd>
                  <dd className="text-xs text-tinta-3">{l.ultimo_dato ? fechaHora(l.ultimo_dato) : 'sin datos'}</dd>
                </div>
                <div className="rounded-lg border border-borde p-3">
                  <dt className="text-tinta-2">Alertas activas</dt>
                  <dd className={`mt-1 font-display text-xl font-bold ${criticas ? 'text-critico' : activas.length ? 'text-aviso' : 'text-ok'}`}>
                    {alertas ? activas.length : '…'}
                  </dd>
                  <dd className="text-xs text-tinta-3">{criticas ? `${criticas} críticas` : activas.length ? 'solo advertencias' : 'ninguna'}</dd>
                </div>
                {origen === 'edge' && (
                  <>
                    <div className="rounded-lg border border-borde p-3">
                      <dt className="text-tinta-2">Pendientes por subir</dt>
                      <dd className={`mt-1 font-display text-xl font-bold ${l.pendientes ? 'text-aviso' : 'text-ok'}`}>{l.pendientes}</dd>
                      <dd className="text-xs text-tinta-3">intervalos y alertas</dd>
                    </div>
                    <div className="rounded-lg border border-borde p-3">
                      <dt className="text-tinta-2">Última subida a la nube</dt>
                      <dd className="mt-1 font-display text-xl font-bold">{hace(l.ultima_sincronizacion, ahora)}</dd>
                      <dd className="text-xs text-tinta-3">{l.ultima_sincronizacion ? fechaHora(l.ultima_sincronizacion) : 'nunca'}</dd>
                    </div>
                  </>
                )}
              </dl>

              <div>
                <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-tinta-2">Datos recibidos en las últimas 24 h</span>
                  <b className={!horas ? '' : conDatos >= 22 ? 'text-ok' : conDatos > 0 ? 'text-aviso' : 'text-tinta-3'}>{horas ? `${conDatos} de 24 horas` : '…'}</b>
                </div>
                <div className="flex gap-0.5" role="img" aria-label={`${conDatos} de 24 horas con datos`}>
                  {(horas ?? Array.from({ length: 24 }, () => null)).map((h, k) => (
                    <span
                      key={k}
                      title={h ? `${horaMin(new Date(h.inicio).toISOString())}: ${h.conDatos ? 'con datos' : 'sin datos'}` : undefined}
                      className={`h-6 flex-1 rounded-sm ${!h ? 'bg-borde/50' : h.conDatos ? 'bg-ok/80' : 'bg-borde'}`}
                    />
                  ))}
                </div>
                {horas && (
                  <div className="mt-1 flex justify-between text-xs text-tinta-3">
                    <span>{horaMin(new Date(horas[0].inicio).toISOString())}</span>
                    <span>ahora</span>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-sm text-tinta-2">
                  Sensores · último valor{ultimo ? ` (${fechaHora(ultimo.ts)})` : ''}
                </p>
                {ultimo ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ultimo.variables
                      .filter((v) => SENSORES.has(v.id))
                      .map((v) => (
                        <span key={v.id} className="rounded border border-borde px-2 py-1 text-sm">
                          <span className="text-tinta-2">{VARIABLES[v.id]?.nombre ?? v.id}</span>{' '}
                          <b>
                            {formatear(v.id, v.valor)} {VARIABLES[v.id]?.unidad}
                          </b>
                        </span>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-tinta-3">{ultimos ? 'Todavía no hay lecturas de esta sede.' : '…'}</p>
                )}
              </div>
            </article>
          )
        })}
        {estado && !misLocales.length && <p className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tinta-3">Tu cuenta no tiene sedes asignadas.</p>}
        {!estado && !errorEstado && <p className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tinta-3">Cargando…</p>}
      </section>

      <section className="rounded-xl border border-borde bg-panel p-5">
        <h2 className="mb-3 font-display text-xl font-bold">Sistema</h2>
        <ul className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <Item
            tono={errorLatencia ? 'critico' : latencia == null ? null : latencia > 3000 ? 'aviso' : 'ok'}
            titulo="Servidor"
            valor={errorLatencia ? 'No responde' : latencia == null ? '…' : origen === 'simulada' ? 'Simulado' : `Responde en ${latencia.toLocaleString('es-CL')} ms`}
            nota={latencia != null && latencia > 3000 ? 'Lento: puede ser tu internet o la Lambda despertando.' : 'Medido desde este navegador.'}
          />
          <Item tono="ok" titulo="Este panel corre en" valor={estado ? dondeCorre : '…'} nota={origen === 'edge' ? 'Funciona aunque no haya internet.' : origen === 'nube' ? 'Hosting en S3, API en Lambda.' : 'Para probar sin AWS.'} />
          <Item
            tono={!estado ? null : Math.abs(desfaseMin) >= 2 ? 'aviso' : 'ok'}
            titulo="Hora del equipo"
            valor={!estado ? '…' : Math.abs(desfaseMin) >= 2 ? `Desfasada ${Math.abs(desfaseMin)} min` : 'Sincronizada'}
            nota={Math.abs(desfaseMin) >= 2 ? 'Las horas que ves pueden no calzar con las del servidor.' : 'Igual a la del servidor.'}
          />
          {editaUmbrales && (
            <Item
              tono={rds == null ? null : rds ? 'ok' : 'aviso'}
              titulo="Base de configuración (RDS)"
              valor={rds == null ? '…' : rds ? 'Encendida' : 'Apagada'}
              nota={rds === false ? 'Los umbrales se ven pero no se editan. Las alertas siguen con la última copia.' : 'Recuerda apagarla al terminar.'}
            />
          )}
        </ul>
      </section>

      <p className="text-xs text-tinta-3">
        {origen === 'nube'
          ? 'Desde la nube solo se sabe si llegan datos: una sede pasa a "sin datos" si no envía nada en 30 minutos. Si se corta internet en planta, el Edge sigue guardando y alertando, y sube todo al volver la conexión, sin perder ni duplicar datos.'
          : 'El Edge guarda cada lectura en la Raspberry y la sube a la nube cuando hay internet. Si se corta, sigue guardando y alertando, y al volver sube los pendientes en orden, sin duplicar.'}
      </p>
    </div>
  )
}

function Item({ tono, titulo, valor, nota }: { tono: keyof typeof TONO | null; titulo: string; valor: string; nota: string }) {
  return (
    <li className="rounded-lg border border-borde p-3">
      <p className="flex items-center gap-2 text-tinta-2">
        <span className={`h-2 w-2 rounded-full ${tono ? TONO[tono].punto : 'bg-borde'}`} />
        {titulo}
      </p>
      <p className={`mt-1 font-bold ${tono ? TONO[tono].texto : ''}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-tinta-3">{nota}</p>
    </li>
  )
}
