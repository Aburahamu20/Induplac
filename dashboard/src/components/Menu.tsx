// Menú lateral y encabezado del diseño aprobado (bocetos de Claude Design, tarea 30).
//
// El menú se arma según los permisos de la sesión: cada rol ve solo sus pantallas
// (contrato §6.4). En pantallas chicas se esconde y se abre con el botón ☰.

import { useEffect, useState } from 'react'
import type { EstadoLocal } from '../api'
import { NOMBRE_ROL, nombreSedes } from '../auth'
import { useSesion } from '../auth/sesion'
import { ActivarMfa } from './ActivarMfa'
import type { Aviso } from './estadoEnlace'
import { ENTRADAS, estadoCorto, ICONOS, nombreEntrada, SEDE, type Entrada, type Pantalla } from './pantallas'

const PUNTO = { ok: 'bg-ok', aviso: 'bg-aviso' }

export function Menu({
  actual,
  ir,
  alertasActivas,
  locales,
  abierto,
  cerrar,
}: {
  actual: Pantalla | undefined
  ir: (p: Pantalla) => void
  alertasActivas: number
  locales: EstadoLocal[]
  abierto: boolean
  cerrar: () => void
}) {
  const ctx = useSesion()
  const { sesion } = ctx
  const visibles = ENTRADAS.filter((e) => e.visible(ctx))
  const unaSede = sesion.locales.length === 1 ? SEDE[sesion.locales[0]] : null
  const marcaDe = (id: Pantalla) => {
    const l = id === 'planta' ? locales.find((x) => x.local_id === 'local1') : id === 'oficinas' ? locales.find((x) => x.local_id === 'local2') : null
    return l ? estadoCorto(l) : null
  }
  const grupos: { id: Entrada['grupo']; titulo: string }[] = [
    { id: 'monitoreo', titulo: 'Monitoreo' },
    { id: 'gestion', titulo: unaSede ? `Gestión · ${unaSede}` : 'Gestión · Admin' },
    { id: 'sistema', titulo: 'Sistema' },
  ]
  const iniciales = sesion.usuario
    .split(/[._-]/)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)

  return (
    <>
      {abierto && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={cerrar} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-borde bg-panel transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-oficinas text-sm font-bold text-white">IP</div>
          <div className="leading-tight">
            <p className="font-display text-lg font-bold">Induplac</p>
            <p className="text-xs text-tinta-2">Panel IoT</p>
          </div>
        </div>

        {unaSede && (
          <div
            className={`mx-3 mb-2 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-bold ${
              unaSede === 'Planta' ? 'border-planta/50 bg-planta/10 text-planta' : 'border-oficinas/50 bg-oficinas/10 text-oficinas'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${unaSede === 'Planta' ? 'bg-planta' : 'bg-oficinas'}`} /> Sede: {unaSede}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 pb-3">
          {grupos.map((g) => {
            const entradas = visibles.filter((e) => e.grupo === g.id)
            if (!entradas.length) return null
            return (
              <div key={g.id} className="mt-3">
                <p className="px-2 pb-1 text-xs font-bold uppercase tracking-[0.14em] text-tinta-3">{g.titulo}</p>
                {entradas.map((e) => {
                  const marca = marcaDe(e.id)
                  const activa = actual === e.id
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        ir(e.id)
                        cerrar()
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm ${
                        activa ? 'bg-oficinas/15 font-bold text-tinta' : 'text-tinta-2 hover:bg-borde/40 hover:text-tinta'
                      }`}
                    >
                      <span className={activa ? 'text-oficinas' : ''}>{e.icono}</span>
                      <span className="flex-1">{nombreEntrada(e.id, ctx)}</span>
                      {e.id === 'alertas' && alertasActivas > 0 && (
                        <span className="rounded-full bg-critico px-1.5 text-xs font-bold text-white">{alertasActivas}</span>
                      )}
                      {marca?.marca && (
                        <span className="flex items-center gap-1 text-xs font-bold text-aviso">
                          <span className="h-1.5 w-1.5 rounded-full bg-aviso" />
                          {marca.marca}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {locales.length > 0 && (
          <div className="mx-3 mb-3 grid gap-1.5 rounded-lg border border-borde p-2.5 text-xs">
            {locales.map((l) => {
              const e = estadoCorto(l)
              return (
                <p key={l.local_id} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${PUNTO[e.tono]}`} />
                  {e.texto}
                </p>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-borde px-3 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-planta/20 text-sm font-bold text-planta">{iniciales}</div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-bold">{sesion.usuario}</p>
            <p className="truncate text-xs text-tinta-2">
              {NOMBRE_ROL[sesion.rol]} · {nombreSedes(sesion.locales)}
            </p>
          </div>
          <button
            onClick={ctx.cerrar}
            title="Cerrar sesión"
            className="rounded-md border border-borde px-2 py-1 text-xs text-tinta-2 hover:border-tinta-3 hover:text-tinta"
          >
            Salir
          </button>
        </div>
        <div className="px-3 pb-3 empty:hidden">
          <ActivarMfa />
        </div>
      </aside>
    </>
  )
}

function useReloj() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])
  return ahora
}

const PILDORA = {
  ok: 'border-ok/40 bg-ok/10 text-ok',
  aviso: 'border-aviso/40 bg-aviso/10 text-aviso',
  critico: 'border-critico/40 bg-critico/10 text-critico',
}
const PUNTO_PILDORA = { ok: 'bg-ok', aviso: 'bg-aviso', critico: 'bg-critico' }

export function Cabecera({
  titulo,
  subtitulo,
  aviso,
  simulado,
  alertasActivas,
  abrirMenu,
  verAlertas,
}: {
  titulo: string
  subtitulo: string
  aviso?: Aviso
  simulado: boolean
  alertasActivas: number
  abrirMenu: () => void
  verAlertas?: () => void
}) {
  const ahora = useReloj()
  const zona = { timeZone: 'America/Santiago' } as const
  const dia = `${ahora.toLocaleDateString('es-CL', { ...zona, weekday: 'long' })} ${ahora.toLocaleDateString('es-CL', { ...zona, day: '2-digit' })}/${ahora.toLocaleDateString('es-CL', { ...zona, month: '2-digit' })}`
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-borde bg-fondo/95 px-4 py-3 backdrop-blur lg:px-8">
      <button onClick={abrirMenu} className="rounded-md border border-borde p-2 text-tinta-2 lg:hidden" aria-label="Abrir menú">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-2xl font-bold leading-tight">{titulo}</h1>
        <p className="text-sm text-tinta-2">
          {subtitulo} · {dia}
          {simulado && <span className="ml-2 rounded bg-borde px-1.5 py-0.5 text-[0.6875rem]">DATOS SIMULADOS</span>}
        </p>
      </div>
      <span className="hidden text-sm tabular-nums text-tinta-2 sm:inline">
        {ahora.toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour12: false })}
      </span>
      {aviso && (
        <span
          title={aviso.detalle}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${PILDORA[aviso.tono]}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${PUNTO_PILDORA[aviso.tono]} ${aviso.tono !== 'critico' ? 'latido' : ''}`} />
          {aviso.texto}
        </span>
      )}
      {verAlertas && (
        <button
          onClick={verAlertas}
          className="relative rounded-lg border border-borde p-2 text-tinta-2 hover:text-tinta"
          aria-label={`Alertas activas: ${alertasActivas}`}
          title={`Alertas activas: ${alertasActivas}`}
        >
          {ICONOS.alertas}
          {alertasActivas > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-critico" />}
        </button>
      )}
    </header>
  )
}
