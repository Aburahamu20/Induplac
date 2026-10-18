// Pantalla de inicio de sesión con el ciclo de vida de la cuenta (contrato §6.1):
// usuario y clave -> cambio de clave temporal -> registro o código MFA -> dashboard.

import QRCode from 'qrcode'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { auth, authSimulada, NOMBRE_ROL, type Desafio, type RespuestaAuth, type Sesion } from '../auth'
import { restablecerUsuariosDemo, USUARIOS_DEMO } from '../auth/simulada'

const campo =
  'w-full rounded-md border border-borde bg-fondo px-3 py-2 text-tinta outline-none placeholder:text-tinta-3 focus:border-oficinas'
const botonPrincipal =
  'w-full rounded-md bg-oficinas px-3 py-2 font-bold text-white hover:brightness-110 disabled:opacity-50'

function Marco({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-oficinas font-bold text-white">IP</div>
          <div>
            <p className="font-bold leading-tight">Induplac — Panel IoT</p>
            <p className="text-xs text-tinta-2">Visibilidad operacional en tiempo real</p>
          </div>
        </div>
        <div className="rounded-xl border border-borde bg-panel p-6">
          <h1 className="text-lg font-bold">{titulo}</h1>
          {subtitulo && <p className="mt-1 text-sm text-tinta-2">{subtitulo}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  )
}

function Error({ texto }: { texto: string | null }) {
  if (!texto) return null
  return <p className="mt-3 rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">{texto}</p>
}

export function Login({ alEntrar }: { alEntrar: (s: Sesion) => void }) {
  const [paso, setPaso] = useState<{ desafio: Desafio; id: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const avanzar = async (accion: () => Promise<RespuestaAuth>) => {
    setError(null)
    setCargando(true)
    try {
      const r = await accion()
      if ('sesion' in r) alEntrar(r.sesion)
      else setPaso({ desafio: r.desafio, id: r.sesion_temporal })
    } catch (e) {
      setError(e instanceof globalThis.Error ? e.message : String(e))
      if (String(e).includes('expiró')) setPaso(null)
    } finally {
      setCargando(false)
    }
  }

  if (!paso) return <PasoClave avanzar={avanzar} error={error} cargando={cargando} />
  if (paso.desafio === 'cambiar_clave')
    return <PasoCambiar id={paso.id} avanzar={avanzar} error={error} cargando={cargando} />
  return (
    <PasoMfa id={paso.id} registrar={paso.desafio === 'registrar_mfa'} avanzar={avanzar} error={error} cargando={cargando} />
  )
}

interface PropsPaso {
  avanzar: (a: () => Promise<RespuestaAuth>) => void
  error: string | null
  cargando: boolean
}

function PasoClave({ avanzar, error, cargando }: PropsPaso) {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    avanzar(() => auth.login(usuario, clave))
  }
  return (
    <Marco titulo="Iniciar sesión" subtitulo="Ingresa con tu usuario de Induplac.">
      <form onSubmit={enviar} className="grid gap-3">
        <input className={campo} placeholder="Usuario" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
        <input className={campo} placeholder="Contraseña" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
        <button className={botonPrincipal} disabled={cargando}>
          {cargando ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
      <Error texto={error} />

      {authSimulada && (
        <div className="mt-6 border-t border-borde pt-4 text-xs text-tinta-2">
          <p className="mb-1 font-bold uppercase tracking-[0.12em]">Usuarios de demo</p>
          <p className="mb-2">Todos parten con clave temporal: en el primer ingreso se pide crear una personal.</p>
          <table className="w-full">
            <tbody>
              {USUARIOS_DEMO.map((u) => (
                <tr key={u.usuario}>
                  <td className="py-0.5 font-bold text-tinta">{u.usuario}</td>
                  <td className="py-0.5 font-mono">{u.claveInicial}</td>
                  <td className="py-0.5 text-right">{NOMBRE_ROL[u.rol].split(' ')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => {
              restablecerUsuariosDemo()
              location.reload()
            }}
            className="mt-3 underline hover:text-tinta"
          >
            Restablecer claves y MFA de demo
          </button>
        </div>
      )}
    </Marco>
  )
}

function PasoCambiar({ id, avanzar, error, cargando }: PropsPaso & { id: string }) {
  const [clave, setClave] = useState('')
  const [repetir, setRepetir] = useState('')
  const [local, setLocal] = useState<string | null>(null)
  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (clave !== repetir) return setLocal('Las contraseñas no coinciden.')
    setLocal(null)
    avanzar(() => auth.cambiarClave(id, clave))
  }
  return (
    <Marco titulo="Crea tu contraseña personal" subtitulo="Estás usando una clave temporal. Elige una nueva: nadie más podrá verla, ni el Administrador.">
      <form onSubmit={enviar} className="grid gap-3">
        <input className={campo} placeholder="Nueva contraseña (mín. 10 caracteres)" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} required />
        <input className={campo} placeholder="Repite la contraseña" type="password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required />
        <button className={botonPrincipal} disabled={cargando}>
          Guardar y continuar
        </button>
      </form>
      <Error texto={local ?? error} />
    </Marco>
  )
}

function PasoMfa({ id, registrar, avanzar, error, cargando }: PropsPaso & { id: string; registrar: boolean }) {
  const [codigo, setCodigo] = useState('')
  const [qr, setQr] = useState<string | null>(null)
  const [secreto, setSecreto] = useState<string | null>(null)

  useEffect(() => {
    if (!registrar) return
    auth.registrarMfa(id).then(async ({ qr_uri }) => {
      setSecreto(new URL(qr_uri).searchParams.get('secret'))
      setQr(await QRCode.toDataURL(qr_uri, { margin: 1, width: 200 }))
    })
  }, [id, registrar])

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    avanzar(() => auth.verificarMfa(id, codigo))
  }

  return (
    <Marco
      titulo={registrar ? 'Activa la verificación en dos pasos' : 'Verificación en dos pasos'}
      subtitulo={
        registrar
          ? 'Tu cuenta puede modificar datos, por eso el MFA es obligatorio. Escanea el código con Microsoft Authenticator.'
          : 'Ingresa el código de 6 dígitos de Microsoft Authenticator.'
      }
    >
      {registrar && (
        <div className="mb-4 grid justify-items-center gap-2">
          {qr ? <img src={qr} alt="Código QR para Microsoft Authenticator" className="rounded-md bg-white p-1" width={200} height={200} /> : <div className="h-[200px]" />}
          {secreto && (
            <p className="text-center text-xs text-tinta-2">
              ¿No puedes escanear? Clave manual:
              <br />
              <span className="font-mono text-tinta">{secreto.match(/.{1,4}/g)?.join(' ')}</span>
            </p>
          )}
        </div>
      )}
      <form onSubmit={enviar} className="grid gap-3">
        <input
          className={`${campo} text-center font-mono text-xl tracking-[0.4em]`}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          required
        />
        <button className={botonPrincipal} disabled={cargando || codigo.length !== 6}>
          Verificar
        </button>
      </form>
      <Error texto={error} />
    </Marco>
  )
}
