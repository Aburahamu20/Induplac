// Funciones de GESTIÓN (solo admins): umbrales, auditoría y usuarios.
// Van aparte de la "fuente" de datos de monitoreo porque solo existen en la nube
// (docs/api-dashboard.md §3.7, §3.8 y §6.4). En modo simulado se guardan en memoria.

import { sesionGuardada } from '../auth/sesion'
import { obtenerToken } from '../auth/token'
import type { LocalId } from './tipos'

export type VariableUmbral = 'energia_pct' | 'energia_kw' | 'agua_m3_dia' | 'agua_m3h' | 'uv'

export interface UmbralVigente {
  local_id: LocalId
  variable: VariableUmbral
  nombre: string
  unidad: string
  con_advertencia: boolean
  advertencia: number | null
  alerta: number
  origen: 'copia' | 'defecto'
  actualizado: string | null
  actualizado_por: string | null
}

export interface ResultadoSimulacion {
  dias: number
  unidad_evento: string
  actual: { advertencia: number | null; alerta: number; alertas: number; advertencias: number; evaluados: number }
  propuesto: { advertencia: number | null; alerta: number; alertas: number; advertencias: number; evaluados: number }
}

export interface RegistroAuditoria {
  sede: 'local1' | 'local2' | 'general'
  id: string
  ts: string
  usuario: string
  rol: string
  accion: string
  objeto: string
  detalle: Record<string, unknown>
  origen: 'nube' | 'edge'
  hash: string
  hash_anterior: string
}

export interface RespuestaAuditoria {
  registros: RegistroAuditoria[]
  integridad: Record<string, { estado: 'ok' | 'alterada'; problemas: { id: string; tipo: string; mensaje: string }[] }>
  truncado: boolean
}

export type Grupo = 'admin-general' | 'admin-sede' | 'jefe' | 'operario' | 'administrador'
export type SedeCognito = 'planta' | 'oficinas' | 'todas'

export interface Usuario {
  usuario: string
  grupo: Grupo | null
  sede: SedeCognito | null
  habilitado: boolean
  estado: string // FORCE_CHANGE_PASSWORD = todavía no entra por primera vez
  creado: string | null
}

export type AccionUsuario = 'desactivar' | 'activar' | 'resetear-clave' | 'resetear-mfa'

export interface Admin {
  usuarios(): Promise<Usuario[]>
  crearUsuario(d: { usuario: string; email: string; grupo: Grupo; sede: SedeCognito }): Promise<Usuario>
  modificarUsuario(usuario: string, d: { grupo?: Grupo; sede?: SedeCognito }): Promise<Usuario>
  // resetear-clave devuelve la clave temporal UNA vez, para que el admin se la entregue
  accionUsuario(usuario: string, accion: AccionUsuario): Promise<Usuario & { clave_temporal?: string }>
  umbrales(): Promise<UmbralVigente[]>
  // ¿Se puede editar? (la configuración vive en RDS, que a veces está apagado)
  configDisponible(): Promise<boolean>
  simular(local: LocalId, variable: VariableUmbral, advertencia: number | null, alerta: number, dias?: number): Promise<ResultadoSimulacion>
  guardarUmbral(local: LocalId, variable: VariableUmbral, advertencia: number | null, alerta: number): Promise<{ copiado: boolean; aviso?: string | null }>
  auditoria(q: { desde?: string; hasta?: string; sede?: string; accion?: string; usuario?: string }): Promise<RespuestaAuditoria>
}

// ---------------- API real ----------------

class AdminApi implements Admin {
  private api: string
  private config: string

  constructor(base: string) {
    this.api = base.replace(/\/$/, '')
    this.config = `${this.api.replace(/\/api$/, '')}/config`
  }

  private async pedir<T>(url: string, metodo = 'GET', cuerpo?: unknown): Promise<T> {
    const t = obtenerToken()
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    const datos = await res.json().catch(() => null)
    if (!res.ok && res.status !== 502) throw new Error(datos?.error?.mensaje ?? `Error HTTP ${res.status}`)
    return datos as T
  }

  umbrales() {
    return this.pedir<UmbralVigente[]>(`${this.api}/umbrales`)
  }

  usuarios() {
    return this.pedir<Usuario[]>(`${this.api}/usuarios`)
  }

  crearUsuario(d: { usuario: string; email: string; grupo: Grupo; sede: SedeCognito }) {
    return this.pedir<Usuario>(`${this.api}/usuarios`, 'POST', d)
  }

  modificarUsuario(usuario: string, d: { grupo?: Grupo; sede?: SedeCognito }) {
    return this.pedir<Usuario>(`${this.api}/usuarios/${encodeURIComponent(usuario)}`, 'PATCH', d)
  }

  accionUsuario(usuario: string, accion: AccionUsuario) {
    return this.pedir<Usuario & { clave_temporal?: string }>(`${this.api}/usuarios/${encodeURIComponent(usuario)}/${accion}`, 'POST', {})
  }

  async configDisponible() {
    try {
      await this.pedir(`${this.config}/umbrales`)
      return true
    } catch {
      return false
    }
  }

  simular(local: LocalId, variable: VariableUmbral, advertencia: number | null, alerta: number, dias = 30) {
    return this.pedir<ResultadoSimulacion>(`${this.api}/umbrales/simulacion`, 'POST', { local_id: local, variable, advertencia, alerta, dias })
  }

  guardarUmbral(local: LocalId, variable: VariableUmbral, advertencia: number | null, alerta: number) {
    return this.pedir<{ copiado: boolean; aviso?: string | null }>(`${this.config}/umbrales/${local}/${variable}`, 'PUT', { advertencia, alerta })
  }

  auditoria(q: Record<string, string | undefined>) {
    const p = new URLSearchParams(Object.entries(q).filter((x): x is [string, string] => !!x[1]))
    return this.pedir<RespuestaAuditoria>(`${this.api}/auditoria?${p}`)
  }
}

// ---------------- Simulado (sin AWS) ----------------

const CATALOGO: { variable: VariableUmbral; nombre: string; unidad: string; con_advertencia: boolean; locales: LocalId[]; defecto: Record<string, [number | null, number]> }[] = [
  { variable: 'energia_pct', nombre: 'Energía sobre el promedio de 4 semanas', unidad: '%', con_advertencia: true, locales: ['local1', 'local2'], defecto: { local1: [10, 20], local2: [10, 20] } },
  { variable: 'energia_kw', nombre: 'Energía (respaldo sin 4 semanas de historia)', unidad: 'kW', con_advertencia: true, locales: ['local1', 'local2'], defecto: { local1: [45, 55], local2: [45, 55] } },
  { variable: 'agua_m3_dia', nombre: 'Agua consumida en el día', unidad: 'm³/día', con_advertencia: true, locales: ['local1', 'local2'], defecto: { local1: [12, 14], local2: [2, 2.5] } },
  { variable: 'agua_m3h', nombre: 'Posible fuga: caudal fuera de horario', unidad: 'm³/h', con_advertencia: false, locales: ['local1', 'local2'], defecto: { local1: [null, 0.3], local2: [null, 0.05] } },
  { variable: 'uv', nombre: 'Índice UV en el patio de carga', unidad: 'UVI', con_advertencia: true, locales: ['local1'], defecto: { local1: [6, 8] } },
]

// Registros de ejemplo para el modo simulado (la nube guarda los reales en induplac-auditoria)
const EJEMPLOS_AUDITORIA: RegistroAuditoria[] = (() => {
  const hex = (n: number) => Array.from({ length: n }, (_, i) => ((n * 7 + i * 13) % 16).toString(16)).join('')
  const filas: [number, RegistroAuditoria['sede'], string, string, string, string, Record<string, unknown>, ('nube' | 'edge')?][] = [
    [0.1, 'local1', 'jefe.planta', 'jefe', 'alerta.reconocida', 'local1:energia_kw:demo-1', { variable: 'energia_kw', nivel: 'critico', valor: '58.4', comentario: 'Arranque de la prensa 2, revisado con mantención.' }],
    [0.4, 'local1', 'admin.planta', 'admin-sede', 'umbral.modificado', 'local1:uv', { antes: { advertencia: 6, alerta: 8 }, despues: { advertencia: 6, alerta: 7 }, unidad: 'UVI', copiado: true }],
    [0.9, 'local1', 'operario.planta', 'operario', 'alerta.reconocida', 'local1:agua_m3h:demo-2', { variable: 'agua_m3h', valor: '0.42', comentario: 'Llave del baño de bodega abierta, cerrada.', sin_internet: true, _edge: { edge_id: 'rpi-planta', hash_ok: true, cadena_ok: true } }, 'edge'],
    [1.2, 'general', 'abraham.castro', 'admin-general', 'usuario.creado', 'nuevo.operario', { grupo: 'operario', sede: 'planta' }],
    [1.6, 'local2', 'admin.oficinas', 'admin-sede', 'alerta.reconocida', 'local2:agua_m3_dia:demo-3', { variable: 'agua_m3_dia', nivel: 'advertencia', valor: '2.1', comentario: null }],
    [2.3, 'local1', 'abraham.castro', 'admin-general', 'usuario.modificado', 'jefe.planta', { antes: { grupo: 'jefe', sede: 'todas' }, despues: { grupo: 'jefe', sede: 'planta' } }],
    [2.8, 'general', 'operario.planta', 'operario', 'sesion.bloqueada', 'operario.planta', { intentos: 5, minutos: 15, _edge: { edge_id: 'rpi-planta', hash_ok: true, cadena_ok: true } }, 'edge'],
    [3.5, 'local1', 'admin.planta', 'admin-sede', 'usuario.clave_reseteada', 'operario.planta', {}],
    [4.1, 'general', 'felipe.murua', 'admin-general', 'umbral.sincronizado', 'umbrales', { copiados: ['local1:energia_pct', 'local1:energia_kw', 'local1:agua_m3_dia', 'local1:agua_m3h', 'local1:uv', 'local2:energia_pct', 'local2:energia_kw', 'local2:agua_m3_dia', 'local2:agua_m3h'] }],
    [5.0, 'local2', 'felipe.murua', 'admin-general', 'umbral.modificado', 'local2:agua_m3_dia', { antes: { advertencia: 2, alerta: 2.5 }, despues: { advertencia: 1.8, alerta: 2.5 }, unidad: 'm³/día', copiado: true }],
    [6.2, 'local2', 'admin.oficinas', 'admin-sede', 'usuario.mfa_reseteado', 'admin.oficinas.2', {}],
    [8.5, 'local1', 'abraham.castro', 'admin-general', 'usuario.desactivado', 'practicante.planta', { grupo: 'operario' }],
  ]
  return filas.map(([dias, sede, usuario, rol, accion, objeto, detalle, origen], i) => {
    const ts = new Date(Date.now() - dias * 86_400_000).toISOString()
    return { sede, id: `${ts}#${hex(8)}${i}`, ts, usuario, rol, accion, objeto, detalle, origen: origen ?? 'nube', hash: hex(64 - i), hash_anterior: hex(63 - i) }
  })
})()

class AdminSimulado implements Admin {
  private cuentas: Usuario[] = [
    ['abraham.castro', 'admin-general', 'todas', 'CONFIRMED'],
    ['felipe.murua', 'admin-general', 'todas', 'CONFIRMED'],
    ['admin.planta', 'admin-sede', 'planta', 'CONFIRMED'],
    ['admin.oficinas', 'admin-sede', 'oficinas', 'CONFIRMED'],
    ['jefe.planta', 'jefe', 'planta', 'CONFIRMED'],
    ['operario.planta', 'operario', 'planta', 'CONFIRMED'],
    ['nuevo.operario', 'operario', 'planta', 'FORCE_CHANGE_PASSWORD'],
  ].map(([usuario, grupo, sede, estado], i) => ({
    usuario, grupo: grupo as Grupo, sede: sede as SedeCognito, estado, habilitado: true,
    creado: new Date(Date.now() - (20 - i) * 86_400_000).toISOString(),
  }))

  private auditar(accion: string, objeto: string, detalle: Record<string, unknown>) {
    const ahora = new Date().toISOString()
    this.registros.unshift({ sede: 'general', id: `${ahora}#demo`, ts: ahora, usuario: 'demo', rol: 'admin-general', accion, objeto, detalle, origen: 'nube', hash: '', hash_anterior: '' })
  }

  private buscar(usuario: string) {
    const u = this.cuentas.find((c) => c.usuario === usuario)
    if (!u) throw new Error('Usuario inexistente.')
    return u
  }

  async usuarios() {
    // Igual que la API: un admin de sede ve solo jefes, operarios y admins de SU sede
    const s = sesionGuardada()
    const general = !s || s.rol === 'admin_general' || s.rol === 'administrador' || s.locales.length > 1
    const miSede = s?.locales[0] === 'local1' ? 'planta' : 'oficinas'
    return this.cuentas
      .filter((c) => general || (c.grupo !== 'admin-general' && c.grupo !== 'administrador' && c.sede === miSede))
      .map((c) => ({ ...c }))
  }

  async crearUsuario(d: { usuario: string; email: string; grupo: Grupo; sede: SedeCognito }) {
    if (this.cuentas.some((c) => c.usuario === d.usuario)) throw new Error('Ese usuario ya existe.')
    const u: Usuario = { usuario: d.usuario, grupo: d.grupo, sede: d.sede, habilitado: true, estado: 'FORCE_CHANGE_PASSWORD', creado: new Date().toISOString() }
    this.cuentas.push(u)
    this.auditar('usuario.creado', d.usuario, { grupo: d.grupo, sede: d.sede })
    return { ...u }
  }

  async modificarUsuario(usuario: string, d: { grupo?: Grupo; sede?: SedeCognito }) {
    const u = this.buscar(usuario)
    this.auditar('usuario.modificado', usuario, { antes: { grupo: u.grupo, sede: u.sede }, despues: { grupo: d.grupo ?? u.grupo, sede: d.sede ?? u.sede } })
    Object.assign(u, d)
    return { ...u }
  }

  async accionUsuario(usuario: string, accion: AccionUsuario) {
    const u = this.buscar(usuario)
    if (accion === 'desactivar') u.habilitado = false
    if (accion === 'activar') u.habilitado = true
    this.auditar(`usuario.${{ desactivar: 'desactivado', activar: 'activado', 'resetear-clave': 'clave_reseteada', 'resetear-mfa': 'mfa_reseteado' }[accion]}`, usuario, {})
    if (accion === 'resetear-clave') {
      u.estado = 'FORCE_CHANGE_PASSWORD'
      return { ...u, clave_temporal: 'Demo-Temporal-1!' }
    }
    return { ...u }
  }

  private valores = new Map<string, { advertencia: number | null; alerta: number; actualizado: string | null; por: string | null }>()
  private registros: RegistroAuditoria[] = []

  async umbrales(): Promise<UmbralVigente[]> {
    return CATALOGO.flatMap((c) =>
      c.locales.map((l) => {
        const v = this.valores.get(`${l}:${c.variable}`)
        const [adv, ale] = c.defecto[l]
        return {
          local_id: l, variable: c.variable, nombre: c.nombre, unidad: c.unidad, con_advertencia: c.con_advertencia,
          advertencia: v ? v.advertencia : adv, alerta: v ? v.alerta : ale,
          origen: v ? ('copia' as const) : ('defecto' as const), actualizado: v?.actualizado ?? null, actualizado_por: v?.por ?? null,
        }
      }),
    )
  }

  async configDisponible() {
    return true
  }

  // Cuenta ficticia pero coherente: bajar el umbral da más alertas y subirlo, menos
  async simular(local: LocalId, variable: VariableUmbral, advertencia: number | null, alerta: number, dias = 30): Promise<ResultadoSimulacion> {
    const c = CATALOGO.find((x) => x.variable === variable)!
    const [advD, aleD] = c.defecto[local]
    const actual = (await this.umbrales()).find((u) => u.local_id === local && u.variable === variable)!
    const base = { energia_pct: 4, energia_kw: 1, agua_m3_dia: 1, agua_m3h: 0, uv: 5 }[variable]
    const contar = (u: number | null, d: number | null) => (u == null || d == null ? 0 : Math.max(0, Math.round(((base + 0.6) * Math.pow(d / u, 4) - 0.6) * (dias / 30))))
    const unidad = variable === 'agua_m3_dia' ? 'días' : 'intervalos de 15 min'
    const evaluados = variable === 'agua_m3_dia' ? dias : dias * 96
    return {
      dias,
      unidad_evento: unidad,
      actual: { advertencia: actual.advertencia, alerta: actual.alerta, alertas: contar(actual.alerta, aleD), advertencias: contar(actual.advertencia, advD) * 3, evaluados },
      propuesto: { advertencia, alerta, alertas: contar(alerta, aleD), advertencias: contar(advertencia, advD) * 3, evaluados },
    }
  }

  async guardarUmbral(local: LocalId, variable: VariableUmbral, advertencia: number | null, alerta: number) {
    const antes = (await this.umbrales()).find((u) => u.local_id === local && u.variable === variable)!
    const ahora = new Date().toISOString()
    this.valores.set(`${local}:${variable}`, { advertencia, alerta, actualizado: ahora, por: 'demo' })
    this.registros.unshift({
      sede: local, id: `${ahora}#demo`, ts: ahora, usuario: 'demo', rol: 'admin-general', accion: 'umbral.modificado',
      objeto: `${local}:${variable}`,
      detalle: { antes: { advertencia: antes.advertencia, alerta: antes.alerta }, despues: { advertencia, alerta }, unidad: antes.unidad },
      origen: 'nube', hash: '', hash_anterior: '',
    })
    return { copiado: true }
  }

  async auditoria(q: { desde?: string; hasta?: string; sede?: string; accion?: string; usuario?: string }): Promise<RespuestaAuditoria> {
    // Igual que la API: admin general ve local1, local2 y general; admin de sede solo la suya
    const s = sesionGuardada()
    const general = !s || s.rol === 'admin_general' || s.rol === 'administrador' || s.locales.length > 1
    const visibles = general ? ['local1', 'local2', 'general'] : [s.locales[0]]
    const desde = q.desde ? new Date(q.desde).getTime() : Date.now() - 7 * 86_400_000
    const hasta = q.hasta ? new Date(q.hasta).getTime() : Date.now() + 60_000
    const registros = [...this.registros, ...EJEMPLOS_AUDITORIA]
      .filter((r) => visibles.includes(r.sede) && (!q.sede || r.sede === q.sede))
      .filter((r) => (!q.accion || r.accion === q.accion) && (!q.usuario || r.usuario === q.usuario))
      .filter((r) => +new Date(r.ts) >= desde && +new Date(r.ts) <= hasta)
      .sort((a, b) => b.ts.localeCompare(a.ts))
    // Solo para ensayar la demo: localStorage 'induplac-demo-auditoria-alterada' = 'local1' muestra esa sede alterada
    let alterada: string | null = null
    try {
      alterada = localStorage.getItem('induplac-demo-auditoria-alterada')
    } catch {
      alterada = null
    }
    const integridad: RespuestaAuditoria['integridad'] = {}
    for (const sede of q.sede ? [q.sede] : visibles) {
      const victima = sede === alterada ? registros.find((r) => r.sede === sede) : undefined
      integridad[sede] = victima
        ? { estado: 'alterada', problemas: [{ id: victima.id, tipo: 'modificado', mensaje: 'El registro fue cambiado después de guardarse.' }] }
        : { estado: 'ok', problemas: [] }
    }
    return { registros, integridad, truncado: false }
  }
}

export const admin: Admin =
  import.meta.env.VITE_FUENTE !== 'api' ? new AdminSimulado() : new AdminApi(import.meta.env.VITE_API_URL ?? '/api')
