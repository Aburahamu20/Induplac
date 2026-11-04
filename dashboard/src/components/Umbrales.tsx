// Pantalla Umbrales de alerta (bocetos aprobados, tarea 30 parte 3).
//
// Muestra y edita los umbrales de cada sede (RDS manda + copia en DynamoDB, §3.8),
// cómo está hoy cada variable frente a ellos, cuántas alertas habría dado un
// cambio en los últimos 30 días (simulación) y los últimos cambios (auditoría).

import { useEffect, useMemo, useState } from 'react'
import { fuente, type LocalId } from '../api'
import { admin, type ResultadoSimulacion, type UmbralVigente, type VariableUmbral } from '../api/admin'
import { useSesion } from '../auth/sesion'
import { usePolling } from '../hooks/usePolling'
import { SEDES } from './estilos'

const INFO: Record<VariableUmbral, { corto: string; como: string; dec: number }> = {
  energia_pct: { corto: 'Energía', como: '% sobre el promedio de 4 semanas a la misma hora', dec: 0 },
  energia_kw: { corto: 'Energía (respaldo)', como: 'Fijo, mientras no hay 4 semanas de historia', dec: 0 },
  agua_m3_dia: { corto: 'Agua diaria', como: 'Suma del día', dec: 1 },
  agua_m3h: { corto: 'Posible fuga', como: 'Caudal de 22:00 a 06:00 y fin de semana', dec: 2 },
  uv: { corto: 'Índice UV', como: 'Máximo del intervalo', dec: 0 },
}
const ORDEN: VariableUmbral[] = ['energia_pct', 'energia_kw', 'agua_m3_dia', 'agua_m3h', 'uv']

const fmt = (n: number | null | undefined, dec = 1) => (n == null ? '—' : n.toLocaleString('es-CL', { maximumFractionDigits: dec }))
const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) : null

type Borrador = Record<string, { advertencia: string; alerta: string }>
const clave = (u: { local_id: LocalId; variable: VariableUmbral }) => `${u.local_id}:${u.variable}`
const cuantas = (n: number, dias: boolean) => (dias ? `${n} ${n === 1 ? 'día' : 'días'} en alerta` : `${n} ${n === 1 ? 'alerta' : 'alertas'}`)
const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))

function validar(u: UmbralVigente, b: { advertencia: string; alerta: string }): string | null {
  const a = num(b.advertencia)
  const r = num(b.alerta)
  if (r == null || Number.isNaN(r)) return 'Falta la alerta'
  if (r < 0 || (a != null && (Number.isNaN(a) || a < 0))) return 'Usa números positivos'
  if (u.con_advertencia && a != null && a >= r) return 'La advertencia tiene que ser menor que la alerta'
  return null
}

export function VistaUmbrales() {
  const { ve } = useSesion()
  const sedes = (['local1', 'local2'] as LocalId[]).filter(ve)
  const [sede, setSede] = useState<LocalId>(sedes[0])
  const [recarga, setRecarga] = useState(0)
  const { datos: umbrales, error } = usePolling(() => admin.umbrales(), 120_000, [recarga])
  const { datos: config } = usePolling(() => admin.configDisponible(), 120_000, [recarga])
  const { datos: actual } = usePolling(() => fuente.actual(sede), 30_000, [sede])
  const { datos: cambios } = usePolling(() => admin.auditoria({ sede, accion: 'umbral.modificado' }).catch(() => null), 120_000, [sede, recarga])
  const [borrador, setBorrador] = useState<Borrador>({})
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'aviso' | 'critico'; texto: string } | null>(null)

  const deSede = useMemo(
    () => (umbrales ?? []).filter((u) => u.local_id === sede).sort((a, b) => ORDEN.indexOf(a.variable) - ORDEN.indexOf(b.variable)),
    [umbrales, sede],
  )
  const cambiados = (umbrales ?? []).filter((u) => {
    const b = borrador[clave(u)]
    return b && (num(b.advertencia) !== u.advertencia || num(b.alerta) !== u.alerta)
  })
  const errores = cambiados.map((u) => validar(u, borrador[clave(u)])).filter(Boolean)
  const editable = config !== false

  // Valor de hoy de cada variable, en la misma unidad que su umbral
  const hoy = useMemo(() => {
    const v = (id: string) => actual?.variables.find((x) => x.id === id)
    const kw = v('energia_kw')
    return {
      energia_pct: kw?.referencia ? { valor: (kw.valor / kw.referencia - 1) * 100, texto: 'Ahora' } : null,
      energia_kw: kw && !kw.referencia ? { valor: kw.valor, texto: 'Ahora' } : null,
      agua_m3_dia: v('agua_m3_dia') ? { valor: v('agua_m3_dia')!.valor, texto: 'Hoy' } : null,
      agua_m3h: v('agua_m3h') ? { valor: v('agua_m3h')!.valor, texto: 'Ahora' } : null,
      uv: v('uv_index') ? { valor: v('uv_index')!.valor, texto: 'Ahora' } : null,
      sinRespaldo: !!kw?.referencia,
    }
  }, [actual])

  const cambiar = (u: UmbralVigente, campo: 'advertencia' | 'alerta', valor: string) =>
    setBorrador((b) => ({
      ...b,
      [clave(u)]: { advertencia: b[clave(u)]?.advertencia ?? String(u.advertencia ?? ''), alerta: b[clave(u)]?.alerta ?? String(u.alerta), [campo]: valor },
    }))

  const guardar = async () => {
    setGuardando(true)
    setMensaje(null)
    const avisos: string[] = []
    try {
      for (const u of cambiados) {
        const b = borrador[clave(u)]
        const r = await admin.guardarUmbral(u.local_id, u.variable, u.con_advertencia ? num(b.advertencia) : null, num(b.alerta)!)
        if (!r.copiado) avisos.push(`${INFO[u.variable].corto}: ${r.aviso}`)
      }
      setBorrador({})
      setRecarga((n) => n + 1)
      setMensaje(
        avisos.length
          ? { tono: 'aviso', texto: avisos.join(' · ') }
          : { tono: 'ok', texto: `${cambiados.length === 1 ? 'Se guardó 1 cambio' : `Se guardaron ${cambiados.length} cambios`}. Ya quedó en la auditoría.` },
      )
    } catch (e) {
      setMensaje({ tono: 'critico', texto: `No se pudo guardar: ${e instanceof Error ? e.message : String(e)}` })
    } finally {
      setGuardando(false)
    }
  }

  const pendientesSede = cambiados.filter((u) => u.local_id === sede).length
  const tonoMensaje = { ok: 'border-ok/40 bg-ok/10 text-ok', aviso: 'border-aviso/40 bg-aviso/10 text-aviso', critico: 'border-critico/40 bg-critico/10 text-critico' }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-tinta-2">Los límites que usan el Edge y la nube para crear alertas.</p>
        <button
          onClick={() => setBorrador({})}
          disabled={!cambiados.length || guardando}
          className="rounded-md border border-borde px-4 py-2 text-sm hover:border-tinta-3 disabled:opacity-40"
        >
          Descartar
        </button>
        <button
          onClick={guardar}
          disabled={!cambiados.length || errores.length > 0 || guardando || !editable}
          className="rounded-md bg-oficinas px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-40"
        >
          {guardando ? 'Guardando…' : cambiados.length ? `Guardar ${cambiados.length === 1 ? '1 cambio' : `${cambiados.length} cambios`}` : 'Guardar cambios'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <p className="flex items-center gap-2 rounded-lg border border-borde bg-panel px-4 py-3 text-sm">
          <span aria-hidden>🔒</span> Cada cambio queda registrado en la Auditoría, con el valor de antes y el nuevo.
        </p>
        <p className="flex items-center gap-2 rounded-lg border border-borde bg-panel px-4 py-3 text-sm">
          <span className={`h-2 w-2 rounded-full ${config === false ? 'bg-aviso' : config ? 'bg-ok' : 'bg-tinta-3'}`} />
          {config === false
            ? 'Base de configuración apagada: puedes ver los umbrales, pero no cambiarlos. Las alertas siguen con la última copia.'
            : config
              ? 'Base de configuración encendida: los cambios se guardan y se copian a la nube.'
              : 'Revisando la base de configuración…'}
        </p>
      </div>

      {mensaje && <p className={`rounded-md border px-3 py-2 text-sm ${tonoMensaje[mensaje.tono]}`}>{mensaje.texto}</p>}
      {error && <p className="rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">No se pudieron cargar los umbrales: {error}</p>}

      {sedes.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {sedes.map((l) => (
            <button
              key={l}
              onClick={() => setSede(l)}
              className={`rounded-full border px-4 py-1.5 text-sm ${sede === l ? 'font-bold text-tinta' : 'border-borde text-tinta-2 hover:text-tinta'}`}
              style={sede === l ? { borderColor: SEDES[l].color, background: `${SEDES[l].color}22` } : undefined}
            >
              {SEDES[l].nombre}
            </button>
          ))}
          {cambiados.length > 0 && (
            <span className="ml-auto flex items-center gap-1.5 text-sm text-oficinas">
              <span className="h-2 w-2 rounded-full bg-oficinas" />
              {cambiados.length === 1 ? '1 cambio sin guardar' : `${cambiados.length} cambios sin guardar`}
              {pendientesSede < cambiados.length && ' (también en la otra sede)'}
            </span>
          )}
        </div>
      )}

      {/* En celular: una tarjeta por variable */}
      <section className="grid gap-3 md:hidden">
        {deSede.map((u) => {
          const b = borrador[clave(u)]
          const err = b ? validar(u, b) : null
          const h = hoy[u.variable]
          return (
            <article key={u.variable} className="rounded-lg border border-borde bg-panel p-4">
              <p className="font-bold">{INFO[u.variable].corto}</p>
              <p className="text-xs text-tinta-2">{INFO[u.variable].como}</p>
              <div className="mt-3 flex flex-wrap gap-4">
                {u.con_advertencia && (
                  <div>
                    <p className="mb-1 text-xs font-bold text-aviso">Advertencia</p>
                    <Campo valor={b?.advertencia ?? String(u.advertencia ?? '')} unidad={u.unidad} activo={editable} onChange={(v) => cambiar(u, 'advertencia', v)} />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs font-bold text-critico">Crítico (alerta)</p>
                  <Campo valor={b?.alerta ?? String(u.alerta)} unidad={u.unidad} activo={editable} onChange={(v) => cambiar(u, 'alerta', v)} />
                </div>
              </div>
              {err && <p className="mt-1 text-xs text-critico">{err}</p>}
              {h && !(u.variable === 'energia_kw' && hoy.sinRespaldo) && (
                <div className="mt-3">
                  <Medidor valor={h.valor} advertencia={b ? num(b.advertencia) : u.advertencia} alerta={b ? (num(b.alerta) ?? u.alerta) : u.alerta} unidad={u.unidad} texto={h.texto} dec={INFO[u.variable].dec} />
                </div>
              )}
            </article>
          )
        })}
      </section>

      {/* Tabla de umbrales */}
      <section className="hidden overflow-x-auto rounded-lg border border-borde bg-panel md:block">
        <table className="w-full min-w-[54rem] text-sm">
          <thead>
            <tr className="border-b border-borde text-left text-xs">
              <th className="px-4 py-3 font-bold text-tinta-2">Variable</th>
              <th className="px-3 py-3 font-bold text-aviso">Advertencia</th>
              <th className="px-3 py-3 font-bold text-critico">Crítico (alerta)</th>
              <th className="px-3 py-3 font-bold text-tinta-2">Cómo está hoy</th>
              <th className="px-4 py-3 font-bold text-tinta-2">Último cambio</th>
            </tr>
          </thead>
          <tbody>
            {deSede.map((u) => {
              const b = borrador[clave(u)]
              const adv = b ? num(b.advertencia) : u.advertencia
              const ale = b ? (num(b.alerta) ?? u.alerta) : u.alerta
              const cambiado = cambiados.some((x) => clave(x) === clave(u))
              const err = b ? validar(u, b) : null
              const h = hoy[u.variable]
              return (
                <tr key={u.variable} className={`border-b border-borde/60 last:border-0 ${cambiado ? 'bg-oficinas/5' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-bold">{INFO[u.variable].corto}</p>
                    <p className="text-xs text-tinta-2">{INFO[u.variable].como}</p>
                  </td>
                  <td className="px-3 py-3">
                    {u.con_advertencia ? (
                      <Campo valor={b?.advertencia ?? String(u.advertencia ?? '')} unidad={u.unidad} activo={editable} onChange={(v) => cambiar(u, 'advertencia', v)} />
                    ) : (
                      <span className="text-tinta-3">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Campo valor={b?.alerta ?? String(u.alerta)} unidad={u.unidad} activo={editable} onChange={(v) => cambiar(u, 'alerta', v)} />
                    {cambiado && !err && <p className="mt-1 text-xs text-oficinas">Antes: {fmt(u.advertencia)} / {fmt(u.alerta)} · sin guardar</p>}
                    {err && <p className="mt-1 text-xs text-critico">{err}</p>}
                  </td>
                  <td className="px-3 py-3">
                    {u.variable === 'energia_kw' && hoy.sinRespaldo ? (
                      <span className="text-xs text-tinta-3">No se usa: ya hay 4 semanas de datos</span>
                    ) : h ? (
                      <Medidor valor={h.valor} advertencia={adv} alerta={ale} unidad={u.unidad} texto={h.texto} dec={INFO[u.variable].dec} />
                    ) : (
                      <span className="text-xs text-tinta-3">Sin dato de hoy</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-tinta-2">
                    {u.origen === 'defecto' ? 'Valor por defecto' : `${fecha(u.actualizado) ?? ''}${u.actualizado_por ? ` · ${u.actualizado_por}` : ''}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Simulacion sede={sede} umbrales={deSede} borrador={borrador} />
        <section className="rounded-lg border border-borde bg-panel p-4">
          <h3 className="font-display text-lg font-bold">Últimos cambios · {SEDES[sede].nombre}</h3>
          <p className="text-xs text-tinta-2">Sale de la auditoría</p>
          <ul className="mt-3 divide-y divide-borde/60 text-sm">
            {(cambios?.registros ?? []).slice(0, 5).map((r) => {
              const d = r.detalle as { antes?: { alerta?: number }; despues?: { advertencia?: number | null; alerta?: number } }
              const variable = r.objeto.split(':')[1] as VariableUmbral
              return (
                <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2">
                  <span className="w-24 shrink-0 text-xs tabular-nums text-tinta-2">{fecha(r.ts)}</span>
                  <span className="flex-1">
                    {INFO[variable]?.corto ?? variable}: {fmt(d.antes?.alerta)} → <b>{fmt(d.despues?.alerta)}</b>
                    {d.despues?.advertencia != null && <span className="text-tinta-2"> (advertencia {fmt(d.despues.advertencia)})</span>}
                  </span>
                  <span className="text-xs text-tinta-2">{r.usuario}</span>
                </li>
              )
            })}
            {cambios && !cambios.registros.length && <li className="py-2 text-tinta-3">Todavía no hay cambios registrados.</li>}
            {cambios === null && <li className="py-2 text-tinta-3">No se pudo leer la auditoría.</li>}
          </ul>
          <a href="#auditoria" className="mt-2 inline-block text-sm text-oficinas hover:underline">
            Ver todo en Auditoría →
          </a>
        </section>
      </div>
      <p className="text-xs text-tinta-3">Si la base de configuración está apagada, la tabla se puede ver pero no editar; el sistema sigue usando la última copia guardada.</p>
    </div>
  )
}

function Campo({ valor, unidad, activo, onChange }: { valor: string; unidad: string; activo: boolean; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input
        inputMode="decimal"
        value={valor}
        disabled={!activo}
        onChange={(e) => onChange(e.target.value)}
        className="w-20 rounded-md border border-borde bg-fondo px-2.5 py-1.5 text-tinta tabular-nums outline-none focus:border-oficinas disabled:opacity-50"
      />
      <span className="text-xs text-tinta-2">{unidad}</span>
    </label>
  )
}

// Barra verde / amarilla / roja con un punto en el valor de hoy
function Medidor({ valor, advertencia, alerta, unidad, texto, dec }: { valor: number; advertencia: number | null; alerta: number; unidad: string; texto: string; dec: number }) {
  const tope = Math.max(alerta * 1.5, valor * 1.1, 1e-6)
  const pos = (x: number) => `${Math.min(100, Math.max(0, (x / tope) * 100))}%`
  const nivel = valor > alerta ? 'critico' : advertencia != null && valor > advertencia ? 'aviso' : 'ok'
  const color = { ok: 'text-ok', aviso: 'text-aviso', critico: 'text-critico' }[nivel]
  const nombre = { ok: 'normal', aviso: 'advertencia', critico: 'alerta' }[nivel]
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 w-40 shrink-0 rounded-full bg-ok/70">
        {advertencia != null && <div className="absolute inset-y-0 rounded-r-full bg-aviso/80" style={{ left: pos(advertencia), right: 0 }} />}
        <div className="absolute inset-y-0 right-0 rounded-r-full bg-critico/80" style={{ left: pos(alerta) }} />
        <div className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fondo bg-white" style={{ left: pos(Math.max(valor, 0)) }} />
      </div>
      <span className={`whitespace-nowrap text-xs ${color}`}>
        {texto} {valor > 0 && unidad === '%' ? '+' : ''}
        {fmt(valor, dec)} {unidad === '%' ? '%' : unidad} · {nombre}
      </span>
    </div>
  )
}

function Simulacion({ sede, umbrales, borrador }: { sede: LocalId; umbrales: UmbralVigente[]; borrador: Borrador }) {
  const [resultados, setResultados] = useState<Record<string, ResultadoSimulacion | 'error'>>({})
  // Se recalcula al cambiar un valor (con una pausa corta para no llamar en cada tecla)
  const firma = JSON.stringify(umbrales.map((u) => [u.variable, u.advertencia, u.alerta, borrador[clave(u)]]))
  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      for (const u of umbrales) {
        const b = borrador[clave(u)]
        const adv = b ? num(b.advertencia) : u.advertencia
        const ale = b ? num(b.alerta) : u.alerta
        if (ale == null || Number.isNaN(ale) || (b && validar(u, b))) continue
        admin
          .simular(sede, u.variable, u.con_advertencia ? adv : null, ale, 30)
          .then((r) => vivo && setResultados((x) => ({ ...x, [clave(u)]: r })))
          .catch(() => vivo && setResultados((x) => ({ ...x, [clave(u)]: 'error' })))
      }
    }, 600)
    return () => {
      vivo = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma, sede])

  const filas = [...umbrales].sort((a, b) => Number(!!borrador[clave(b)]) - Number(!!borrador[clave(a)]))
  return (
    <section className="rounded-lg border border-borde bg-panel p-4">
      <h3 className="font-display text-lg font-bold">¿Cuántas alertas habrían saltado?</h3>
      <p className="text-xs text-tinta-2">Con los datos reales de los últimos 30 días de {SEDES[sede].nombre} · se recalcula al cambiar un valor</p>
      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-tinta-2">
            <th className="py-1.5 font-bold">Variable</th>
            <th className="py-1.5 font-bold">Guardado</th>
            <th className="py-1.5 font-bold">Con tu cambio</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((u) => {
            const r = resultados[clave(u)]
            const b = borrador[clave(u)]
            const cambiado = b && (num(b.advertencia) !== u.advertencia || num(b.alerta) !== u.alerta)
            const dias = !!r && r !== 'error' && r.unidad_evento === 'días'
            return (
              <tr key={u.variable} className={`border-t border-borde/60 ${cambiado ? 'bg-oficinas/5' : ''}`}>
                <td className="py-2">
                  {INFO[u.variable].corto} · {fmt(u.alerta, 2)}
                  {cambiado && ` → ${fmt(num(b.alerta), 2)}`} {u.unidad}
                </td>
                <td className="py-2 font-bold">{r === 'error' ? '—' : r ? cuantas(r.actual.alertas, dias) : '…'}</td>
                <td className="py-2">
                  {!cambiado ? (
                    <span className="text-tinta-3">sin cambio</span>
                  ) : r && r !== 'error' ? (
                    <span className={r.propuesto.alertas > r.actual.alertas ? 'font-bold text-aviso' : 'font-bold text-ok'}>
                      {cuantas(r.propuesto.alertas, dias)} <span className="font-normal text-oficinas">sin guardar</span>
                    </span>
                  ) : (
                    '…'
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-tinta-3">Cuenta intervalos de 15 min (o días, para el agua diaria) que habrían quedado en alerta.</p>
    </section>
  )
}
