// Hand-made SVG charts for the dashboards. Colours are design tokens passed as CSS values
// (e.g. 'var(--accent)'), so light and dark themes both work. Every chart has a hover/focus layer
// and its card can swap to a table view, so no value is only reachable by hovering.
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Button, Card } from '../../components/ui'
import { fmtInt } from './format'
import '../analytics.css'

// ---- palette roles (validated with the dataviz checks; see analytics.css header) -----------------

export const COLOR = {
  focus: 'var(--accent)', // the series the story is about
  context: 'var(--faint)', // de-emphasised context series
  instagram: 'var(--ig)',
  tiktok: 'var(--tt)',
}

/** Ordinal ramp for funnel steps: strongest first, each later step one visible step lighter. */
export const FUNNEL_RAMP = [
  'color-mix(in oklab, var(--accent) 66%, var(--ink))',
  'var(--accent)',
  'color-mix(in oklab, var(--accent) 84%, var(--surface))',
  'color-mix(in oklab, var(--accent) 69%, var(--surface))',
  'color-mix(in oklab, var(--accent) 56%, var(--surface))',
]

// ---- helpers -------------------------------------------------------------------------------------

export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.clientWidth)
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setWidth(Math.round(e.contentRect.width))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Clean axis ticks from 0, e.g. max 34 -> [0, 10, 20, 30, 40] */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag
  const top = Math.ceil(max / step) * step
  const out: number[] = []
  for (let v = 0; v <= top + step / 1000; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

/** Column with a 4px rounded data end, square at the baseline. */
function colPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return ''
  const rr = Math.min(r, w / 2, h)
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`
}
/** Horizontal bar with a 4px rounded data end, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return ''
  const rr = Math.min(r, h / 2, w)
  return `M${x},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h - rr}Q${x + w},${y + h} ${x + w - rr},${y + h}H${x}Z`
}

function useIndexNav(n: number) {
  const [index, setIndex] = useState<number | null>(null)
  const [keyboard, setKeyboard] = useState(false)
  const onKeyDown = (e: KeyboardEvent) => {
    if (!n) return
    const cur = index ?? n - 1
    let next = cur
    if (e.key === 'ArrowLeft') next = Math.max(0, cur - 1)
    else if (e.key === 'ArrowRight') next = Math.min(n - 1, cur + 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = n - 1
    else if (e.key === 'Escape') { setIndex(null); return }
    else return
    e.preventDefault()
    setKeyboard(true)
    setIndex(next)
  }
  return {
    index, setIndex,
    keyboard,
    bind: {
      tabIndex: 0,
      onKeyDown,
      onFocus: () => { setKeyboard(true); setIndex(i => i ?? n - 1) },
      onBlur: () => { setKeyboard(false); setIndex(null) },
    },
  }
}

// ---- chrome --------------------------------------------------------------------------------------

export function ChartCard({ title, subtitle, legend, table, actions, children, className = '', note }: {
  title: ReactNode; subtitle?: ReactNode; legend?: ReactNode; table?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; note?: ReactNode
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <Card
      className={`an-chart-card ${className}`}
      title={title}
      subtitle={subtitle}
      actions={<>
        {actions}
        {table && (
          <Button size="sm" variant="ghost" icon={showTable ? 'chart' : 'tasks'} aria-pressed={showTable} onClick={() => setShowTable(v => !v)}>
            {showTable ? 'Show chart' : 'Show table'}
          </Button>
        )}
      </>}
    >
      {showTable && table ? <div className="table-wrap an-table-view">{table}</div> : (
        <div className="stack">
          {legend && <div className="an-legend">{legend}</div>}
          {children}
        </div>
      )}
      {note && <p className="an-note tiny muted">{note}</p>}
    </Card>
  )
}

export function LegendItem({ color, label, value, kind = 'rect', icon }: { color: string; label: ReactNode; value?: ReactNode; kind?: 'rect' | 'line'; icon?: ReactNode }) {
  return (
    <span className="an-legend-item">
      <span className={kind === 'line' ? 'an-key-line' : 'an-key-rect'} style={{ background: color }} aria-hidden="true" />
      {icon}
      <span className="an-legend-label">{label}</span>
      {value != null && <span className="an-legend-value num">{value}</span>}
    </span>
  )
}

interface TipRow { color: string; label: string; value: string }

function Tooltip({ x, y, width, title, rows, live }: { x: number; y: number; width: number; title: string; rows: TipRow[]; live: boolean }) {
  const flip = x > width - 170
  return (
    <div className="an-tip" style={{ left: flip ? x - 12 : x + 12, top: y, transform: flip ? 'translateX(-100%)' : undefined }} role={live ? 'status' : undefined} aria-live={live ? 'polite' : undefined}>
      <div className="an-tip-head">{title}</div>
      {rows.map(r => (
        <div key={r.label} className="an-tip-row">
          <span className="an-key-line" style={{ background: r.color }} aria-hidden="true" />
          <strong className="num">{r.value}</strong>
          <span className="muted">{r.label}</span>
        </div>
      ))}
    </div>
  )
}

// ---- line chart ----------------------------------------------------------------------------------

export interface LineSeries { id: string; label: string; color: string; values: number[] }

export function LineChart({ labels, tipLabels, series, annotation, height = 240, ariaLabel, format = fmtInt }: {
  labels: string[]; tipLabels?: string[]; series: LineSeries[]; annotation?: { index: number; label: string } | null; height?: number; ariaLabel: string; format?: (v: number) => string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const n = labels.length
  const nav = useIndexNav(n)
  const narrow = width < 440
  const m = { top: annotation ? 30 : 14, right: narrow ? 34 : 82, bottom: 26, left: 34 }
  const w = Math.max(width, 220)
  const iw = Math.max(10, w - m.left - m.right)
  const ih = Math.max(10, height - m.top - m.bottom)
  const max = Math.max(1, ...series.flatMap(s => s.values))
  const ticks = niceTicks(max, 4)
  const top = ticks[ticks.length - 1]
  const x = (i: number) => m.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => m.top + ih - (v / top) * ih
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')

  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 74))))
  const xTicks = labels.map((l, i) => ({ l, i })).filter(t => (n - 1 - t.i) % tickEvery === 0)

  // end labels: value (and series name when there is room), nudged apart only if they would overlap
  const ends = series.map(s => ({ s, y: y(s.values[n - 1] ?? 0) }))
  if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 14) {
    const mid = (ends[0].y + ends[1].y) / 2
    const upper = ends[0].y <= ends[1].y ? 0 : 1
    ends[upper].y = mid - 7
    ends[1 - upper].y = mid + 7
  }

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left
    const i = Math.round(((px - m.left) / iw) * (n - 1))
    nav.setIndex(Math.max(0, Math.min(n - 1, i)))
  }
  const hi = nav.index

  return (
    <div ref={ref} className="an-plot" style={{ height }} role="group" aria-label={ariaLabel + '. Use the arrow keys to read each day.'} {...nav.bind}>
      {width > 0 && n > 0 && (
        <svg width={w} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => nav.setIndex(null)} aria-hidden="true">
          {ticks.map(t => (
            <g key={t}>
              <line x1={m.left} x2={m.left + iw} y1={y(t)} y2={y(t)} className={t === 0 ? 'an-axis' : 'an-gridline'} />
              <text x={m.left - 6} y={y(t) + 4} textAnchor="end" className="an-tick">{format(t)}</text>
            </g>
          ))}
          {xTicks.map(t => (
            <text key={t.i} x={x(t.i)} y={height - 8} textAnchor={t.i === 0 ? 'start' : t.i === n - 1 ? 'end' : 'middle'} className="an-tick">{t.l}</text>
          ))}
          {annotation && annotation.index >= 0 && annotation.index < n && (() => {
            const ax = x(annotation.index)
            const est = annotation.label.length * 6.6
            const right = ax + 6 + est <= w - 2
            const left = ax - 6 - est >= 0
            const label = right || left ? annotation.label : annotation.label.replace(/^Instagram /, '')
            const anchorEnd = !right && (left || ax > w / 2)
            return (
              <g>
                <line x1={ax} x2={ax} y1={m.top - 8} y2={m.top + ih} className="an-annot-line" />
                <text x={ax + (anchorEnd ? -6 : 6)} y={m.top - 14} textAnchor={anchorEnd ? 'end' : 'start'} className="an-annot-text">{label}</text>
              </g>
            )
          })()}
          {series.map(s => (
            <path key={s.id} d={path(s.values)} className="an-line" style={{ stroke: s.color }} />
          ))}
          {ends.map(({ s, y: ey }) => (
            <g key={s.id}>
              <circle cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} className="an-dot" style={{ fill: s.color }} />
              <text x={x(n - 1) + 9} y={ey + 4} className="an-end-label">
                <tspan className="an-end-value">{format(s.values[n - 1] ?? 0)}</tspan>
                {!narrow && <tspan dx={4} className="an-end-name">{s.label}</tspan>}
              </text>
            </g>
          ))}
          {hi != null && (
            <g>
              <line x1={x(hi)} x2={x(hi)} y1={m.top} y2={m.top + ih} className="an-crosshair" />
              {series.map(s => <circle key={s.id} cx={x(hi)} cy={y(s.values[hi] ?? 0)} r={4.5} className="an-dot" style={{ fill: s.color }} />)}
            </g>
          )}
        </svg>
      )}
      {hi != null && width > 0 && (
        <Tooltip x={x(hi)} y={m.top} width={w} live={nav.keyboard} title={(tipLabels ?? labels)[hi]}
          rows={series.map(s => ({ color: s.color, label: s.label, value: format(s.values[hi] ?? 0) }))} />
      )}
    </div>
  )
}

// ---- stacked columns -----------------------------------------------------------------------------

export function StackedColumns({ labels, tipLabels, series, height = 200, ariaLabel, format = fmtInt, totalLabel = 'Total' }: {
  labels: string[]; tipLabels?: string[]; series: LineSeries[]; height?: number; ariaLabel: string; format?: (v: number) => string; totalLabel?: string
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const n = labels.length
  const nav = useIndexNav(n)
  const m = { top: 10, right: 6, bottom: 26, left: 34 }
  const w = Math.max(width, 220)
  const iw = Math.max(10, w - m.left - m.right)
  const ih = Math.max(10, height - m.top - m.bottom)
  const totals = labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0))
  const ticks = niceTicks(Math.max(1, ...totals), 4)
  const top = ticks[ticks.length - 1]
  const band = iw / Math.max(1, n)
  const bw = Math.max(1.5, Math.min(24, band - 2))
  const cx = (i: number) => m.left + band * i + band / 2
  const h = (v: number) => (v / top) * ih
  const tickEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 74))))
  const hi = nav.index
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const px = e.clientX - e.currentTarget.getBoundingClientRect().left
    nav.setIndex(Math.max(0, Math.min(n - 1, Math.floor((px - m.left) / band))))
  }

  return (
    <div ref={ref} className="an-plot" style={{ height }} role="group" aria-label={ariaLabel + '. Use the arrow keys to read each day.'} {...nav.bind}>
      {width > 0 && n > 0 && (
        <svg width={w} height={height} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => nav.setIndex(null)} aria-hidden="true">
          {ticks.map(t => (
            <g key={t}>
              <line x1={m.left} x2={m.left + iw} y1={m.top + ih - h(t)} y2={m.top + ih - h(t)} className={t === 0 ? 'an-axis' : 'an-gridline'} />
              <text x={m.left - 6} y={m.top + ih - h(t) + 4} textAnchor="end" className="an-tick">{format(t)}</text>
            </g>
          ))}
          {labels.map((l, i) => (n - 1 - i) % tickEvery === 0 && (
            <text key={i} x={cx(i)} y={height - 8} textAnchor={i === n - 1 ? 'end' : 'middle'} className="an-tick">{l}</text>
          ))}
          {labels.map((_, i) => {
            let base = m.top + ih
            const visible = series.filter(s => (s.values[i] ?? 0) > 0)
            return (
              <g key={i} className={hi === i ? 'an-col is-hot' : hi != null ? 'an-col is-dim' : 'an-col'}>
                {visible.map((s, k) => {
                  const segH = h(s.values[i] ?? 0)
                  const gap = k > 0 ? 2 : 0 // surface gap between stacked segments
                  const y0 = base - segH
                  const d = k === visible.length - 1 ? colPath(cx(i) - bw / 2, y0, bw, Math.max(0, segH - gap)) : `M${cx(i) - bw / 2},${base - gap}V${y0}H${cx(i) + bw / 2}V${base - gap}Z`
                  base = y0
                  return <path key={s.id} d={d} style={{ fill: s.color }} />
                })}
                <rect x={m.left + band * i} y={m.top} width={band} height={ih} fill="transparent" />
              </g>
            )
          })}
        </svg>
      )}
      {hi != null && width > 0 && (
        <Tooltip x={cx(hi)} y={m.top} width={w} live={nav.keyboard} title={(tipLabels ?? labels)[hi]}
          rows={[...series.map(s => ({ color: s.color, label: s.label, value: format(s.values[hi] ?? 0) })), ...(series.length > 1 ? [{ color: 'transparent', label: totalLabel, value: format(totals[hi]) }] : [])]} />
      )}
    </div>
  )
}

// ---- horizontal bar list (label above each bar, value at the tip) -----------------------------------

export interface BarRow { id: string; label: ReactNode; value: number; color?: string; display?: string; meta?: ReactNode; tip?: TipRow[]; tipTitle?: string; onClick?: () => void }

export function BarList({ rows, max, ariaLabel, barHeight = 14, compact = false, format = fmtInt, between }: {
  rows: BarRow[]; max?: number; ariaLabel: string; barHeight?: number; compact?: boolean; format?: (v: number) => string
  /** optional annotation rendered between row i-1 and row i (e.g. step conversion) */
  between?: (i: number) => ReactNode
}) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hot, setHot] = useState<number | null>(null)
  const [kb, setKb] = useState(false)
  // Missing values (NaN, e.g. no baseline yet) draw no bar and read as a dash, and never break the scale.
  const top = max ?? Math.max(1, ...rows.map(r => r.value).filter(Number.isFinite))
  const valueRoom = 76
  const track = Math.max(40, width - valueRoom)
  return (
    <div ref={ref} className={`an-bars ${compact ? 'is-compact' : ''}`} role="list" aria-label={ariaLabel}>
      {width > 0 && rows.map((r, i) => {
        const bw = r.value > 0 && Number.isFinite(r.value) ? Math.max(2, Math.min(track, (r.value / top) * track)) : 0
        const text = r.display ?? (Number.isFinite(r.value) ? format(r.value) : '—')
        const inner = (
          <>
            <span className="an-bar-label">
              <span className="truncate">{r.label}</span>
              {r.meta && <span className="an-bar-meta tiny muted">{r.meta}</span>}
            </span>
            <svg width={width} height={barHeight} aria-hidden="true" className="an-bar-svg">
              <rect x={0} y={0} width={track} height={barHeight} rx={4} className="an-bar-track" />
              {bw > 0 && <path d={barPath(0, 0, bw, barHeight)} style={{ fill: r.color ?? COLOR.focus }} />}
              <text x={bw + 6} y={barHeight / 2 + 4} className="an-bar-value">{text}</text>
            </svg>
          </>
        )
        const common = {
          className: `an-bar-row ${hot === i ? 'is-hot' : ''} ${r.onClick ? 'is-clickable' : ''}`,
          tabIndex: 0,
          onPointerEnter: () => { setKb(false); setHot(i) },
          onPointerLeave: () => setHot(null),
          onFocus: () => { setKb(true); setHot(i) },
          onBlur: () => setHot(null),
          'aria-label': typeof r.label === 'string' ? `${r.label}: ${text}` : undefined,
        }
        return (
          <div key={r.id} role="listitem" className="an-bar-item">
            {between && i > 0 && <div className="an-bar-between">{between(i)}</div>}
            <div className="an-bar-anchor">
              {r.onClick
                ? <button type="button" onClick={r.onClick} {...common}>{inner}</button>
                : <div {...common}>{inner}</div>}
              {hot === i && r.tip && (
                <Tooltip x={Math.min(bw, track)} y={-8} width={width} live={kb} title={r.tipTitle ?? (typeof r.label === 'string' ? r.label : '')} rows={r.tip} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ---- sparkline -----------------------------------------------------------------------------------

export function Sparkline({ values, height = 26, label }: { values: number[]; height?: number; label?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const n = values.length
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => 2 + (n <= 1 ? 0 : (i / (n - 1)) * (width - 6))
  const y = (v: number) => 3 + (1 - (v - min) / span) * (height - 6)
  return (
    <div ref={ref} className="an-spark" style={{ height }} aria-hidden={label ? undefined : true} aria-label={label} role={label ? 'img' : undefined}>
      {width > 0 && n > 1 && (
        <svg width={width} height={height} aria-hidden="true">
          <path d={values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')} className="an-spark-line" />
          <circle cx={x(n - 1)} cy={y(values[n - 1])} r={3} className="an-spark-dot" />
        </svg>
      )}
    </div>
  )
}
