// Right-hand pane (full screen on phones): who to call, why, the call itself, and what happened before.
import type { Task } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { activeEpisode, byId, userName, useStore } from '../../lib/store'
import { ago, useNow } from '../../lib/time'
import { Avatar, Button, ChannelBadge, Chip, EmptyState, Field, StageBadge, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { CallFlow } from './CallFlow'
import { BriefCard, ClientSnapshot, FinishTask, History } from './Panels'
import { DueLabel, EscalationChip } from './TaskList'
import { OUTCOME_META, PRIORITY_META, TYPE_META, firstName, isCallType, isManager, latestConversation } from './helpers'

export function TaskDetail({ task, onBack, next, phoneShown, onReveal, doneAt }: {
  task: Task
  onBack?: () => void
  next?: Task
  phoneShown: boolean
  onReveal: (clientId: string, why: 'call' | 'view') => void
  doneAt?: string
}) {
  const { state, me, can, actions } = useStore()
  const now = useNow(15_000)
  const client = byId(state.clients, task.clientId)
  if (!client) {
    return <div className="card card-padded"><EmptyState icon="user" title="Client not found" body="The person on this task may have been merged or erased. Ask a manager to check the audit log." /></div>
  }
  const episode = (task.episodeId ? byId(state.episodes, task.episodeId) : undefined) ?? activeEpisode(state, client.id)
  const conversation = latestConversation(state, client.id)
  const manager = isManager(me, can)
  const mine = task.assignedTo === me.id
  const open = task.status === 'open'
  const callType = isCallType(task.type)
  const assignee = userName(state, task.assignedTo)
  const canAct = open && (mine || manager) && (!callType || can('pipeline.move') || manager)
  const blockedReason = !open ? undefined : !(mine || manager) ? `This task belongs to ${assignee}. Only they or a manager can log it.` : !canAct ? 'Logging call outcomes needs access to move leads along the journey.' : undefined
  const meta = TYPE_META[task.type]
  const last = task.attempts[task.attempts.length - 1]
  const reveal = (why: 'call' | 'view') => onReveal(client.id, why)
  const handle = client.handles.instagram ?? client.handles.tiktok

  return (
    <article className="tk-detail" aria-label={task.title}>
      {onBack && (
        <button type="button" className="tk-back" onClick={onBack}><Icon name="chevronLeft" size={16} />All tasks</button>
      )}

      <header className="tk-dhead card">
        <div className="tk-dhead-chips">
          <Chip tone={meta.tone} icon={meta.icon}>{meta.label}</Chip>
          {open && <DueLabel task={task} now={now} />}
          <EscalationChip task={task} />
          {open && task.priority !== 'normal' && <Chip tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Chip>}
          {task.attempts.length > 0 && open && <Chip icon="phone">{task.attempts.length} {task.attempts.length === 1 ? 'try' : 'tries'}</Chip>}
        </div>
        <h2 className="tk-dtitle">{task.title}</h2>
        <div className="tk-dclient">
          <Avatar name={client.name} size={36} />
          <div className="stack grow" style={{ gap: 2 }}>
            <button type="button" className="tk-dname" onClick={() => actions.go('client', client.id)}>
              <span className="truncate">{client.name}</span><Icon name="chevronRight" size={15} />
            </button>
            <span className="row wrap tk-dclient-sub">
              {episode && <StageBadge stage={episode.stage} exit={episode.exit} />}
              <ChannelBadge channel={client.source.channel} size="sm" label={false} />
              {handle && <span className="small muted truncate">{handle}</span>}
            </span>
          </div>
        </div>
        <div className="tk-dassign">
          {manager && open ? (
            <Reassign task={task} />
          ) : (
            <span className="row small" style={{ gap: 6 }}>
              <span className="muted">Assigned to</span><UserAvatar userId={task.assignedTo} size={22} /><span className="strong">{mine ? `${assignee} (you)` : assignee}</span>
            </span>
          )}
        </div>
      </header>

      {!open && (
        <div className="tk-done card" role="status">
          <span className="tk-done-ic" aria-hidden="true"><Icon name="check" size={18} /></span>
          <div className="stack grow" style={{ gap: 2 }}>
            <span className="strong">{task.status === 'cancelled' ? 'Cancelled' : last ? `Done · ${OUTCOME_META[last.outcome].label}` : 'Done'}</span>
            <span className="small muted">
              {doneAt ? `Closed ${ago(doneAt, now)}` : 'Closed'}
              {last?.outcome === 'booked' ? '. The consultation is in the calendar and the deposit is tracked on the record.' : last?.outcome === 'no_answer' ? `. ${firstName(client.name)} is in Nurture.` : last?.outcome === 'not_interested' ? `. ${firstName(client.name)} is marked as lost.` : last?.outcome === 'wrong_number' ? `. ${firstName(client.name)} is in Nurture until we have a working number.` : '.'}
            </span>
          </div>
          <div className="row wrap">
            {last?.outcome === 'booked' && <Button size="sm" variant="secondary" icon="calendar" onClick={() => actions.go('calendar')}>Open calendar</Button>}
            {next && <Button size="sm" variant="primary" iconRight="arrowRight" onClick={() => actions.go('tasks', next.id)}>Next: {firstName(byId(state.clients, next.clientId)?.name)}</Button>}
          </div>
        </div>
      )}

      <BriefCard task={task} client={client} />

      {open && callType && (
        <CallFlow task={task} client={client} episode={episode} conversation={conversation} phoneShown={phoneShown} onReveal={reveal} canAct={canAct} blockedReason={blockedReason} />
      )}
      {open && (!callType || task.type === 'follow_up') && (
        <FinishTask task={task} client={client} conversation={conversation} canAct={open && (mine || manager)} blockedReason={!(mine || manager) ? blockedReason : undefined} />
      )}

      <div className="tk-detail-grid">
        <ClientSnapshot task={task} client={client} episode={episode} conversation={conversation} phoneShown={phoneShown} onReveal={reveal} />
        <History task={task} />
      </div>

      {open && next && (
        <button type="button" className="tk-upnext" onClick={() => actions.go('tasks', next.id)}>
          <span className="eyebrow">Up next</span>
          <span className="truncate strong">{next.title}</span>
          <Icon name="arrowRight" size={16} />
        </button>
      )}
    </article>
  )
}

function Reassign({ task }: { task: Task }) {
  const { state, actions } = useStore()
  const people = state.users.filter(u => u.status === 'active' && u.role !== 'marketing')
  const current = state.users.find(u => u.id === task.assignedTo)
  return (
    <div className="tk-reassign">
      <Field label="Assigned to" hint={current && !current.onShift ? `${firstName(current.name)} is off shift${task.slaMinutes ? '; the countdown keeps running' : ''}. Consider someone on shift.` : undefined}>
        {id => (
          <select id={id} className="input" value={task.assignedTo} onChange={e => {
            const u = state.users.find(x => x.id === e.target.value)
            actions.assignTask(task.id, e.target.value)
            actions.toast(`Reassigned to ${u?.name ?? 'teammate'}. They've been notified.`, 'success')
          }}>
            {people.map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}{u.onShift ? '' : ' (off shift)'}</option>)}
          </select>
        )}
      </Field>
    </div>
  )
}
