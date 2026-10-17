// Fuente simulada: genera datos ficticios en el navegador, respetando el
// formato del contrato (docs/api-dashboard.md). Cada 5 s "llega" una lectura
// nueva por local, como si la mandara el ESP32.
//
// Los valores siguen un perfil por hora del día (America/Santiago):
// turno diurno con más consumo, noches casi en cero, UV según el sol.
// Las reglas de nivel imitan las de CONTEXTO.md §8.2.

import type { Fuente } from './fuente'
import type {
  ActualRespuesta,
  Alerta,
  EstadoLocal,
  EstadoRespuesta,
  LocalId,
  LocalInfo,
  Nivel,
  ValorVariable,
  VariableId,
} from './tipos'

const TICK_MS = 5_000

const LOCALES: LocalInfo[] = [
  {
    local_id: 'local1',
    nombre: 'Local 1 · Planta',
    variables: ['energia_kw', 'agua_m3h', 'agua_m3_dia', 'uv_index', 'produccion_mes', 'produccion_anual', 'hh_sin_incidentes'],
  },
  {
    local_id: 'local2',
    nombre: 'Local 2 · Oficinas',
    variables: ['energia_kw', 'energia_climatizacion_kw', 'energia_iluminacion_kw', 'agua_m3h', 'agua_m3_dia', 'hh_sin_incidentes'],
  },
]

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
}

export class FuenteSimulada implements Fuente {
  private sim: Record<LocalId, EstadoSim>
  private listaAlertas: Alerta[] = []

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
    })
    this.sim = { local1: base('local1'), local2: base('local2') }
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
          { id: 'produccion_mes', valor: s.produccionMes, referencia: null, nivel: 'normal' },
          { id: 'produccion_anual', valor: s.produccionAnual, referencia: null, nivel: 'normal' },
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

      for (const x of v) s.valores[x.id] = x
      this.evaluarAlertas(local, v, ahora)
    }
  }

  // Motor de alertas simulado: una alerta por local + variable + intervalo de 15 min
  private evaluarAlertas(local: LocalId, valores: ValorVariable[], ahora: Date) {
    for (const x of valores) {
      if (x.nivel !== 'critico') continue
      const inicio = inicioIntervalo(ahora)
      const id = `${local}:${x.id}:${inicio}`
      if (this.listaAlertas.some((al) => al.id === id)) continue
      this.listaAlertas.unshift({
        id,
        local_id: local,
        variable: x.id,
        nivel: 'critico',
        valor: x.valor,
        umbral: x.id === 'uv_index' ? 8 : x.id === 'agua_m3_dia' ? AGUA[local].critico : (x.referencia ?? 0) * 1.2,
        regla:
          x.id === 'uv_index'
            ? 'UV mayor o igual a 8'
            : x.id === 'agua_m3_dia'
              ? `Agua diaria sobre ${AGUA[local].critico} m³`
              : '20 % sobre el promedio de 4 semanas a la misma hora',
        inicio_intervalo: inicio,
        estado: 'activa',
        origen: this.sim[local].enlace.enlace === 'online' ? 'lambda' : 'edge',
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
}
