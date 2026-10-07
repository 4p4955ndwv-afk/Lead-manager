// Built-in demo answers, used when live Claude isn't available. Each one reads the same permission-filtered view
// of the store that the snapshot uses, so a coordinator never sees revenue and phones stay masked where they should.
import type { AiMode, Appointment, Client, DemoState, Episode } from '../../lib/types'
import { CHANNEL_LABEL, STAGES, STAGE_LABEL } from '../../lib/types'
import { activeEpisode, userName } from '../../lib/store'
import { canOpen } from '../../lib/permissions'
import { DAY, HOUR, ago, ms, replyWindow, sameDay, shortDate, startOfDay, timeOf } from '../../lib/time'
import { AI_CHANNELS, MODE_LABEL, duration, gateFor, gateStats } from '../ai/compute'
import {
  chatsNeedingPerson, clientById, dueText, firstName, flags, fmtMoney, nameOf, phoneOf, procName, safeText, stageText, teamScope, todaysAppointments, upcomingSessions, visibleTasks,
  type Ctx,
} from './snapshot'

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const pctChange = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : 0)
const signed = (n: number) => (n > 0 ? `+${n}%` : n < 0 ? `−${Math.abs(n)}%` : 'no change')
const plural = (n: number, one: string, many = one + 's') => `${n} ${n === 1 ? one : many}`
const fold = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
/** Lower-cases the first letter for use mid-sentence, leaving names and acronyms alone: 'Hair transplant (FUE)' -> 'hair transplant (FUE)', 'AI paused' unchanged. */
const lcFirst = (t: string) => (/^\p{Lu}[^\p{Lu}]/u.test(t) ? t[0].toLowerCase() + t.slice(1) : t)
/** Why a chat is waiting for a person, as a phrase that reads well mid-sentence. */
const REASON_TEXT: Record<string, string> = {
  'Co-pilot: draft ready': 'an AI draft is waiting to be approved',
  'Shadow mode: staff reply': 'shadow mode, so a person writes the reply',
  'AI paused (kill switch)': 'AI replies are paused',
  'Opted out earlier: review': 'they opted out earlier',
  'Low confidence': 'the AI wasn’t confident enough to reply',
}
const reasonText = (r: string | undefined) => (r ? REASON_TEXT[r] ?? lcFirst(r) : 'the chat needs a person')

/** The client a question is about: full name first, then a unique first name. */
export function findClient(s: DemoState, q: string): Client | undefined {
  const fq = fold(q)
  const full = [...s.clients].sort((a, b) => b.name.length - a.name.length).find(c => fq.includes(fold(c.name)))
  if (full) return full
  const words = new Set(fq.split(/[^\p{L}]+/u))
  const byFirst = s.clients.filter(c => words.has(fold(firstName(c.name))))
  return byFirst.length === 1 ? byFirst[0] : undefined
}

export function demoAnswer(c: Ctx, question: string): string {
  const q = question.toLowerCase()
  const client = findClient(c.s, question)
  if (/shared (a|their)? ?(phone )?numbers?|haven'?t been called|not been called|uncalled/.test(q)) return uncalled(c)
  if (/apple business manager|managed google play|(distribut|roll ?out).*(phones?|app)/.test(q)) return mobileRollout(c)
  if (/draft|write/.test(q) && /follow.?up|message|reply/.test(q)) return client ? draftFollowUp(c, client) : 'Who should the follow-up go to? Ask again with their name, for example "Draft a follow-up message for Chloe Martin".'
  if (/tiktok/.test(q) && /instagram/.test(q)) return channels(c)
  if (/due (a|for a|their next)? ?session|sessions? (due|in the next)|next (7|seven) days/.test(q)) return sessionsDue(c)
  if (client && !/^(brief me|summari[sz]e today)/.test(q)) return clientSummary(c, client)
  if (/summari[sz]e today|brief me|today for me|what should i do first/.test(q)) return today(c)
  if (/open calls|calls? .*first|missing their deadline|at risk of missing|who should take/.test(q)) return calls(c)
  if (/pipeline|going cold|at risk/.test(q)) return pipelineRisk(c)
  if (/proposal/.test(q)) return proposal(c, question)
  if (/\bai\b|autopilot|co-?pilot|unedited|playbook|guardrail|handoff/.test(q)) return aiPerformance(c)
  if (/diary|calendar|confirm|free slots|double book|clinic list/.test(q)) return calendar(c, q)
  if (/analytics|previous period|compared with|what moved|this week|last \d+ days/.test(q)) return analytics(c, q)
  if (/payment|overdue|instalment|deposit|chase/.test(q)) return payments(c)
  return fallback(c)
}

// ---- 1. numbers shared today, not called -------------------------------------------------------

function uncalled(c: Ctx): string {
  const { s, now } = c
  if (!canOpen(c.me, 'tasks')) return 'Call tasks are not part of your access, so I can’t list who is waiting for a call. A coordinator or manager can see this.'
  const today = startOfDay(now)
  // every open call task from a shared number with no attempt yet; an older one that slipped is the most urgent of all
  const list = visibleTasks(c).filter(t => t.type === 'call' && t.slaMinutes && t.attempts.length === 0)
  const older = list.filter(t => ms(t.createdAt) < today).length
  const called = s.tasks.filter(t => t.type === 'call' && t.slaMinutes && ms(t.createdAt) >= today && (t.attempts.length > 0 || t.status === 'done')).length
  if (!list.length && !teamScope(c)) return 'None of the new numbers waiting for a call are assigned to you. Lead coordinators call new leads; the Tasks page shows the team queue.'
  if (!list.length) return `Everyone who shared a number has had at least one call attempt${called ? ` (${plural(called, 'lead')} today so far)` : ''}. New numbers create a call task with a 15-minute deadline, and I’ll flag any that slip.`
  const lines = list.map(t => {
    const cl = clientById(c, t.clientId)
    const conv = s.conversations.find(v => v.clientId === t.clientId)
    const esc = t.escalationLevel === 2 ? ', escalated to the owner' : t.escalationLevel === 1 ? ', escalated to the manager' : ''
    const when = ms(t.createdAt) < today ? ` · shared ${ago(t.createdAt, now)}` : ''
    return `- **${cl?.name ?? 'Unknown'}** (${conv ? CHANNEL_LABEL[conv.channel] : 'DM'}) · ${userName(s, t.assignedTo)} · ${dueText(t.dueAt, now)}${esc}${when} · ${phoneOf(c, cl)}`
  })
  const first = list[0]
  const brief = first.brief ? ` ${safeText(c, first.brief).split('. ').slice(0, 2).join('. ').replace(/\.?$/, '.')}` : ''
  return [
    `**${plural(list.length, 'lead')} shared a number ${older ? '' : 'today '}and ${list.length === 1 ? 'hasn’t' : 'haven’t'} been called yet:**`,
    ...lines,
    '',
    `Call ${nameOf(c, first.clientId)} first: ${ms(first.dueAt) < now ? 'they are already past the 15-minute window.' : 'their deadline is closest.'}${brief}`,
    called ? `${plural(called, 'other lead')} from today ${called === 1 ? 'has' : 'have'} already been called.` : '',
  ].filter(Boolean).join('\n')
}

// ---- 2. today --------------------------------------------------------------------------------

function today(c: Ctx): string {
  const { s, me, now } = c
  const f = flags(c)
  const m = s.metrics[s.metrics.length - 1]
  const y = s.metrics[s.metrics.length - 2]
  const tasks = visibleTasks(c)
  const callsOpen = tasks.filter(t => t.type === 'call' || t.type === 'callback')
  const overdue = callsOpen.filter(t => ms(t.dueAt) < now)
  const chats = chatsNeedingPerson(c)
  const risky = chats.filter(v => /minor|complaint|clinical/i.test(v.needsHumanReason ?? ''))
  const appts = todaysAppointments(c)
  const nextAppt = appts.find(a => ms(a.start) > now && !['completed', 'no_show', 'arrived'].includes(a.status))
  const unconfirmed = s.appointments.filter(a => a.status === 'unconfirmed' && ms(a.start) > now && ms(a.start) < now + 2 * DAY)
  const plans = s.plans.filter(p => p.status === 'proposed')
  const out: string[] = [`**Today at ${s.settings.orgName}, ${timeOf(new Date(now).toISOString())}**`]
  if (m) out.push(`- **${m.dms} DMs** so far${y ? ` (${signed(pctChange(m.dms, y.dms))} on yesterday)` : ''}; the AI sent ${m.aiReplies} replies with a median first reply of ${duration(m.medianFirstReplySec)}. ${m.contacts} people shared a number.`)
  if (s.ai.killSwitch) out.push('- **AI replies are paused**, so staff are answering every DM.')
  const mine = tasks.filter(t => t.assignedTo === me.id && t.type !== 'call' && t.type !== 'callback')
  if (mine.length) out.push(`- **Your other tasks:** ${mine.slice(0, 4).map(t => `${t.title} (${dueText(t.dueAt, now)})`).join('; ')}.`)
  if (canOpen(me, 'tasks')) {
    if (!teamScope(c) && !callsOpen.length) out.push('- **No calls assigned to you.**')
    else out.push(`- **${plural(callsOpen.length, 'call')} ${teamScope(c) ? 'waiting' : 'assigned to you'}**${overdue.length ? `, ${overdue.length} overdue: ${overdue.map(t => nameOf(c, t.clientId)).join(', ')}` : ', none overdue'}.`)
  }
  if (f.allChats || f.assignedChats) {
    if (!chats.length) out.push(f.allChats ? '- **No chats need a person.**' : '- **No chats assigned to you need a person.**')
    else out.push(`- **${plural(chats.length, 'chat')} ${chats.length === 1 ? 'needs' : 'need'} a person**${risky.length ? ` (${risky.map(v => `${nameOf(c, v.clientId)}: ${reasonText(v.needsHumanReason)}`).join('; ')})` : ''}.`)
  }
  out.push(`- **${plural(appts.length, 'appointment')} today**${nextAppt ? `; next is ${nameOf(c, nextAppt.clientId)} at ${timeOf(nextAppt.start)} (${nextAppt.type.replace('_', '-')})` : ''}${unconfirmed.length ? `. ${plural(unconfirmed.length, 'booking')} in the next two days ${unconfirmed.length === 1 ? 'is' : 'are'} still unconfirmed` : ''}.`)
  if (plans.length) out.push(`- **${plural(plans.length, 'treatment plan')} waiting for a decision**: ${plans.map(p => nameOf(c, p.clientId)).join(', ')}.`)
  if (f.revenue && m) out.push(`- Revenue booked today: ${fmtMoney(c, m.revenue)}${y ? ` (yesterday ${fmtMoney(c, y.revenue)})` : ''}.`)
  if (f.payments) {
    const od = s.payments.filter(p => p.status === 'overdue' || (p.status === 'due' && ms(p.dueAt) < now))
    if (od.length) out.push(`- **${plural(od.length, 'payment')} overdue** (${fmtMoney(c, sum(od.map(p => p.amount)))}): ${od.map(p => nameOf(c, p.clientId)).join(', ')}.`)
  }
  const firstDo = overdue[0] ? `call ${nameOf(c, overdue[0].clientId)}, who is past the call deadline`
    : risky[0] ? `reply to ${nameOf(c, risky[0].clientId)} (${reasonText(risky[0].needsHumanReason)})`
      : callsOpen[0] ? `call ${nameOf(c, callsOpen[0].clientId)} (${dueText(callsOpen[0].dueAt, now)})`
        : chats[0] ? `clear the ${plural(chats.length, 'chat')} waiting in the inbox`
          : unconfirmed[0] ? `confirm ${nameOf(c, unconfirmed[0].clientId)}’s appointment`
            : 'nothing is urgent; a good moment to follow up on proposed plans'
  out.push('', `**What to do first:** ${firstDo}.`)
  return out.join('\n')
}

// ---- 3. TikTok vs Instagram ------------------------------------------------------------------

function channels(c: Ctx): string {
  const { s, now } = c
  const wk = s.metrics.slice(-7), prev = s.metrics.slice(-14, -7)
  const ig = sum(wk.map(m => m.byChannel.instagram)), tt = sum(wk.map(m => m.byChannel.tiktok))
  const igP = sum(prev.map(m => m.byChannel.instagram)), ttP = sum(prev.map(m => m.byChannel.tiktok))
  const total = Math.max(1, ig + tt)
  const since = now - 7 * DAY
  const leads = (ch: 'instagram' | 'tiktok') => s.clients.filter(cl => cl.source.channel === ch && ms(cl.createdAt) >= since)
  const withNumber = (ch: 'instagram' | 'tiktok') => leads(ch).filter(cl => cl.phone).length
  const g = { ig: gateStats(s, 'instagram', now), tt: gateStats(s, 'tiktok', now) }
  const ttApi = s.settings.channels.find(x => x.channel === 'tiktok')
  const faster = pctChange(tt, ttP) > pctChange(ig, igP) ? 'TikTok' : 'Instagram'
  return [
    `**Last 7 days: Instagram ${ig} DMs (${Math.round((ig / total) * 100)}%), TikTok ${tt} DMs (${Math.round((tt / total) * 100)}%).**`,
    `- **Instagram:** ${signed(pctChange(ig, igP))} on the week before. AI on ${MODE_LABEL[s.ai.mode.instagram].toLowerCase()}; ${Math.round(g.ig.uneditedRate * 100)}% of drafts sent unedited, handoff rate ${Math.round(g.ig.handoffRate * 100)}%. ${withNumber('instagram')} of ${leads('instagram').length} new Instagram leads shared a number.`,
    `- **TikTok:** ${signed(pctChange(tt, ttP))} on the week before. AI on ${MODE_LABEL[s.ai.mode.tiktok].toLowerCase()}; ${Math.round(g.tt.uneditedRate * 100)}% of drafts sent unedited, handoff rate ${Math.round(g.tt.handoffRate * 100)}%. ${withNumber('tiktok')} of ${leads('tiktok').length} new TikTok leads shared a number.`,
    ttApi && ttApi.status !== 'connected' ? `- TikTok’s messaging API is still ${ttApi.status === 'pending' ? 'under review' : 'not connected'}, so staff copy co-pilot drafts into TikTok by hand. That adds minutes to every TikTok reply.` : '',
    '',
    `**Takeaway:** ${faster} grew faster this week. ${s.ai.mode.tiktok !== 'autopilot' ? `TikTok drafts are edited more often (${Math.round(g.tt.editRate * 100)}% vs ${Math.round(g.ig.editRate * 100)}%), so it isn’t ready for autopilot yet; Claude’s proposal on session-count answers targets exactly that.` : 'Both channels are on autopilot; keep an eye on QA findings.'}`,
  ].filter(Boolean).join('\n')
}

// ---- 4. follow-up draft ----------------------------------------------------------------------

function draftFollowUp(c: Ctx, cl: Client): string {
  const { s, me, now } = c
  const f = flags(c)
  const ep = activeEpisode(s, cl.id)
  const plan = s.plans.filter(p => p.clientId === cl.id && (p.status === 'proposed' || p.status === 'accepted')).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0]
  // the message comes from whoever will send it: the viewer if they handle chats, else the client's owner, else the coordinator on shift
  const coordinator = s.users.find(u => u.role === 'coordinator' && u.status === 'active' && u.onShift) ?? s.users.find(u => u.role === 'coordinator' && u.status === 'active')
  const senderId = me.role === 'coordinator' || me.role === 'frontdesk' ? me.id : cl.ownerId ?? (c.can('chats.reply') ? me.id : coordinator?.id ?? me.id)
  const sender = firstName(userName(s, senderId))
  const first = firstName(cl.name)
  const org = s.settings.orgName
  const conv = s.conversations.find(v => v.clientId === cl.id)
  const items = plan ? plan.items.map(i => lcFirst(procName(c, i.procedureId))) : []
  const itemsText = items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0]
  let msg: string
  if (plan?.status === 'proposed') {
    const total = sum(plan.items.map(i => i.price)) - plan.discount
    const clinician = userName(s, plan.createdBy)
    const money = f.payments && plan.paymentPlan.type === 'instalments' && plan.paymentPlan.instalments ? ` If it helps, you can spread the ${fmtMoney(c, total)} over ${plan.paymentPlan.instalments} monthly payments.` : ''
    msg = `Hi ${first}, it’s ${sender} from ${org}. Just checking in on the plan ${clinician} put together for you (${itemsText}).${money} Would you like me to hold a start date for you? Happy to answer any questions, and there’s no pressure at all.`
  } else if (ep?.stage === 'treatment' && plan) {
    const nextS = upcomingSessions(c, 30).find(x => x.clientId === cl.id)
    msg = nextS?.booked
      ? `Hi ${first}, it’s ${sender} from ${org}. A quick reminder that your ${lcFirst(nextS.procedure)} session ${nextS.sessionNo} is on ${shortDate(nextS.at)} at ${timeOf(nextS.at)}. Reply here if you need to move it. See you then!`
      : `Hi ${first}, it’s ${sender} from ${org}. You’re due your next ${itemsText} session soon. Would you like me to book it in? Just let me know which days suit you.`
  } else if (ep?.stage === 'aftercare' || ep?.stage === 'alumni') {
    msg = `Hi ${first}, it’s ${sender} from ${org}. How are you getting on since your treatment? If you have a moment, we’d love to hear how it went, and we’re here if you have any questions.`
  } else {
    const interest = ep?.interests[0] ? lcFirst(procName(c, ep.interests[0])) : 'our treatments'
    msg = `Hi ${first}, it’s ${sender} from ${org}. Thanks again for getting in touch about ${interest}. Would you like to book a free consultation? I can give you a call at a time that suits you.`
  }
  const where: string[] = []
  if (conv) {
    const w = replyWindow(conv, now)
    if (w.open) where.push(`Send it from the Inbox: the ${CHANNEL_LABEL[conv.channel]} reply window is open for another ${Math.max(1, Math.round(w.msLeft / HOUR))} h.`)
    else if (w.humanAgentOpen) where.push(`The 24-hour ${CHANNEL_LABEL[conv.channel]} window has closed, but a person can still reply with the Human Agent tag until ${shortDate(w.humanAgentUntil!)}.`)
    else where.push(`${first}’s ${CHANNEL_LABEL[conv.channel]} chat window closed ${ago(w.closesAt, now)}, so ${!cl.phone ? 'wait for them to message again: there is no number on file to call or text' : cl.consent.whatsapp ? 'send it as a WhatsApp message (they have consented to WhatsApp)' : cl.consent.sms ? 'send it by SMS (they have consented to SMS)' : 'call them instead; they haven’t consented to WhatsApp or SMS'}.`)
  } else where.push(!cl.phone ? 'There is no open chat and no number on file, so it can only be sent once they message again.' : cl.consent.whatsapp ? 'Send it on WhatsApp; they have consented.' : 'Call them; there is no open chat to reply in.')
  if (!c.can('chats.reply')) where.unshift(`Your access can’t send messages, so ask ${senderId === me.id ? 'a coordinator' : sender} to send it.`)
  if (cl.language !== 'en') where.push(`${first} usually writes in ${({ es: 'Spanish', ar: 'Arabic', fr: 'French' } as Record<string, string>)[cl.language] ?? cl.language}; consider sending it in that language.`)
  const note = s.notes.find(n => n.clientId === cl.id && (!n.clinical || f.clinical))
  return [
    `**Draft follow-up for ${cl.name}:**`,
    '',
    `> ${msg}`,
    '',
    ...where.map(w => `- ${w}`),
    note ? `- Based on the latest note (${shortDate(note.at)}, ${userName(s, note.authorId)}): “${safeText(c, note.text)}”` : '',
    `- Stage: ${stageText(ep)}${cl.ownerId ? ` · owner ${userName(s, cl.ownerId)}` : ''}.`,
  ].filter(Boolean).join('\n')
}

// ---- 5. sessions due --------------------------------------------------------------------------

function sessionsDue(c: Ctx): string {
  const { s, now } = c
  const list = upcomingSessions(c, 7)
  const booked = list.filter(x => x.booked)
  const unbooked = list.filter(x => !x.booked)
  if (!list.length) return 'No one is due a session in the next 7 days. Clients with a course in progress appear here once their next session falls due.'
  const out: string[] = [`**${plural(new Set(list.map(x => x.clientId)).size, 'client')} ${new Set(list.map(x => x.clientId)).size === 1 ? 'is' : 'are'} due a session in the next 7 days.**`]
  if (booked.length) {
    out.push('', '**Booked**')
    booked.forEach(x => out.push(`- ${nameOf(c, x.clientId)}: ${x.procedure} session ${x.sessionNo} of ${x.total}, ${sameDay(x.at, now) ? 'today' : shortDate(x.at)} at ${timeOf(x.at)} with ${userName(s, x.practitionerId)} (${x.status})`))
  }
  if (unbooked.length) {
    out.push('', '**Due but not booked yet**')
    unbooked.slice(0, 10).forEach(x => out.push(`- ${nameOf(c, x.clientId)}: ${x.procedure} session ${x.sessionNo} of ${x.total}, ${x.overdue ? `was due ${shortDate(x.at)}` : `due around ${shortDate(x.at)}`}`))
    out.push('', `Book the ${unbooked.length === 1 ? 'unbooked session' : `${unbooked.length} unbooked sessions`} first; ${unbooked.filter(x => x.overdue).length ? 'the overdue ones are slipping out of the recommended interval.' : 'courses work best on schedule.'}`)
  }
  const unconf = booked.filter(x => x.status === 'unconfirmed')
  if (unconf.length) out.push(`${plural(unconf.length, 'booked session')} still ${unconf.length === 1 ? 'needs' : 'need'} confirming.`)
  return out.join('\n')
}

// ---- client summary ---------------------------------------------------------------------------

function clientSummary(c: Ctx, cl: Client): string {
  const { s, now } = c
  const f = flags(c)
  const eps = s.episodes.filter(e => e.clientId === cl.id).sort((a, b) => a.number - b.number)
  const ep = eps[eps.length - 1]
  const tasks = canOpen(c.me, 'tasks') ? s.tasks.filter(t => t.clientId === cl.id && t.status === 'open').sort((a, b) => ms(a.dueAt) - ms(b.dueAt)) : []
  const next = s.appointments.filter(a => a.clientId === cl.id && ms(a.start) > now && a.status !== 'cancelled').sort((a, b) => ms(a.start) - ms(b.start))[0]
  const plan = ep ? s.plans.find(p => p.episodeId === ep.id) : undefined
  const conv = s.conversations.find(v => v.clientId === cl.id)
  const canChat = conv && (f.allChats || (f.assignedChats && conv.assignedTo === c.me.id))
  const lastIn = conv ? [...conv.messages].reverse().find(m => m.author === 'client') : undefined
  const overduePay = f.payments ? s.payments.filter(p => p.clientId === cl.id && (p.status === 'overdue' || (p.status === 'due' && ms(p.dueAt) < now))) : []
  const out: string[] = [`**${cl.name}: ${stageText(ep)}${ep && ep.number > 1 ? ` (returning client, journey ${ep.number})` : ''}**`]
  out.push(`- Came from ${CHANNEL_LABEL[cl.source.channel]} (${cl.source.detail}) ${ago(cl.createdAt, now)}${cl.ownerId ? `; looked after by ${userName(s, cl.ownerId)}` : ''}. Phone: ${cl.phone ? phoneOf(c, cl) : 'not shared yet'}.`)
  if (ep?.interests.length) out.push(`- Interested in ${ep.interests.map(i => lcFirst(procName(c, i))).join(' and ')}.`)
  if (plan) {
    const done = sum(plan.items.map(i => i.sessions.filter(x => x.status === 'done').length))
    const total = sum(plan.items.map(i => i.sessionsTotal))
    out.push(`- Treatment plan ${plan.status}: ${plan.items.map(i => `${procName(c, i.procedureId)} (${i.sessions.filter(x => x.status === 'done').length}/${i.sessionsTotal})`).join(', ')}; ${done} of ${total} sessions done${f.payments ? `, ${fmtMoney(c, sum(plan.items.map(i => i.price)) - plan.discount)}` : ''}.`)
  }
  if (next) out.push(`- Next appointment: ${next.type.replace('_', '-')} on ${shortDate(next.start)} at ${timeOf(next.start)} (${next.status}).`)
  tasks.forEach(t => out.push(`- Open task: ${t.title} · ${userName(s, t.assignedTo)} · ${dueText(t.dueAt, now)}${t.escalationLevel ? ' · escalated' : ''}.`))
  overduePay.forEach(p => out.push(`- Overdue ${p.kind}: ${fmtMoney(c, p.amount)} since ${shortDate(p.dueAt)}.`))
  if (canChat && lastIn) out.push(`- Last message (${ago(lastIn.at, now)}): “${safeText(c, lastIn.text)}”${conv!.needsHumanReason ? ` · ${reasonText(conv!.needsHumanReason)}` : ''}.`)
  const notes = s.notes.filter(n => n.clientId === cl.id && (!n.clinical || f.clinical)).slice(0, 2)
  notes.forEach(n => out.push(`- Note${n.clinical ? ' (clinical)' : ''} from ${userName(s, n.authorId)}, ${shortDate(n.at)}: “${safeText(c, n.text)}”`))
  if (!f.clinical && s.notes.some(n => n.clientId === cl.id && n.clinical)) out.push('- Clinical notes are hidden for your role.')
  out.push('', `**Next best action:** ${nextAction(c, cl, ep)}`)
  return out.join('\n')
}

function nextAction(c: Ctx, cl: Client, ep: Episode | undefined): string {
  const { s, now } = c
  const first = firstName(cl.name)
  const call = s.tasks.find(t => t.clientId === cl.id && t.status === 'open' && (t.type === 'call' || t.type === 'callback'))
  if (call && ms(call.dueAt) < now) return `call ${first} now; the call is ${dueText(call.dueAt, now)}.`
  if (call) return `call ${first} (${dueText(call.dueAt, now)}) and agree a consultation date.`
  const conv = s.conversations.find(v => v.clientId === cl.id)
  if (conv?.draft) return 'approve or edit the AI draft waiting in the inbox.'
  if (conv?.needsHuman) return `reply in the inbox: ${reasonText(conv.needsHumanReason)}.`
  if (!ep) return 'nothing open.'
  if (ep.exit === 'nurture') return `leave ${first} in nurture; the AI will check in when they asked (${ep.exitReason ?? 'later'}).`
  if (ep.exit) return `nothing to do: the journey ended (${ep.exitReason ?? 'closed'}).`
  if (ep.stage === 'plan') return `follow up on the proposed plan and offer to hold a start date.`
  if (ep.stage === 'treatment') {
    const nextS = upcomingSessions(c, 30).find(x => x.clientId === cl.id)
    return nextS && !nextS.booked ? `book ${lcFirst(nextS.procedure)} session ${nextS.sessionNo}.` : 'make sure the next session is confirmed and any instalment is paid.'
  }
  if (ep.stage === 'aftercare') return `check in on recovery and ask for a review.`
  if (ep.stage === 'booked') return `confirm the appointment and that any deposit is paid.`
  if (STAGES.indexOf(ep.stage) <= STAGES.indexOf('qualifying')) return `let the AI keep qualifying and ask for a number; step in if they ask anything clinical.`
  return `move ${first} to the next step: ${STAGE_LABEL[STAGES[Math.min(STAGES.length - 1, STAGES.indexOf(ep.stage) + 1)]]}.`
}

// ---- calls priority ---------------------------------------------------------------------------

function calls(c: Ctx): string {
  const { s, now } = c
  const list = visibleTasks(c).filter(t => t.type === 'call' || t.type === 'callback')
  if (!list.length) return canOpen(c.me, 'tasks') ? 'No calls are waiting. New numbers from DMs create a call task with a 15-minute deadline.' : 'Calls are not part of your access.'
  const out = [`**Call order (${plural(list.length, 'open call')}):**`]
  list.slice(0, 8).forEach((t, i) => {
    const u = s.users.find(x => x.id === t.assignedTo)
    const off = u && !u.onShift ? ` (${firstName(u.name)} is off shift: reassign)` : ''
    const say = t.brief ? ` Say: ${safeText(c, t.brief).split('. ').filter(x => !/^Goal/.test(x))[0]?.replace(/\.?$/, '.')}` : ''
    out.push(`${i + 1}. **${nameOf(c, t.clientId)}** · ${dueText(t.dueAt, now)} · ${userName(s, t.assignedTo)}${off}${t.attempts.length ? ` · ${plural(t.attempts.length, 'attempt')}` : ''}.${say}`)
  })
  const coord = s.users.filter(u => u.role === 'coordinator' && u.onShift && u.status === 'active')
  const atRisk = list.filter(t => t.slaMinutes && ms(t.dueAt) - now < 10 * 60_000)
  if (atRisk.length && coord.length) out.push('', `${plural(atRisk.length, 'call')} ${atRisk.length === 1 ? 'is' : 'are'} at or past the 15-minute deadline. On shift now: ${coord.map(u => u.name).join(', ')}.`)
  return out.join('\n')
}

// ---- pipeline risk ----------------------------------------------------------------------------

function pipelineRisk(c: Ctx): string {
  const { s, now } = c
  const rows: Array<{ name: string; why: string; owner: string; score: number }> = []
  for (const cl of s.clients) {
    const ep = activeEpisode(s, cl.id)
    if (!ep || ep.exit || !['qualifying', 'contact', 'call', 'booked', 'plan'].includes(ep.stage)) continue
    const conv = s.conversations.find(v => v.clientId === cl.id)
    const last = Math.max(ms(conv?.lastMessageAt ?? cl.createdAt), ...s.tasks.filter(t => t.clientId === cl.id).flatMap(t => t.attempts.map(a => ms(a.at))))
    const idleDays = (now - last) / DAY
    const overdue = s.tasks.find(t => t.clientId === cl.id && t.status === 'open' && ms(t.dueAt) < now)
    const plan = s.plans.find(p => p.episodeId === ep.id && p.status === 'proposed')
    let why = ''
    let score = 0
    if (overdue) { why = `${overdue.type === 'call' || overdue.type === 'callback' ? 'the call' : `“${overdue.title}”`} is ${dueText(overdue.dueAt, now)}`; score = 3 }
    else if (plan && now - ms(plan.createdAt) > DAY) { why = `plan proposed ${ago(plan.createdAt, now)} with no decision`; score = 2 }
    else if (idleDays > 2) { why = `no contact for ${Math.round(idleDays)} days at ${lcFirst(STAGE_LABEL[ep.stage])}`; score = 1 + Math.min(1, idleDays / 10) }
    if (score) rows.push({ name: cl.name, why, owner: cl.ownerId ? userName(s, cl.ownerId) : 'unassigned', score })
  }
  rows.sort((a, b) => b.score - a.score)
  if (!rows.length) return 'No leads look at risk right now: every open lead has had contact in the last two days and nothing is overdue.'
  return [`**${plural(rows.length, 'lead')} at risk of going cold:**`, ...rows.slice(0, 8).map(r => `- **${r.name}**: ${r.why} · ${r.owner}`), '', `Start with ${rows[0].name}; ${rows[0].owner === 'unassigned' ? 'assign an owner first' : `${rows[0].owner} should contact them today`}.`].join('\n')
}

// ---- proposals --------------------------------------------------------------------------------

function proposal(c: Ctx, question: string): string {
  const { s } = c
  const fq = fold(question)
  const p = s.proposals.find(x => fq.includes(fold(x.title))) ?? s.proposals.find(x => x.status === 'open')
  if (!p) return 'There are no proposals from Claude right now. New ones arrive every Monday.'
  const nums = (p.evidence.match(/\d+/g) ?? []).map(Number)
  const small = nums.length > 0 && Math.max(...nums) < 30
  return [
    `**${p.title}** (${p.status === 'open' ? 'waiting for a decision' : p.status})`,
    `- **Evidence:** ${p.evidence}`,
    `- **Change:** ${p.change}`,
    `- **Expected impact:** ${p.impact}`,
    '',
    `**How strong is it?** ${small ? 'Promising but based on a small sample, so treat the effect size as a rough guide.' : 'Reasonable: the sample is big enough to act on, though not a controlled test.'} Accepting only adds it to a draft; it is still evaluated against the golden set and needs a manager’s approval and clinical sign-off before any client sees it.`,
    `**What could go wrong:** ${/time window|evening|after 6/i.test(p.change + p.evidence) ? 'more calls promised for evenings than the team can cover; check the evening rota before accepting.' : /banned/i.test(p.change) ? 'very little; banned phrases only make replies more cautious.' : 'longer replies on TikTok, which can feel less personal; keep the line short.'}`,
  ].join('\n')
}

// ---- AI performance ---------------------------------------------------------------------------

function aiPerformance(c: Ctx): string {
  const { s, now } = c
  const out = [s.ai.killSwitch ? '**AI replies are paused right now.** Figures below are for the last 14 days.' : '**AI over the last 14 days, by channel:**']
  const ready: string[] = []
  for (const ch of AI_CHANNELS) {
    const g = gateStats(s, ch, now)
    const mode: AiMode = s.ai.mode[ch]
    const gate = gateFor(mode, g)
    out.push(`- **${CHANNEL_LABEL[ch]}** (${MODE_LABEL[mode].toLowerCase()}): ${Math.round(g.uneditedRate * 100)}% sent unedited, ${Math.round(g.editRate * 100)}% edited, ${plural(g.openIssues, 'open guardrail issue')}, handoff rate ${Math.round(g.handoffRate * 100)}%. ${gate.title}: ${gate.summary.replace(': ', ', ').toLowerCase()}.`)
    if (gate.next && gate.checks.every(x => x.met)) ready.push(`${CHANNEL_LABEL[ch]} is ready for ${MODE_LABEL[gate.next].toLowerCase()}`)
  }
  const pending = s.playbooks.find(p => p.status === 'pending')
  const live = s.playbooks.find(p => p.status === 'live')
  if (live) out.push(`- Playbook ${live.version} is live (golden set ${live.evalScore}%).${pending ? ` ${pending.version} scores ${pending.evalScore}% and is waiting for ${[!pending.approvals.manager && 'a manager’s approval', !pending.approvals.clinician && 'clinical sign-off'].filter(Boolean).join(' and ') || 'publishing'}.` : ''}`)
  const qa = s.qa.filter(q => !q.resolved && q.severity !== 'info')
  if (qa.length) out.push(`- Nightly QA: ${qa.map(q => q.rule).join('; ')}.`)
  out.push('', `**Verdict:** ${ready.length ? ready.join('; ') + '.' : 'no channel has met the gate for its next mode yet.'}${qa.length ? ' Resolve the open QA findings first; they count against autopilot.' : ''}`)
  return out.join('\n')
}

// ---- analytics --------------------------------------------------------------------------------

function analytics(c: Ctx, q: string): string {
  const { s } = c
  const f = flags(c)
  const n = Math.max(1, Math.min(30, Number(q.match(/last (\d+) days/)?.[1] ?? 7)))
  const cur = s.metrics.slice(-n), prev = s.metrics.slice(-2 * n, -n)
  const k = (rows: typeof cur, key: 'dms' | 'contacts' | 'booked' | 'attended' | 'treatments' | 'revenue') => sum(rows.map(r => r[key]))
  const avg = (rows: typeof cur, key: 'medianFirstReplySec' | 'callSlaMetPct') => (rows.length ? sum(rows.map(r => r[key])) / rows.length : 0)
  const line = (label: string, a: number, b: number, fmt = (x: number) => String(Math.round(x))) => ({ label, a, b, change: pctChange(a, b), text: `- ${label}: ${fmt(a)} (${prev.length ? signed(pctChange(a, b)) : 'no earlier data'})` })
  const rows = [
    line('DMs', k(cur, 'dms'), k(prev, 'dms')),
    line('Numbers shared', k(cur, 'contacts'), k(prev, 'contacts')),
    line('Consultations booked', k(cur, 'booked'), k(prev, 'booked')),
    line('Attended', k(cur, 'attended'), k(prev, 'attended')),
    line('Treatments started', k(cur, 'treatments'), k(prev, 'treatments')),
    ...(f.revenue ? [line('Revenue', k(cur, 'revenue'), k(prev, 'revenue'), x => fmtMoney(c, x))] : []),
  ]
  const big = [...rows].sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0]
  const conv = k(cur, 'contacts') / Math.max(1, k(cur, 'dms'))
  return [
    `**Last ${n} days compared with the ${n} days before:**`,
    ...rows.map(r => r.text),
    `- Median first reply: ${duration(avg(cur, 'medianFirstReplySec'))} (was ${duration(avg(prev, 'medianFirstReplySec'))}); calls within 15 minutes: ${Math.round(avg(cur, 'callSlaMetPct'))}%.`,
    '',
    `**What moved most:** ${big.label.toLowerCase()} (${signed(big.change)}). ${Math.round(conv * 100)}% of DMs ended with a number shared.`,
    `**One change this week:** ${avg(cur, 'callSlaMetPct') < 90 ? 'call faster: the 15-minute call rate is below 90%, and that is where booked consultations are lost.' : s.ai.mode.tiktok !== 'autopilot' ? 'accept Claude’s TikTok proposal so more TikTok chats get to a number without edits.' : 'keep the AI settings as they are and focus on plan follow-ups.'}`,
  ].join('\n')
}

// ---- calendar ---------------------------------------------------------------------------------

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** The day or range a calendar question names, e.g. "Sunday 4 October 2026", "28 Sept – 4 Oct 2026", "1 – 7 Oct 2026". */
function askedPeriod(q: string, now: number): { from: number; to: number; single: boolean } | null {
  const hits = [...q.matchAll(/\b(\d{1,2})(?:\s*[–-]\s*(\d{1,2}))?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:\s+(\d{4}))?/gi)]
  if (!hits.length) return null
  const year = Number(hits.find(h => h[4])?.[4] ?? new Date(now).getFullYear())
  const day = (d: string, m: string, y = year) => new Date(y, MONTHS.indexOf(m.toLowerCase().slice(0, 3)), Number(d)).getTime()
  const first = hits[0], last = hits[hits.length - 1]
  let from = day(first[1], first[3]), to = first[2] ? day(first[2], first[3]) : day(last[1], last[3])
  if (from > to) from = day(first[1], first[3], year - 1) // e.g. 29 Dec – 4 Jan
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null
  return { from, to: to + DAY, single: to === from }
}

/** Overlapping bookings for the same practitioner or room. */
function clashes(list: Appointment[]): string[] {
  const out: string[] = []
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j]
    if (ms(a.start) < ms(b.end) && ms(b.start) < ms(a.end) && (a.practitionerId === b.practitionerId || a.roomId === b.roomId)) out.push(`${shortDate(a.start)} ${timeOf(a.start)}`)
  }
  return [...new Set(out)]
}

/** Free stretches of an hour or more in business hours for each clinician on a day. */
function freeTime(c: Ctx, dayStart: number, booked: Appointment[]): string[] {
  const { s } = c
  const [oh, om] = s.ai.businessHours.start.split(':').map(Number)
  const [ch, cm] = s.ai.businessHours.end.split(':').map(Number)
  if (!s.ai.businessHours.days.includes(new Date(dayStart).getDay())) return []
  const open = dayStart + oh * HOUR + om * 60_000, close = dayStart + ch * HOUR + cm * 60_000
  return s.users.filter(u => u.role === 'clinician' && u.status === 'active').map(u => {
    let cur = Math.max(open, c.now)
    const gaps: string[] = []
    for (const a of booked.filter(x => x.practitionerId === u.id).sort((x, y) => ms(x.start) - ms(y.start))) {
      if (ms(a.start) - cur >= HOUR) gaps.push(`${timeOf(new Date(cur).toISOString())}–${timeOf(a.start)}`)
      cur = Math.max(cur, ms(a.end))
    }
    if (close - cur >= HOUR) gaps.push(`${timeOf(new Date(cur).toISOString())}–${timeOf(new Date(close).toISOString())}`)
    return gaps.length ? `${u.name} ${gaps.slice(0, 3).join(', ')}` : ''
  }).filter(Boolean)
}

function calendar(c: Ctx, q = ''): string {
  const { s, me, now } = c
  const f = flags(c)
  const asked = askedPeriod(q, now)
  // "my diary" from someone with their own clinic list means their appointments only
  const mineOnly = /\bmy (diary|calendar|clinic list)\b/.test(q) && s.appointments.some(a => a.practitionerId === me.id)
  const scope = (a: Appointment) => a.status !== 'cancelled' && (!mineOnly || a.practitionerId === me.id)
  const line = (a: Appointment, withDay = false) => `- ${withDay ? `${shortDate(a.start)} ` : ''}${timeOf(a.start)} ${nameOf(c, a.clientId)}: ${a.type.replace('_', '-')}${a.procedureId ? `, ${procName(c, a.procedureId)}` : ''}${a.sessionNo ? ` session ${a.sessionNo}` : ''} with ${userName(s, a.practitionerId)} (${a.status})`
  const tail = (list: Appointment[]): string[] => {
    const upcoming = list.filter(a => ms(a.end) > now)
    const unconf = upcoming.filter(a => a.status === 'unconfirmed')
    const deposits = f.payments ? upcoming.filter(a => a.deposit === 'due') : []
    const clash = clashes(list)
    const out: string[] = []
    if (unconf.length) out.push(`- Still to confirm: ${unconf.map(a => `${nameOf(c, a.clientId)} (${shortDate(a.start)} ${timeOf(a.start)})`).join(', ')}.`)
    if (deposits.length) out.push(`- Deposits due: ${deposits.map(a => nameOf(c, a.clientId)).join(', ')}.`)
    if (!unconf.length && !deposits.length && upcoming.length) out.push(f.payments ? '- Everyone is confirmed and no deposits are outstanding.' : '- Everyone is confirmed.')
    out.push(clash.length ? `- **Double booking** at ${clash.join(', ')}: the same practitioner or room is booked twice.` : '- No double bookings: each practitioner and room has one appointment at a time.')
    return out
  }
  const who = mineOnly ? 'Your clinic list' : 'The clinic'

  if (asked && !(asked.single && sameDay(asked.from, now))) {
    const list = s.appointments.filter(a => scope(a) && ms(a.start) >= asked.from && ms(a.start) < asked.to).sort((a, b) => ms(a.start) - ms(b.start))
    const label = asked.single ? new Date(asked.from).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : `${shortDate(new Date(asked.from).toISOString())} to ${shortDate(new Date(asked.to - DAY).toISOString())}`
    if (!list.length) return `**${who} has no bookings ${asked.single ? 'on' : 'from'} ${label}.**${asked.to > now ? ' Every slot in business hours is free for new consultations.' : ''}`
    const out = [`**${label}: ${plural(list.length, 'booking')}.**`]
    if (asked.single) list.forEach(a => out.push(line(a)))
    else {
      const byDay = new Map<string, number>()
      list.forEach(a => byDay.set(shortDate(a.start), (byDay.get(shortDate(a.start)) ?? 0) + 1))
      const [top, next] = [...byDay.entries()].sort((a, b) => b[1] - a[1])
      out.push(`- By day: ${[...byDay.entries()].map(([d, n]) => `${d} (${n})`).join(' · ')}${top && (!next || top[1] > next[1]) ? `; busiest is ${top[0]}` : ''}.`)
    }
    out.push(...tail(list))
    if (asked.single && asked.to > now) {
      const free = freeTime(c, asked.from, list)
      if (free.length) out.push(`- Free for new consultations (an hour or more): ${free.join('; ')}.`)
    }
    return out.join('\n')
  }

  const appts = todaysAppointments(c).filter(scope)
  const week = s.appointments.filter(a => scope(a) && ms(a.start) > now && ms(a.start) < now + 7 * DAY).sort((a, b) => ms(a.start) - ms(b.start))
  const byDay = new Map<string, number>()
  week.forEach(a => byDay.set(shortDate(a.start), (byDay.get(shortDate(a.start)) ?? 0) + 1))
  const busiest = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]
  const out = [`**Today: ${plural(appts.length, 'appointment')}${mineOnly ? ' on your list' : ''}.**`]
  appts.forEach(a => out.push(line(a)))
  const free = freeTime(c, startOfDay(now), appts)
  if (free.length) out.push(`- Free today for new consultations (an hour or more): ${free.join('; ')}.`)
  out.push('', `**Next 7 days: ${plural(week.length, 'booking')}**${busiest ? `; busiest day ${busiest[0]} (${busiest[1]})` : ''}.`)
  out.push(...tail([...appts, ...week.filter(a => !appts.includes(a))]))
  return out.join('\n')
}

// ---- payments ---------------------------------------------------------------------------------

function payments(c: Ctx): string {
  const { s, now } = c
  if (!flags(c).payments) return 'Payments are not part of your access, so I can’t show amounts or who owes what. Ask finance or a manager.'
  const open = s.payments.filter(p => p.status === 'due' || p.status === 'overdue').sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  const overdue = open.filter(p => p.status === 'overdue' || ms(p.dueAt) < now)
  const soon = open.filter(p => !overdue.includes(p) && ms(p.dueAt) < now + 7 * DAY)
  if (!open.length) return 'Nothing is due or overdue.'
  const out = [`**${plural(overdue.length, 'payment')} overdue, ${soon.length} due in the next 7 days.**`]
  overdue.forEach(p => out.push(`- Overdue: ${nameOf(c, p.clientId)}, ${p.kind} ${fmtMoney(c, p.amount)} since ${shortDate(p.dueAt)}`))
  soon.forEach(p => out.push(`- Due ${shortDate(p.dueAt)}: ${nameOf(c, p.clientId)}, ${p.kind} ${fmtMoney(c, p.amount)}`))
  if (overdue[0]) out.push('', `Chase ${nameOf(c, overdue[0].clientId)} first with a card link; it has been overdue the longest.`)
  return out.join('\n')
}

// ---- private mobile app rollout -----------------------------------------------------------------

function mobileRollout(c: Ctx): string {
  const { s } = c
  const by = (role: 'owner' | 'manager') => firstName(s.users.find(u => u.role === role && u.status === 'active')?.name ?? (role === 'owner' ? 'the owner' : 'the manager'))
  const owner = by('owner'), manager = by('manager')
  return [
    `**Private app rollout for ${s.settings.orgName}: about 4 to 6 weeks, mostly waiting on Apple and Google.**`,
    `1. **Week 1 · ${owner}:** enrol the clinic in the Apple Developer Program as an organisation (it needs a D-U-N-S number, which can take up to 2 weeks) and open a Google Play Console account.`,
    `2. **Week 1 · ${owner}:** create the Apple Business Manager account, and set up managed Google Play through Google Workspace or your device-management provider.`,
    '3. **Weeks 2 to 3 · developer:** build the iOS and Android wrappers with push notifications and sign-in using each person’s own Lead Manager login.',
    `4. **Week 3 · ${manager}:** test on 2 or 3 staff phones for a week: new-lead alerts, the 15-minute call flow and escalations.`,
    '5. **Week 4 · developer:** submit the iOS build as a custom app (review usually takes 1 to 3 days) and publish the Android build privately to your organisation.',
    `6. **Weeks 4 to 5 · ${manager}:** assign the app to staff devices or Managed Apple IDs, and set up work profiles on Android phones.`,
    '',
    'Start today with the web app: staff can install it from the browser (Settings → Mobile app) and get the same notifications while the store apps are set up.',
  ].join('\n')
}

// ---- fallback ---------------------------------------------------------------------------------

function fallback(c: Ctx): string {
  const calls = visibleTasks(c).filter(t => t.type === 'call' || t.type === 'callback').length
  const chats = chatsNeedingPerson(c).length
  return [
    'I can only answer a set of common questions in this demo, because live Claude isn’t connected here. Right now:',
    canOpen(c.me, 'tasks') ? `- ${plural(calls, 'call')} waiting` : '',
    flags(c).allChats || flags(c).assignedChats ? `- ${plural(chats, 'chat')} needing a person` : '',
    `- ${plural(todaysAppointments(c).length, 'appointment')} today`,
    '',
    'Try one of the suggested questions, ask about a client by name, or open this preview inside claude.ai for live answers to anything.',
  ].filter(Boolean).join('\n')
}
