// Grouped task rows: Overdue, Due within the hour, Later today, Upcoming (or Done today / Earlier).
import type { Task } from '../../lib/types'
import { byId, userName, useStore } from '../../lib/store'
import { ago, ms, sameDay, shortDate, timeOf, until } from '../../lib/time'
import { ChannelBadge, Chip, Countdown, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { OUTCOME_META, PRIORITY_META, TYPE_META, escalatedTo } from './helpers'

export interface TaskGroup { id: string; label: string; tasks: Task[]; tone?: 'danger' | 'warn' }

export function TaskList({ groups, selectedId, onSelect, now, showAssignee, doneAt }: {
  groups: TaskGroup[]
  selectedId?: string
  onSelect: (id: string) => void
  now: number
  showAssignee: boolean
  doneAt: Map<string, string>
}) {
  return (
    <div className="tk-groups">
      {groups.filter(g => g.tasks.length).map(g => (
        <section key={g.id} className="tk-group" aria-label={g.label}>
          <h3 className={`tk-group-head ${g.tone ? 'tk-group-' + g.tone : ''}`}>
            <span>{g.label}</span>
            <span className="tk-group-count num">{g.tasks.length}</span>
          </h3>
          <ul className="tk-rows">
            {g.tasks.map(t => (
              <li key={t.id}>
                <TaskRow task={t} selected={t.id === selectedId} onSelect={onSelect} now={now} showAssignee={showAssignee} doneAt={doneAt.get(t.id)} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export function DueLabel({ task, now, compact }: { task: Task; now: number; compact?: boolean }) {
  if (task.status === 'open' && task.slaMinutes) return <Countdown deadline={task.dueAt} compact={compact} />
  const due = ms(task.dueAt)
  const when = sameDay(due, now) ? timeOf(task.dueAt) : `${shortDate(task.dueAt)}, ${timeOf(task.dueAt)}`
  if (task.status === 'open' && due < now) return <Chip tone="danger" icon="clock">Overdue · due {ago(task.dueAt, now)}</Chip>
  return (
    <span className="tk-due num" title={`Due ${when}`}>
      <Icon name="clock" size={13} />
      {until(task.dueAt, now)} · {when}
    </span>
  )
}

export function EscalationChip({ task }: { task: Task }) {
  const { me } = useStore()
  if (task.status !== 'open' || task.escalationLevel === 0) return null
  if (escalatedTo(me, task)) {
    return <Chip tone={task.escalationLevel === 1 ? 'warn' : 'danger'} icon="flag" title={`Not called in time; escalated to you (${task.escalationLevel === 1 ? 'manager' : 'owner'})`}>Escalated to you</Chip>
  }
  return task.escalationLevel === 1
    ? <Chip tone="warn" icon="alert" title="Not called within 15 minutes; the manager was alerted">Escalated to manager</Chip>
    : <Chip tone="danger" icon="alert" title="Not called within 60 minutes; the owner was alerted">Escalated to owner</Chip>
}

function TaskRow({ task, selected, onSelect, now, showAssignee, doneAt }: { task: Task; selected: boolean; onSelect: (id: string) => void; now: number; showAssignee: boolean; doneAt?: string }) {
  const { state, me } = useStore()
  const client = byId(state.clients, task.clientId)
  const meta = TYPE_META[task.type]
  const last = task.attempts[task.attempts.length - 1]
  const open = task.status === 'open'
  const tries = task.attempts.length
  return (
    <button type="button" className={`tk-row ${selected ? 'is-selected' : ''} ${open ? '' : 'is-done'}`} aria-current={selected ? 'true' : undefined} onClick={() => onSelect(task.id)}>
      <span className={`tk-ic tk-ic-${meta.tone}`} aria-hidden="true"><Icon name={meta.icon} size={16} /></span>
      <span className="tk-row-body">
        <span className="tk-row-title truncate">{task.title}</span>
        <span className="tk-row-sub">
          <span className="truncate">{client?.name ?? 'Unknown client'}</span>
          {client && <ChannelBadge channel={client.source.channel} label={false} size="sm" />}
          <span className="faint" aria-hidden="true">·</span>
          <span className="faint truncate">{meta.label}</span>
        </span>
        <span className="tk-row-meta">
          {open ? <DueLabel task={task} now={now} compact /> : (
            <>
              {task.status === 'cancelled' ? <Chip>Cancelled</Chip> : last ? <Chip tone={OUTCOME_META[last.outcome].tone} icon={OUTCOME_META[last.outcome].icon}>{OUTCOME_META[last.outcome].label}</Chip> : <Chip tone="ok" icon="check">Marked done</Chip>}
              {doneAt && <span className="tk-due">Closed {ago(doneAt, now)}</span>}
            </>
          )}
          <EscalationChip task={task} />
          {open && tries > 0 && <Chip icon="phone" title={`${tries} call attempt${tries === 1 ? '' : 's'} so far`}>{tries} {tries === 1 ? 'try' : 'tries'}</Chip>}
          {open && task.priority !== 'normal' && <Chip tone={PRIORITY_META[task.priority].tone}>{PRIORITY_META[task.priority].label}</Chip>}
        </span>
      </span>
      {showAssignee && (
        <span className="tk-row-side" title={`Assigned to ${userName(state, task.assignedTo)}`}>
          <UserAvatar userId={task.assignedTo} size={26} />
          <span className="sr-only">Assigned to {userName(state, task.assignedTo)}</span>
        </span>
      )}
    </button>
  )
}
