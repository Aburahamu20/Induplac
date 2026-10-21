import { useMemo, useState } from 'react'
import { conDemo, fuente, usaSimulacion, type LocalId } from './api'
import { auth, authSimulada, type Permiso, type Sesion } from './auth'
import { guardarSesion, sesionGuardada, SesionCtx, useSesion, type ContextoSesion } from './auth/sesion'
import { fijarToken } from './auth/token'
import { Encabezado } from './components/Encabezado'
import { Login } from './components/Login'
import { PanelDemo } from './components/PanelDemo'
import { peorEstado } from './components/estadoEnlace'
import { usePolling } from './hooks/usePolling'
import { VistaAlertas, VistaOficinas, VistaPlanta, VistaResumen } from './vistas'

type Pestana = 'resumen' | 'oficinas' | 'planta' | 'alertas'

// Qué necesita cada pestaña para mostrarse (contrato §6.4)
const PESTANAS: { id: Pestana; nombre: string; visible: (c: ContextoSesion) => boolean }[] = [
  { id: 'resumen', nombre: 'Resumen general', visible: (c) => c.puede('ver_general') && c.ve('local1') && c.ve('local2') },
  { id: 'oficinas', nombre: 'Oficinas administrativas', visible: (c) => c.puede('ver_actual') && c.ve('local2') },
  { id: 'planta', nombre: 'Planta de fabricación', visible: (c) => c.puede('ver_actual') && c.ve('local1') },
  { id: 'alertas', nombre: 'Alertas', visible: (c) => c.puede('ver_alertas') },
]

// Sesión guardada al recargar la página (si no expiró)
function sesionInicial(): Sesion | null {
  const s = sesionGuardada()
  if (s) {
    authSimulada?.restaurar(s)
    fijarToken(s.token)
  }
  return s
}

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(sesionInicial)

  const contexto = useMemo<ContextoSesion | null>(() => {
    if (!sesion) return null
    return {
      sesion,
      puede: (p: Permiso) => sesion.permisos.includes(p),
      ve: (l: LocalId) => sesion.locales.includes(l),
      cerrar: () => {
        auth.logout(sesion.token).catch(() => {})
        fijarToken(null)
        guardarSesion(null)
        setSesion(null)
      },
    }
  }, [sesion])

  if (!contexto) {
    return (
      <Login
        alEntrar={(s) => {
          fijarToken(s.token)
          guardarSesion(s)
          setSesion(s)
        }}
      />
    )
  }

  return (
    <SesionCtx.Provider value={contexto}>
      <Dashboard />
    </SesionCtx.Provider>
  )
}

function Dashboard() {
  const ctx = useSesion()
  const visibles = PESTANAS.filter((p) => p.visible(ctx))
  const [elegida, setPestana] = useState<Pestana | null>(null)
  const pestana = visibles.find((p) => p.id === elegida)?.id ?? visibles[0]?.id

  // En simulación se consulta cada 1 s para que el showcase se vea fluido; contra la API, cada 5 s (contrato §2)
  const { datos: estado } = usePolling(() => fuente.estado(), usaSimulacion ? 1_000 : 5_000)
  const { datos: alertas } = usePolling(() => fuente.alertas({ estado: 'activa' }), 5_000)
  const misAlertas = alertas?.filter((a) => ctx.ve(a.local_id)) ?? []
  const misLocales = estado?.locales.filter((l) => ctx.ve(l.local_id)) ?? []

  const enlace =
    pestana === 'oficinas'
      ? misLocales.find((l) => l.local_id === 'local2')
      : pestana === 'planta'
        ? misLocales.find((l) => l.local_id === 'local1')
        : misLocales.length
          ? peorEstado(misLocales)
          : undefined

  return (
    <div className="min-h-screen">
      <header className="border-b border-borde">
        <Encabezado enlace={enlace} simulado={usaSimulacion} />
        <nav className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto overflow-y-hidden px-4 pt-1 [scrollbar-width:none]">
          {visibles.map((p) => (
            <button
              key={p.id}
              onClick={() => setPestana(p.id)}
              className={`-mb-px flex items-center gap-2 whitespace-nowrap rounded-t-md border px-4 py-2 text-sm ${
                pestana === p.id
                  ? 'border-borde border-b-fondo bg-fondo font-bold text-tinta'
                  : 'border-transparent text-tinta-2 hover:text-tinta'
              }`}
            >
              {p.nombre}
              {p.id === 'alertas' && misAlertas.length > 0 && (
                <span className="rounded-full bg-critico px-1.5 text-xs font-bold text-white">{misAlertas.length}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-5">
        {!pestana && <p className="py-10 text-center text-tinta-2">Tu usuario no tiene permisos para ver datos. Contacta al Administrador.</p>}
        {pestana === 'resumen' && <VistaResumen />}
        {pestana === 'oficinas' && <VistaOficinas />}
        {pestana === 'planta' && <VistaPlanta />}
        {pestana === 'alertas' && <VistaAlertas />}
      </main>

      {conDemo && <PanelDemo />}
    </div>
  )
}
