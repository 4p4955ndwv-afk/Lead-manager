import { useState } from 'react'
import type { Conversation, Task, TaskType } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { activeEpisode, byId, useStore } from '../../lib/store'
import { canOpen, maskPhone } from '../../lib/permissions'
import { ago, dateTime, money, ms, until, useNow } from '../../lib/time'
import { Avatar, Button, ChannelBadge, Chip, Countdown, Progress, StageBadge, UserAvatar } from '../../components/ui'
import { Icon, type IconName } from '../../components/icons'
import { MoveStageDialog } from './dialogs'
import { languageName } from './helpers'

const TASK_ICON: Record<TaskType, IconName> = { call: 'phone', callback: 'phone', follow_up: 'clock', clinical_review: 'shield', payment: 'card', review: 'star' }
const APPT_LABEL = { consultation: 'Consultation', session: 'Treatment session', follow_up: 'Follow-up' } as const
const APPT_STATUS_TONE = { unconfirmed: 'warn', confirmed: 'ok', arrived: 'team', completed: 'neutral', no_show: 'danger', cancelled: 'neutral' } as const

export function ContextPanel({ conv }: { conv: Conversation }) {
  const { state, me, can, actions } = useStore()
  const now = useNow(30_000)
  const [moving, setMoving] = useState(false)
  const client = byId(state.clients, conv.clientId)
  if (!client) return <p className="muted small ib-ctx-pad">This chat is not linked to a client record yet.</p>
  const ep = activeEpisode(state, client.id)
  const owner = byId(state.users, client.ownerId)
  const branch = byId(state.branches, client.branchId)
  const handle = client.handles[conv.channel as 'instagram' | 'tiktok'] ?? client.handles.instagram ?? client.handles.tiktok
  const tasks = state.tasks.filter(t => t.clientId === client.id && t.status === 'open' && (t.type !== 'payment' || can('payments.view'))).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  const nextAppt = state.appointments
    .filter(a => a.clientId === client.id && ms(a.end) > now && !['cancelled', 'no_show', 'completed'].includes(a.status))
    .sort((a, b) => ms(a.start) - ms(b.start))[0]
  const showMoney = can('payments.view') || can('analytics.revenue')
  const score = client.score
  const heat = score >= 75 ? { label: 'Hot', tone: 'ok' as const } : score >= 50 ? { label: 'Warm', tone: 'warn' as const } : { label: 'Cool', tone: 'neutral' as const }
  const consent: Array<[string, boolean]> = [['WhatsApp', client.consent.whatsapp], ['SMS', client.consent.sms], ['Marketing', client.consent.marketing], ['Call recording', client.consent.callRecording]]

  return (
    <div className="ib-ctx">
      <section className="ib-ctx-sec ib-ctx-id">
        <div className="row">
          <Avatar name={client.name} size={44} />
          <div className="stack grow" style={{ gap: 0 }}>
            <h2 className="ib-ctx-name truncate">{client.name}</h2>
            <span className="small muted truncate">{handle ?? 'No social handle'}</span>
          </div>
        </div>
        <div className="ib-ctx-phone">
          <Icon name="phone" size={14} />
          <span className="num">{client.phone ? maskPhone(client.phone, can('clients.view_phone')) : 'No number shared yet'}</span>
          {client.phone && !can('clients.view_phone') && <Chip icon="lock" title="Your role cannot see phone numbers">Hidden</Chip>}
        </div>
        <div className="ib-ctx-actions">
          <Button size="sm" variant="secondary" icon="user" onClick={() => actions.go('client', client.id)}>Open client record</Button>
          {ep && can('pipeline.move') && <Button size="sm" variant="secondary" icon="arrowRight" onClick={() => setMoving(true)}>Move stage</Button>}
        </div>
      </section>

      {(client.doNotContact || ep?.exit === 'under18' || ep?.exit === 'dnc') && (
        <section className="ib-ctx-sec">
          <div className="ib-ctx-alert">
            <Icon name="alert" size={15} />
            <span>{ep?.exit === 'under18' ? 'Possible minor. Booking is blocked until age is verified in person.' : 'Do not contact. Follow-ups and reminders are switched off.'}</span>
          </div>
        </section>
      )}

      <section className="ib-ctx-sec">
        <div className="ib-ctx-grid">
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Lead score</span>
            <div className="row">
              <span className="ib-ctx-score num">{score}</span>
              <Chip tone={heat.tone}>{heat.label}</Chip>
            </div>
            <Progress value={score} tone={heat.tone === 'neutral' ? 'info' : heat.tone} label={`Lead score ${score} of 100`} />
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <span className="eyebrow">Stage</span>
            {ep ? <span><StageBadge stage={ep.stage} exit={ep.exit} /></span> : <span className="muted small">No episode</span>}
            {ep && <span className="tiny muted">{ep.number > 1 ? `Returning client · episode ${ep.number}` : `Started ${ago(ep.startedAt, now)}`}</span>}
          </div>
        </div>
        {ep?.exitReason && <p className="small muted">Reason: {ep.exitReason}</p>}
      </section>

      <section className="ib-ctx-sec">
        <h3 className="eyebrow">Interested in</h3>
        {ep && ep.interests.length > 0 ? (
          <div className="row wrap" style={{ gap: 6 }}>
            {ep.interests.map(id => <Chip key={id} tone="accent">{byId(state.procedures, id)?.name ?? id}</Chip>)}
          </div>
        ) : <p className="small muted">Not mentioned yet. The AI adds treatments as they come up in the chat.</p>}
        {showMoney && ep && ep.value > 0 && <p className="small muted">Expected value <b className="ib-ink num">{money(ep.value, state.settings.currency)}</b></p>}
      </section>

      <section className="ib-ctx-sec">
        <dl className="ib-ctx-kv">
          <div><dt>Source</dt><dd><ChannelBadge channel={client.source.channel} size="sm" label={false} /> <span>{client.source.detail}</span></dd></div>
          <div><dt>Language</dt><dd>{languageName(client.language)}</dd></div>
          <div><dt>Owner</dt><dd>{owner ? <span className="row" style={{ gap: 6 }}><UserAvatar userId={owner.id} size={20} /><span className="truncate">{owner.name}</span>{!owner.onShift && <span className="tiny faint">off shift</span>}</span> : <span className="muted">{client.phone ? 'Unassigned' : 'Unassigned until a number is shared'}</span>}</dd></div>
          <div><dt>Branch</dt><dd>{branch ? `${branch.name}, ${branch.city}` : '—'}</dd></div>
          <div><dt>First contact</dt><dd>{ago(client.createdAt, now)}</dd></div>
        </dl>
      </section>

      <section className="ib-ctx-sec">
        <h3 className="eyebrow">Consent</h3>
        <div className="row wrap" style={{ gap: 6 }}>
          {consent.map(([label, on]) => <Chip key={label} tone={on ? 'ok' : 'neutral'} icon={on ? 'check' : 'x'}>{label}</Chip>)}
          <Chip tone={client.ageVerified ? 'ok' : 'warn'} icon={client.ageVerified ? 'check' : 'alert'}>{client.ageVerified ? 'Age verified' : 'Age not verified'}</Chip>
          {client.doNotContact && <Chip tone="danger" icon="x">Do not contact</Chip>}
        </div>
      </section>

      <section className="ib-ctx-sec">
        <h3 className="eyebrow">Open tasks {tasks.length > 0 && <span className="num">({tasks.length})</span>}</h3>
        {tasks.length === 0 ? (
          <p className="small muted">{client.phone ? `No open tasks for ${client.name.split(' ')[0]}. Create a follow-up from the chat’s menu if something needs doing.` : `No open tasks. A call task with a 15-minute deadline is created automatically when ${client.name.split(' ')[0]} shares a number.`}</p>
        ) : (
          <ul className="ib-ctx-tasks">
            {tasks.map(t => <TaskRow key={t.id} t={t} meId={me.id} now={now} />)}
          </ul>
        )}
      </section>

      <section className="ib-ctx-sec">
        <h3 className="eyebrow">Next appointment</h3>
        {nextAppt ? (() => {
          const inner = <>
            <span className="ib-ctx-appt-icon"><Icon name="calendar" size={16} /></span>
            <span className="stack grow" style={{ gap: 1 }}>
              <span className="strong small">{APPT_LABEL[nextAppt.type]}{nextAppt.procedureId ? ` · ${byId(state.procedures, nextAppt.procedureId)?.name ?? ''}` : ''}{nextAppt.sessionNo ? ` · session ${nextAppt.sessionNo}` : ''}</span>
              <span className="tiny muted num">{dateTime(nextAppt.start)} · {until(nextAppt.start, now)} · {byId(state.users, nextAppt.practitionerId)?.name}</span>
            </span>
            <Chip tone={APPT_STATUS_TONE[nextAppt.status]}>{nextAppt.status === 'unconfirmed' ? 'Unconfirmed' : nextAppt.status === 'arrived' ? 'Arrived' : 'Confirmed'}</Chip>
          </>
          // roles without the calendar see the appointment but get no link that would bounce them to Today
          return canOpen(me, 'calendar')
            ? <button type="button" className="ib-ctx-appt" onClick={() => actions.go('calendar', nextAppt.id)}>{inner}</button>
            : <div className="ib-ctx-appt is-static">{inner}</div>
        })() : <p className="small muted">Nothing booked. Appointments booked on the call show up here.</p>}
      </section>

      <section className="ib-ctx-sec">
        <Button size="sm" variant="ghost" icon="sparkles" onClick={() => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: `Summarise the ${conv.channel} chat with ${client.name} and suggest the best next step.` } }))}>
          Ask Claude about this lead
        </Button>
      </section>

      {ep && <MoveStageDialog open={moving} onClose={() => setMoving(false)} episodeId={ep.id} />}
    </div>
  )
}

function TaskRow({ t, meId, now }: { t: Task; meId: string; now: number }) {
  const { state, me, actions } = useStore()
  const assignee = byId(state.users, t.assignedTo)
  const overdue = ms(t.dueAt) < now
  const linked = canOpen(me, 'tasks')
  const Row = linked ? 'button' : 'div'
  return (
    <li>
      <Row {...(linked ? { type: 'button' as const, onClick: () => actions.go('tasks', t.id) } : {})} className={`ib-ctx-task ${linked ? '' : 'is-static'}`}>
        <span className={`ib-ctx-task-icon ${t.priority === 'urgent' ? 'is-urgent' : ''}`}><Icon name={TASK_ICON[t.type]} size={15} /></span>
        <span className="stack grow" style={{ gap: 2 }}>
          <span className="small strong ib-ctx-task-title">{t.title}</span>
          <span className="tiny muted">{t.assignedTo === meId ? 'You' : assignee ? `${assignee.name} · ${ROLE_LABEL[assignee.role]}` : 'Unassigned'}</span>
          <span className="row wrap" style={{ gap: 6 }}>
            {t.slaMinutes ? <Countdown deadline={t.dueAt} compact /> : <Chip tone={overdue ? 'danger' : 'neutral'} icon="clock">{overdue ? `Overdue · due ${ago(t.dueAt, now)}` : `Due ${until(t.dueAt, now)}`}</Chip>}
            {t.escalationLevel > 0 && !!t.slaMinutes && <Chip tone="danger" icon="alert">Escalated to {t.escalationLevel === 1 ? 'manager' : 'owner'}</Chip>}
          </span>
        </span>
      </Row>
    </li>
  )
}
