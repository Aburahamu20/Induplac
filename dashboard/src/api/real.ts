// Fuente real: llama a la API del Edge (planta) o de AWS (nube).
// Se activa con VITE_FUENTE=api. Mismo contrato que la simulada.

import type { ControlDemo, Fuente } from './fuente'
import type {
  ActualRespuesta,
  Alerta,
  ConsultaHistorico,
  EstadoRespuesta,
  HistoricoRespuesta,
  LocalId,
  LocalInfo,
} from './tipos'

export class FuenteApi implements Fuente {
  private base: string
  private token: () => string | null

  readonly demo?: ControlDemo

  constructor(base: string, token: () => string | null = () => null, conDemo = false) {
    this.base = base.replace(/\/$/, '')
    this.token = token
    if (conDemo) {
      this.demo = {
        enlace: (local, conectado) => this.post('/demo/enlace', { local_id: local, conectado }),
        inyectar: (local, variable, valor) => this.post('/demo/inyectar', { local_id: local, variable, valor }),
      }
    }
  }

  private async post(ruta: string, cuerpo: unknown): Promise<void> {
    const t = this.token()
    const res = await fetch(`${this.base}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: JSON.stringify(cuerpo),
    })
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
  }

  private async get<T>(ruta: string): Promise<T> {
    const t = this.token()
    const res = await fetch(`${this.base}${ruta}`, {
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    })
    if (!res.ok) {
      const cuerpo = await res.json().catch(() => null)
      throw new Error(cuerpo?.error?.mensaje ?? `Error HTTP ${res.status}`)
    }
    return res.json() as Promise<T>
  }

  estado() {
    return this.get<EstadoRespuesta>('/estado')
  }

  locales() {
    return this.get<LocalInfo[]>('/locales')
  }

  actual(local: LocalId) {
    return this.get<ActualRespuesta>(`/locales/${local}/actual`)
  }

  alertas(filtro?: { local_id?: LocalId; estado?: Alerta['estado'] }) {
    const q = new URLSearchParams()
    if (filtro?.local_id) q.set('local_id', filtro.local_id)
    if (filtro?.estado) q.set('estado', filtro.estado)
    const qs = q.toString()
    return this.get<Alerta[]>(`/alertas${qs ? `?${qs}` : ''}`)
  }

  async reconocerAlerta(id: string) {
    const t = this.token()
    const res = await fetch(`${this.base}/alertas/${encodeURIComponent(id)}/reconocer`, {
      method: 'POST',
      headers: t ? { Authorization: `Bearer ${t}` } : {},
    })
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`)
    return res.json() as Promise<Alerta>
  }

  historico(c: ConsultaHistorico) {
    const q = new URLSearchParams()
    for (const l of c.local_ids) q.append('local_id', l)
    q.set('variable', c.variable)
    q.set('desde', c.desde)
    q.set('hasta', c.hasta)
    q.set('agrupacion', c.agrupacion)
    return this.get<HistoricoRespuesta>(`/historico?${q}`)
  }
}
