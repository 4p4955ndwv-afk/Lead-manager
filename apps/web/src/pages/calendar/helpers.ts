// Pure helpers for the clinic calendar: date maths, labels, clash checks, plan lookups and the age policy.
import type { Appointment, AppointmentStatus, AppointmentType, Client, DemoState, PlanItem, Procedure, TreatmentPlan } from '../../lib/types'
import type { Tone } from '../../components/ui'
import type { IconName } from '../../components/icons'
import { DAY, MIN, ms } from '../../lib/time'

export type CalView = 'practitioner' | 'room' | 'week' | 'agenda'

/** Clinic day shown in the time grid. */
export const DAY_START_MIN = 8 * 60
export const DAY_END_MIN = 20 * 60
export const PX_PER_MIN = 1.8
export const GRID_HEIGHT = (DAY_END_MIN - DAY_START_MIN) * PX_PER_MIN

export const TYPE_LABEL: Record<AppointmentType, string> = { consultation: 'Consultation', session: 'Treatment session', follow_up: 'Follow-up' }
export const TYPE_SHORT: Record<AppointmentType, string> = { consultation: 'Consultation', session: 'Session', follow_up: 'Follow-up' }

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  unconfirmed: 'Unconfirmed',
  confirmed: 'Confirmed',
  arrived: 'In clinic',
  completed: 'Completed',
  no_show: 'No-show',
  cancelled: 'Cancelled',
}
export const STATUS_TONE: Record<AppointmentStatus, Tone> = {
  unconfirmed: 'warn',
  confirmed: 'ok',
  arrived: 'accent',
  completed: 'neutral',
  no_show: 'danger',
  cancelled: 'neutral',
}
export const STATUS_ICON: Record<AppointmentStatus, IconName> = {
  unconfirmed: 'clock',
  confirmed: 'check',
  arrived: 'pin',
  completed: 'check',
  no_show: 'x',
  cancelled: 'x',
}

/** Statuses that hold a practitioner and a room. */
export const isLive = (a: Appointment) => a.status !== 'cancelled' && a.status !== 'no_show'

// ---- dates -------------------------------------------------------------------------------------

export function startOfLocalDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}
/** Calendar-day arithmetic that survives clock changes (British Summer Time). */
export function addDays(t: number, n: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + n)
  return d.getTime()
}
/** Monday of the week containing `t`. */
export function weekStart(t: number): number {
  const d = new Date(startOfLocalDay(t))
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  return addDays(d.getTime(), -dow)
}
export const isSameDay = (a: number, b: number) => startOfLocalDay(a) === startOfLocalDay(b)

const LOCALE = 'en-GB'
export const hm = (t: number | string) => new Date(typeof t === 'string' ? ms(t) : t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false })
export const fullDay = (t: number) => new Date(t).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
export const mediumDay = (t: number) => new Date(t).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' })
export const dayMonth = (t: number) => new Date(t).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' })
export const weekdayShort = (t: number) => new Date(t).toLocaleDateString(LOCALE, { weekday: 'short' })

export function relativeDay(t: number, now: number): string | null {
  const diff = Math.round((startOfLocalDay(t) - startOfLocalDay(now)) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return null
}

export function rangeLabel(from: number, toExclusive: number): string {
  const last = addDays(toExclusive, -1)
  const a = new Date(from), b = new Date(last)
  const year = b.getFullYear()
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${b.toLocaleDateString(LOCALE, { month: 'short' })} ${year}`
  return `${dayMonth(from)} – ${dayMonth(last)} ${year}`
}

/** YYYY-MM-DD for <input type="date"> in local time. */
export function dateInput(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export function parseDateInput(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime()
}
/** HH:MM of a timestamp, for the time <select>. */
export function timeInput(t: number): string {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function combine(dayMs: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(dayMs)
  d.setHours(h || 0, m || 0, 0, 0)
  return d.getTime()
}
/** Bookable start times, every 15 minutes through clinic hours. */
export const TIME_OPTIONS: string[] = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 15 }, (_, i) => {
  const m = DAY_START_MIN + i * 15
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})
export const minutesOfDay = (t: number) => {
  const d = new Date(t)
  return d.getHours() * 60 + d.getMinutes()
}
export function durationLabel(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export function currencySymbol(currency: string): string {
  try {
    return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).formatToParts(0).find(p => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

// ---- lookups -----------------------------------------------------------------------------------

export const clientOf = (s: DemoState, a: Appointment): Client | undefined => s.clients.find(c => c.id === a.clientId)
export const procOf = (s: DemoState, id: string | undefined): Procedure | undefined => (id ? s.procedures.find(p => p.id === id) : undefined)
export const firstName = (name: string) => name.replace(/^Dr\.? /, '').split(' ')[0]

/** The plan item an appointment belongs to (same client and procedure, preferring the same episode). */
export function planItemFor(s: DemoState, clientId: string, episodeId: string | undefined, procedureId: string | undefined): { plan: TreatmentPlan; item: PlanItem } | undefined {
  if (!procedureId) return undefined
  const plans = s.plans
    .filter(p => p.clientId === clientId && p.status !== 'declined')
    .sort((a, b) => (a.episodeId === episodeId ? -1 : 0) - (b.episodeId === episodeId ? -1 : 0) || ms(b.createdAt) - ms(a.createdAt))
  for (const plan of plans) {
    const item = plan.items.find(i => i.procedureId === procedureId)
    if (item) return { plan, item }
  }
  return undefined
}

export interface SessionInfo { no: number; total: number; done: number; fromPlan: boolean }
export function sessionInfo(s: DemoState, a: Appointment): SessionInfo | undefined {
  if (a.type !== 'session' || !a.sessionNo) return undefined
  const pi = planItemFor(s, a.clientId, a.episodeId, a.procedureId)
  const total = pi?.item.sessionsTotal ?? procOf(s, a.procedureId)?.sessions ?? a.sessionNo
  return { no: a.sessionNo, total: Math.max(total, a.sessionNo), done: pi ? pi.item.sessions.filter(x => x.status === 'done').length : 0, fromPlan: !!pi }
}

/** "PRP scalp therapy · Session 2 of 4", "Consultation · Laser hair removal", "Follow-up". */
export function apptLine(s: DemoState, a: Appointment): string {
  const proc = procOf(s, a.procedureId)
  if (a.type === 'session') {
    const si = sessionInfo(s, a)
    return `${proc?.name ?? 'Treatment'}${si ? ` · Session ${si.no} of ${si.total}` : ''}`
  }
  if (a.type === 'consultation') return `Consultation${proc ? ` · ${proc.name}` : ''}`
  return `Follow-up${proc ? ` · ${proc.name}` : ''}`
}

export function apptMinutes(a: Appointment): number {
  return Math.max(5, Math.round((ms(a.end) - ms(a.start)) / MIN))
}

// ---- clashes -----------------------------------------------------------------------------------

export interface Clashes { practitioner: Appointment[]; room: Appointment[]; client: Appointment[] }
export function findClashes(s: DemoState, q: { start: number; end: number; practitionerId: string; roomId: string; clientId?: string; excludeId?: string }): Clashes {
  const overlapping = s.appointments.filter(a => a.id !== q.excludeId && isLive(a) && ms(a.start) < q.end && ms(a.end) > q.start)
  return {
    practitioner: overlapping.filter(a => a.practitionerId === q.practitionerId),
    room: overlapping.filter(a => a.roomId === q.roomId),
    client: q.clientId ? overlapping.filter(a => a.clientId === q.clientId) : [],
  }
}
export const hasClash = (c: Clashes) => c.practitioner.length + c.room.length + c.client.length > 0

export function clashLines(s: DemoState, c: Clashes, practitionerId: string, roomId: string): string[] {
  const lines: string[] = []
  const nameOf = (a: Appointment) => clientOf(s, a)?.name ?? 'another client'
  const prac = s.users.find(u => u.id === practitionerId)?.name ?? 'The practitioner'
  const room = s.rooms.find(r => r.id === roomId)?.name ?? 'The room'
  c.practitioner.forEach(a => lines.push(`${prac} is with ${nameOf(a)} ${hm(a.start)}–${hm(a.end)}.`))
  c.room.filter(a => !c.practitioner.includes(a)).forEach(a => lines.push(`${room} is booked for ${nameOf(a)} ${hm(a.start)}–${hm(a.end)}.`))
  c.client.filter(a => !c.practitioner.includes(a) && !c.room.includes(a)).forEach(a => lines.push(`${nameOf(a)} already has an appointment ${hm(a.start)}–${hm(a.end)}.`))
  return lines
}

// ---- age policy ----------------------------------------------------------------------------------

export function ageInYears(dob: string, at = Date.now()): number | null {
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date(at)
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1
  return age
}

export interface AgeCheck { blocked: boolean; title: string; detail: string; unverified: boolean }

/**
 * Under-18s can never be booked. A client who is not age-verified and either has an under-18 exit on any
 * episode or a date of birth under 18 is blocked. A known date of birth below a procedure's minimum age
 * (e.g. 21 for FUE) is also blocked. Neither can be overridden from the calendar.
 */
export function ageCheck(s: DemoState, client: Client, procedureId?: string): AgeCheck {
  const age = client.dateOfBirth ? ageInYears(client.dateOfBirth) : null
  const under18Exit = s.episodes.find(e => e.clientId === client.id && e.exit === 'under18')
  if (!client.ageVerified && (under18Exit || (age != null && age < 18))) {
    return {
      blocked: true,
      unverified: true,
      title: 'Booking blocked: client may be under 18',
      detail: under18Exit
        ? `${client.name} was marked under 18${under18Exit.exitReason ? ` (“${under18Exit.exitReason}”)` : ''}. Northlight only treats clients aged 18 and over, so no appointment can be booked, and this cannot be overridden.`
        : `${client.name}'s date of birth makes them ${age}. Northlight only treats clients aged 18 and over, so no appointment can be booked, and this cannot be overridden.`,
    }
  }
  const proc = procOf(s, procedureId)
  if (proc && age != null && age < proc.minAge) {
    return {
      blocked: true,
      unverified: !client.ageVerified,
      title: `${proc.name} needs clients aged ${proc.minAge}+`,
      detail: `${client.name} is ${age}. This treatment cannot be booked until they reach ${proc.minAge}. This cannot be overridden.`,
    }
  }
  return { blocked: false, unverified: !client.ageVerified, title: '', detail: '' }
}

// ---- layout ------------------------------------------------------------------------------------

/** Side-by-side lanes for overlapping appointments in one column. */
export function layoutLanes(list: Appointment[]): Map<string, { lane: number; lanes: number }> {
  const out = new Map<string, { lane: number; lanes: number }>()
  const sorted = [...list].sort((a, b) => ms(a.start) - ms(b.start) || ms(b.end) - ms(a.end))
  let cluster: Appointment[] = []
  let laneEnds: number[] = []
  let clusterEnd = -Infinity
  const flush = () => {
    cluster.forEach(a => {
      const v = out.get(a.id)!
      out.set(a.id, { lane: v.lane, lanes: laneEnds.length })
    })
    cluster = []
    laneEnds = []
    clusterEnd = -Infinity
  }
  for (const a of sorted) {
    const s = ms(a.start), e = ms(a.end)
    if (s >= clusterEnd && cluster.length) flush()
    let lane = laneEnds.findIndex(end => end <= s)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(e)
    } else laneEnds[lane] = e
    out.set(a.id, { lane, lanes: 1 })
    cluster.push(a)
    clusterEnd = Math.max(clusterEnd, e)
  }
  flush()
  return out
}
