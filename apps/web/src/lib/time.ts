import { useEffect, useState } from 'react'
import type { Channel, Conversation } from './types'

export const MIN = 60_000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

export const ms = (iso: string | undefined) => (iso ? Date.parse(iso) : NaN)
export const iso = (t: number) => new Date(t).toISOString()
export const fromNow = (deltaMs: number) => iso(Date.now() + deltaMs)

/** Re-renders every `intervalMs` and returns the current time. Use for countdowns. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "12 Sep" */
export function ago(isoStr: string | undefined, now = Date.now()): string {
  if (!isoStr) return ''
  const d = now - ms(isoStr)
  if (d < 45_000) return 'just now'
  if (d < HOUR) return `${Math.round(d / MIN)} min ago`
  if (d < DAY) return `${Math.round(d / HOUR)} h ago`
  if (d < 2 * DAY) return 'yesterday'
  if (d < 7 * DAY) return `${Math.round(d / DAY)} days ago`
  return shortDate(isoStr)
}

/** "in 12 min", "in 3 h", "tomorrow", or `ago()` if in the past */
export function until(isoStr: string | undefined, now = Date.now()): string {
  if (!isoStr) return ''
  const d = ms(isoStr) - now
  if (d < 0) return ago(isoStr, now)
  if (d < HOUR) return `in ${Math.max(1, Math.round(d / MIN))} min`
  if (d < DAY) return `in ${Math.round(d / HOUR)} h`
  if (d < 2 * DAY) return 'tomorrow'
  return `in ${Math.round(d / DAY)} days`
}

/** mm:ss or h:mm:ss countdown; negative values are shown with a leading minus. */
export function countdown(deadlineIso: string, now = Date.now()): { text: string; overdue: boolean; msLeft: number } {
  const left = ms(deadlineIso) - now
  const a = Math.abs(left)
  const h = Math.floor(a / HOUR)
  const m = Math.floor((a % HOUR) / MIN)
  const s = Math.floor((a % MIN) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const text = (left < 0 ? '−' : '') + (h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`)
  return { text, overdue: left < 0, msLeft: left }
}

export function shortDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
export function longDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}
export function timeOf(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}
export function dateTime(isoStr: string): string {
  return `${shortDate(isoStr)}, ${timeOf(isoStr)}`
}
export function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
export function sameDay(a: string | number, b: string | number): boolean {
  const x = new Date(a), y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

/** Platform reply windows: Instagram 24 h, TikTok 48 h (max 10 messages per customer message), WhatsApp 24 h. */
export function windowHours(channel: Channel): number {
  return channel === 'tiktok' ? 48 : 24
}

export interface WindowState {
  open: boolean
  closesAt: string
  msLeft: number
  /** Instagram only: a human may still reply with the Human Agent tag for 7 days. */
  humanAgentUntil?: string
  humanAgentOpen?: boolean
  /** TikTok only: messages left before the 10-message cap. */
  messagesLeft?: number
}

export function replyWindow(c: Conversation, now = Date.now()): WindowState {
  const base = ms(c.lastInboundAt)
  const closes = base + windowHours(c.channel) * HOUR
  const st: WindowState = { open: now < closes, closesAt: iso(closes), msLeft: closes - now }
  if (c.channel === 'instagram') {
    const ha = base + 7 * DAY
    st.humanAgentUntil = iso(ha)
    st.humanAgentOpen = now < ha
  }
  if (c.channel === 'tiktok') {
    st.messagesLeft = Math.max(0, 10 - c.outboundSinceInbound)
    if (st.messagesLeft === 0) st.open = false
  }
  return st
}

export function money(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`
  }
}

/** Shifts every ISO timestamp inside a value by `delta` ms (used to keep saved demo data fresh). */
export function shiftTimestamps<T>(value: T, delta: number): T {
  const re = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return re.test(v) ? iso(Date.parse(v) + delta) : v
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) out[k] = walk(x)
      return out
    }
    return v
  }
  return walk(value) as T
}

let seq = 0
/** Short unique id with a prefix, e.g. uid('cl') -> 'cl_k3j9x2' */
export function uid(prefix: string): string {
  seq = (seq + 1) % 1296
  return `${prefix}_${Date.now().toString(36).slice(-5)}${seq.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 5)}`
}
