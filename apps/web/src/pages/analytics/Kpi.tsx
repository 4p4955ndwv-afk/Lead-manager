import type { ReactNode } from 'react'
import { Icon } from '../../components/icons'
import { Locked } from '../../components/ui'
import { Sparkline } from './charts'

export interface Delta { text: string; good: boolean | null; compare: string }

/** Stat tile: label, value, signed change vs the previous period (colour = direction × whether up is good), sparkline. */
export function KpiTile({ label, value, delta, hint, spark, sparkLabel }: { label: string; value: ReactNode; delta?: Delta | null; hint?: ReactNode; spark?: number[]; sparkLabel?: string }) {
  return (
    <div className="an-kpi">
      <span className="an-kpi-label">{label}</span>
      <span className="an-kpi-value">{value}</span>
      {delta ? (
        <span className="an-kpi-delta">
          <span className={`an-delta ${delta.good === true ? 'is-good' : delta.good === false ? 'is-bad' : 'is-flat'}`}>
            {delta.good !== null && <Icon name="arrowUpRight" size={13} className={delta.text.startsWith('−') ? 'an-delta-down' : undefined} />}
            {delta.text}
          </span>
          <span className="muted">{delta.compare}</span>
        </span>
      ) : delta === null ? <span className="an-kpi-delta muted">No earlier data to compare</span> : null}
      {hint && <span className="an-kpi-hint">{hint}</span>}
      {spark && spark.length > 1 && <Sparkline values={spark} label={sparkLabel} />}
    </div>
  )
}

export function LockedTile({ label, why }: { label: string; why: string }) {
  return (
    <div className="an-kpi an-kpi-locked">
      <span className="an-kpi-label">{label}</span>
      <Locked>{why}</Locked>
    </div>
  )
}

const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '±')

/** Percentage change for counts. `upIsGood` decides the colour. */
export function pctDelta(cur: number, prev: number | null | undefined, compare: string, upIsGood = true): Delta | null {
  if (prev == null || !Number.isFinite(prev)) return null
  if (prev === 0) return cur === 0 ? { text: '±0%', good: null, compare } : { text: 'new', good: upIsGood, compare }
  const p = (cur - prev) / prev
  if (Math.abs(p) < 0.005) return { text: '±0%', good: null, compare }
  return { text: `${sign(p)}${Math.abs(p * 100).toFixed(Math.abs(p) < 0.1 ? 1 : 0)}%`, good: p > 0 === upIsGood, compare }
}

/** Change in percentage points for rates (0-1). */
export function ptsDelta(cur: number, prev: number | null | undefined, compare: string, upIsGood = true): Delta | null {
  if (prev == null || !Number.isFinite(prev) || !Number.isFinite(cur)) return null
  const d = (cur - prev) * 100
  if (Math.abs(d) < 0.05) return { text: '±0 pts', good: null, compare }
  return { text: `${sign(d)}${Math.abs(d).toFixed(1)} pts`, good: d > 0 === upIsGood, compare }
}
