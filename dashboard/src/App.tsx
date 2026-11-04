import { useEffect, useMemo, useState } from 'react'
import { conDemo, fuente, usaSimulacion, type LocalId } from './api'
import { auth, authSimulada, type Permiso, type Sesion } from './auth'
import { guardarSesion, sesionGuardada, SesionCtx, useSesion, type ContextoSesion } from './auth/sesion'
import { fijarToken } from './auth/token'
import { Cabecera, Menu, Proximamente } from './components/Menu'
import { ENTRADAS, nombreEntrada, type Pantalla } from './components/pantallas'
import { Login } from './components/Login'
import { PanelDemo } from './components/PanelDemo'
import { avisoEnlace } from './components/estadoEnlace'
import { usePolling } from './hooks/usePolling'
import { VistaHistorico } from './components/Historico'
import { VistaUmbrales } from './components/Umbrales'
import { VistaUsuarios } from './components/Usuarios'
import { VistaAuditoria } from './components/Auditoria'
import { VistaAlertas, VistaOficinas, VistaPlanta, VistaResumen } from './vistas'

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

// La pantalla actual va en la dirección (#planta, #alertas...) para que recargar no te saque de ahí
function leerHash(): Pantalla | null {
  const h = location.hash.replace('#', '')
  return ENTRADAS.some((e) => e.id === h) ? (h as Pantalla) : null
}

const SUBTITULO: Partial<Record<Pantalla, string>> = {
  resumen: 'Planta y Oficinas',
  planta: 'Panel principal',
  oficinas: 'Panel principal',
  historico: 'Compara períodos',
}

function Dashboard() {
  const ctx = useSesion()
  const visibles = ENTRADAS.filter((e) => e.visible(ctx))
  const [elegida, setElegida] = useState<Pantalla | null>(leerHash)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const pantalla = visibles.find((p) => p.id === elegida)?.id ?? visibles[0]?.id

  useEffect(() => {
    const alCambiar = () => setElegida(leerHash())
    window.addEventListener('hashchange', alCambiar)
    return () => window.removeEventListener('hashchange', alCambiar)
  }, [])
  const ir = (p: Pantalla) => {
    location.hash = p
    setElegida(p)
    window.scrollTo({ top: 0 })
  }

  // En simulación se consulta cada 1 s para que el showcase se vea fluido; contra la API, cada 5 s (contrato §2)
  const { datos: estado, error: errorEstado } = usePolling(() => fuente.estado(), usaSimulacion ? 1_000 : 5_000)
  const { datos: alertas } = usePolling(() => fuente.alertas({ estado: 'activa' }), 5_000)
  const misAlertas = alertas?.filter((a) => ctx.ve(a.local_id)) ?? []
  const misLocales = (estado?.locales.filter((l) => ctx.ve(l.local_id)) ?? []).sort((a, b) => a.local_id.localeCompare(b.local_id))

  // En la pantalla de una sede, el aviso es de esa sede; en las demás, de todas las que ve el usuario
  const localesAviso =
    pantalla === 'oficinas'
      ? misLocales.filter((l) => l.local_id === 'local2')
      : pantalla === 'planta'
        ? misLocales.filter((l) => l.local_id === 'local1')
        : misLocales
  const aviso = avisoEnlace(localesAviso, estado?.origen, !!errorEstado)
  const sedes = ctx.sesion.locales.length === 1 ? (ctx.ve('local1') ? 'Planta' : 'Oficinas') : 'Planta y Oficinas'

  return (
    <div className="lg:flex">
      <Menu
        actual={pantalla}
        ir={ir}
        alertasActivas={misAlertas.length}
        locales={misLocales}
        abierto={menuAbierto}
        cerrar={() => setMenuAbierto(false)}
      />
      <div className="min-w-0 flex-1">
        <Cabecera
          titulo={pantalla ? nombreEntrada(pantalla, ctx) : 'Induplac'}
          subtitulo={(pantalla && SUBTITULO[pantalla]) ?? sedes}
          aviso={aviso}
          simulado={usaSimulacion}
          alertasActivas={misAlertas.length}
          abrirMenu={() => setMenuAbierto(true)}
          verAlertas={ctx.puede('ver_alertas') ? () => ir('alertas') : undefined}
        />
        <main className="px-4 py-5 lg:px-8">
          {!pantalla && <p className="py-10 text-center text-tinta-2">Tu usuario no tiene permisos para ver datos. Contacta al Administrador.</p>}
          {pantalla === 'resumen' && <VistaResumen />}
          {pantalla === 'oficinas' && <VistaOficinas />}
          {pantalla === 'planta' && <VistaPlanta />}
          {pantalla === 'alertas' && <VistaAlertas />}
          {pantalla === 'historico' && <VistaHistorico />}
          {pantalla === 'umbrales' && <VistaUmbrales />}
          {pantalla === 'usuarios' && <VistaUsuarios />}
          {pantalla === 'auditoria' && <VistaAuditoria />}
          {pantalla && ['estado'].includes(pantalla) && (
            <Proximamente nombre={nombreEntrada(pantalla, ctx)} />
          )}
        </main>
      </div>

      {conDemo && <PanelDemo />}
    </div>
  )
}
