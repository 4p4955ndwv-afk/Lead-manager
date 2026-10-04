// Pipeline data: one row per client (their latest episode), filters, sorting, summary figures and move rules.
import type { Appointment, Channel, Client, DemoState, Episode, Exit, Procedure, Stage, StageChange, Task, User } from '../../lib/types'
import { EXITS, STAGES, STAGE_LABEL, EXIT_LABEL } from '../../lib/types'
import { activeEpisode } from '../../lib/store'
import { DAY, ms } from '../../lib/time'

export type Pos = Stage | Exit

/** dataTransfer type for a dragged card; drop targets also accept it before React has re-rendered with the dragged row. */
export const DRAG_TYPE = 'application/x-lm-episode'
export const isCardDrag = (dt: DataTransfer | null) => !!dt && Array.from(dt.types).includes(DRAG_TYPE)

export const isStage = (p: Pos | undefined): p is Stage => !!p && (STAGES as string[]).includes(p)
export const isExit = (p: Pos | undefined): p is Exit => !!p && (EXITS as string[]).includes(p)
export const posLabel = (p: Pos) => (isStage(p) ? STAGE_LABEL[p] : EXIT_LABEL[p])

export interface PRow {
  client: Client
  ep: Episode
  /** where the episode sits now: a main stage, or an exit when it is off the path */
  pos: Pos
  onPath: boolean
  /** relationship owner, or whoever holds the open call task when no owner is set yet */
  ownerId?: string
  owner?: User
  /** open call or callback task, earliest due first */
  callTask?: Task
  /** open call task with an SLA (fresh lead, 15 minutes) */
  slaTask?: Task
  overdueCall: boolean
  nextAppt?: Appointment
  enteredAt: number
  lastChange: number
  procedure?: Procedure
  extraInterests: number
  /** the history entry that took the episode off the path */
  exitEntry?: StageChange
}

const CLOSED_APPT: Appointment['status'][] = ['completed', 'no_show', 'cancelled']

export function buildRows(s: DemoState, now: number): PRow[] {
  const rows: PRow[] = []
  for (const client of s.clients) {
    const ep = activeEpisode(s, client.id)
    if (!ep) continue
    const pos: Pos = ep.exit ?? ep.stage
    const calls = s.tasks
      .filter(t => t.clientId === client.id && t.status === 'open' && (t.type === 'call' || t.type === 'callback'))
      .sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
    const slaTask = calls.find(t => t.slaMinutes)
    const nextAppt = s.appointments
      .filter(a => a.clientId === client.id && ms(a.start) > now && !CLOSED_APPT.includes(a.status))
      .sort((a, b) => ms(a.start) - ms(b.start))[0]
    const entries = ep.history.filter(h => h.to === pos)
    const entered = entries.length ? ms(entries[entries.length - 1].at) : ms(ep.startedAt)
    const last = ep.history.length ? Math.max(...ep.history.map(h => ms(h.at))) : ms(ep.startedAt)
    const procId = ep.interests[0]
    const ownerId = client.ownerId ?? calls[0]?.assignedTo
    rows.push({
      client,
      ep,
      pos,
      onPath: !ep.exit,
      ownerId,
      owner: s.users.find(u => u.id === ownerId),
      callTask: calls[0],
      slaTask,
      overdueCall: calls.some(t => ms(t.dueAt) < now),
      nextAppt,
      enteredAt: Number.isFinite(entered) ? entered : ms(ep.startedAt),
      lastChange: Number.isFinite(last) ? last : ms(ep.startedAt),
      procedure: s.procedures.find(p => p.id === procId),
      extraInterests: Math.max(0, ep.interests.length - 1),
      exitEntry: ep.exit ? entries[entries.length - 1] : undefined,
    })
  }
  return rows
}

// ---- filters ---------------------------------------------------------------------------------------

export interface Filters {
  q: string
  owner: string // 'all' | 'me' | 'none' | userId
  channel: 'all' | Channel
  branch: string // 'all' | branchId
  proc: string // 'all' | procedureId
  overdue: boolean
}

export const NO_FILTERS: Filters = { q: '', owner: 'all', channel: 'all', branch: 'all', proc: 'all', overdue: false }

export function activeFilterCount(f: Filters): number {
  return [f.q.trim() !== '', f.owner !== 'all', f.channel !== 'all', f.branch !== 'all', f.proc !== 'all', f.overdue].filter(Boolean).length
}

export function applyFilters(rows: PRow[], f: Filters, meId: string, canPhone: boolean): PRow[] {
  const q = f.q.trim().toLowerCase()
  // a UK number typed locally (07700 …) is stored as +44 7700 …, so drop the trunk 0 before matching
  const digits = q.replace(/\D/g, '').replace(/^0+/, '')
  return rows.filter(r => {
    if (f.owner === 'me' && r.ownerId !== meId) return false
    if (f.owner === 'none' && r.ownerId) return false
    if (!['all', 'me', 'none'].includes(f.owner) && r.ownerId !== f.owner) return false
    if (f.channel !== 'all' && r.client.source.channel !== f.channel) return false
    if (f.branch !== 'all' && r.client.branchId !== f.branch) return false
    if (f.proc !== 'all' && !r.ep.interests.includes(f.proc)) return false
    if (f.overdue && !r.overdueCall) return false
    if (q) {
      const hay = [r.client.name, r.client.handles.instagram, r.client.handles.tiktok, r.client.email, r.procedure?.name, r.client.source.detail]
        .filter(Boolean).join(' ').toLowerCase()
      const phoneHit = canPhone && digits.length >= 4 && (r.client.phone ?? '').replace(/\D/g, '').includes(digits)
      if (!hay.includes(q) && !phoneHit) return false
    }
    return true
  })
}

// ---- sorting (list view) ---------------------------------------------------------------------------

export type SortKey = 'name' | 'stage' | 'channel' | 'owner' | 'value' | 'score' | 'created' | 'changed'
export interface Sort { key: SortKey; dir: 'asc' | 'desc' }

const posOrder = (p: Pos) => (isStage(p) ? STAGES.indexOf(p) : STAGES.length + EXITS.indexOf(p))

export function sortRows(rows: PRow[], sort: Sort): PRow[] {
  const val = (r: PRow): string | number => {
    switch (sort.key) {
      case 'name': return r.client.name.toLowerCase()
      case 'stage': return posOrder(r.pos)
      case 'channel': return r.client.source.channel
      case 'owner': return r.owner?.name.toLowerCase() ?? '~'
      case 'value': return r.ep.value
      case 'score': return r.client.score
      case 'created': return ms(r.client.createdAt)
      case 'changed': return r.lastChange
    }
  }
  const sign = sort.dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b)
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
    return c !== 0 ? c * sign : a.client.name.localeCompare(b.client.name)
  })
}

// ---- summary -----------------------------------------------------------------------------------------

/** First moment an episode reached `stage` or anything after it on the main path. */
function firstReach(ep: Episode, stage: Stage): number | undefined {
  const idx = STAGES.indexOf(stage)
  const hits = ep.history.filter(h => isStage(h.to) && STAGES.indexOf(h.to) >= idx).map(h => ms(h.at))
  return hits.length ? Math.min(...hits) : undefined
}

export interface Summary {
  onPath: number
  alumni: number
  off: number
  value: number
  contacts30: number
  booked30: number
  conversion: number | null
  breaches: Task[]
}

export function summarise(s: DemoState, rows: PRow[], now: number): Summary {
  const active = rows.filter(r => r.onPath && r.pos !== 'alumni')
  const clientIds = new Set(rows.map(r => r.client.id))
  const since = now - 30 * DAY
  let contacts30 = 0
  let booked30 = 0
  for (const ep of s.episodes) {
    if (!clientIds.has(ep.clientId)) continue
    const c = firstReach(ep, 'contact')
    if (c === undefined || c < since) continue
    contacts30 += 1
    if (firstReach(ep, 'booked') !== undefined) booked30 += 1
  }
  const breaches = s.tasks
    .filter(t => t.status === 'open' && t.slaMinutes && ms(t.dueAt) < now && clientIds.has(t.clientId))
    .sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  return {
    onPath: active.length,
    alumni: rows.filter(r => r.pos === 'alumni').length,
    off: rows.filter(r => !r.onPath).length,
    value: active.reduce((sum, r) => sum + r.ep.value, 0),
    contacts30,
    booked30,
    conversion: contacts30 ? booked30 / contacts30 : null,
    breaches,
  }
}

// ---- move rules ----------------------------------------------------------------------------------------

/** Exits that protect someone (or the clinic). Taking a person out of these needs an override. */
export const PROTECTIVE_EXITS: Exit[] = ['not_suitable', 'dnc', 'spam', 'under18']

export type MoveKind = 'same' | 'next' | 'skip' | 'back' | 'exit' | 'return'
export interface MoveRule { kind: MoveKind; needsReason: boolean; needsOverride: boolean; steps: number }

/** The rule for moving an episode from where it sits now to `to`. Shared by the board and the client record. */
export function moveRule(row: { pos: Pos; ep: Episode }, to: Pos): MoveRule {
  const from = row.pos
  if (from === to) return { kind: 'same', needsReason: false, needsOverride: false, steps: 0 }
  if (isExit(to)) {
    return { kind: 'exit', needsReason: true, needsOverride: isExit(from) && PROTECTIVE_EXITS.includes(from), steps: 0 }
  }
  if (isExit(from)) {
    return { kind: 'return', needsReason: true, needsOverride: PROTECTIVE_EXITS.includes(from) || to !== row.ep.stage, steps: 0 }
  }
  const steps = STAGES.indexOf(to) - STAGES.indexOf(from)
  if (steps === 1) return { kind: 'next', needsReason: false, needsOverride: false, steps }
  return { kind: steps > 1 ? 'skip' : 'back', needsReason: true, needsOverride: true, steps }
}

export const nextStage = (row: PRow): Stage | undefined =>
  row.onPath && isStage(row.pos) ? STAGES[STAGES.indexOf(row.pos) + 1] : undefined

export const EXIT_HELP: Record<Exit, { what: string; placeholder: string; empty: string }> = {
  nurture: {
    what: 'They are interested but not ready. They stay in the nurture list and the team checks in later.',
    placeholder: 'e.g. Wants to start after the summer',
    empty: 'Leads who are interested but not ready yet land here, so the team can check in later.',
  },
  lost: {
    what: 'They decided not to go ahead. The reason helps the team and the AI learn what loses people.',
    placeholder: 'e.g. Chose a clinic closer to home',
    empty: 'People who decided not to go ahead appear here with the reason they gave.',
  },
  not_suitable: {
    what: 'A clinician advised against treatment. Bringing them back later needs a manager or owner.',
    placeholder: 'e.g. Clinician advised against treatment',
    empty: 'People a clinician has advised against treating appear here.',
  },
  dnc: {
    what: 'They asked not to be contacted. The AI and the team stop all messages and calls to them.',
    placeholder: 'e.g. Asked us to stop messaging',
    empty: 'People who asked us to stop contacting them appear here. No one can message them.',
  },
  spam: {
    what: 'Spam or fake accounts. The AI stops replying to them.',
    placeholder: 'e.g. Bot account sending links',
    empty: 'Spam and fake accounts the AI or the team flagged appear here.',
  },
  under18: {
    what: 'They are under 18. Booking is blocked and the AI stops selling to them.',
    placeholder: 'e.g. Said she is 16',
    empty: 'Anyone who says they are under 18 lands here automatically and cannot be booked.',
  },
}
