import type { ReactNode } from 'react'
import { useStore } from '../lib/store'
import { canOpen } from '../lib/permissions'
import { ROLE_LABEL } from '../lib/types'
import { longDate, money, ms, timeOf, useNow } from '../lib/time'
import { Countdown } from '../components/ui'
import { Icon } from '../components/icons'
import { fmtDuration, fmtInt, fmtPct, plural } from './analytics/format'
import { topSources } from './analytics/data'
import { CallQueue, DailyBrief, FunnelSnapshot, NeedsPerson, Schedule, Tile } from './today/parts'
import { AiStatus, Arrivals, ClinicList, ClinicalQuestions, MarketingSources, PaymentsDue, TeamSla, Unconfirmed } from './today/roles'
import {
  aiRepliesToday, callQueue, clientName, firstName, greeting, headline, medianFirstReplyToday, needsPerson, openPayments, reasonOf, seesAll, todaysAppointments, unconfirmedSoon,
} from './today/compute'
import './today.css'

export default function Today() {
  const { state, me, can, actions } = useStore()
  const now = useNow(30_000)
  const role = me.role
  const all = seesAll(role)
  const canAllChats = can('chats.view_all')
  const cur = state.settings.currency
  const go = (page: Parameters<typeof actions.go>[0], id?: string) => (canOpen(me, page) ? () => actions.go(page, id) : undefined)

  const calls = callQueue(state, me)
  const chats = needsPerson(state, me, canAllChats)
  const appts = todaysAppointments(state, now)
  const head = headline(state, me, now, p => can(p))
  const upcoming = (a: { start: string; status: string }) => ms(a.start) > now && !['completed', 'no_show', 'cancelled', 'arrived'].includes(a.status)
  const nextAppt = appts.find(upcoming)

  // ---- tiles ----
  const callsTile = (
    <Tile key="calls" icon="phone" label={all ? 'Leads waiting for a call' : 'My leads to call'} value={fmtInt(calls.length)}
      tone={calls.some(t => ms(t.dueAt) < now) ? 'danger' : calls.length ? 'warn' : 'ok'}
      hint={calls[0] ? <span className="td-tile-row"><Countdown deadline={calls[0].dueAt} compact /><span className="truncate">{clientName(state, calls[0].clientId)}</span></span> : 'No one waiting'}
      onClick={go('tasks', calls[0]?.id)} ariaLabel={`${calls.length} leads waiting for a call. Open tasks`} />
  )
  const draftCount = chats.filter(c => c.draft).length
  const riskCount = chats.filter(c => /minor|complaint|clinical/i.test(reasonOf(c))).length
  const chatsTile = (
    <Tile key="chats" icon="message" label="Chats needing a person" value={fmtInt(chats.length)} tone={riskCount ? 'warn' : undefined}
      hint={chats.length ? [draftCount && `${draftCount} ${draftCount === 1 ? 'draft' : 'drafts'} to approve`, riskCount && `${riskCount} flagged`].filter(Boolean).join(' · ') || 'Waiting for a reply' : 'All handled'}
      onClick={go('inbox', chats[0]?.id)} ariaLabel={`${chats.length} chats need a person. Open inbox`} />
  )
  const apptTile = (
    <Tile key="appts" icon="calendar" label="Today's appointments" value={fmtInt(appts.length)}
      hint={nextAppt ? `Next: ${timeOf(nextAppt.start)} ${clientName(state, nextAppt.clientId)}` : appts.length ? 'All started or finished' : 'Nothing booked'}
      onClick={go('calendar')} ariaLabel={`${appts.length} appointments today. Open calendar`} />
  )
  const aiTile = (
    <Tile key="ai" icon="sparkles" label="AI replies today" value={state.ai.killSwitch ? 'Paused' : fmtInt(aiRepliesToday(state, now))} tone={state.ai.killSwitch ? 'danger' : 'accent'}
      hint={`Median first reply ${fmtDuration(medianFirstReplyToday(state, now))}`}
      onClick={go(canOpen(me, 'ai') ? 'ai' : 'analytics')} ariaLabel={`AI replies today. Open ${canOpen(me, 'ai') ? 'AI settings' : 'analytics'}`} />
  )

  let tiles: ReactNode[] = [callsTile, chatsTile, apptTile, aiTile]
  let left: ReactNode[] = []
  let right: ReactNode[] = []

  if (role === 'owner' || role === 'manager' || role === 'coordinator') {
    left = [
      <CallQueue key="calls" tasks={calls} showAssignee={all} />,
      <NeedsPerson key="chats" convs={chats} scopeNote={canAllChats ? 'Drafts to approve and chats the AI handed over.' : 'Chats assigned to you.'} />,
      ...(all ? [<TeamSla key="sla" />] : []),
    ]
    right = [
      <DailyBrief key="brief" />,
      ...(all ? [<AiStatus key="ai" />] : []),
      <Schedule key="schedule" appts={appts} />,
      ...(can('analytics.view') ? [<FunnelSnapshot key="funnel" />] : []),
    ]
  } else if (role === 'frontdesk') {
    const arrived = appts.filter(a => a.status === 'arrived')
    const unconfirmed = unconfirmedSoon(state, now)
    tiles = [
      apptTile,
      <Tile key="arrived" icon="user" label="In reception now" value={fmtInt(arrived.length)} tone={arrived.length ? 'accent' : undefined} hint={arrived[0] ? `${clientName(state, arrived[0].clientId)} for ${timeOf(arrived[0].start)}` : 'No one waiting'} />,
      <Tile key="unconf" icon="alert" label="Unconfirmed, today and tomorrow" value={fmtInt(unconfirmed.length)} tone={unconfirmed.length ? 'warn' : 'ok'} hint={unconfirmed.length ? 'Confirm by phone or WhatsApp' : 'Everyone confirmed'} />,
      chatsTile,
    ]
    left = [<Arrivals key="arrivals" />, <Unconfirmed key="unconf" />, <NeedsPerson key="chats" convs={chats} scopeNote="Chats assigned to you." />]
    right = [<DailyBrief key="brief" />, <Schedule key="schedule" appts={appts} />]
    if (calls.length) left.unshift(<CallQueue key="calls" tasks={calls} showAssignee={false} title="Calls for you" />)
  } else if (role === 'clinician') {
    const mine = todaysAppointments(state, now, me.id)
    const questions = state.tasks.filter(t => t.status === 'open' && t.type === 'clinical_review' && t.assignedTo === me.id)
    const waiting = mine.filter(a => a.status === 'arrived')
    // Someone already in reception is the next patient, even if their slot has not started yet.
    const next = waiting[0] ?? mine.find(upcoming)
    tiles = [
      <Tile key="mine" icon="calendar" label="My patients today" value={fmtInt(mine.length)} hint={`${mine.filter(a => a.status === 'completed').length} seen so far`} onClick={go('calendar')} />,
      <Tile key="q" icon="shield" label="Clinical questions" value={fmtInt(questions.length)} tone={questions.length ? 'warn' : 'ok'} hint={questions[0] ? <span className="td-tile-row"><Countdown deadline={questions[0].dueAt} compact /><span className="truncate">{clientName(state, questions[0].clientId)}</span></span> : 'None waiting'} onClick={go('tasks', questions[0]?.id)} />,
      <Tile key="waiting" icon="user" label="Waiting for you" value={fmtInt(waiting.length)} tone={waiting.length ? 'accent' : undefined} hint={waiting[0] ? `${clientName(state, waiting[0].clientId)} has arrived` : 'No one in reception'} />,
      <Tile key="next" icon="clock" label="Next patient" value={next ? timeOf(next.start) : '—'} hint={next ? `${clientName(state, next.clientId)}${next.status === 'arrived' ? ' · in reception' : ''}` : 'No more today'} onClick={next ? () => actions.go('client', next.clientId) : undefined} />,
    ]
    left = [<ClinicList key="clinic" />, <ClinicalQuestions key="questions" />]
    right = [<DailyBrief key="brief" />, <Schedule key="schedule" appts={appts} title="Whole clinic today" />]
  } else if (role === 'finance') {
    const p = openPayments(state, now)
    const deposits = p.list.filter(x => x.kind === 'deposit')
    const rev7 = state.metrics.slice(-7).reduce((a, d) => a + d.revenue, 0)
    tiles = [
      <Tile key="over" icon="alert" label="Overdue" value={money(p.overdueTotal, cur)} tone={p.overdue.length ? 'danger' : 'ok'} hint={p.overdue.length ? plural(p.overdue.length, 'payment') : 'Nothing overdue'} />,
      <Tile key="due7" icon="clock" label="Due in the next 7 days" value={money(p.due7Total, cur)} hint={plural(p.due7.length, 'payment')} />,
      <Tile key="paid" icon="check" label="Paid in the last 30 days" value={money(p.paid30Total, cur)} hint={plural(p.paid30.length, 'payment')} />,
      can('analytics.revenue')
        ? <Tile key="rev" icon="chart" label="Treatment revenue, 7 days" value={money(rev7, cur)} hint="From daily figures" onClick={go('analytics')} />
        : <Tile key="dep" icon="card" label="Deposits outstanding" value={fmtInt(deposits.length)} hint="Before consultations" />,
    ]
    left = [<PaymentsDue key="payments" />]
    right = [<DailyBrief key="brief" />, ...(can('analytics.view') ? [<FunnelSnapshot key="funnel" />] : [])]
  } else if (role === 'marketing') {
    const m = state.metrics
    const w = m.slice(-7), pw = m.slice(-14, -7)
    const dms = w.reduce((a, d) => a + d.dms, 0), pdms = pw.reduce((a, d) => a + d.dms, 0)
    const contacts = w.reduce((a, d) => a + d.contacts, 0)
    const best = topSources(state, 30, 'all', now)[0]
    tiles = [
      <Tile key="dms" icon="message" label="DMs, last 7 days" value={fmtInt(dms)} hint={pdms ? `${dms >= pdms ? '+' : '−'}${Math.abs(Math.round(((dms - pdms) / pdms) * 100))}% on the week before` : undefined} onClick={go('analytics')} />,
      <Tile key="rate" icon="phone" label="Contact rate, 7 days" value={fmtPct(dms ? contacts / dms : NaN)} hint={`${fmtInt(contacts)} numbers shared`} onClick={go('analytics')} />,
      aiTile,
      <Tile key="best" icon="star" label="Top source, 30 days" value={best ? fmtInt(best.booked) : '—'} hint={best ? <span className="td-clamp">booked from {best.detail}</span> : 'No leads yet'} onClick={go('analytics')} />,
    ]
    left = [<MarketingSources key="sources" />]
    right = [<DailyBrief key="brief" />, <FunnelSnapshot key="funnel" />]
  }

  return (
    <div className="page td-page">
      <header className="td-head">
        <div className="td-head-text">
          <span className="eyebrow">{longDate(new Date(now).toISOString())} · {ROLE_LABEL[role]}</span>
          <h1>{greeting(now)}, {firstName(me)}</h1>
          <p className={`td-now tone-${head.tone}`}>
            <Icon name={head.tone === 'danger' ? 'alert' : head.tone === 'warn' ? 'clock' : head.tone === 'ok' ? 'check' : 'info'} size={16} />
            <span>{head.text}</span>
            {head.link && canOpen(me, head.link.page) && (
              <button type="button" className="td-now-link" onClick={() => actions.go(head.link!.page, head.link!.id)}>{head.link.label}<Icon name="arrowRight" size={14} /></button>
            )}
          </p>
        </div>
      </header>

      <section className="td-tiles" aria-label="Summary">{tiles}</section>

      <div className="td-grid">
        <div className="td-col">{left}</div>
        <div className="td-col">{right}</div>
      </div>
    </div>
  )
}
