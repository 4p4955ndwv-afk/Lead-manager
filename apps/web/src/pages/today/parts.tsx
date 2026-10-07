import type { ReactNode } from 'react'
import { Avatar, Button, Card, ChannelBadge, Chip, Countdown, EmptyState, UserAvatar } from '../../components/ui'
import { Icon, type IconName } from '../../components/icons'
import { useStore } from '../../lib/store'
import { canOpen, maskPhone } from '../../lib/permissions'
import type { Appointment, Conversation, Task } from '../../lib/types'
import { HOUR, ago, ms, timeOf, useNow } from '../../lib/time'
import { FunnelBars } from '../analytics/Funnel'
import { funnelOf, toDays, windowOf } from '../analytics/data'
import { fmtPct } from '../analytics/format'
import {
  STATUS_LABEL, STATUS_TONE, apptWhat, claudePrompt, clientChannel, clientName, dailyBrief, lastClientText, reasonOf, reasonTone,
} from './compute'

// ---- summary tile --------------------------------------------------------------------------------

export function Tile({ label, value, hint, icon, tone, onClick, ariaLabel }: { label: string; value: ReactNode; hint?: ReactNode; icon: IconName; tone?: 'danger' | 'warn' | 'ok' | 'accent'; onClick?: () => void; ariaLabel?: string }) {
  const body = (
    <>
      <span className="td-tile-label"><Icon name={icon} size={15} />{label}</span>
      <span className={`td-tile-value ${tone ? 'is-' + tone : ''}`}>{value}</span>
      {hint && <span className="td-tile-hint">{hint}</span>}
    </>
  )
  return onClick
    ? <button type="button" className="td-tile is-clickable" onClick={onClick} aria-label={ariaLabel}>{body}</button>
    : <div className="td-tile">{body}</div>
}

/** Live deadline: a ticking countdown when it is close, otherwise a plain due time. */
export function Deadline({ due }: { due: string }) {
  const now = useNow(30_000)
  const left = ms(due) - now
  if (left < 6 * HOUR) return <Countdown deadline={due} compact />
  const d = new Date(due)
  const sameDay = new Date(now).toDateString() === d.toDateString()
  return (
    <span className="td-due num" title={d.toLocaleString()}>
      <Icon name="clock" size={13} />
      {sameDay ? timeOf(due) : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${timeOf(due)}`}
    </span>
  )
}

export function EscalationChip({ level }: { level: Task['escalationLevel'] }) {
  if (!level) return null
  return level === 2
    ? <Chip tone="danger" icon="alert">Escalated to owner</Chip>
    : <Chip tone="warn" icon="alert">Escalated to manager</Chip>
}

// ---- call now ------------------------------------------------------------------------------------

export function CallQueue({ tasks, showAssignee, title = 'Call now' }: { tasks: Task[]; showAssignee: boolean; title?: string }) {
  const { state, actions, can, me } = useStore()
  const shown = tasks.slice(0, 6)
  return (
    <Card title={title} subtitle={showAssignee ? 'Every open lead call, soonest deadline first.' : 'Your open lead calls, soonest deadline first.'} padded={false} className="td-card"
      actions={canOpen(me, 'tasks') ? <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => actions.go('tasks')}>All tasks</Button> : undefined}>
      {shown.length === 0 ? (
        <EmptyState icon="phone" title="No one is waiting for a call" body="When someone shares their number in a DM, the AI creates a call here with a 15-minute countdown." />
      ) : (
        <ul className="td-list">
          {shown.map(t => {
            const client = state.clients.find(c => c.id === t.clientId)
            return (
              <li key={t.id}>
                <button type="button" className="td-item td-item-call" onClick={() => actions.go('tasks', t.id)}>
                  <span className="td-item-lead"><Deadline due={t.dueAt} /></span>
                  <span className="td-item-main">
                    <span className="td-item-title">
                      <span className="strong truncate">{client?.name ?? 'Unknown client'}</span>
                      <ChannelBadge channel={clientChannel(state, t.clientId)} label={false} size="sm" />
                      {t.type === 'callback' && <Chip tone="info">Call back</Chip>}
                      <EscalationChip level={t.escalationLevel} />
                    </span>
                    <span className="td-item-sub">
                      {client?.phone && <span className="mono td-phone">{maskPhone(client.phone, can('clients.view_phone'))}</span>}
                      <span className="truncate">{t.brief ?? t.title}</span>
                    </span>
                  </span>
                  <span className="td-item-trail">
                    {showAssignee && <UserAvatar userId={t.assignedTo} size={24} />}
                    <Icon name="chevronRight" size={16} />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {tasks.length > shown.length && <p className="td-more tiny muted">{tasks.length - shown.length} more in Tasks &amp; calls</p>}
    </Card>
  )
}

// ---- needs a person ------------------------------------------------------------------------------

export function NeedsPerson({ convs, scopeNote }: { convs: Conversation[]; scopeNote: string }) {
  const { state, actions, me } = useStore()
  const now = useNow(30_000)
  const shown = convs.slice(0, 6)
  return (
    <Card title="Needs a person" subtitle={scopeNote} padded={false} className="td-card"
      actions={canOpen(me, 'inbox') ? <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => actions.go('inbox')}>Inbox</Button> : undefined}>
      {shown.length === 0 ? (
        <EmptyState icon="message" title="No chats need you" body="Chats land here when the AI drafts a reply for approval, spots a clinical question or a possible minor, or is not confident." />
      ) : (
        <ul className="td-list">
          {shown.map(c => {
            const reason = reasonOf(c)
            const name = clientName(state, c.clientId)
            return (
              <li key={c.id}>
                <button type="button" className="td-item" onClick={() => actions.go('inbox', c.id)}>
                  <span className="td-item-lead td-item-avatar"><Avatar name={name} size={30} /></span>
                  <span className="td-item-main">
                    <span className="td-item-title">
                      <span className="strong truncate">{name}</span>
                      <ChannelBadge channel={c.channel} label={false} size="sm" />
                      <Chip tone={reasonTone(reason)}>{reason}</Chip>
                    </span>
                    <span className="td-item-sub"><span className="truncate">“{lastClientText(c)}”</span></span>
                  </span>
                  <span className="td-item-trail">
                    <span className="tiny muted td-nowrap">{ago(c.lastInboundAt, now)}</span>
                    {c.unread > 0 && <span className="td-unread num" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {convs.length > shown.length && <p className="td-more tiny muted">{convs.length - shown.length} more in the inbox</p>}
    </Card>
  )
}

// ---- schedule ------------------------------------------------------------------------------------

export function Schedule({ appts, title = "Today's schedule", subtitle, onOpen, emptyBody }: { appts: Appointment[]; title?: string; subtitle?: string; onOpen?: (a: Appointment) => void; emptyBody?: string }) {
  const { state, actions, me } = useStore()
  const now = useNow(30_000)
  const open = onOpen ?? (canOpen(me, 'calendar') ? (a: Appointment) => actions.go('calendar', a.id) : undefined)
  const nowIndex = appts.findIndex(a => ms(a.start) > now)
  const markerAt = nowIndex === -1 ? appts.length : nowIndex
  const items: ReactNode[] = []
  appts.forEach((a, i) => {
    if (i === markerAt) items.push(<NowMarker key="now" now={now} />)
    const practitioner = state.users.find(u => u.id === a.practitionerId)
    const room = state.rooms.find(r => r.id === a.roomId)
    const past = ms(a.end) < now
    const current = ms(a.start) <= now && ms(a.end) >= now
    items.push(
      <li key={a.id}>
        <button type="button" className={`td-slot ${past ? 'is-past' : ''} ${current ? 'is-current' : ''}`} onClick={open ? () => open(a) : undefined} disabled={!open}>
          <span className="td-slot-time num">
            <span className="strong">{timeOf(a.start)}</span>
            <span className="tiny muted">{Math.round((ms(a.end) - ms(a.start)) / 60000)} min</span>
          </span>
          <span className="td-slot-rail" aria-hidden="true"><span className={`td-slot-dot tone-${STATUS_TONE[a.status]}`} /></span>
          <span className="td-slot-main">
            <span className="td-item-title">
              <span className="strong truncate">{clientName(state, a.clientId)}</span>
              <Chip tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Chip>
              {a.deposit === 'due' && <Chip tone="warn" icon="card">Deposit due</Chip>}
            </span>
            <span className="small td-slot-what">{apptWhat(state, a)}</span>
            <span className="tiny muted">{practitioner?.name ?? 'No practitioner'}{room ? ` · ${room.name}` : ''}</span>
          </span>
        </button>
      </li>,
    )
  })
  if (appts.length && markerAt === appts.length) items.push(<NowMarker key="now" now={now} />)
  return (
    <Card title={title} subtitle={subtitle ?? `${appts.length} ${appts.length === 1 ? 'appointment' : 'appointments'}`} padded={false} className="td-card"
      actions={canOpen(me, 'calendar') ? <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => actions.go('calendar')}>Calendar</Button> : undefined}>
      {appts.length === 0
        ? <EmptyState icon="calendar" title="Nothing booked today" body={emptyBody ?? 'Consultations booked on a call and treatment sessions from plans appear here on the day.'} />
        : <ol className="td-timeline">{items}</ol>}
    </Card>
  )
}

function NowMarker({ now }: { now: number }) {
  return (
    <li className="td-now-marker" aria-label={`Now, ${timeOf(new Date(now).toISOString())}`}>
      <span className="td-now-time num">{timeOf(new Date(now).toISOString())}</span>
      <span className="td-now-line" />
    </li>
  )
}

// ---- Claude daily brief --------------------------------------------------------------------------

export function DailyBrief() {
  const { state, me, can } = useStore()
  const now = useNow(60_000)
  const text = dailyBrief(state, me, now, p => can(p))
  const ask = () => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: claudePrompt(me, state.settings.orgName) } }))
  return (
    <section className="card card-padded td-brief" aria-labelledby="td-brief-title">
      <div className="td-brief-head">
        <span className="td-brief-mark" aria-hidden="true"><Icon name="sparkles" size={16} /></span>
        <h2 id="td-brief-title" className="card-title">Daily brief by Claude</h2>
      </div>
      <p className="td-brief-text">{text}</p>
      <div className="td-brief-foot">
        <span className="tiny muted">Written from live clinic data at {timeOf(new Date(now).toISOString())}</span>
        <Button size="sm" variant="subtle" icon="sparkles" onClick={ask}>Ask Claude about today</Button>
      </div>
    </section>
  )
}

// ---- weekly funnel -------------------------------------------------------------------------------

export function FunnelSnapshot() {
  const { state, actions, me } = useStore()
  const rows = windowOf(toDays(state.metrics, 'all'), 7) ?? toDays(state.metrics, 'all')
  const f = funnelOf(rows)
  return (
    <Card title="This week's funnel" subtitle={`Last 7 days · ${fmtPct(f.dms ? f.treatments / f.dms : NaN, 1)} of DMs started treatment`} className="td-card"
      actions={canOpen(me, 'analytics') ? <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => actions.go('analytics')}>Analytics</Button> : undefined}>
      {f.dms ? <FunnelBars funnel={f} compact /> : <EmptyState icon="chart" title="No DMs this week yet" body="The funnel fills in as DMs arrive and leads move from number shared to treatment." />}
    </Card>
  )
}
