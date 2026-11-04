// Pantalla Usuarios y permisos (bocetos aprobados, tarea 30 parte 4).
//
// Lista las cuentas de Cognito (GET /api/usuarios), con filtros por sede y rol, y
// permite crear, cambiar rol o sede, desactivar, reactivar y resetear clave o MFA
// (docs/api-dashboard.md §6.4). Los permisos salen del ROL (grupo de Cognito):
// aquí se muestran como etiquetas, no se editan uno por uno.

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { admin, type AccionUsuario, type Grupo, type SedeCognito, type Usuario } from '../api/admin'
import { useSesion } from '../auth/sesion'
import { usePolling } from '../hooks/usePolling'

const ROL: Record<Grupo, { nombre: string; clase: string; permisos: string[] }> = {
  'admin-general': { nombre: 'Admin general', clase: 'bg-aviso/15 text-aviso', permisos: ['Ver', 'Reconocer', 'Histórico', 'Umbrales', 'Usuarios', 'Auditoría'] },
  administrador: { nombre: 'Admin (antiguo)', clase: 'bg-aviso/15 text-aviso', permisos: ['Ver', 'Reconocer', 'Histórico', 'Umbrales', 'Usuarios', 'Auditoría'] },
  'admin-sede': { nombre: 'Admin de sede', clase: 'bg-oficinas/15 text-oficinas', permisos: ['Ver', 'Reconocer', 'Histórico', 'Umbrales', 'Usuarios', 'Auditoría'] },
  jefe: { nombre: 'Jefe', clase: 'bg-purple-500/15 text-purple-300', permisos: ['Ver', 'Reconocer', 'Histórico'] },
  operario: { nombre: 'Operario', clase: 'bg-borde text-tinta-2', permisos: ['Ver'] },
}
const TODOS_PERMISOS = ['Ver', 'Reconocer', 'Histórico', 'Umbrales', 'Usuarios', 'Auditoría']
const SEDE: Record<SedeCognito, { nombre: string; clase: string }> = {
  planta: { nombre: 'Planta', clase: 'border-planta/60 text-planta' },
  oficinas: { nombre: 'Oficinas', clase: 'border-oficinas/60 text-oficinas' },
  todas: { nombre: 'Ambas', clase: 'border-borde text-tinta-2' },
}
// Qué sedes calzan con cada rol (las mismas reglas que valida la API)
const SEDES_DE: Record<Grupo, SedeCognito[]> = {
  'admin-general': ['todas'],
  administrador: ['todas'],
  'admin-sede': ['planta', 'oficinas'],
  jefe: ['planta', 'oficinas', 'todas'],
  operario: ['planta', 'oficinas'],
}

const iniciales = (u: string) =>
  u
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—')
const pendiente = (u: Usuario) => u.estado === 'FORCE_CHANGE_PASSWORD'

type FiltroRol = 'todos' | Grupo | 'desactivados'

export function VistaUsuarios() {
  const { sesion } = useSesion()
  const esGeneral = sesion.rol === 'admin_general' || sesion.rol === 'administrador'
  const miSede: SedeCognito = sesion.locales.length > 1 ? 'todas' : sesion.locales[0] === 'local1' ? 'planta' : 'oficinas'
  const [recarga, setRecarga] = useState(0)
  const { datos: cuentas, error } = usePolling(() => admin.usuarios(), 60_000, [recarga])
  const [busqueda, setBusqueda] = useState('')
  const [filtroSede, setFiltroSede] = useState<'todas-las-sedes' | SedeCognito>('todas-las-sedes')
  const [filtroRol, setFiltroRol] = useState<FiltroRol>('todos')
  const [elegido, setElegido] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)

  const lista = useMemo(() => cuentas ?? [], [cuentas])
  const filtradas = useMemo(
    () =>
      lista
        .filter((u) => u.usuario.includes(busqueda.trim().toLowerCase()))
        .filter((u) => filtroSede === 'todas-las-sedes' || u.sede === filtroSede)
        .filter((u) => (filtroRol === 'todos' ? true : filtroRol === 'desactivados' ? !u.habilitado : u.grupo === filtroRol && u.habilitado)),
    [lista, busqueda, filtroSede, filtroRol],
  )
  const actual = lista.find((u) => u.usuario === elegido) ?? null
  const activas = lista.filter((u) => u.habilitado)
  const contar = (f: (u: Usuario) => boolean) => lista.filter(f).length

  const chip = (activo: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${activo ? 'border-oficinas bg-oficinas/15 font-bold text-tinta' : 'border-borde text-tinta-2 hover:text-tinta'}`

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-tinta-2">
          {esGeneral ? 'Ambas sedes' : SEDE[miSede].nombre} · {activas.length} cuentas activas · {contar((u) => !u.habilitado)} desactivadas ·{' '}
          {contar(pendiente)} con la clave temporal pendiente
        </p>
        <button onClick={() => setCreando(true)} className="rounded-md bg-oficinas px-4 py-2 text-sm font-bold text-white hover:brightness-110">
          + Nuevo usuario
        </button>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { n: activas.length, t: 'cuentas activas', c: '' },
          { n: contar((u) => u.habilitado && (u.grupo === 'admin-general' || u.grupo === 'admin-sede')), t: 'administradores', c: 'text-aviso' },
          { n: contar((u) => u.habilitado && pendiente(u)), t: 'aún no entran', c: 'text-aviso' },
          { n: contar((u) => !u.habilitado), t: 'desactivadas', c: 'text-tinta-2' },
        ].map((k) => (
          <article key={k.t} className="rounded-lg border border-borde bg-panel p-4">
            <p className={`font-display text-3xl font-bold ${k.c}`}>{k.n}</p>
            <p className="text-sm text-tinta-2">{k.t}</p>
          </article>
        ))}
      </section>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="🔍  Buscar por nombre de usuario"
        className="rounded-lg border border-borde bg-panel px-4 py-2.5 text-sm text-tinta outline-none placeholder:text-tinta-3 focus:border-oficinas"
      />

      <div className="grid gap-2">
        {esGeneral && (
          <div className="flex flex-wrap gap-2">
            <button className={chip(filtroSede === 'todas-las-sedes')} onClick={() => setFiltroSede('todas-las-sedes')}>
              Todas las sedes
            </button>
            {(['planta', 'oficinas', 'todas'] as SedeCognito[]).map((s) => (
              <button key={s} className={chip(filtroSede === s)} onClick={() => setFiltroSede(s)}>
                {SEDE[s].nombre} ({contar((u) => u.sede === s)})
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={chip(filtroRol === 'todos')} onClick={() => setFiltroRol('todos')}>
            Todos ({lista.length})
          </button>
          {(['admin-general', 'admin-sede', 'jefe', 'operario'] as Grupo[])
            .filter((g) => esGeneral || g !== 'admin-general')
            .map((g) => (
              <button key={g} className={chip(filtroRol === g)} onClick={() => setFiltroRol(g)}>
                {ROL[g].nombre} ({contar((u) => u.grupo === g && u.habilitado)})
              </button>
            ))}
          <button className={chip(filtroRol === 'desactivados')} onClick={() => setFiltroRol('desactivados')}>
            Desactivados ({contar((u) => !u.habilitado)})
          </button>
        </div>
      </div>

      {error && <p className="rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">No se pudieron cargar las cuentas: {error}</p>}

      <div className="grid items-start gap-4 xl:grid-cols-[1fr_24rem]">
        <ul className="grid gap-2">
          {filtradas.map((u) => (
            <li key={u.usuario}>
              <button
                onClick={() => setElegido(u.usuario)}
                className={`flex w-full items-center gap-3 rounded-lg border bg-panel p-3 text-left ${
                  elegido === u.usuario ? 'border-oficinas' : 'border-borde hover:border-tinta-3'
                } ${u.habilitado ? '' : 'opacity-60'}`}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-borde text-sm font-bold">{iniciales(u.usuario)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className={u.habilitado ? '' : 'line-through'}>{u.usuario}</b>
                    {u.grupo && <span className={`rounded px-2 py-0.5 text-xs font-bold ${ROL[u.grupo].clase}`}>{ROL[u.grupo].nombre}</span>}
                    {u.sede && <span className={`rounded border px-2 py-0.5 text-xs ${SEDE[u.sede].clase}`}>{SEDE[u.sede].nombre}</span>}
                    {!u.habilitado ? (
                      <span className="text-xs text-critico">Desactivada</span>
                    ) : pendiente(u) ? (
                      <span className="text-xs text-aviso">Clave temporal · aún no entra</span>
                    ) : null}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    {TODOS_PERMISOS.map((p) => (
                      <span
                        key={p}
                        className={`rounded border border-borde px-1.5 py-0.5 text-xs ${u.grupo && ROL[u.grupo].permisos.includes(p) ? 'text-tinta-2' : 'text-tinta-3 line-through opacity-60'}`}
                      >
                        {p}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="hidden text-xs text-tinta-3 sm:block">creada {fecha(u.creado)}</span>
              </button>
            </li>
          ))}
          {cuentas && !filtradas.length && <li className="rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tinta-3">No hay cuentas con esos filtros.</li>}
        </ul>

        {actual ? (
          <Detalle
            key={actual.usuario}
            u={actual}
            esGeneral={esGeneral}
            miSede={miSede}
            yo={sesion.usuario}
            alCambiar={() => setRecarga((n) => n + 1)}
          />
        ) : (
          <aside className="hidden rounded-lg border border-dashed border-borde p-6 text-center text-sm text-tinta-3 xl:block">Elige una cuenta para ver su detalle.</aside>
        )}
      </div>

      <p className="text-xs text-tinta-3">
        {esGeneral
          ? 'Solo el admin general crea administradores y da acceso a las dos sedes.'
          : `Un admin de sede maneja jefes y operarios de ${SEDE[miSede].nombre}. Crear administradores o dar acceso a otra sede lo hace el admin general.`}{' '}
        Las cuentas se desactivan, no se borran, para que la auditoría siga mostrando quién hizo qué.
      </p>

      {creando && (
        <NuevoUsuario
          esGeneral={esGeneral}
          miSede={miSede}
          cerrar={() => setCreando(false)}
          creado={(u) => {
            setCreando(false)
            setRecarga((n) => n + 1)
            setElegido(u)
          }}
        />
      )}
    </div>
  )
}

function Detalle({ u, esGeneral, miSede, yo, alCambiar }: { u: Usuario; esGeneral: boolean; miSede: SedeCognito; yo: string; alCambiar: () => void }) {
  const [grupo, setGrupo] = useState<Grupo | null>(u.grupo)
  const [sede, setSede] = useState<SedeCognito | null>(u.sede)
  const [ocupado, setOcupado] = useState(false)
  const [mensaje, setMensaje] = useState<{ tono: 'ok' | 'critico'; texto: string } | null>(null)
  const [clave, setClave] = useState<string | null>(null)
  const soyYo = u.usuario === yo
  // En pantallas chicas el detalle queda bajo la lista: lo traemos a la vista
  const caja = useRef<HTMLElement>(null)
  useEffect(() => {
    if (window.innerWidth < 1280) caja.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  // El admin de sede solo maneja jefes y operarios de su sede (la API lo valida igual)
  const puedeTocar = !soyYo && (esGeneral || ((u.grupo === 'jefe' || u.grupo === 'operario') && u.sede === miSede))
  const gruposPosibles: Grupo[] = esGeneral ? ['admin-general', 'admin-sede', 'jefe', 'operario'] : ['jefe', 'operario']
  const sedesPosibles = grupo ? SEDES_DE[grupo].filter((s) => esGeneral || s === miSede) : []
  const cambiado = grupo !== u.grupo || sede !== u.sede

  const hacer = async (f: () => Promise<unknown>, ok: string) => {
    setOcupado(true)
    setMensaje(null)
    try {
      await f()
      setMensaje({ tono: 'ok', texto: ok })
      alCambiar()
    } catch (e) {
      setMensaje({ tono: 'critico', texto: e instanceof Error ? e.message : String(e) })
    } finally {
      setOcupado(false)
    }
  }
  const accion = (a: AccionUsuario, ok: string, confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return
    void hacer(async () => {
      const r = await admin.accionUsuario(u.usuario, a)
      if (r.clave_temporal) setClave(r.clave_temporal)
    }, ok)
  }
  const campo = 'w-full rounded-md border border-borde bg-fondo px-2.5 py-2 text-sm text-tinta outline-none focus:border-oficinas disabled:opacity-50'

  return (
    <aside ref={caja} className="grid scroll-mt-24 gap-4 rounded-lg border border-borde bg-panel p-4 xl:sticky xl:top-24">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-borde font-bold">{iniciales(u.usuario)}</span>
        <div>
          <p className="font-display text-xl font-bold">{u.usuario}</p>
          <p className="text-xs text-tinta-2">
            {u.grupo ? ROL[u.grupo].nombre : 'Sin rol'} · {u.sede ? SEDE[u.sede].nombre : 'sin sede'} · creada {fecha(u.creado)}
          </p>
        </div>
      </div>

      {!u.habilitado && <p className="rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">Cuenta desactivada: no puede entrar.</p>}
      {u.habilitado && pendiente(u) && (
        <p className="rounded-md border border-aviso/40 bg-aviso/10 px-3 py-2 text-sm text-aviso">
          Todavía no entra por primera vez. La clave temporal le llegó por correo; si no la encuentra, resetea la clave.
        </p>
      )}
      {soyYo && <p className="text-sm text-tinta-2">Esta es tu cuenta: tu rol y tu sede los cambia otro admin general.</p>}
      {!soyYo && !puedeTocar && <p className="text-sm text-tinta-2">Solo el admin general puede cambiar esta cuenta.</p>}

      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs text-tinta-2">
          Rol
          <select
            className={campo}
            disabled={!puedeTocar || ocupado}
            value={grupo ?? ''}
            onChange={(e) => {
              const g = e.target.value as Grupo
              setGrupo(g)
              const posibles = SEDES_DE[g].filter((s) => esGeneral || s === miSede)
              if (!sede || !posibles.includes(sede)) setSede(posibles[0])
            }}
          >
            {(gruposPosibles.includes(grupo as Grupo) ? gruposPosibles : [grupo as Grupo, ...gruposPosibles]).map((g) => (
              <option key={g} value={g}>
                {ROL[g]?.nombre ?? g}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-tinta-2">
          Sede
          <select className={campo} disabled={!puedeTocar || ocupado} value={sede ?? ''} onChange={(e) => setSede(e.target.value as SedeCognito)}>
            {(sedesPosibles.includes(sede as SedeCognito) ? sedesPosibles : [sede as SedeCognito, ...sedesPosibles]).map((s) => (
              <option key={s} value={s}>
                {SEDE[s]?.nombre ?? s}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs text-tinta-2">Lo que puede hacer con este rol</p>
        <div className="flex flex-wrap gap-1.5">
          {TODOS_PERMISOS.map((p) => (
            <span key={p} className={`rounded border px-2 py-0.5 text-xs ${grupo && ROL[grupo].permisos.includes(p) ? 'border-ok/40 text-ok' : 'border-borde text-tinta-3 line-through'}`}>
              {p}
            </span>
          ))}
        </div>
        {(grupo === 'jefe' || grupo?.startsWith('admin')) && <p className="mt-1.5 text-xs text-tinta-3">Con este rol el MFA es obligatorio.</p>}
      </div>

      {cambiado && puedeTocar && (
        <button
          disabled={ocupado || !grupo || !sede}
          onClick={() => hacer(() => admin.modificarUsuario(u.usuario, { grupo: grupo!, sede: sede! }), 'Rol y sede actualizados. Se aplican en su próximo inicio de sesión.')}
          className="rounded-md bg-oficinas px-3 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50"
        >
          Guardar rol y sede
        </button>
      )}

      {puedeTocar && (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={ocupado || !u.habilitado}
            onClick={() => accion('resetear-clave', 'Clave temporal nueva lista.', `¿Resetear la clave de ${u.usuario}? Su clave actual deja de servir.`)}
            className="rounded-md border border-borde px-3 py-2 text-sm hover:border-tinta-3 disabled:opacity-40"
          >
            Resetear clave
          </button>
          <button
            disabled={ocupado || !u.habilitado}
            onClick={() => accion('resetear-mfa', 'MFA borrado: lo registrará de nuevo al entrar.', `¿Resetear el MFA de ${u.usuario}? Úsalo si perdió el celular.`)}
            className="rounded-md border border-borde px-3 py-2 text-sm hover:border-tinta-3 disabled:opacity-40"
          >
            Resetear MFA
          </button>
          {u.habilitado ? (
            <button
              disabled={ocupado}
              onClick={() => accion('desactivar', 'Cuenta desactivada y sesiones cerradas.', `¿Desactivar a ${u.usuario}? No podrá entrar hasta que la reactives.`)}
              className="col-span-2 rounded-md border border-critico/50 px-3 py-2 text-sm text-critico hover:bg-critico/10 disabled:opacity-40"
            >
              Desactivar cuenta
            </button>
          ) : (
            <button disabled={ocupado} onClick={() => accion('activar', 'Cuenta reactivada.')} className="col-span-2 rounded-md border border-ok/50 px-3 py-2 text-sm text-ok hover:bg-ok/10 disabled:opacity-40">
              Reactivar cuenta
            </button>
          )}
        </div>
      )}

      {clave && (
        <div className="rounded-md border border-oficinas/50 bg-oficinas/10 p-3 text-sm">
          <p className="font-bold">Clave temporal de {u.usuario}</p>
          <p className="my-2 select-all rounded bg-fondo px-2 py-1.5 text-center font-mono text-base tracking-wider">{clave}</p>
          <p className="text-xs text-tinta-2">Entrégasela en persona o por un canal seguro. No se vuelve a mostrar y la cambia al entrar.</p>
        </div>
      )}
      {mensaje && <p className={`text-sm ${mensaje.tono === 'ok' ? 'text-ok' : 'text-critico'}`}>{mensaje.texto}</p>}
      <p className="text-xs text-tinta-3">Cada cambio queda en la Auditoría. Las cuentas se desactivan, no se borran.</p>
    </aside>
  )
}

function NuevoUsuario({ esGeneral, miSede, cerrar, creado }: { esGeneral: boolean; miSede: SedeCognito; cerrar: () => void; creado: (u: string) => void }) {
  const [usuario, setUsuario] = useState('')
  const [email, setEmail] = useState('')
  const [grupo, setGrupo] = useState<Grupo>('operario')
  const posibles = SEDES_DE[grupo].filter((s) => esGeneral || s === miSede)
  const [sede, setSede] = useState<SedeCognito>(esGeneral ? 'planta' : miSede)
  const sedeValida = posibles.includes(sede) ? sede : posibles[0]
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const campo = 'w-full rounded-md border border-borde bg-fondo px-3 py-2 text-sm text-tinta outline-none focus:border-oficinas'

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const u = await admin.crearUsuario({ usuario: usuario.trim().toLowerCase(), email: email.trim(), grupo, sede: sedeValida })
      creado(u.usuario)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" onClick={cerrar}>
      <form onSubmit={enviar} onClick={(e) => e.stopPropagation()} className="grid w-full max-w-md gap-3 rounded-xl border border-borde bg-panel p-6">
        <h2 className="font-display text-xl font-bold">Nuevo usuario</h2>
        <label className="grid gap-1 text-xs text-tinta-2">
          Usuario (minúsculas, sin espacios; ej. operario.planta2)
          <input className={campo} value={usuario} onChange={(e) => setUsuario(e.target.value)} required pattern="[a-zA-Z0-9][a-zA-Z0-9._-]{2,39}" />
        </label>
        <label className="grid gap-1 text-xs text-tinta-2">
          Correo (ahí le llega la clave temporal; no se muestra en la lista)
          <input className={campo} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-tinta-2">
            Rol
            <select className={campo} value={grupo} onChange={(e) => setGrupo(e.target.value as Grupo)}>
              {(esGeneral ? (['admin-general', 'admin-sede', 'jefe', 'operario'] as Grupo[]) : (['jefe', 'operario'] as Grupo[])).map((g) => (
                <option key={g} value={g}>
                  {ROL[g].nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-tinta-2">
            Sede
            <select className={campo} value={sedeValida} onChange={(e) => setSede(e.target.value as SedeCognito)} disabled={posibles.length === 1}>
              {posibles.map((s) => (
                <option key={s} value={s}>
                  {SEDE[s].nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-tinta-2">
          Puede: {ROL[grupo].permisos.join(', ')}.{grupo !== 'operario' && ' El MFA será obligatorio en su primer inicio de sesión.'}
        </p>
        {error && <p className="rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={cerrar} className="rounded-md border border-borde px-4 py-2 text-sm">
            Cancelar
          </button>
          <button disabled={enviando} className="rounded-md bg-oficinas px-4 py-2 text-sm font-bold text-white hover:brightness-110 disabled:opacity-50">
            {enviando ? 'Creando…' : 'Crear cuenta'}
          </button>
        </div>
      </form>
    </div>
  )
}
