// Fuente simulada: genera datos ficticios en el navegador, respetando el
// formato del contrato (docs/api-dashboard.md). Cada 5 s "llega" una lectura
// nueva por local, como si la mandara el ESP32.
//
// Los valores siguen un perfil por hora del día (America/Santiago):
// turno diurno con más consumo, noches casi en cero, UV según el sol.
// Las reglas de nivel imitan las de CONTEXTO.md §8.2.

import type { ControlDemo, Fuente } from './fuente'
import type {
  ActualRespuesta,
  Alerta,
  ConsultaHistorico,
  EstadoLocal,
  EstadoRespuesta,
  HistoricoRespuesta,
  LocalId,
  LocalInfo,
  Nivel,
  ValorVariable,
  VariableId,
} from './tipos'

const TICK_MS = 5_000
const DURACION_INYECCION_MS = 90_000 // lo que dura un valor inyectado en la demo
const LOTE_SYNC = 2 // pendientes que "suben" por segundo al reconectar (demo)

const LOCALES: LocalInfo[] = [
  {
    local_id: 'local1',
    nombre: 'Local 1 · Planta',
    variables: ['energia_kw', 'agua_m3h', 'agua_m3_dia', 'uv_index', 'produccion_mes', 'produccion_anual', 'hh_sin_incidentes', 'dias_sin_incidentes'],
  },
  {
    local_id: 'local2',
    nombre: 'Local 2 · Oficinas',
    variables: ['energia_kw', 'energia_climatizacion_kw', 'energia_iluminacion_kw', 'agua_m3h', 'agua_m3_dia', 'hh_sin_incidentes', 'dias_sin_incidentes'],
  },
]

// Metas de producción (ficticias). Van en "referencia" de la variable.
const META_MES = 400
const META_ANIO = 5000

// Umbrales de agua diaria (CONTEXTO §8.2)
const AGUA = {
  local1: { normal: 10, advertencia: 12, critico: 14, fuga: 0.3 },
  local2: { normal: 1.5, advertencia: 2, critico: 2.5, fuga: 0.05 },
}

// ---------- Utilidades de tiempo (hora de Santiago) ----------

const fmtHora = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Santiago',
  hour: 'numeric',
  minute: 'numeric',
  weekday: 'short',
  hour12: false,
})

function horaSantiago(fecha: Date): { hora: number; habil: boolean } {
  const partes = fmtHora.formatToParts(fecha)
  const h = Number(partes.find((p) => p.type === 'hour')?.value ?? 0) % 24
  const m = Number(partes.find((p) => p.type === 'minute')?.value ?? 0)
  const dia = partes.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  return { hora: h + m / 60, habil: dia !== 'Sat' && dia !== 'Sun' }
}

function ruido(base: number, pct = 0.08): number {
  return base * (1 + (Math.random() * 2 - 1) * pct)
}

function inicioIntervalo(fecha: Date): string {
  const d = new Date(fecha)
  d.setUTCSeconds(0, 0)
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15)
  return d.toISOString().replace('.000', '')
}

const iso = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z')

// ---------- Perfiles por hora ----------

function turno(hora: number, habil: boolean): 'dia' | 'transicion' | 'noche' {
  if (!habil) return 'noche'
  if (hora >= 8 && hora < 18) return 'dia'
  if ((hora >= 6 && hora < 8) || (hora >= 18 && hora < 20)) return 'transicion'
  return 'noche'
}

function perfilPlanta(fecha: Date) {
  const { hora, habil } = horaSantiago(fecha)
  const t = turno(hora, habil)
  {
    return {
      energia: { dia: 38, transicion: 20, noche: 6 }[t],
      agua_m3h: { dia: 1.0, transicion: 0.3, noche: 0.02 }[t],
      // Sol de primavera en Santiago: de 7 a 19 h, peak cerca de 9 UVI
      uv: hora > 7 && hora < 19 ? 9 * Math.sin((Math.PI * (hora - 7)) / 12) : 0,
      personas: { dia: 40, transicion: 10, noche: 0 }[t],
      noche: t === 'noche',
    }
  }
}

function perfilOficina(fecha: Date) {
  const { hora, habil } = horaSantiago(fecha)
  const t = turno(hora, habil)
  return {
    clima: { dia: 9, transicion: 5, noche: 1.5 }[t],
    ilum: { dia: 3.5, transicion: 2, noche: 0.4 }[t],
    agua_m3h: { dia: 0.13, transicion: 0.05, noche: 0.005 }[t],
    personas: { dia: 20, transicion: 5, noche: 0 }[t],
    noche: t === 'noche',
  }
}

function perfilBase(local: LocalId, fecha: Date) {
  return local === 'local1' ? perfilPlanta(fecha) : perfilOficina(fecha)
}

// Agua ya consumida desde las 00:00 hasta ahora (para partir con un valor creíble)
function aguaInicial(local: LocalId, ahora: Date): number {
  const { hora } = horaSantiago(ahora)
  let total = 0
  for (let h = 0; h < hora; h += 0.25) {
    const f = new Date(ahora.getTime() - (hora - h) * 3_600_000)
    total += perfilBase(local, f).agua_m3h * 0.25
  }
  return total
}

// ---------- Reglas de nivel (imitan CONTEXTO §8.2) ----------

function nivelRelativo(valor: number, ref: number): Nivel {
  if (valor > ref * 1.2) return 'critico'
  if (valor > ref * 1.1) return 'advertencia'
  return 'normal'
}

function nivelUv(uv: number): Nivel {
  if (uv >= 8) return 'critico'
  if (uv >= 6) return 'advertencia'
  return 'normal'
}

// ---------- Histórico simulado (determinístico: el mismo instante da el mismo valor) ----------

function azar(t: number, semilla: number): number {
  const x = Math.sin(t / 900_000 * 12.9898 + semilla * 78.233) * 43758.5453
  return x - Math.floor(x)
}

function energiaEn(local: LocalId, t: number): number {
  const f = new Date(t)
  const base = local === 'local1' ? perfilPlanta(f).energia : perfilOficina(f).clima + perfilOficina(f).ilum
  return base * (1 + (azar(t, local === 'local1' ? 1 : 2) - 0.5) * 0.16)
}

function aguaDelDia(local: LocalId, inicioDia: number): number {
  let total = 0
  for (let t = inicioDia; t < inicioDia + 86_400_000; t += 900_000) {
    total += perfilBase(local, new Date(t)).agua_m3h * 0.25
  }
  return total * (0.9 + azar(inicioDia, local === 'local1' ? 3 : 4) * 0.2)
}

// Medianoche de Santiago del día de "fecha" (en ms UTC)
function medianocheSantiago(fecha: Date): number {
  const { hora } = horaSantiago(fecha)
  const t = fecha.getTime() - hora * 3_600_000
  return Math.round(t / 60_000) * 60_000
}

// ---------- Estado interno de cada local ----------

interface EstadoSim {
  enlace: EstadoLocal
  ts: Date
  valores: Partial<Record<VariableId, ValorVariable>>
  aguaDia: number
  diaAgua: string
  produccionMes: number
  produccionAnual: number
  hh: number
  dias: number
}

export class FuenteSimulada implements Fuente {
  readonly demo: ControlDemo
  private sim: Record<LocalId, EstadoSim>
  private listaAlertas: Alerta[] = []
  // Valores inyectados desde el panel de demo: local -> variable -> { valor, hasta }
  private inyectados: Partial<Record<LocalId, Partial<Record<VariableId, { valor: number; hasta: number }>>>> = {}
  private sincronizador: ReturnType<typeof setInterval> | null = null

  constructor() {
    const ahora = new Date()
    const base = (local: LocalId): EstadoSim => ({
      enlace: {
        local_id: local,
        enlace: 'online',
        pendientes: 0,
        ultima_sincronizacion: iso(ahora),
        ultimo_dato: iso(ahora),
      },
      ts: ahora,
      valores: {},
      aguaDia: aguaInicial(local, ahora),
      diaAgua: ahora.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }),
      produccionMes: local === 'local1' ? 312 : 0,
      produccionAnual: local === 'local1' ? 3480 : 0,
      hh: local === 'local1' ? 1840 : 960,
      dias: local === 'local1' ? 53 : 120,
    })
    this.sim = { local1: base('local1'), local2: base('local2') }
    this.demo = {
      enlace: async (local, conectado) => this.cambiarEnlace(local, conectado),
      inyectar: async (local, variable, valor) => {
        this.inyectados[local] = { ...this.inyectados[local], [variable]: { valor, hasta: Date.now() + DURACION_INYECCION_MS } }
        this.tick()
      },
      limpiar: async () => {
        this.inyectados = {}
        this.tick()
      },
    }
    this.tick()
    setInterval(() => this.tick(), TICK_MS)
  }

  // Una "lectura" nueva por local, como si llegara del ESP32
  private tick() {
    const ahora = new Date()
    for (const local of ['local1', 'local2'] as LocalId[]) {
      const s = this.sim[local]
      const p = perfilBase(local, ahora)
      const horas = TICK_MS / 3_600_000

      // Reinicio del agua diaria a medianoche
      const hoy = ahora.toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })
      if (hoy !== s.diaAgua) {
        s.aguaDia = 0
        s.diaAgua = hoy
      }

      const caudal = Math.max(0, ruido(p.agua_m3h, 0.15))
      s.aguaDia += caudal * horas
      s.hh += p.personas * horas
      s.ts = ahora
      s.enlace.ultimo_dato = iso(ahora)
      if (s.enlace.enlace === 'online') s.enlace.ultima_sincronizacion = iso(ahora)

      const a = AGUA[local]
      const v: ValorVariable[] = [
        { id: 'agua_m3h', valor: caudal, referencia: null, nivel: p.noche && caudal > a.fuga ? 'advertencia' : 'normal' },
        {
          id: 'agua_m3_dia',
          valor: s.aguaDia,
          referencia: a.normal,
          nivel: s.aguaDia > a.critico ? 'critico' : s.aguaDia > a.advertencia ? 'advertencia' : 'normal',
        },
        { id: 'hh_sin_incidentes', valor: s.hh, referencia: null, nivel: 'normal' },
        { id: 'dias_sin_incidentes', valor: s.dias, referencia: null, nivel: 'normal' },
      ]

      if (local === 'local1') {
        const p = perfilPlanta(ahora)
        const kw = ruido(p.energia)
        const uv = Math.max(0, ruido(p.uv, 0.05))
        // ~1 tablero cada 2 min durante el turno
        if (p.personas > 0 && Math.random() < TICK_MS / 120_000) {
          s.produccionMes += 1
          s.produccionAnual += 1
        }
        v.push(
          { id: 'energia_kw', valor: kw, referencia: p.energia, nivel: nivelRelativo(kw, p.energia) },
          { id: 'uv_index', valor: uv, referencia: null, nivel: nivelUv(uv) },
          { id: 'produccion_mes', valor: s.produccionMes, referencia: META_MES, nivel: 'normal' },
          { id: 'produccion_anual', valor: s.produccionAnual, referencia: META_ANIO, nivel: 'normal' },
        )
      } else {
        const p = perfilOficina(ahora)
        const clima = ruido(p.clima)
        const ilum = ruido(p.ilum)
        const ref = p.clima + p.ilum
        v.push(
          { id: 'energia_kw', valor: clima + ilum, referencia: ref, nivel: nivelRelativo(clima + ilum, ref) },
          { id: 'energia_climatizacion_kw', valor: clima, referencia: p.clima, nivel: nivelRelativo(clima, p.clima) },
          { id: 'energia_iluminacion_kw', valor: ilum, referencia: p.ilum, nivel: nivelRelativo(ilum, p.ilum) },
        )
      }

      this.aplicarInyecciones(local, v, p.noche)
      for (const x of v) s.valores[x.id] = x
      // En la demo, cada lectura sin internet cuenta como un intervalo pendiente de subir
      if (s.enlace.enlace === 'offline') s.enlace.pendientes += 1
      this.evaluarAlertas(local, v, ahora)
    }
  }

  // Reemplaza los valores inyectados desde el panel de demo y recalcula su nivel
  private aplicarInyecciones(local: LocalId, valores: ValorVariable[], noche: boolean) {
    const iny = this.inyectados[local]
    if (!iny) return
    const ahora = Date.now()
    for (const x of valores) {
      const dato = iny[x.id]
      if (!dato) continue
      if (dato.hasta < ahora) {
        delete iny[x.id]
        continue
      }
      x.valor = dato.valor
      if (x.id === 'uv_index') x.nivel = nivelUv(x.valor)
      else if (x.id === 'agua_m3h') x.nivel = x.valor > AGUA[local].fuga && (noche || x.valor > AGUA[local].fuga * 5) ? 'critico' : 'normal'
      else if (x.referencia) x.nivel = nivelRelativo(x.valor, x.referencia)
    }
  }

  // Corte o regreso del enlace Edge -> AWS (lo que se cae en una planta real)
  private cambiarEnlace(local: LocalId, conectado: boolean) {
    const e = this.sim[local].enlace
    if (!conectado) {
      e.enlace = 'offline'
      return
    }
    if (e.enlace === 'online') return
    e.enlace = e.pendientes > 0 ? 'sincronizando' : 'online'
    if (this.sincronizador) return
    // Sube los pendientes en lotes, como el Edge real (modo-offline.md §6.3)
    this.sincronizador = setInterval(() => {
      let quedan = false
      for (const l of ['local1', 'local2'] as LocalId[]) {
        const en = this.sim[l].enlace
        if (en.enlace !== 'sincronizando') continue
        en.pendientes = Math.max(0, en.pendientes - LOTE_SYNC)
        if (en.pendientes === 0) {
          en.enlace = 'online'
          en.ultima_sincronizacion = iso(new Date())
        } else quedan = true
      }
      if (!quedan && this.sincronizador) {
        clearInterval(this.sincronizador)
        this.sincronizador = null
      }
    }, 1_000)
  }

  // Motor de alertas simulado: una alerta por local + variable + intervalo de 15 min
  private evaluarAlertas(local: LocalId, valores: ValorVariable[], ahora: Date) {
    for (const x of valores) {
      if (x.nivel !== 'critico') continue
      const inicio = inicioIntervalo(ahora)
      const id = `${local}:${x.id}:${inicio}`
      if (this.listaAlertas.some((al) => al.id === id)) continue
      if (this.sim[local].enlace.enlace === 'offline') this.sim[local].enlace.pendientes += 1
      this.listaAlertas.unshift({
        id,
        local_id: local,
        variable: x.id,
        nivel: 'critico',
        valor: x.valor,
        umbral:
          x.id === 'uv_index'
            ? 8
            : x.id === 'agua_m3_dia'
              ? AGUA[local].critico
              : x.id === 'agua_m3h'
                ? AGUA[local].fuga
                : (x.referencia ?? 0) * 1.2,
        regla:
          x.id === 'uv_index'
            ? 'UV mayor o igual a 8'
            : x.id === 'agua_m3_dia'
              ? `Agua diaria sobre ${AGUA[local].critico} m³`
              : x.id === 'agua_m3h'
                ? `Posible fuga: caudal sobre ${AGUA[local].fuga} m³/h fuera de horario`
              : '20 % sobre el promedio de 4 semanas a la misma hora',
        inicio_intervalo: inicio,
        estado: 'activa',
        origen: this.sim[local].enlace.enlace === 'offline' ? 'edge' : 'lambda',
        reconocida_en: null,
      })
    }
  }

  // ---------- Interfaz Fuente (mismas funciones que la API real) ----------

  async estado(): Promise<EstadoRespuesta> {
    return {
      origen: 'simulada',
      hora_servidor: iso(new Date()),
      locales: [{ ...this.sim.local1.enlace }, { ...this.sim.local2.enlace }],
    }
  }

  async locales(): Promise<LocalInfo[]> {
    return LOCALES
  }

  async actual(local: LocalId): Promise<ActualRespuesta> {
    const s = this.sim[local]
    const info = LOCALES.find((l) => l.local_id === local)!
    return {
      local_id: local,
      ts: iso(s.ts),
      variables: info.variables.map((id) => ({ ...s.valores[id]! })),
    }
  }

  async alertas(filtro?: { local_id?: LocalId; estado?: Alerta['estado'] }): Promise<Alerta[]> {
    return this.listaAlertas
      .filter((a) => !filtro?.local_id || a.local_id === filtro.local_id)
      .filter((a) => !filtro?.estado || a.estado === filtro.estado)
      .map((a) => ({ ...a }))
  }

  async historico(c: ConsultaHistorico): Promise<HistoricoRespuesta> {
    const desde = new Date(c.desde).getTime()
    const hasta = new Date(c.hasta).getTime()
    const series = c.local_ids.map((local) => {
      const puntos: HistoricoRespuesta['series'][number]['puntos'] = []
      if (c.variable === 'energia_kw') {
        const paso = c.agrupacion === '15min' ? 900_000 : 3_600_000
        for (let t = Math.floor(desde / paso) * paso; t <= hasta; t += paso) {
          const muestras = [0, 0.25, 0.5, 0.75].map((f) => energiaEn(local, t + f * paso))
          puntos.push({
            inicio: iso(new Date(t)),
            promedio: muestras.reduce((a, b) => a + b, 0) / muestras.length,
            maximo: Math.max(...muestras),
            total: null,
          })
        }
      } else if (c.variable === 'agua_m3_dia') {
        const hoy = medianocheSantiago(new Date())
        for (let t = medianocheSantiago(new Date(desde)); t <= hasta; t += 86_400_000) {
          const dia = medianocheSantiago(new Date(t + 3_600_000 * 3))
          puntos.push({
            inicio: iso(new Date(dia)),
            promedio: null,
            maximo: null,
            total: Math.abs(dia - hoy) < 3_600_000 ? this.sim[local].aguaDia : aguaDelDia(local, dia),
          })
        }
      }
      return { local_id: local, puntos }
    })
    return { variable: c.variable, agrupacion: c.agrupacion, series }
  }
}
