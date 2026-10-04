// Shared helpers for the client directory and client record. Pure functions over the demo state.
import type {
  Appointment, AppointmentStatus, AuditEntry, CallOutcome, Channel, Client, DemoState, Document, Episode, Payment, Stage, TreatmentPlan,
} from '../../lib/types'
import { CHANNEL_LABEL, STAGES } from '../../lib/types'
import { ms } from '../../lib/time'
import type { Tone } from '../../components/ui'
import type { IconName } from '../../components/icons'

export const LANG_LABEL: Record<string, string> = {
  en: 'English', ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', pl: 'Polish',
  ur: 'Urdu', hi: 'Hindi', zh: 'Chinese', ja: 'Japanese', tr: 'Turkish', ru: 'Russian', ro: 'Romanian',
}
export const langLabel = (code: string) => LANG_LABEL[code] ?? code.toUpperCase()

export const episodesOf = (s: DemoState, clientId: string): Episode[] =>
  s.episodes.filter(e => e.clientId === clientId).sort((a, b) => a.number - b.number)

export const latestEpisode = (s: DemoState, clientId: string): Episode | undefined => {
  const eps = episodesOf(s, clientId)
  return eps[eps.length - 1]
}

export const procName = (s: DemoState, id: string | undefined) => s.procedures.find(p => p.id === id)?.name ?? 'Treatment'

export const planSubtotal = (p: TreatmentPlan) => p.items.reduce((t, i) => t + i.price, 0)
export const planTotal = (p: TreatmentPlan) => Math.max(0, planSubtotal(p) - p.discount)

export const stageIndex = (st: Stage) => STAGES.indexOf(st)

/** An episode is finished or off the main path, so a returning client can start a new one. */
export const isClosed = (ep: Episode) => !!ep.exit || ep.stage === 'alumni'

export const yearOf = (isoStr: string) => new Date(isoStr).getFullYear()

/** "26 Jul 2026" */
export const dayYear = (isoStr: string) => new Date(isoStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function initials(name: string): string {
  return name.split(/\s+/).map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase()
}

export function slug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Every record id that belongs to this person, so audit entries about them can be found. */
export function relatedIds(s: DemoState, clientId: string): Set<string> {
  const ids = new Set<string>([clientId])
  // records merged into this one keep their old client id in the audit log
  s.clients.find(c => c.id === clientId)?.mergedFrom?.forEach(id => ids.add(id))
  s.episodes.forEach(e => e.clientId === clientId && ids.add(e.id))
  s.conversations.forEach(c => c.clientId === clientId && ids.add(c.id))
  s.tasks.forEach(t => t.clientId === clientId && ids.add(t.id))
  s.appointments.forEach(a => a.clientId === clientId && ids.add(a.id))
  s.plans.forEach(p => p.clientId === clientId && ids.add(p.id))
  s.payments.forEach(p => p.clientId === clientId && ids.add(p.id))
  return ids
}

export function auditFor(s: DemoState, clientId: string): AuditEntry[] {
  const ids = relatedIds(s, clientId)
  return s.audit.filter(a => ids.has(a.target.id)).sort((a, b) => ms(b.at) - ms(a.at))
}

/** Most recent thing that happened with this person (message, stage move, call, visit, payment, note). */
export function lastActivity(s: DemoState, clientId: string, now = Date.now()): string | undefined {
  let best = 0
  const bump = (t: string | undefined) => {
    const v = ms(t)
    if (!Number.isNaN(v) && v <= now && v > best) best = v
  }
  const c = s.clients.find(x => x.id === clientId)
  bump(c?.createdAt)
  s.conversations.forEach(cv => cv.clientId === clientId && bump(cv.lastMessageAt))
  s.episodes.forEach(e => e.clientId === clientId && e.history.forEach(h => bump(h.at)))
  s.tasks.forEach(t => t.clientId === clientId && t.attempts.forEach(a => bump(a.at)))
  s.appointments.forEach(a => a.clientId === clientId && bump(a.start))
  s.payments.forEach(p => p.clientId === clientId && bump(p.paidAt))
  s.notes.forEach(n => n.clientId === clientId && bump(n.at))
  s.documents.forEach(d => d.clientId === clientId && bump(d.at))
  return best ? new Date(best).toISOString() : undefined
}

// ---- labels and tones -----------------------------------------------------------------------------

export const APPT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  unconfirmed: 'Unconfirmed', confirmed: 'Confirmed', arrived: 'Arrived', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled',
}
export const APPT_STATUS_TONE: Record<AppointmentStatus, Tone> = {
  unconfirmed: 'warn', confirmed: 'team', arrived: 'accent', completed: 'ok', no_show: 'danger', cancelled: 'neutral',
}

export const PAY_STATUS_LABEL: Record<Payment['status'], string> = { paid: 'Paid', due: 'Due', overdue: 'Overdue', refunded: 'Refunded' }
export const PAY_STATUS_TONE: Record<Payment['status'], Tone> = { paid: 'ok', due: 'warn', overdue: 'danger', refunded: 'neutral' }
export const PAY_KIND_LABEL: Record<Payment['kind'], string> = { deposit: 'Deposit', instalment: 'Instalment', balance: 'Balance', refund: 'Refund' }
export const PAY_METHOD_LABEL: Record<NonNullable<Payment['method']>, string> = {
  card_link: 'Card link', card_in_clinic: 'Card in clinic', bank_transfer: 'Bank transfer', cash: 'Cash',
}

export const PLAN_STATUS_LABEL: Record<TreatmentPlan['status'], string> = {
  draft: 'Draft', proposed: 'Proposed to client', accepted: 'Accepted', declined: 'Declined', completed: 'Completed',
}
export const PLAN_STATUS_TONE: Record<TreatmentPlan['status'], Tone> = {
  draft: 'neutral', proposed: 'warn', accepted: 'accent', declined: 'danger', completed: 'ok',
}

export const CALL_OUTCOME_LABEL: Record<CallOutcome, string> = {
  booked: 'Booked a consultation', no_answer: 'No answer', call_back: 'Asked us to call back', not_interested: 'Not interested',
  wrong_number: 'Wrong number', thinking: 'Thinking about it',
}

export const DOC_KIND_LABEL: Record<Document['kind'], string> = {
  consent_form: 'Consent form', photo: 'Clinical photos', quote: 'Quote', invoice: 'Invoice', id_check: 'ID check',
}
export const DOC_KIND_ICON: Record<Document['kind'], IconName> = {
  consent_form: 'shield', photo: 'image', quote: 'file', invoice: 'card', id_check: 'key',
}

/** Channel name for use mid-sentence: "came in via walk-in", but brand names keep their capitals ("via WhatsApp"). */
export const channelPhrase = (ch: Channel) => (ch === 'phone' ? 'a phone call' : ch === 'walkin' || ch === 'referral' ? CHANNEL_LABEL[ch].toLowerCase() : CHANNEL_LABEL[ch])

export const MANUAL_CHANNELS: { id: Extract<Channel, 'phone' | 'walkin' | 'referral' | 'whatsapp'>; label: string }[] = [
  { id: 'phone', label: 'Phone call' },
  { id: 'walkin', label: 'Walk-in' },
  { id: 'referral', label: 'Referral' },
  { id: 'whatsapp', label: 'WhatsApp' },
]

export function apptTitle(s: DemoState, a: Appointment): string {
  const proc = a.procedureId ? procName(s, a.procedureId) : undefined
  if (a.type === 'consultation') return proc ? `Consultation · ${proc}` : 'Consultation'
  if (a.type === 'session') {
    const item = s.plans.filter(p => p.episodeId === a.episodeId).flatMap(p => p.items).find(i => i.procedureId === a.procedureId)
    const of = item ? ` of ${item.sessionsTotal}` : ''
    return `${proc ?? 'Treatment'} · Session ${a.sessionNo ?? '?'}${of}`
  }
  return a.notes ? `Follow-up · ${a.notes}` : 'Follow-up'
}

// ---- input helpers --------------------------------------------------------------------------------

/** Normalises a UK or international number typed by staff to E.164, or returns null when it cannot be a phone number. */
export function toE164(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  let d = raw.replace(/[^\d+]/g, '')
  if (d.startsWith('00')) d = '+' + d.slice(2)
  if (!d.startsWith('+')) d = d.startsWith('0') ? '+44' + d.slice(1) : '+' + d
  const digits = d.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return null
  return d
}

/** Value for <input type="datetime-local"> in local time. */
export function localInput(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function dateInput(t: number): string {
  return localInput(t).slice(0, 10)
}

/** Next working-hours slot at least `minLeadMs` away, rounded to the half hour. */
export function nextSlot(from: number, minLeadMs = 0): number {
  const d = new Date(from + minLeadMs)
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60)
  if (d.getHours() < 9) d.setHours(9, 0)
  if (d.getHours() >= 18) { d.setDate(d.getDate() + 1); d.setHours(10, 0) }
  if (d.getDay() === 0) { d.setDate(d.getDate() + 1); d.setHours(10, 0) }
  return d.getTime()
}

export function handlesOf(c: Client): Array<{ channel: 'instagram' | 'tiktok'; handle: string }> {
  const out: Array<{ channel: 'instagram' | 'tiktok'; handle: string }> = []
  if (c.handles.instagram) out.push({ channel: 'instagram', handle: c.handles.instagram })
  if (c.handles.tiktok) out.push({ channel: 'tiktok', handle: c.handles.tiktok })
  return out
}

export function handleUrl(channel: 'instagram' | 'tiktok', handle: string): string {
  const h = handle.replace(/^@/, '')
  return channel === 'instagram' ? `https://instagram.com/${h}` : `https://www.tiktok.com/@${h}`
}

export const scoreTone = (n: number): Tone => (n >= 80 ? 'ok' : n >= 55 ? 'accent' : n >= 30 ? 'warn' : 'neutral')

/** Why nothing may be booked for this person right now, or null when booking is allowed. */
export function bookingBlock(c: Client, ep?: Episode): string | null {
  if (c.doNotContact) return 'Do not contact is on'
  if (ep?.exit === 'under18') return 'Under 18: booking is blocked'
  if (ep?.exit === 'spam') return 'Marked as spam'
  return null
}

/** A returning client may start a new episode once the last one is finished or off the path, unless it ended for a blocking reason. */
export function canRestart(c: Client, ep?: Episode): boolean {
  if (!ep || !isClosed(ep)) return false
  if (ep.exit === 'under18' || ep.exit === 'spam') return false
  if (ep.exit === 'dnc' && c.doNotContact) return false
  return true
}
