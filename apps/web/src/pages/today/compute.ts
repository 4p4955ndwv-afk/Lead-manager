// Selectors for the Today page. Everything is derived from the store state at render time.
import type { AiMode, Appointment, Conversation, DemoState, PageId, Payment, Role, Task, User } from '../../lib/types'
import { DAY, HOUR, MIN, money, ms, sameDay, startOfDay, timeOf } from '../../lib/time'
import { fmtDuration, fmtInt, median, plural } from '../analytics/format'

export const seesAll = (role: Role) => role === 'owner' || role === 'manager'

export const firstName = (u: User) => u.name.replace(/^Dr\.? /, '').split(/\s+/)[0]

export function greeting(now: number): string {
  const h = new Date(now).getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export const clientName = (s: DemoState, id: string) => s.clients.find(c => c.id === id)?.name ?? 'Unknown client'

export function clientChannel(s: DemoState, clientId: string) {
  return s.conversations.find(c => c.clientId === clientId)?.channel ?? s.clients.find(c => c.id === clientId)?.source.channel ?? 'phone'
}

// ---- calls ---------------------------------------------------------------------------------------

export function callQueue(s: DemoState, me: User): Task[] {
  return s.tasks
    .filter(t => t.status === 'open' && (t.type === 'call' || t.type === 'callback') && (seesAll(me.role) || t.assignedTo === me.id))
    .sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
}

// ---- chats ---------------------------------------------------------------------------------------

const RISK_ORDER = ['Possible minor', 'Complaint', 'AI paused (kill switch)', 'Clinical question', 'Low confidence']

export function needsPerson(s: DemoState, me: User, canAll: boolean): Conversation[] {
  const rank = (c: Conversation) => {
    const i = RISK_ORDER.indexOf(c.needsHumanReason ?? '')
    return i === -1 ? RISK_ORDER.length : i
  }
  return s.conversations
    .filter(c => (c.needsHuman || !!c.draft) && (canAll || c.assignedTo === me.id))
    .sort((a, b) => rank(a) - rank(b) || ms(a.lastInboundAt) - ms(b.lastInboundAt))
}

export function reasonOf(c: Conversation): string {
  if (c.needsHumanReason) return c.needsHumanReason
  return c.draft ? 'Draft ready to send' : 'Waiting for a reply'
}

export function reasonTone(reason: string): 'danger' | 'team' | 'warn' | 'info' {
  if (/minor|complaint|kill switch/i.test(reason)) return 'danger'
  if (/clinical/i.test(reason)) return 'team'
  if (/low confidence/i.test(reason)) return 'warn'
  return 'info'
}

export function lastClientText(c: Conversation): string {
  for (let i = c.messages.length - 1; i >= 0; i--) if (c.messages[i].author === 'client') return c.messages[i].text
  return c.messages[c.messages.length - 1]?.text ?? ''
}

/** Seconds from the first client message to the first reply that was actually sent (AI or staff). */
export function firstReplySec(c: Conversation): number | null {
  const first = c.messages.find(m => m.author === 'client')
  if (!first) return null
  const reply = c.messages.find(m => (m.author === 'ai' || m.author === 'human') && m.status !== 'shadow' && ms(m.at) >= ms(first.at))
  return reply ? Math.max(0, (ms(reply.at) - ms(first.at)) / 1000) : null
}

/** AI replies today: the overnight daily count plus AI messages sent in live chats today. */
export function aiRepliesToday(s: DemoState, now: number): number {
  const base = s.metrics[s.metrics.length - 1]?.aiReplies ?? 0
  let live = 0
  for (const c of s.conversations) for (const m of c.messages) if (m.author === 'ai' && m.status !== 'shadow' && sameDay(m.at, now)) live += 1
  return base + live
}

/** Median first reply today, combining the daily median (weighted by that day's DMs) with live chats started today. */
export function medianFirstReplyToday(s: DemoState, now: number): number {
  const last = s.metrics[s.metrics.length - 1]
  const samples: number[] = last ? Array(Math.max(1, last.dms)).fill(last.medianFirstReplySec) : []
  for (const c of s.conversations) {
    const first = c.messages.find(m => m.author === 'client')
    if (!first || !sameDay(first.at, now)) continue
    const v = firstReplySec(c)
    if (v != null) samples.push(v)
  }
  return median(samples)
}

// ---- appointments --------------------------------------------------------------------------------

export function todaysAppointments(s: DemoState, now: number, practitionerId?: string): Appointment[] {
  return s.appointments
    .filter(a => sameDay(a.start, now) && a.status !== 'cancelled' && (!practitionerId || a.practitionerId === practitionerId))
    .sort((a, b) => ms(a.start) - ms(b.start))
}

/** Unconfirmed appointments from an hour ago to the end of tomorrow (what the front desk chases). */
export function unconfirmedSoon(s: DemoState, now: number): Appointment[] {
  const end = startOfDay(now) + 2 * DAY
  return s.appointments.filter(a => a.status === 'unconfirmed' && ms(a.start) > now - HOUR && ms(a.start) < end).sort((a, b) => ms(a.start) - ms(b.start))
}

export const APPT_TYPE: Record<Appointment['type'], string> = { consultation: 'Consultation', session: 'Session', follow_up: 'Follow-up' }

export const STATUS_LABEL: Record<Appointment['status'], string> = {
  unconfirmed: 'Unconfirmed', confirmed: 'Confirmed', arrived: 'Arrived', completed: 'Completed', no_show: 'No-show', cancelled: 'Cancelled',
}
export const STATUS_TONE: Record<Appointment['status'], 'warn' | 'team' | 'accent' | 'ok' | 'danger' | 'neutral'> = {
  unconfirmed: 'warn', confirmed: 'team', arrived: 'accent', completed: 'ok', no_show: 'danger', cancelled: 'neutral',
}

/** "Laser hair removal · Session 5 of 6" when the plan knows the course length. */
export function procedureLine(s: DemoState, a: Appointment): string | null {
  const proc = s.procedures.find(p => p.id === a.procedureId)
  if (!proc) return null
  if (a.type !== 'session' || !a.sessionNo) return proc.name
  const item = s.plans.filter(p => p.clientId === a.clientId).flatMap(p => p.items).find(i => i.procedureId === proc.id)
  return `${proc.name} · Session ${a.sessionNo} of ${item?.sessionsTotal ?? proc.sessions}`
}

/** What the visit is for, without repeating "Session": "Laser hair removal · Session 5 of 6", "Follow-up · 6-month FUE review". */
export function apptWhat(s: DemoState, a: Appointment, withNotes = true): string {
  const proc = procedureLine(s, a)
  if (a.type === 'session' && a.sessionNo && proc) return proc
  return `${APPT_TYPE[a.type]}${proc ? ` · ${proc}` : withNotes && a.notes ? ` · ${a.notes}` : ''}`
}

// ---- payments ------------------------------------------------------------------------------------

export const isOverdue = (p: Payment, now: number) => p.status === 'overdue' || (p.status === 'due' && ms(p.dueAt) < now)

export function openPayments(s: DemoState, now: number) {
  const list = s.payments.filter(p => p.status === 'due' || p.status === 'overdue').sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  const overdue = list.filter(p => isOverdue(p, now))
  const due7 = list.filter(p => !isOverdue(p, now) && ms(p.dueAt) <= now + 7 * DAY)
  const paid30 = s.payments.filter(p => p.status === 'paid' && p.paidAt && ms(p.paidAt) >= now - 30 * DAY)
  const sum = (xs: Payment[]) => xs.reduce((a, p) => a + p.amount, 0)
  return { list, overdue, due7, paid30, overdueTotal: sum(overdue), due7Total: sum(due7), paid30Total: sum(paid30), openTotal: sum(list) }
}

export const PAYMENT_KIND: Record<Payment['kind'], string> = { deposit: 'Deposit', instalment: 'Instalment', balance: 'Balance', refund: 'Refund' }

// ---- AI ------------------------------------------------------------------------------------------

export const MODE_LABEL: Record<AiMode, string> = { shadow: 'Shadow', copilot: 'Co-pilot', autopilot: 'Autopilot' }
export const MODE_HINT: Record<AiMode, string> = { shadow: 'AI drafts only; staff write every reply', copilot: 'AI drafts; staff tap send', autopilot: 'AI replies on its own' }
export const MODE_TONE: Record<AiMode, 'accent' | 'team' | 'neutral'> = { autopilot: 'accent', copilot: 'team', shadow: 'neutral' }

function modeSentence(s: DemoState): string {
  if (s.ai.killSwitch) return 'AI replies are paused for everyone, so staff are answering every DM.'
  const groups = new Map<AiMode, string[]>()
  const names: Record<string, string> = { instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp' }
  for (const [ch, mode] of Object.entries(s.ai.mode) as Array<[string, AiMode]>) groups.set(mode, [...(groups.get(mode) ?? []), names[ch]])
  const parts = [...groups.entries()].map(([mode, chs]) => `${MODE_LABEL[mode].toLowerCase()} for ${chs.join(' and ')}`)
  return `AI is on ${parts.join(', ')}.`
}

// ---- headline + daily brief ----------------------------------------------------------------------

export interface Headline { text: string; tone: 'danger' | 'warn' | 'ok' | 'info'; link?: { page: PageId; id?: string; label: string } }

export function headline(s: DemoState, me: User, now: number, can: (p: 'chats.view_all' | 'payments.view') => boolean): Headline {
  const role = me.role
  if (role === 'finance') {
    const p = openPayments(s, now)
    if (p.overdue.length) return { tone: 'danger', text: `${money(p.overdueTotal, s.settings.currency)} is overdue across ${plural(p.overdue.length, 'payment')}. Start with ${clientName(s, p.overdue[0].clientId)}.`, link: { page: 'client', id: p.overdue[0].clientId, label: 'Open client' } }
    if (p.due7.length) return { tone: 'info', text: `${plural(p.due7.length, 'payment')} worth ${money(p.due7Total, s.settings.currency)} ${p.due7.length === 1 ? 'falls' : 'fall'} due this week.` }
    return { tone: 'ok', text: 'Nothing is overdue. Payments due this week will show here.' }
  }
  if (role === 'clinician') {
    const q = s.tasks.filter(t => t.status === 'open' && t.type === 'clinical_review' && t.assignedTo === me.id).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
    if (q.length) return { tone: 'warn', text: `${clientName(s, q[0].clientId)} is waiting for a clinician to answer a clinical question.`, link: { page: 'tasks', id: q[0].id, label: 'Open question' } }
    const next = todaysAppointments(s, now, me.id).find(a => ms(a.start) > now || a.status === 'arrived')
    if (next) return { tone: 'info', text: next.status === 'arrived' ? `${clientName(s, next.clientId)} has arrived for ${timeOf(next.start)}.` : `Next patient: ${clientName(s, next.clientId)} at ${timeOf(next.start)}.`, link: { page: 'client', id: next.clientId, label: 'Open record' } }
    return { tone: 'ok', text: 'No more patients today and no open clinical questions.' }
  }
  if (role === 'frontdesk') {
    const today = todaysAppointments(s, now)
    const arrived = today.filter(a => a.status === 'arrived')
    if (arrived.length) return { tone: 'info', text: `${clientName(s, arrived[0].clientId)} is in reception for ${timeOf(arrived[0].start)}. Let ${s.users.find(u => u.id === arrived[0].practitionerId)?.name ?? 'the clinician'} know.` }
    const unconf = unconfirmedSoon(s, now)
    if (unconf.length) return { tone: 'warn', text: `${plural(unconf.length, 'appointment')} today and tomorrow ${unconf.length === 1 ? 'is' : 'are'} still unconfirmed.` }
    return { tone: 'ok', text: 'Everyone due in today is confirmed.' }
  }
  if (role === 'marketing') {
    const m = s.metrics
    const last7 = m.slice(-7).reduce((a, d) => a + d.dms, 0)
    const prev7 = m.slice(-14, -7).reduce((a, d) => a + d.dms, 0)
    if (!last7) return { tone: 'info', text: 'No DMs recorded in the last 7 days yet. Daily numbers are added overnight.', link: { page: 'analytics', label: 'Open analytics' } }
    if (!prev7) return { tone: 'ok', text: `${fmtInt(last7)} DMs in the last 7 days.`, link: { page: 'analytics', label: 'Open analytics' } }
    const change = (last7 - prev7) / prev7
    return { tone: change >= 0 ? 'ok' : 'warn', text: `${fmtInt(last7)} DMs in the last 7 days, ${change >= 0 ? 'up' : 'down'} ${Math.abs(Math.round(change * 100))}% on the week before.`, link: { page: 'analytics', label: 'Open analytics' } }
  }
  // owner, manager, coordinator
  const calls = callQueue(s, me)
  const overdue = calls.filter(t => ms(t.dueAt) < now)
  if (overdue.length) {
    const t = overdue[0]
    const toYou = (t.escalationLevel === 1 && role === 'manager') || (t.escalationLevel === 2 && role === 'owner')
    return { tone: 'danger', text: `${clientName(s, t.clientId)} is ${Math.max(1, Math.round((now - ms(t.dueAt)) / MIN))} min past the call deadline${seesAll(role) && t.assignedTo !== me.id ? ` (${s.users.find(u => u.id === t.assignedTo)?.name ?? 'unassigned'})` : ''}.${toYou ? ' It is escalated to you.' : ''} ${t.assignedTo === me.id ? 'Call first.' : 'Call or reassign now.'}`, link: { page: 'tasks', id: t.id, label: 'Open call' } }
  }
  const soon = calls.find(t => ms(t.dueAt) - now < HOUR)
  if (soon) return { tone: 'warn', text: `${clientName(s, soon.clientId)} needs a call within ${Math.max(1, Math.round((ms(soon.dueAt) - now) / MIN))} min.`, link: { page: 'tasks', id: soon.id, label: 'Open call' } }
  const chats = needsPerson(s, me, can('chats.view_all'))
  if (chats.length) return { tone: 'info', text: `${plural(chats.length, 'chat')} need${chats.length === 1 ? 's' : ''} a person. Start with ${clientName(s, chats[0].clientId)} (${reasonOf(chats[0]).toLowerCase()}).`, link: { page: 'inbox', id: chats[0].id, label: 'Open chat' } }
  return { tone: 'ok', text: 'Nothing urgent right now. New leads appear here the moment someone shares a number.' }
}

export function dailyBrief(s: DemoState, me: User, now: number, can: (p: 'payments.view' | 'clinical.view') => boolean): string {
  const y = s.metrics[s.metrics.length - 2]
  const parts: string[] = []
  if (y) {
    parts.push(`Yesterday brought ${y.dms} DMs; ${y.contacts} people shared a number and ${y.booked} booked a consultation.`)
  }
  const escalated = s.tasks.filter(t => t.status === 'open' && t.escalationLevel > 0)
  const recentMisses = new Set(s.audit.filter(a => a.action === 'sla.escalated' && ms(a.at) > now - DAY).map(a => a.target.id))
  escalated.forEach(t => recentMisses.add(t.id))
  if (recentMisses.size) {
    const names = escalated.map(t => `${clientName(s, t.clientId)} (escalated to the ${t.escalationLevel === 2 ? 'owner' : 'manager'})`)
    parts.push(`${plural(recentMisses.size, 'lead call')} missed the 15-minute window${names.length ? `; still waiting: ${names.join(', ')}` : ''}.`)
  } else {
    parts.push(`Every lead call in the last 24 hours was made within 15 minutes${y ? ` (${y.callSlaMetPct}% met yesterday)` : ''}.`)
  }
  parts.push(`${modeSentence(s)}${y && !s.ai.killSwitch ? ` Yesterday's median first reply was ${fmtDuration(y.medianFirstReplySec)}.` : ''}`)
  const risky = s.conversations.filter(c => c.needsHuman && /minor|complaint|clinical/i.test(c.needsHumanReason ?? ''))
  if (risky.length) parts.push(`Waiting for a person: ${risky.map(c => `${clientName(s, c.clientId)} (${(c.needsHumanReason ?? '').toLowerCase()})`).join(', ')}.`)
  const appts = todaysAppointments(s, now)
  const left = appts.filter(a => ms(a.end) > now && a.status !== 'completed' && a.status !== 'no_show')
  if (appts.length) parts.push(`Today: ${plural(appts.length, 'appointment')}${left.length ? `, next at ${timeOf(left[0].start)} with ${clientName(s, left[0].clientId)}` : ', all finished'}.`)
  if (me.role === 'finance' && can('payments.view')) {
    const p = openPayments(s, now)
    if (p.overdue.length) parts.push(`${money(p.overdueTotal, s.settings.currency)} is overdue.`)
  }
  return parts.join(' ')
}

export function claudePrompt(me: User): string {
  const focus: Record<Role, string> = {
    owner: 'the whole clinic: leads at risk, team SLA, AI performance and revenue',
    manager: 'the team: which calls are at risk of missing the 15-minute window, who is overloaded, and any escalations',
    coordinator: 'my calls and chats: who to call first and what to say',
    frontdesk: 'arrivals, unconfirmed appointments and deposits due today',
    clinician: 'my clinic list and any open clinical questions',
    finance: 'payments due and overdue, and what to chase first',
    marketing: 'which posts and videos are bringing leads that book',
  }
  return `Brief me on today at Northlight Clinic. Focus on ${focus[me.role]}. What changed since yesterday and what should I do first?`
}
