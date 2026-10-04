// What the asking person may see, as a compact snapshot for Claude. In production the MCP server applies the same
// rules on every tool call; here the panel builds the snapshot once per question.
import type { Appointment, Client, Conversation, DemoState, Episode, Permission, Task, User } from '../../lib/types'
import { CHANNEL_LABEL, EXIT_LABEL, ROLE_LABEL, STAGES, STAGE_LABEL } from '../../lib/types'
import { canOpen, maskPhone } from '../../lib/permissions'
import { activeEpisode, userName } from '../../lib/store'
import { DAY, HOUR, MIN, ago, iso, money, ms, sameDay, shortDate, startOfDay, timeOf } from '../../lib/time'
import { maskDigits } from '../ai/compute'

export interface Ctx {
  s: DemoState
  me: User
  can: (p: Permission) => boolean
  now: number
}

export const flags = (c: Ctx) => ({
  phones: c.can('clients.view_phone'),
  clinical: c.can('clinical.view'),
  payments: c.can('payments.view'),
  revenue: c.can('analytics.revenue'),
  allChats: c.can('chats.view_all'),
  assignedChats: c.can('chats.view_assigned'),
})

export const cur = (c: Ctx) => c.s.settings.currency
export const fmtMoney = (c: Ctx, n: number) => money(n, cur(c))
export const clientById = (c: Ctx, id: string) => c.s.clients.find(x => x.id === id)
export const nameOf = (c: Ctx, id: string) => clientById(c, id)?.name ?? 'Unknown client'
export const phoneOf = (c: Ctx, cl: Client | undefined) => maskPhone(cl?.phone, flags(c).phones)
/** Free text with phone numbers masked unless this person may see them. */
export const safeText = (c: Ctx, t: string) => maskDigits(t, flags(c).phones)
export const firstName = (name: string) => name.replace(/^Dr\.? /, '').split(/\s+/)[0]

/** "in 6 min", "18 min overdue", "tomorrow 10:00" */
export function dueText(isoStr: string, now: number): string {
  const d = ms(isoStr) - now
  if (d < 0) {
    const a = -d
    return a < HOUR ? `${Math.max(1, Math.round(a / MIN))} min overdue` : a < DAY ? `${Math.round(a / HOUR)} h overdue` : `${Math.round(a / DAY)} ${Math.round(a / DAY) === 1 ? 'day' : 'days'} overdue`
  }
  if (d < HOUR) return `due in ${Math.max(1, Math.round(d / MIN))} min`
  if (sameDay(isoStr, now)) return `due today ${timeOf(isoStr)}`
  if (sameDay(isoStr, now + DAY)) return `due tomorrow ${timeOf(isoStr)}`
  return `due ${shortDate(isoStr)} ${timeOf(isoStr)}`
}

export function stageText(ep: Episode | undefined): string {
  if (!ep) return 'No journey yet'
  return ep.exit ? `${EXIT_LABEL[ep.exit]} (was at ${STAGE_LABEL[ep.stage]})` : STAGE_LABEL[ep.stage]
}

/** Owners, managers and coordinators share the lead queue; everyone else sees their own tasks. */
export const teamScope = (c: Ctx) => c.me.role === 'owner' || c.me.role === 'manager' || c.me.role === 'coordinator'

export function visibleTasks(c: Ctx): Task[] {
  if (!canOpen(c.me, 'tasks')) return []
  const team = teamScope(c)
  return c.s.tasks.filter(t => t.status === 'open' && (team || t.assignedTo === c.me.id)).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
}

export function visibleChats(c: Ctx): Conversation[] {
  const f = flags(c)
  return c.s.conversations.filter(v => f.allChats || (f.assignedChats && v.assignedTo === c.me.id))
}

export function chatsNeedingPerson(c: Ctx): Conversation[] {
  return visibleChats(c).filter(v => v.needsHuman || !!v.draft).sort((a, b) => ms(a.lastInboundAt) - ms(b.lastInboundAt))
}

export function todaysAppointments(c: Ctx): Appointment[] {
  return c.s.appointments.filter(a => sameDay(a.start, c.now) && a.status !== 'cancelled').sort((a, b) => ms(a.start) - ms(b.start))
}

export const procName = (c: Ctx, id: string | undefined) => c.s.procedures.find(p => p.id === id)?.name ?? 'Appointment'

export interface SessionDue { clientId: string; procedure: string; sessionNo: number; total: number; at: string; booked: boolean; status?: Appointment['status']; practitionerId?: string; overdue: boolean }

/** Booked sessions in the window, plus course sessions that are due by then but not booked yet. */
export function upcomingSessions(c: Ctx, days = 7): SessionDue[] {
  const { s, now } = c
  const until = now + days * DAY
  const out: SessionDue[] = []
  for (const a of s.appointments) {
    if (a.type !== 'session' || ['cancelled', 'no_show', 'completed'].includes(a.status)) continue
    if (ms(a.start) < now - 2 * HOUR || ms(a.start) > until) continue
    const item = s.plans.filter(p => p.clientId === a.clientId).flatMap(p => p.items).find(i => i.procedureId === a.procedureId)
    out.push({ clientId: a.clientId, procedure: procName(c, a.procedureId), sessionNo: a.sessionNo ?? 1, total: item?.sessionsTotal ?? 1, at: a.start, booked: true, status: a.status, practitionerId: a.practitionerId, overdue: false })
  }
  for (const p of s.plans) {
    if (p.status !== 'accepted') continue
    for (const it of p.items) {
      const next = it.sessions.find(x => x.status === 'due')
      if (!next || it.sessions.some(x => x.status === 'booked')) continue
      if (s.appointments.some(a => a.clientId === p.clientId && a.procedureId === it.procedureId && a.type === 'session' && ms(a.start) > now && a.status !== 'cancelled')) continue
      const proc = s.procedures.find(x => x.id === it.procedureId)
      const doneDates = it.sessions.filter(x => x.status === 'done' && x.date).map(x => ms(x.date)).sort((a, b) => a - b)
      const last = doneDates[doneDates.length - 1]
      const expected = last ? last + (proc?.intervalWeeks ?? 4) * 7 * DAY : ms(it.addedAt) + 21 * DAY
      if (expected > until) continue
      out.push({ clientId: p.clientId, procedure: proc?.name ?? 'Treatment', sessionNo: next.no, total: it.sessionsTotal, at: iso(expected), booked: false, overdue: expected < startOfDay(now) })
    }
  }
  return out.sort((a, b) => ms(a.at) - ms(b.at))
}

/** The JSON Claude receives with each question. Only what this person may see. */
export function buildSnapshot(c: Ctx): string {
  const { s, me, now } = c
  const f = flags(c)
  const clientLine = (id: string) => nameOf(c, id)
  const live = s.playbooks.find(p => p.status === 'live')
  const pending = s.playbooks.find(p => p.status === 'pending')

  const tasks = visibleTasks(c).slice(0, 30).map(t => ({
    client: clientLine(t.clientId), title: t.title, type: t.type, assignedTo: userName(s, t.assignedTo), due: t.dueAt, dueText: dueText(t.dueAt, now),
    escalatedTo: t.escalationLevel === 2 ? 'owner' : t.escalationLevel === 1 ? 'manager' : undefined, priority: t.priority, callAttempts: t.attempts.length,
    lastAttempt: t.attempts.length ? `${t.attempts[t.attempts.length - 1].outcome.replace('_', ' ')}${t.attempts[t.attempts.length - 1].note ? ': ' + t.attempts[t.attempts.length - 1].note : ''}` : undefined,
    phone: phoneOf(c, clientById(c, t.clientId)), brief: t.type === 'clinical_review' && !f.clinical ? undefined : t.brief ? safeText(c, t.brief) : undefined,
  }))

  const chats = chatsNeedingPerson(c).slice(0, 20).map(v => {
    const lastIn = [...v.messages].reverse().find(m => m.author === 'client')
    return { client: clientLine(v.clientId), channel: CHANNEL_LABEL[v.channel], reason: v.needsHumanReason ?? (v.draft ? 'Draft ready to send' : 'Waiting for a reply'), lastClientMessage: lastIn ? safeText(c, lastIn.text) : undefined, waitingSince: ago(v.lastInboundAt, now), handling: v.handling, draftReady: !!v.draft }
  })

  const appts = todaysAppointments(c).map(a => ({
    time: timeOf(a.start), client: clientLine(a.clientId), type: a.type, procedure: a.procedureId ? procName(c, a.procedureId) : undefined, session: a.sessionNo,
    practitioner: userName(s, a.practitionerId), room: s.rooms.find(r => r.id === a.roomId)?.name, status: a.status, deposit: f.payments ? a.deposit : undefined, notes: a.notes ? safeText(c, a.notes) : undefined,
  }))

  const sessions = upcomingSessions(c, 14).slice(0, 20).map(x => ({ client: clientLine(x.clientId), procedure: x.procedure, session: `${x.sessionNo} of ${x.total}`, when: x.at, booked: x.booked, status: x.status, overdue: x.overdue || undefined }))

  const metrics = s.metrics.slice(-14).map(m => ({
    date: m.date, dms: m.dms, instagram: m.byChannel.instagram, tiktok: m.byChannel.tiktok, aiReplies: m.aiReplies, humanReplies: m.humanReplies, qualified: m.qualified,
    numbersShared: m.contacts, booked: m.booked, attended: m.attended, treatments: m.treatments, medianFirstReplySec: m.medianFirstReplySec, callSlaMetPct: m.callSlaMetPct,
    revenue: f.revenue ? m.revenue : undefined,
  }))

  const pipeline: Record<string, number> = {}
  for (const ep of s.episodes) {
    if (ep.endedAt && !ep.exit && ep.stage === 'alumni' && activeEpisode(s, ep.clientId)?.id !== ep.id) continue
    const k = ep.exit ? EXIT_LABEL[ep.exit] : STAGE_LABEL[ep.stage]
    pipeline[k] = (pipeline[k] ?? 0) + 1
  }

  const clients = s.clients
    .map(cl => ({ cl, ep: activeEpisode(s, cl.id) }))
    .filter(x => x.ep && (!x.ep.exit || x.ep.exit === 'nurture'))
    .sort((a, b) => STAGES.indexOf(a.ep!.stage) - STAGES.indexOf(b.ep!.stage))
    .slice(0, 60)
    .map(({ cl, ep }) => {
      const plan = s.plans.filter(p => p.clientId === cl.id && p.episodeId === ep!.id)[0]
      const next = s.appointments.filter(a => a.clientId === cl.id && ms(a.start) > now && a.status !== 'cancelled').sort((a, b) => ms(a.start) - ms(b.start))[0]
      const notes = s.notes.filter(n => n.clientId === cl.id && (!n.clinical || f.clinical)).slice(0, 2).map(n => `${shortDate(n.at)}${n.clinical ? ' (clinical)' : ''}: ${safeText(c, n.text)}`)
      return {
        name: cl.name, stage: stageText(ep), episode: ep!.number, channel: CHANNEL_LABEL[cl.source.channel], source: cl.source.detail, language: cl.language,
        owner: cl.ownerId ? userName(s, cl.ownerId) : undefined, phone: cl.phone ? phoneOf(c, cl) : undefined, interests: ep!.interests.map(i => procName(c, i)),
        plan: plan ? {
          status: plan.status, items: plan.items.map(i => ({ procedure: procName(c, i.procedureId), sessionsDone: i.sessions.filter(x => x.status === 'done').length, sessionsTotal: i.sessionsTotal, price: f.payments ? i.price : undefined })),
          total: f.payments ? plan.items.reduce((n, i) => n + i.price, 0) - plan.discount : undefined, paymentPlan: f.payments ? plan.paymentPlan : undefined,
        } : undefined,
        nextAppointment: next ? `${next.type} ${shortDate(next.start)} ${timeOf(next.start)} (${next.status})` : undefined,
        notes: notes.length ? notes : undefined,
      }
    })

  const payments = f.payments ? s.payments.filter(p => p.status === 'due' || p.status === 'overdue').map(p => ({ client: clientLine(p.clientId), kind: p.kind, amount: p.amount, status: ms(p.dueAt) < now && p.status === 'due' ? 'overdue' : p.status, due: p.dueAt })) : undefined

  return JSON.stringify({
    asOf: iso(now),
    org: s.settings.orgName,
    currency: f.payments || f.revenue ? s.settings.currency : undefined,
    askedBy: { name: me.name, role: ROLE_LABEL[me.role] },
    access: { phoneNumbers: f.phones ? 'visible' : 'masked', clinicalNotes: f.clinical ? 'visible' : 'hidden', payments: f.payments ? 'visible' : 'hidden', revenue: f.revenue ? 'visible' : 'hidden', chats: f.allChats ? 'all' : f.assignedChats ? 'assigned to me' : 'none' },
    openTasks: tasks,
    chatsNeedingAPerson: chats,
    todaysAppointments: appts,
    upcomingSessions14Days: sessions,
    metricsLast14Days: metrics,
    pipelineCounts: pipeline,
    clients,
    paymentsDue: payments,
    ai: {
      modes: s.ai.mode, paused: s.ai.killSwitch, confidenceThreshold: s.ai.confidenceThreshold,
      livePlaybook: live ? { version: live.version, summary: live.summary, evalScore: live.evalScore, sections: live.sections.map(x => x.title) } : undefined,
      pendingPlaybook: pending ? { version: pending.version, summary: pending.summary, evalScore: pending.evalScore, managerApproved: !!pending.approvals.manager, clinicalSignoff: !!pending.approvals.clinician } : undefined,
      openProposals: s.proposals.filter(p => p.status === 'open').map(p => p.title),
      openQaFindings: s.qa.filter(q => !q.resolved && q.severity !== 'info').map(q => `${q.rule}: ${safeText(c, q.excerpt)}`),
    },
  })
}
