// Pide datos cada cierto tiempo (contrato §2: polling cada 5 s).

import { useEffect, useState } from 'react'

const EVENTO_REFRESCAR = 'induplac:refrescar'

export function refrescarTodo() {
  window.dispatchEvent(new Event(EVENTO_REFRESCAR))
}

export function usePolling<T>(pedir: () => Promise<T>, cadaMs: number, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let activo = true
    const cargar = () =>
      pedir()
        .then((d) => {
          if (activo) {
            setDatos(d)
            setError(null)
          }
        })
        .catch((e: unknown) => activo && setError(e instanceof Error ? e.message : String(e)))

    cargar()
    const id = setInterval(cargar, cadaMs)
    // Permite pedir datos al instante (ej. tras una acción del panel de demo)
    window.addEventListener(EVENTO_REFRESCAR, cargar)
    return () => {
      activo = false
      clearInterval(id)
      window.removeEventListener(EVENTO_REFRESCAR, cargar)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadaMs, ...deps])

  return { datos, error }
}
