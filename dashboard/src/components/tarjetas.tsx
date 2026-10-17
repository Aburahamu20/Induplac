// Tarjetas KPI armadas desde los datos del contrato (§3.3).
// Cada función recibe la variable que entrega la API y decide texto, color y barra.

import type { ValorVariable } from '../api'
import { VARIABLES, formatear } from '../api/variables'
import { tonoDeNivel } from './estilos'
import { KpiCard } from './KpiCard'

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : 0)
const fmtPct = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(Math.round(n))}%`

// Meta de racha para la barra de HH (ficticia)
const META_RACHA_DIAS = 60

// Energía: comparación contra el promedio histórico (referencia)
export function TarjetaEnergia({ titulo, v }: { titulo: string; v: ValorVariable }) {
  const tono = tonoDeNivel(v.nivel)
  const dif = v.referencia ? pct(v.valor, v.referencia) - 100 : null
  return (
    <KpiCard
      titulo={titulo}
      valor={formatear(v.id, v.valor)}
      unidad={VARIABLES[v.id].unidad}
      alerta={v.nivel === 'critico'}
      estado={
        dif === null
          ? { texto: 'Sin promedio histórico aún', tono: 'neutro' }
          : { texto: `${dif >= 0 ? '▲' : '▼'} ${fmtPct(dif)} vs promedio`, tono }
      }
      barra={v.referencia ? { pct: pct(v.valor, v.referencia * 1.2), tono } : undefined}
    />
  )
}

// Agua del día: contra el umbral de alerta del local
export function TarjetaAgua({ titulo, v, umbral }: { titulo: string; v: ValorVariable; umbral: number }) {
  const tono = tonoDeNivel(v.nivel)
  const texto =
    v.nivel === 'critico' ? '▲ Sobre el umbral de alerta' : v.nivel === 'advertencia' ? '▲ Sobre lo normal' : '✓ Dentro del umbral'
  return (
    <KpiCard
      titulo={titulo}
      valor={formatear(v.id, v.valor)}
      unidad={VARIABLES[v.id].unidad}
      alerta={v.nivel === 'critico'}
      estado={{ texto, tono }}
      barra={{ pct: pct(v.valor, umbral), tono }}
    />
  )
}

// Caudal instantáneo: detecta posible fuga fuera de horario
export function TarjetaCaudal({ titulo, v }: { titulo: string; v: ValorVariable }) {
  const fuga = v.nivel !== 'normal'
  return (
    <KpiCard
      titulo={titulo}
      valor={formatear(v.id, v.valor)}
      unidad={VARIABLES[v.id].unidad}
      alerta={v.nivel === 'critico'}
      estado={fuga ? { texto: '▲ Posible fuga fuera de horario', tono: 'aviso' } : { texto: '✓ Consumo esperado', tono: 'ok' }}
    />
  )
}

// Subconsumo (climatización, iluminación)
export function TarjetaSubconsumo({ titulo, v }: { titulo: string; v: ValorVariable }) {
  return <TarjetaEnergia titulo={titulo} v={v} />
}

// Producción: avance contra la meta (referencia)
export function TarjetaProduccion({ titulo, v, periodo }: { titulo: string; v: ValorVariable; periodo: string }) {
  const avance = v.referencia ? pct(v.valor, v.referencia) : 0
  return (
    <KpiCard
      titulo={titulo}
      valor={formatear(v.id, v.valor)}
      unidad="und"
      estado={{ texto: `▲ ${Math.round(avance)}% de meta ${periodo}`, tono: 'ok' }}
      barra={{ pct: avance, tono: 'ok' }}
    />
  )
}

// HH sin incidentes + racha en días
export function TarjetaHH({ titulo, hh, dias }: { titulo: string; hh: ValorVariable; dias?: ValorVariable }) {
  return (
    <KpiCard
      titulo={titulo}
      valor={formatear(hh.id, hh.valor)}
      unidad="hrs"
      estado={dias ? { texto: `✓ Racha activa: ${Math.round(dias.valor)} días`, tono: 'ok' } : undefined}
      barra={dias ? { pct: pct(dias.valor, META_RACHA_DIAS), tono: 'ok' } : undefined}
    />
  )
}

// Índice UV con la escala de colores de la OMS
const ESCALA_UV = ['#3fb950', '#3fb950', '#d9a521', '#d9a521', '#d9a521', '#e8663a', '#e8663a', '#ef4f4f', '#ef4f4f', '#ef4f4f', '#9b5de5', '#9b5de5']

function categoriaUv(uv: number): string {
  if (uv < 3) return 'Bajo'
  if (uv < 6) return 'Moderado'
  if (uv < 8) return 'Alto · usar protector y sombra'
  if (uv < 11) return 'Muy alto · evitar exposición'
  return 'Extremo'
}

export function TarjetaUv({ titulo, v }: { titulo: string; v: ValorVariable }) {
  const tono = tonoDeNivel(v.nivel)
  const nivel = Math.round(v.valor)
  return (
    <KpiCard
      titulo={titulo}
      valor={formatear(v.id, v.valor)}
      unidad="UV"
      alerta={v.nivel === 'critico'}
      estado={{ texto: `${v.nivel === 'normal' ? '✓' : '▲'} ${categoriaUv(v.valor)}`, tono }}
    >
      <div className="mt-3" aria-label={`Escala UV, valor actual ${nivel}`}>
        <div className="flex gap-0.5">
          {ESCALA_UV.map((c, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-sm"
              style={{ background: c, opacity: i < Math.max(1, nivel) ? 1 : 0.25 }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-tinta-3">
          {['1', '3', '5', '7', '9', '11+'].map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      </div>
    </KpiCard>
  )
}
