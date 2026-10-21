// Gráficos del histórico (contrato §3.6), con Chart.js.
// Cada sede tiene SIEMPRE el mismo color en todos los gráficos.

import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'
import { fuente, type LocalId } from '../api'
import { usePolling } from '../hooks/usePolling'
import { SEDES } from './estilos'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend)

ChartJS.defaults.color = '#a3aab6'
ChartJS.defaults.font.family = '"Atkinson Hyperlegible", system-ui, sans-serif'
ChartJS.defaults.borderColor = '#2a2f39'

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-CL', { timeZone: 'America/Santiago', hour: '2-digit', minute: '2-digit', hour12: false })

const diaCorto = (iso: string) => {
  const d = new Date(iso)
  const txt = d.toLocaleDateString('es-CL', { timeZone: 'America/Santiago', weekday: 'short' }).replace('.', '')
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}

const esHoy = (iso: string) =>
  new Date(iso).toLocaleDateString('es-CL', { timeZone: 'America/Santiago' }) ===
  new Date().toLocaleDateString('es-CL', { timeZone: 'America/Santiago' })

function base(unidad: string): ChartOptions<'line' | 'bar'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8 } },
      tooltip: {
        backgroundColor: '#0d0f13',
        borderColor: '#2a2f39',
        borderWidth: 1,
        padding: 10,
        callbacks: {
          label: (c) => ` ${c.dataset.label}: ${Number(c.parsed.y).toLocaleString('es-CL', { maximumFractionDigits: 1 })} ${unidad}`,
        },
      },
    },
    scales: {
      x: { grid: { color: 'rgba(42,47,57,0.6)' }, ticks: { maxRotation: 0, autoSkipPadding: 16 } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(42,47,57,0.6)' },
        ticks: { callback: (v) => `${v} ${unidad}` },
      },
    },
  }
}

export function Panel({ titulo, children, className = '' }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-borde bg-panel p-4 ${className}`}>
      <h3 className="mb-2 text-sm font-bold">{titulo}</h3>
      {children}
    </section>
  )
}

// Energía: últimas 8 horas, promedio cada 15 min
export function GraficoEnergia({ locales }: { locales: LocalId[] }) {
  const { datos } = usePolling(
    () => {
      const hasta = new Date()
      const desde = new Date(hasta.getTime() - 8 * 3_600_000)
      return fuente.historico({
        local_ids: locales,
        variable: 'energia_kw',
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        agrupacion: '15min',
      })
    },
    60_000,
    [locales.join()],
  )

  const etiquetas = datos?.series[0]?.puntos.map((p) => hora(p.inicio)) ?? []
  return (
    <Panel titulo="Consumo eléctrico — últimas 8 horas (kW, promedio cada 15 min)">
      <div className="h-64">
        <Line
          options={base('kW') as ChartOptions<'line'>}
          data={{
            labels: etiquetas,
            datasets:
              datos?.series.map((s) => ({
                label: SEDES[s.local_id].nombre,
                data: s.puntos.map((p) => p.promedio),
                borderColor: SEDES[s.local_id].color,
                backgroundColor: `${SEDES[s.local_id].color}1f`,
                fill: s.local_id === 'local1',
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointBackgroundColor: SEDES[s.local_id].color,
                pointBorderColor: '#1a1d24',
                pointBorderWidth: 2,
              })) ?? [],
          }}
        />
      </div>
    </Panel>
  )
}

// Agua: total por día de los últimos 5 días
export function GraficoAgua({ locales }: { locales: LocalId[] }) {
  const { datos } = usePolling(
    () => {
      const hasta = new Date()
      const desde = new Date(hasta.getTime() - 4 * 86_400_000)
      return fuente.historico({
        local_ids: locales,
        variable: 'agua_m3_dia',
        desde: desde.toISOString(),
        hasta: hasta.toISOString(),
        agrupacion: 'dia',
      })
    },
    60_000,
    [locales.join()],
  )

  const etiquetas = datos?.series[0]?.puntos.map((p) => (esHoy(p.inicio) ? `${diaCorto(p.inicio)} (hoy)` : diaCorto(p.inicio))) ?? []
  const opciones = base('m³') as ChartOptions<'bar'>
  return (
    <Panel titulo="Agua consumida por día (m³)">
      <div className="h-64">
        <Bar
          options={{ ...opciones, interaction: { mode: 'index', intersect: false } }}
          data={{
            labels: etiquetas,
            datasets:
              datos?.series.map((s) => ({
                label: SEDES[s.local_id].nombre,
                data: s.puntos.map((p) => p.total),
                backgroundColor: SEDES[s.local_id].color,
                borderRadius: { topLeft: 4, topRight: 4 },
                borderSkipped: 'bottom' as const,
                borderColor: '#1a1d24',
                borderWidth: { left: 2, right: 2 },
                maxBarThickness: 36,
              })) ?? [],
          }}
        />
      </div>
    </Panel>
  )
}
