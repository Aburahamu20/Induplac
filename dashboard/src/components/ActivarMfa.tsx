// MFA opcional (operarios): botón en el encabezado para activar Microsoft
// Authenticator desde la sesión abierta. Jefes y admins no lo ven, porque a
// ellos el login ya les obliga a registrarlo.

import QRCode from 'qrcode'
import { useState, type FormEvent } from 'react'
import { authCognito } from '../auth'
import { guardarSesion, useSesion } from '../auth/sesion'

export function ActivarMfa() {
  const { sesion } = useSesion()
  const [abierto, setAbierto] = useState(false)
  const [listo, setListo] = useState(false)
  const [qr, setQr] = useState<string | null>(null)
  const [secreto, setSecreto] = useState<string | null>(null)
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  if (!authCognito || sesion.mfa !== false || listo) return null

  const abrir = async () => {
    setAbierto(true)
    setError(null)
    try {
      const { qr_uri } = await authCognito!.activarMfa(sesion.token)
      setSecreto(new URL(qr_uri).searchParams.get('secret'))
      setQr(await QRCode.toDataURL(qr_uri, { margin: 1, width: 200 }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setCargando(true)
    setError(null)
    try {
      await authCognito!.confirmarActivacionMfa(sesion.token, codigo)
      guardarSesion({ ...sesion, mfa: true })
      setListo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <button
        onClick={abrir}
        title="Opcional: protege tu cuenta con Microsoft Authenticator"
        className="rounded-md border border-borde px-2.5 py-1 text-xs text-tinta-2 hover:border-tinta-3 hover:text-tinta"
      >
        Activar MFA
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4" onClick={() => setAbierto(false)}>
          <div className="w-full max-w-sm rounded-xl border border-borde bg-panel p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Activa la verificación en dos pasos</h2>
            <p className="mt-1 text-sm text-tinta-2">Es opcional para tu cuenta. Escanea el código con Microsoft Authenticator y escribe el código de 6 dígitos.</p>
            <div className="my-4 grid justify-items-center gap-2">
              {qr ? <img src={qr} alt="Código QR para Microsoft Authenticator" className="rounded-md bg-white p-1" width={200} height={200} /> : <div className="h-[200px]" />}
              {secreto && <p className="font-mono text-xs text-tinta">{secreto.match(/.{1,4}/g)?.join(' ')}</p>}
            </div>
            <form onSubmit={enviar} className="grid gap-3">
              <input
                className="w-full rounded-md border border-borde bg-fondo px-3 py-2 text-center font-mono text-xl tracking-[0.4em] text-tinta outline-none focus:border-oficinas"
                placeholder="000000"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setAbierto(false)} className="flex-1 rounded-md border border-borde px-3 py-2 text-sm text-tinta-2 hover:text-tinta">
                  Ahora no
                </button>
                <button disabled={cargando || codigo.length !== 6} className="flex-1 rounded-md bg-oficinas px-3 py-2 font-bold text-white hover:brightness-110 disabled:opacity-50">
                  Activar
                </button>
              </div>
            </form>
            {error && <p className="mt-3 rounded-md border border-critico/40 bg-critico/10 px-3 py-2 text-sm text-critico">{error}</p>}
          </div>
        </div>
      )}
    </>
  )
}
