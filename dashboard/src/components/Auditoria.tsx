// Pantalla Auditoría (bocetos aprobados, tarea 30 parte 5).
//
// Muestra quién hizo qué (GET /api/auditoria, docs/api-dashboard.md §3.7 y §3.7b):
// filtros por período, sede, tipo de acción y texto; el detalle de cada registro y
// el resultado de revisar la cadena de hashes. Si alguien cambió o borró un registro
// desde la consola de AWS, la API marca la sede como "alterada" y aquí se avisa en rojo.
// Los registros no se pueden editar ni borrar: no hay ningún botón para eso.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { admin, type RegistroAuditoria } from '../api/admin'
import { useSesion } from '../auth/sesion'
import { usePolling } from '../hooks/usePolling'

const ZONA = 'America/Santiago'
const NOMBRE_SEDE: Record<string, string> = { local1: 'Planta', local2: 'Oficinas', general: 'General' }
const CLASE_SEDE: Record<string, string> = {
  local1: 'border-planta/60 text-planta',
  local2: 'border-oficinas/60 text-oficinas',
  general: 'border-borde text-tinta-2',
}
const NOMBRE_ROL: Record<string, string> = {
  'admin-general': 'Admin general',
  'admin-sede': 'Admin de sede',
  jefe: 'Jefe',
  operario: 'Operario',
  administrador: 'Admin',
  jefe_mantenimiento_operaciones: 'Jefe',
  'consola-edge': 'Consola del Edge',
}
const VARIABLE: Record<string, string> = {
  energia_kw: 'consumo eléctrico',
  energia_pct: 'consumo sobre el promedio',
  agua_m3_dia: 'agua del día',
  agua_m3h: 'posible fuga de agua',
  uv: 'índice UV',
}
const GRUPO: Record<string, string> = { 'admin-general': 'admin general', 'admin-sede': 'admin de sede', jefe: 'jefe', operario: 'operario' }
const SEDE_COGNITO: Record<string, string> = { planta: 'Planta', oficinas: 'Oficinas', todas: 'ambas sedes' }

type Categoria = 'todas' | 'alerta' | 'umbral' | 'usuario' | 'sesion'
const CATEGORIAS: { id: Categoria; nombre: string }[] = [
  { id: 'todas', nombre: 'Todo' },
  { id: 'alerta', nombre: 'Alertas' },
  { id: 'umbral', nombre: 'Umbrales' },
  { id: 'usuario', nombre: 'Cuentas' },
  { id: 'sesion', nombre: 'Inicios de sesión' },
]
const ICONO_CATEGORIA: Record<string, string> = { alerta: '🔔', umbral: '🎚️', usuario: '👤', sesion: '🔒' }

type Rango = 'hoy' | '7d' | '30d' | 'otro'
const RANGOS: { id: Rango; nombre: string }[] = [
  { id: 'hoy', nombre: 'Hoy' },
  { id: '7d', nombre: 'Últimos 7 días' },
  { id: '30d', nombre: 'Últimos 30 días' },
  { id: 'otro', nombre: 'Elegir fechas' },
]

// Fecha YYYY-MM-DD en hora de Chile (la API entiende las fechas sin zona en hora de Chile)
const diaChile = (t: number) => new Date(t).toLocaleDateString('sv-SE', { timeZone: ZONA })
const hora = (iso: string) => new Date(iso).toLocaleString('es-CL', { timeZone: ZONA, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
const horaLarga = (iso: string) =>
  new Date(iso).toLocaleString('es-CL', { timeZone: ZONA, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const categoria = (r: RegistroAuditoria) => r.accion.split('.')[0]
const num = (v: unknown) => (v == null ? '—' : String(v).replace('.', ','))

type Cambio = { advertencia?: number | null; alerta?: number; grupo?: string; sede?: string }

// La acción en palabras simples, para que cualquiera del equipo la entienda
function frase(r: RegistroAuditoria): string {
  const d = r.detalle as Record<string, unknown>
  const antes = (d.antes ?? {}) as Cambio
  const despues = (d.despues ?? {}) as Cambio
  switch (r.accion) {
    case 'alerta.reconocida': {
      const nivel = d.nivel === 'critico' ? 'crítica ' : d.nivel === 'advertencia' ? 'de advertencia ' : ''
      return `Reconoció una alerta ${nivel}de ${VARIABLE[String(d.variable)] ?? d.variable} (valor ${num(d.valor)})`
    }
    case 'umbral.modificado': {
      const variable = r.objeto.split(':')[1]
      const partes = []
      if (antes.alerta !== despues.alerta) partes.push(`alerta ${num(antes.alerta)} → ${num(despues.alerta)}`)
      if (antes.advertencia !== despues.advertencia) partes.push(`advertencia ${num(antes.advertencia)} → ${num(despues.advertencia)}`)
      return `Cambió el umbral de ${VARIABLE[variable] ?? variable}: ${partes.join(', ') || 'sin cambios'}${d.unidad ? ` ${d.unidad}` : ''}`
    }
    case 'umbral.sincronizado':
      return `Copió ${num(d.copiados)} umbrales de RDS a DynamoDB`
    case 'usuario.creado':
      return d.grupo
        ? `Creó la cuenta ${r.objeto} como ${GRUPO[String(d.grupo)] ?? d.grupo} (${SEDE_COGNITO[String(d.sede)] ?? d.sede})`
        : `Creó la cuenta ${r.objeto} en el Edge`
    case 'usuario.modificado':
      return `Cambió la cuenta ${r.objeto}: ${GRUPO[antes.grupo ?? ''] ?? antes.grupo} en ${SEDE_COGNITO[antes.sede ?? ''] ?? antes.sede} → ${
        GRUPO[despues.grupo ?? ''] ?? despues.grupo
      } en ${SEDE_COGNITO[despues.sede ?? ''] ?? despues.sede}`
    case 'usuario.desactivado':
      return `Desactivó la cuenta ${r.objeto}`
    case 'usuario.activado':
      return `Reactivó la cuenta ${r.objeto}`
    case 'usuario.clave_reseteada':
      return `Reseteó la clave de ${r.objeto}`
    case 'usuario.mfa_reseteado':
      return `Reseteó el MFA de ${r.objeto}`
    case 'sesion.bloqueada':
      return `La cuenta ${r.objeto} quedó bloqueada por ${num(d.intentos)} intentos fallidos (${num(d.minutos)} min)`
    default:
      return `${r.accion} · ${r.objeto}`
  }
}

function descargarCsv(registros: RegistroAuditoria[]) {
  const celda = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const filas = [
    ['fecha (Chile)', 'sede', 'usuario', 'rol', 'accion', 'descripcion', 'objeto', 'origen', 'hash'],
    ...registros.map((r) => [horaLarga(r.ts), NOMBRE_SEDE[r.sede] ?? r.sede, r.usuario, r.rol, r.accion, frase(r), r.objeto, r.origen, r.hash]),
  ]
  // BOM para que Excel lea bien las tildes
  const blob = new Blob(['﻿' + filas.map((f) => f.map(celda).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `auditoria-induplac-${diaChile(Date.now())}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export function VistaAuditoria() {
  const { sesion } = useSesion()
  const esGeneral = sesion.rol === 'admin_general' || sesion.rol === 'administrador' || sesion.locales.length > 1
  const [rango, setRango] = useState<Rango>('7d')
  const [hoy] = useState(() => Date.now())
  const [desdeOtro, setDesdeOtro] = useState(() => diaChile(hoy - 6 * 86_400_000))
  const [hastaOtro, setHastaOtro] = useState(() => diaChile(hoy))
  const [sede, setSede] = useState<string>('')
  const [cat, setCat] = useState<Categoria>('todas')
  const [busqueda, setBusqueda] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)

  const { desde, hasta } = useMemo(() => {
    if (rango === 'otro') return { desde: desdeOtro, hasta: `${hastaOtro}T23:59:59` }
    const dias = rango === 'hoy' ? 0 : rango === '7d' ? 6 : 29
    return { desde: diaChile(hoy - dias * 86_400_000), hasta: undefined }
  }, [rango, desdeOtro, hastaOtro, hoy])

  const { datos, error } = usePolling(() => admin.auditoria({ desde, hasta, sede: sede || undefined }), 60_000, [desde, hasta, sede])
  const registros = useMemo(() => datos?.registros ?? [], [datos])
  const integridad = datos?.integridad ?? {}
  const alteradas = Object.entries(integridad).filter(([, v]) => v.estado === 'alterada')
  const conProblema = new Set(alteradas.flatMap(([, v]) => v.problemas.map((p) => p.id)))

  const texto = busqueda.trim().toLowerCase()
  const filtrados = useMemo(
    () =>
      registros
        .filter((r) => cat === 'todas' || categoria(r) === cat)
        .filter((r) => !texto || `${r.usuario} ${r.objeto} ${frase(r)}`.toLowerCase().includes(texto)),
    [registros, cat, texto],
  )
  const actual = registros.find((r) => r.id === elegido) ?? null
  const contar = (c: string) => registros.filter((r) => categoria(r) === c).length

  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${activo ? 'border-oficinas bg-oficinas/15 font-bold text-tinta' : 'border-borde text-tinta-2 hover:text-tinta'}`
  const campoFecha = 'rounded-md border border-borde bg-panel px-2.5 py-1.5 text-sm text-tinta outline-none focus:border-oficinas'

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-tinta-2">
          Quién hizo qué y cuándo, en {esGeneral ? 'las dos sedes' : NOMBRE_SEDE[sesion.locales[0]]}. Los registros no se pueden editar ni borrar.
        </p>
        <button
          onClick={() => descargarCsv(filtrados)}
          disabled={!filtrados.length}
          className="rounded-md border border-borde px-4 py-2 text-sm font-bold hover:border-tinta-3 disabled:opacity-40"
        >
          ⬇ Descargar CSV
        </button>
      </div>

      {datos &&
        (alteradas.length ? (
          <section className="rounded-lg border border-critico/60 bg-critico/10 p-4">
            <p className="font-display text-xl font-bold text-critico">⚠ Auditoría alterada</p>
            <p className="mt-1 text-sm text-tinta">
              Alguien cambió o borró registros por fuera del sistema (por ejemplo, desde la consola de AWS). Revisa quién tiene acceso a la cuenta y avisa al admin
              general.
            </p>
            <ul className="mt-3 grid gap-1.5 text-sm">
              {alteradas.flatMap(([s, v]) =>
                v.problemas.map((p) => (
                  <li key={`${s}-${p.id}-${p.tipo}`}>
                    <b>{NOMBRE_SEDE[s] ?? s}:</b> {p.mensaje}{' '}
                    {registros.some((r) => r.id === p.id) && (
                      <button onClick={() => setElegido(p.id)} className="text-critico underline">
                        ver registro
                      </button>
                    )}
                  </li>
                )),
              )}
            </ul>
          </section>
        ) : (
          Object.keys(integridad).length > 0 && (
            <section className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-ok/40 bg-ok/10 px-4 py-3 text-sm">
              <b className="text-ok">✓ Cadena de registros íntegra</b>
              <span className="text-tinta-2">Nadie cambió ni borró registros en este período.</span>
              <span className="flex flex-wrap gap-2">
                {Object.keys(integridad).map((s) => (
                  <span key={s} className="rounded border border-ok/40 px-2 py-0.5 text-xs text-ok">
                    {NOMBRE_SEDE[s] ?? s} ✓
                  </span>
                ))}
              </span>
            </section>
          )
        ))}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { n: registros.length, t: 'registros en el período', c: '' },
          { n: contar('alerta'), t: 'alertas reconocidas', c: 'text-aviso' },
          { n: contar('umbral'), t: 'cambios de umbrales', c: 'text-oficinas' },
          { n: contar('usuario') + contar('sesion'), t: 'cambios en cuentas y bloqueos', c: 'text-tinta' },
        ].map((k) => (
          <article key={k.t} className="rounded-lg border border-borde bg-panel p-4">
            <p className={`font-display text-3xl font-bold ${k.c}`}>{datos ? k.n : '…'}</p>
            <p className="text-sm text-tinta-2">{k.t}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {RANGOS.map((r) => (
            <button key={r.id} className={chip(rango === r.id)} onClick={() => setRango(r.id)}>
              {r.nombre}
            </button>
          ))}
          {rango === 'otro' && (
            <span className="flex flex-wrap items-center gap-2 text-sm text-tinta-2">
              <input type="date" className={campoFecha} value={desdeOtro} max={hastaOtro} onChange={(e) => e.target.value && setDesdeOtro(e.target.value)} />
              a
              <input type="date" className={campoFecha} value={hastaOtro} min={desdeOtro} max={diaChile(hoy)} onChange={(e) => e.target.value && setHastaOtro(e.target.value)} />
            </span>
          )}
        </div>
        {esGeneral && (
          <div className="flex flex-wrap gap-2">
            {['', 'local1', 'local2', 'general'].map((s) => (
              <button key={s || 'todas'} className={chip(sede === s)} onClick={() => setSede(s)}>
                {s ? NOMBRE_SEDE[s] : 'Todas las sedes'}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {CATEGORIAS.map((c) => (
            <button key={c.id} className={chip(cat === c.id)} onClick={() => setCat(c.id)}>
              {c.nombre} ({c.id === 'todas' ? registros.length : contar(c.id)})
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="🔍  Buscar por usuario, cuenta o lo que pasó"
          className="rounded-lg border border-borde bg-panel px-4 py-2.5 text-sm text-tinta outline-none placeholder:text-tinta-3 focus:border-oficinas"
        />
      </div>

      {error && <p className="rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">No se pudo cargar la auditoría: {error}</p>}
      {datos?.truncado && (
        <p className="rounded-md border border-aviso/40 bg-aviso/10 px-3 py-2 text-sm text-aviso">
          Hay más de 1.000 registros en este período: se muestran los más recientes. Elige un rango más corto para ver el resto.
        </p>
      )}

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_26rem]">
        <ul className="grid gap-2">
          {filtrados.map((r) => {
            const malo = conProblema.has(r.id)
            return (
              <li key={`${r.sede}-${r.id}`}>
                <button
                  onClick={() => setElegido(r.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border bg-panel p-3 text-left ${
                    malo ? 'border-critico' : elegido === r.id ? 'border-oficinas' : 'border-borde hover:border-tinta-3'
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-borde text-lg" aria-hidden>
                    {ICONO_CATEGORIA[categoria(r)] ?? '•'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold leading-snug">{frase(r)}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-tinta-2">
                      <span className="tabular-nums sm:hidden">{hora(r.ts)} ·</span>
                      <span>
                        {r.usuario} · {NOMBRE_ROL[r.rol] ?? r.rol}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 text-xs ${CLASE_SEDE[r.sede] ?? CLASE_SEDE.general}`}>{NOMBRE_SEDE[r.sede] ?? r.sede}</span>
                      {r.origen === 'edge' && (
                        <span className="rounded bg-borde px-1.5 py-0.5 text-xs">{(r.detalle as { sin_internet?: boolean }).sin_internet ? 'Edge · sin internet' : 'Edge'}</span>
                      )}
                      {malo && <span className="text-xs font-bold text-critico">Alterado</span>}
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-sm tabular-nums text-tinta-2 sm:block">{hora(r.ts)}</span>
                </button>
              </li>
            )
          })}
          {datos && !filtrados.length && (
            <li className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tinta-3">No hay registros con esos filtros en este período.</li>
          )}
          {!datos && !error && <li className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tinta-3">Cargando…</li>}
        </ul>

        {actual ? (
          <Detalle key={actual.id} r={actual} problemas={alteradas.flatMap(([, v]) => v.problemas).filter((p) => p.id === actual.id)} />
        ) : (
          <aside className="hidden rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tinta-3 xl:block">Elige un registro para ver su detalle.</aside>
        )}
      </div>

      <p className="text-xs text-tinta-3">
        Cada registro guarda el hash del anterior (SHA-256), como una cadena. Si alguien cambia o borra uno por fuera del sistema, la cadena se rompe y esta pantalla
        lo muestra. Lo que se hace en el Edge sin internet se guarda en la Raspberry y sube a la nube al reconectar.
      </p>
    </div>
  )
}

function Detalle({ r, problemas }: { r: RegistroAuditoria; problemas: { tipo: string; mensaje: string }[] }) {
  const d = r.detalle as Record<string, unknown>
  const antes = d.antes as Cambio | undefined
  const despues = d.despues as Cambio | undefined
  const edge = d._edge as { edge_id?: string; hash_ok?: boolean; cadena_ok?: boolean } | undefined
  // En pantallas chicas el detalle queda bajo la lista: lo traemos a la vista
  const caja = useRef<HTMLElement>(null)
  useEffect(() => {
    if (window.innerWidth < 1280) caja.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  const comentario = typeof d.comentario === 'string' && d.comentario ? d.comentario : null
  const fila = (k: string, v: ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-borde/60 py-1.5 text-sm last:border-0">
      <span className="text-tinta-2">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  )

  return (
    <aside className="grid scroll-mt-24 gap-4 rounded-lg border border-borde bg-panel p-4 xl:sticky xl:top-24" ref={caja}>
      <div>
        <p className="text-xs uppercase tracking-[0.12em] text-tinta-3">{r.accion}</p>
        <p className="mt-1 font-display text-xl font-bold leading-snug">{frase(r)}</p>
      </div>

      {problemas.map((p) => (
        <p key={p.tipo} className="rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">
          ⚠ {p.mensaje}
        </p>
      ))}

      <div>
        {fila('Cuándo', <span className="first-letter:uppercase">{horaLarga(r.ts)}</span>)}
        {fila('Quién', `${r.usuario} (${NOMBRE_ROL[r.rol] ?? r.rol})`)}
        {fila('Sede', NOMBRE_SEDE[r.sede] ?? r.sede)}
        {fila('Sobre qué', <span className="break-all">{r.objeto}</span>)}
        {fila('Desde', r.origen === 'edge' ? `Edge${edge?.edge_id ? ` (${edge.edge_id})` : ''}${d.sin_internet ? ', sin internet' : ''}` : 'Nube')}
      </div>

      {comentario && (
        <blockquote className="rounded-md border-l-4 border-oficinas bg-fondo px-3 py-2 text-sm">
          <p className="mb-1 text-xs text-tinta-2">Comentario</p>“{comentario}”
        </blockquote>
      )}

      {antes && despues && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-tinta-2">
              <th className="py-1 font-normal"></th>
              <th className="py-1 font-normal">Antes</th>
              <th className="py-1 font-normal">Después</th>
            </tr>
          </thead>
          <tbody>
            {(['advertencia', 'alerta', 'grupo', 'sede'] as const)
              .filter((k) => k in antes || k in despues)
              .map((k) => (
                <tr key={k} className="border-t border-borde/60">
                  <td className="py-1.5 capitalize text-tinta-2">{k === 'grupo' ? 'rol' : k}</td>
                  <td className="py-1.5">{num(antes[k])}</td>
                  <td className={`py-1.5 ${antes[k] !== despues[k] ? 'font-bold text-oficinas' : ''}`}>{num(despues[k])}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {d.copiado === false && <p className="text-sm text-aviso">Quedó guardado en RDS, pero la copia a DynamoDB falló: las alertas siguieron con el valor anterior.</p>}

      {edge && (
        <div className="grid gap-1 text-sm">
          <p className={edge.hash_ok ? 'text-ok' : 'text-critico'}>{edge.hash_ok ? '✓ Nadie lo cambió en la Raspberry' : '⚠ Se cambió en la Raspberry antes de subir'}</p>
          <p className={edge.cadena_ok ? 'text-ok' : 'text-critico'}>
            {edge.cadena_ok ? '✓ No falta ningún registro anterior del Edge' : '⚠ Faltan registros del Edge o se reinició su base'}
          </p>
        </div>
      )}

      <details className="text-xs text-tinta-3">
        <summary className="cursor-pointer text-tinta-2">Hash del registro (para verificar)</summary>
        <p className="mt-2">Hash</p>
        <p className="break-all font-mono text-tinta-2">{r.hash || '—'}</p>
        <p className="mt-2">Hash del anterior</p>
        <p className="break-all font-mono text-tinta-2">{r.hash_anterior || '—'}</p>
      </details>
      <p className="text-xs text-tinta-3">Este registro no se puede editar ni borrar.</p>
    </aside>
  )
}
