// Number and date formatting shared by the Today and Analytics dashboards.

export const fmtInt = (v: number): string => Math.round(v).toLocaleString()

export function fmtCompact(v: number): string {
  const a = Math.abs(v)
  if (a >= 1_000_000) return (v / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, '') + 'M'
  if (a >= 10_000) return Math.round(v / 1000) + 'k'
  if (a >= 1_000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(v).toString()
}

export const fmtPct = (ratio: number, digits = 0): string => (Number.isFinite(ratio) ? (ratio * 100).toFixed(digits) + '%' : '—')

/** 9 s, 24 min, 1.5 h */
export function fmtDuration(sec: number): string {
  if (!Number.isFinite(sec)) return '—'
  if (sec < 60) return `${Math.round(sec)} s`
  if (sec < 3600) return `${Math.round(sec / 60)} min`
  return `${(sec / 3600).toFixed(1).replace(/\.0$/, '')} h`
}

/** Compact currency for axis ticks and tight labels, e.g. £12k */
export function fmtMoneyCompact(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(amount)
  } catch {
    return `${currency} ${fmtCompact(amount)}`
  }
}

/** '2026-10-04' -> '4 Oct' */
export function dayLabel(date: string, withWeekday = false): string {
  const d = new Date(date + 'T12:00:00')
  return d.toLocaleDateString(undefined, withWeekday ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export const plural = (n: number, one: string, many = one + 's'): string => `${fmtInt(n)} ${n === 1 ? one : many}`
