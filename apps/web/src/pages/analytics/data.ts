// Everything the dashboards show is derived here from the store's DemoState.
import type { Channel, Client, DailyMetric, DemoState, Episode, Stage, Task } from '../../lib/types'
import { STAGES } from '../../lib/types'
import { DAY, MIN, ms } from '../../lib/time'
import { median } from './format'

export type RangeDays = 7 | 30 | 60
export type ChannelFilter = 'all' | 'instagram' | 'tiktok'

export interface Day {
  date: string
  dms: number
  contacts: number
  booked: number
  attended: number
  treatments: number
  revenue: number
  aiReplies: number
  humanReplies: number
  medianFirstReplySec: number
  callSlaMetPct: number
  instagram: number
  tiktok: number
  aiEra: boolean
}

/** Index of the first day from which AI replies outnumber staff replies every day (autopilot era), or -1. */
export function aiStartIndex(metrics: DailyMetric[]): number {
  let idx = -1
  for (let i = metrics.length - 1; i >= 0; i--) {
    if (metrics[i].aiReplies > metrics[i].humanReplies) idx = i
    else break
  }
  return idx
}

/**
 * Daily rows for a channel. Metrics split DMs by channel; for a single channel the later funnel steps,
 * replies and revenue are apportioned by that day's DM share (the note under the filters says so).
 */
export function toDays(metrics: DailyMetric[], channel: ChannelFilter): Day[] {
  const start = aiStartIndex(metrics)
  return metrics.map((m, i) => {
    const share = channel === 'all' ? 1 : m.dms ? m.byChannel[channel] / m.dms : 0
    return {
      date: m.date,
      dms: channel === 'all' ? m.dms : m.byChannel[channel],
      contacts: m.contacts * share,
      booked: m.booked * share,
      attended: m.attended * share,
      treatments: m.treatments * share,
      revenue: m.revenue * share,
      aiReplies: m.aiReplies * share,
      humanReplies: m.humanReplies * share,
      medianFirstReplySec: m.medianFirstReplySec,
      callSlaMetPct: m.callSlaMetPct,
      instagram: m.byChannel.instagram,
      tiktok: m.byChannel.tiktok,
      aiEra: start >= 0 && i >= start,
    }
  })
}

/** The last `range` days, shifted back by `offset` days; null when the data does not reach that far. */
export function windowOf(days: Day[], range: number, offset = 0): Day[] | null {
  const end = days.length - offset
  const start = end - range
  if (start < 0 || end <= 0) return null
  return days.slice(start, end)
}

type NumKey = 'dms' | 'contacts' | 'booked' | 'attended' | 'treatments' | 'revenue' | 'aiReplies' | 'humanReplies'
export const total = (rows: Day[], k: NumKey): number => rows.reduce((a, r) => a + r[k], 0)

export interface Funnel { dms: number; contacts: number; booked: number; attended: number; treatments: number }
export const funnelOf = (rows: Day[]): Funnel => ({
  dms: total(rows, 'dms'), contacts: total(rows, 'contacts'), booked: total(rows, 'booked'), attended: total(rows, 'attended'), treatments: total(rows, 'treatments'),
})
export const FUNNEL_STEPS: Array<{ key: keyof Funnel; label: string; rate: string }> = [
  { key: 'dms', label: 'DMs received', rate: '' },
  { key: 'contacts', label: 'Numbers shared', rate: 'contact rate' },
  { key: 'booked', label: 'Consultations booked', rate: 'booked after the call' },
  { key: 'attended', label: 'Consultations attended', rate: 'turned up' },
  { key: 'treatments', label: 'Treatments started', rate: 'started treatment' },
]

/** Median first reply for the AI era in a window, plus the pre-AI baseline (from the window, or from all earlier data). */
export function replyTimes(rows: Day[], all: Day[]) {
  const ai = rows.filter(r => r.aiEra).map(r => r.medianFirstReplySec)
  const preInRange = rows.filter(r => !r.aiEra).map(r => r.medianFirstReplySec)
  const preAll = all.filter(r => !r.aiEra).map(r => r.medianFirstReplySec)
  const before = preInRange.length ? preInRange : preAll
  return {
    ai: median(ai),
    aiDays: ai.length,
    before: median(before),
    beforeDays: before.length,
    beforeFromRange: preInRange.length > 0,
    overall: median(rows.map(r => r.medianFirstReplySec)),
  }
}

// ---- live records ---------------------------------------------------------------------------------

export function reached(ep: Episode, stage: Stage): boolean {
  return STAGES.indexOf(ep.stage) >= STAGES.indexOf(stage) || ep.history.some(h => h.to === stage)
}

const NEGATIVE_EXITS = new Set(['lost', 'not_suitable', 'dnc', 'spam', 'under18'])
export const realisedValue = (ep: Episode): number => (ep.exit && NEGATIVE_EXITS.has(ep.exit) ? 0 : ep.value)

function episodesByClient(s: DemoState): Map<string, Episode[]> {
  const map = new Map<string, Episode[]>()
  for (const e of s.episodes) {
    const list = map.get(e.clientId)
    if (list) list.push(e)
    else map.set(e.clientId, [e])
  }
  return map
}

const channelOk = (c: Client, channel: ChannelFilter) => channel === 'all' || c.source.channel === channel

export interface SourceRow { detail: string; channel: Channel; leads: number; contacts: number; booked: number; treatments: number; contactRate: number; bookRate: number }

/** Clients created in the window, grouped by the post or video that started the conversation. */
export function topSources(s: DemoState, range: number, channel: ChannelFilter, now: number): SourceRow[] {
  const since = now - range * DAY
  const eps = episodesByClient(s)
  const groups = new Map<string, SourceRow & { channels: Record<string, number> }>()
  for (const c of s.clients) {
    if (ms(c.createdAt) < since || !channelOk(c, channel)) continue
    const list = eps.get(c.id) ?? []
    const g = groups.get(c.source.detail) ?? { detail: c.source.detail, channel: c.source.channel, leads: 0, contacts: 0, booked: 0, treatments: 0, contactRate: 0, bookRate: 0, channels: {} }
    g.leads += 1
    g.channels[c.source.channel] = (g.channels[c.source.channel] ?? 0) + 1
    if (c.phone || list.some(e => reached(e, 'contact'))) g.contacts += 1
    if (list.some(e => reached(e, 'booked'))) g.booked += 1
    if (list.some(e => reached(e, 'treatment'))) g.treatments += 1
    groups.set(c.source.detail, g)
  }
  return [...groups.values()]
    .map(g => ({
      detail: g.detail,
      channel: (Object.entries(g.channels).sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.channel) as Channel,
      leads: g.leads, contacts: g.contacts, booked: g.booked, treatments: g.treatments,
      contactRate: g.leads ? g.contacts / g.leads : 0,
      bookRate: g.leads ? g.booked / g.leads : 0,
    }))
    .sort((a, b) => b.booked - a.booked || b.leads - a.leads || a.detail.localeCompare(b.detail))
}

/** Was a lead call made within its SLA? Uses the original deadline (created + SLA minutes), not a rescheduled one. */
export function slaOutcome(t: Task, now: number): 'met' | 'missed' | 'pending' | null {
  const timed = t.slaMinutes != null || (t.priority === 'urgent' && (t.type === 'call' || t.type === 'callback'))
  if (!timed) return null
  const deadline = ms(t.createdAt) + (t.slaMinutes ?? 15) * MIN
  const first = t.attempts.length ? Math.min(...t.attempts.map(a => ms(a.at))) : NaN
  if (Number.isFinite(first)) return first <= deadline ? 'met' : 'missed'
  if (t.status !== 'open') return null
  return now > deadline ? 'missed' : 'pending'
}

export interface LeaderRow { userId: string; name: string; onShift: boolean; owned: number; calls: number; booked: number; bookRate: number; slaMet: number; slaTotal: number; slaPending: number }

export function leaderboard(s: DemoState, range: number, channel: ChannelFilter, now: number): LeaderRow[] {
  const since = now - range * DAY
  const clientOk = new Map(s.clients.map(c => [c.id, channelOk(c, channel)]))
  const epClient = new Map(s.episodes.map(e => [e.id, e.clientId]))
  const people = s.users.filter(u => u.status === 'active' && (u.role === 'coordinator' || s.tasks.some(t => t.attempts.some(a => a.by === u.id && ms(a.at) >= since))))
  return people.map(u => {
    const owned = s.clients.filter(c => c.ownerId === u.id && ms(c.createdAt) >= since && clientOk.get(c.id)).length
    const attempts = s.tasks.filter(t => clientOk.get(t.clientId)).flatMap(t => t.attempts).filter(a => a.by === u.id && ms(a.at) >= since).length
    let callMoves = 0
    let booked = 0
    for (const e of s.episodes) {
      if (!clientOk.get(epClient.get(e.id) ?? '')) continue
      for (const h of e.history) {
        if (h.by !== u.id || ms(h.at) < since) continue
        if (h.to === 'call') callMoves += 1
        if (h.to === 'booked') booked += 1
      }
    }
    const calls = attempts + callMoves
    let slaMet = 0, slaTotal = 0, slaPending = 0
    for (const t of s.tasks) {
      if (t.assignedTo !== u.id || ms(t.createdAt) < since || !clientOk.get(t.clientId)) continue
      const o = slaOutcome(t, now)
      if (o === 'met') { slaMet += 1; slaTotal += 1 } else if (o === 'missed') slaTotal += 1
      else if (o === 'pending') slaPending += 1
    }
    return { userId: u.id, name: u.name, onShift: u.onShift, owned, calls, booked, bookRate: calls ? booked / calls : 0, slaMet, slaTotal, slaPending }
  }).sort((a, b) => b.booked - a.booked || b.calls - a.calls)
}

export interface ReturningRow { clientId: string; name: string; channel: Channel; episodes: number; value: number; latest: Episode }
export function returningClients(s: DemoState, channel: ChannelFilter) {
  const eps = episodesByClient(s)
  let totalValue = 0
  let clients = 0
  const rows: ReturningRow[] = []
  for (const c of s.clients) {
    if (!channelOk(c, channel)) continue
    const list = eps.get(c.id) ?? []
    clients += 1
    const value = list.reduce((a, e) => a + realisedValue(e), 0)
    totalValue += value
    if (list.length > 1) rows.push({ clientId: c.id, name: c.name, channel: c.source.channel, episodes: list.length, value, latest: [...list].sort((a, b) => b.number - a.number)[0] })
  }
  rows.sort((a, b) => b.value - a.value)
  const returningValue = rows.reduce((a, r) => a + r.value, 0)
  return { rows, clients, totalValue, returningValue, valueShare: totalValue ? returningValue / totalValue : 0, clientShare: clients ? rows.length / clients : 0 }
}

export interface ProcedureRevenue { procedureId: string; name: string; value: number; plans: number; sessionsDone: number; sessionsTotal: number }
/** Accepted and completed plan value per procedure (discounts spread across items by price). All time. */
export function revenueByProcedure(s: DemoState, channel: ChannelFilter) {
  const clientOk = new Map(s.clients.map(c => [c.id, channelOk(c, channel)]))
  const map = new Map<string, ProcedureRevenue & { planIds: Set<string> }>()
  let proposed = 0
  let proposedPlans = 0
  for (const p of s.plans) {
    if (!clientOk.get(p.clientId)) continue
    const gross = p.items.reduce((a, i) => a + i.price, 0) || 1
    if (p.status === 'proposed' || p.status === 'draft') {
      proposed += gross - p.discount
      proposedPlans += 1
      continue
    }
    if (p.status !== 'accepted' && p.status !== 'completed') continue
    for (const it of p.items) {
      const proc = s.procedures.find(x => x.id === it.procedureId)
      const row = map.get(it.procedureId) ?? { procedureId: it.procedureId, name: proc?.name ?? it.procedureId, value: 0, plans: 0, sessionsDone: 0, sessionsTotal: 0, planIds: new Set<string>() }
      row.value += it.price - p.discount * (it.price / gross)
      row.planIds.add(p.id)
      row.plans = row.planIds.size
      row.sessionsDone += it.sessions.filter(x => x.status === 'done').length
      row.sessionsTotal += it.sessionsTotal
      map.set(it.procedureId, row)
    }
  }
  const rows: ProcedureRevenue[] = [...map.values()].map(({ planIds: _p, ...r }) => r).sort((a, b) => b.value - a.value)
  return { rows, proposed, proposedPlans, total: rows.reduce((a, r) => a + r.value, 0) }
}

export function toCsv(rows: Day[], showRevenue: boolean): string {
  const head = ['date', 'dms', 'instagram_dms', 'tiktok_dms', 'contacts', 'booked', 'attended', 'treatments', ...(showRevenue ? ['revenue'] : []), 'ai_replies', 'staff_replies', 'median_first_reply_sec', 'call_sla_met_pct']
  const lines = rows.map(r => [r.date, r.dms, r.instagram, r.tiktok, r.contacts, r.booked, r.attended, r.treatments, ...(showRevenue ? [r.revenue] : []), r.aiReplies, r.humanReplies, r.medianFirstReplySec, r.callSlaMetPct].map(v => (typeof v === 'number' ? String(Math.round(v * 10) / 10) : v)).join(','))
  return [head.join(','), ...lines].join('\n')
}
