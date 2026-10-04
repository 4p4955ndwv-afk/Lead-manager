// Shared logic for the Tasks & calls workspace: labels, grouping, booking slots, message templates.
import { useEffect, useState } from 'react'
import type { CallOutcome, Client, Conversation, DemoState, Task, TaskType, User } from '../../lib/types'
import type { IconName } from '../../components/icons'
import type { Tone } from '../../components/ui'
import { HOUR, MIN, ms, sameDay } from '../../lib/time'

export type TabId = 'mine' | 'team' | 'done'
export type TypeFilter = TaskType | 'all'

export const TYPE_ORDER: TaskType[] = ['call', 'callback', 'follow_up', 'clinical_review', 'payment', 'review']

export const TYPE_META: Record<TaskType, { label: string; plural: string; icon: IconName; tone: Tone }> = {
  call: { label: 'Lead call', plural: 'Calls', icon: 'phone', tone: 'warn' },
  callback: { label: 'Callback', plural: 'Callbacks', icon: 'history', tone: 'info' },
  follow_up: { label: 'Follow-up', plural: 'Follow-ups', icon: 'refresh', tone: 'team' },
  clinical_review: { label: 'Clinical review', plural: 'Clinical reviews', icon: 'shield', tone: 'accent' },
  payment: { label: 'Payment', plural: 'Payments', icon: 'card', tone: 'info' },
  review: { label: 'Review request', plural: 'Reviews', icon: 'star', tone: 'ok' },
}

export const OUTCOME_META: Record<CallOutcome, { label: string; tone: Tone; icon: IconName }> = {
  booked: { label: 'Booked', tone: 'ok', icon: 'calendar' },
  no_answer: { label: 'No answer', tone: 'warn', icon: 'phone' },
  call_back: { label: 'Call back', tone: 'info', icon: 'history' },
  not_interested: { label: 'Not interested', tone: 'neutral', icon: 'x' },
  wrong_number: { label: 'Wrong number', tone: 'danger', icon: 'alert' },
  thinking: { label: 'Thinking about it', tone: 'team', icon: 'clock' },
}

export const PRIORITY_META: Record<Task['priority'], { label: string; tone: Tone }> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  high: { label: 'High', tone: 'warn' },
  normal: { label: 'Normal', tone: 'neutral' },
}

export type GroupId = 'overdue' | 'hour' | 'today' | 'upcoming'
export const GROUPS: { id: GroupId; label: string }[] = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'hour', label: 'Due within the hour' },
  { id: 'today', label: 'Later today' },
  { id: 'upcoming', label: 'Upcoming' },
]

export function groupOf(t: Task, now: number): GroupId {
  const due = ms(t.dueAt)
  if (due < now) return 'overdue'
  if (due - now <= HOUR) return 'hour'
  if (sameDay(due, now)) return 'today'
  return 'upcoming'
}

const PRIORITY_RANK: Record<Task['priority'], number> = { urgent: 0, high: 1, normal: 2 }
export function byUrgency(a: Task, b: Task): number {
  return ms(a.dueAt) - ms(b.dueAt) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
}

/** Calls, callbacks and follow-ups are worked by phone and get the call flow. */
export const isCallType = (t: TaskType) => t === 'call' || t === 'callback' || t === 'follow_up'

/** Owners and managers see the team view, reassign tasks and act on anyone's task. */
export function isManager(me: User, can: (p: 'pipeline.override') => boolean): boolean {
  return can('pipeline.override') || me.role === 'owner' || me.role === 'manager'
}

/** The call deadline was missed and nobody has called yet (a logged attempt ends the SLA). */
export const isEscalated = (t: Task) => t.status === 'open' && t.escalationLevel > 0 && !!t.slaMinutes

/** Escalated tasks land in the manager's (level 1+) or owner's (level 2) own list too. */
export function escalatedTo(me: User, t: Task): boolean {
  if (t.assignedTo === me.id || !isEscalated(t)) return false
  if (me.role === 'manager') return t.escalationLevel >= 1
  if (me.role === 'owner') return t.escalationLevel === 2
  return false
}

export function inMine(me: User, t: Task): boolean {
  return t.assignedTo === me.id || escalatedTo(me, t)
}

/** When a task was closed, from the audit trail (falls back to the last attempt). */
export function doneAtMap(state: DemoState): Map<string, string> {
  const out = new Map<string, string>()
  for (const a of state.audit) {
    if (a.target.type !== 'task' || out.has(a.target.id)) continue
    if (a.action === 'call.logged' || a.action === 'task.done') out.set(a.target.id, a.at)
  }
  for (const t of state.tasks) {
    if (t.status !== 'open' && !out.has(t.id)) out.set(t.id, t.attempts[t.attempts.length - 1]?.at ?? t.dueAt)
  }
  return out
}

export function latestConversation(state: DemoState, clientId: string): Conversation | undefined {
  return state.conversations.filter(c => c.clientId === clientId).sort((a, b) => ms(b.lastMessageAt) - ms(a.lastMessageAt))[0]
}

export const LANGUAGE_NAME: Record<string, string> = {
  en: 'English', es: 'Spanish', ar: 'Arabic', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', pl: 'Polish', ur: 'Urdu', hi: 'Hindi', tr: 'Turkish', ro: 'Romanian',
}
export const languageName = (code: string | undefined) => (code ? LANGUAGE_NAME[code] ?? code.toUpperCase() : 'English')

/** Masks phone-like digit runs inside free text (DMs often contain the number). */
export function maskPhonesInText(text: string, visible: boolean): string {
  if (visible) return text
  return text.replace(/(\+?\d[\d\s().-]{7,}\d)/g, m => {
    const digits = m.replace(/\D/g, '')
    return digits.length >= 9 ? `${m.slice(0, 3)} •••• ••${digits.slice(-4)}` : m
  })
}

/** Splits the AI brief into readable lines and pulls out the "Goal:" sentence. */
export function briefLines(brief: string): { lines: string[]; goal?: string } {
  const parts = brief.split(/(?<=[.!?])\s+(?=[A-Z¿¡])/).map(s => s.trim()).filter(Boolean)
  const goalIdx = parts.findIndex(p => /^goal:/i.test(p))
  const goal = goalIdx >= 0 ? parts[goalIdx].replace(/^goal:\s*/i, '') : undefined
  return { lines: parts.filter((_, i) => i !== goalIdx), goal }
}

export const firstName = (name: string | undefined) => (name ?? '').replace(/^Dr\.? /, '').split(/\s+/)[0] || 'there'

// ---- booking -----------------------------------------------------------------------------------

export const CONSULT_MIN = 30

export function dayStarts(now: number, count = 7): number[] {
  const out: number[] = []
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    out.push(x.getTime())
  }
  return out
}

export interface Slot { start: number; taken: boolean; past: boolean }

/** 30-minute consultation slots inside business hours, marking the practitioner's existing appointments. */
export function daySlots(state: DemoState, practitionerId: string, dayStart: number, now: number): { open: boolean; slots: Slot[] } {
  const bh = state.ai.businessHours
  const day = new Date(dayStart)
  if (!bh.days.includes(day.getDay())) return { open: false, slots: [] }
  const [sh, sm] = bh.start.split(':').map(Number)
  const [eh, em] = bh.end.split(':').map(Number)
  const open = new Date(dayStart).setHours(sh, sm || 0, 0, 0)
  const close = new Date(dayStart).setHours(eh, em || 0, 0, 0)
  const appts = state.appointments.filter(a => a.practitionerId === practitionerId && a.status !== 'cancelled' && sameDay(a.start, dayStart))
  const slots: Slot[] = []
  for (let t = open; t + CONSULT_MIN * MIN <= close; t += CONSULT_MIN * MIN) {
    const end = t + CONSULT_MIN * MIN
    slots.push({ start: t, taken: appts.some(a => ms(a.start) < end && ms(a.end) > t), past: t < now + 30 * MIN })
  }
  return { open: true, slots }
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(t: number): string {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function fromLocalInput(v: string): number {
  const t = new Date(v).getTime()
  return Number.isFinite(t) ? t : NaN
}

export function tomorrowAt(now: number, hh: number, mm = 0): number {
  const d = new Date(now)
  d.setDate(d.getDate() + 1)
  d.setHours(hh, mm, 0, 0)
  return d.getTime()
}

export function dayLabel(t: number, now: number): { top: string; bottom: string } {
  const d = new Date(t)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const top = sameDay(t, now) ? 'Today' : sameDay(t, tomorrow.getTime()) ? 'Tomorrow' : d.toLocaleDateString(undefined, { weekday: 'short' })
  return { top, bottom: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) }
}

export function weekdayTime(t: number): string {
  return new Date(t).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ---- messages ----------------------------------------------------------------------------------

export const PUBLIC_NUMBER = '020 7946 0321'

/** The approved "missed call" WhatsApp template, in the client's language when we have one. */
export function missedCallTemplate(client: Client, sender: string, org: string): { text: string; language: string; translated: boolean } {
  const first = firstName(client.name)
  const s = firstName(sender)
  switch (client.language) {
    case 'es':
      return { language: 'Spanish', translated: true, text: `Hola ${first}, soy ${s} de ${org}. Te hemos llamado por tu consulta gratuita y no hemos podido hablar contigo. ¿Cuándo te viene bien que te llamemos? También puedes responder aquí y buscamos una hora.` }
    case 'fr':
      return { language: 'French', translated: true, text: `Bonjour ${first}, c'est ${s} de ${org}. Nous avons essayé de vous appeler au sujet de votre consultation gratuite. Quand pouvons-nous vous rappeler ? Vous pouvez aussi répondre ici.` }
    case 'ar':
      return { language: 'Arabic', translated: true, text: `مرحباً ${first}، معك ${s} من ${org}. حاولنا الاتصال بك بخصوص استشارتك المجانية ولم نتمكن من الوصول إليك. متى يناسبك أن نتصل بك؟ يمكنك أيضاً الرد هنا.` }
    default:
      return { language: 'English', translated: client.language === 'en', text: `Hi ${first}, it's ${s} from ${org}. Sorry we missed you! We tried to call about your free consultation. When's a good time to call? You can also reply here and we'll find a time that suits you.` }
  }
}

export function reviewRequestText(client: Client, org: string): string {
  return `Hi ${firstName(client.name)}, it was lovely to see you at ${org}. If you're happy with your results, would you mind leaving us a quick review? It takes a minute and really helps other people find us: northlight.example/review. Thank you!`
}

export function paymentReminderText(client: Client, amount: string, due: string, org: string): string {
  return `Hi ${firstName(client.name)}, a quick reminder from ${org}: ${amount} was due on ${due}. You can pay with the secure link we sent, or call us on ${PUBLIC_NUMBER}. Thank you!`
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the textarea fallback */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const h = () => setMatch(mq.matches)
    h()
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [query])
  return match
}

export function mmss(msElapsed: number): string {
  const s = Math.max(0, Math.floor(msElapsed / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`
}
