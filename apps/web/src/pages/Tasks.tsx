// Tasks & calls: the coordinator's call workspace. Route #tasks or #tasks~<taskId>.
// List of open work grouped by urgency on the left, the selected task (brief, call flow, history) on the right.
// On phones one pane shows at a time; the detail has a back button.
import { useEffect, useMemo, useState } from 'react'
import type { Task, TaskType } from '../lib/types'
import { byId, userName, useStore } from '../lib/store'
import { sameDay, until, useNow } from '../lib/time'
import { Button, EmptyState, PageHeader, Tabs, UserAvatar } from '../components/ui'
import { Icon } from '../components/icons'
import { TaskList, type TaskGroup } from './tasks/TaskList'
import { TaskDetail } from './tasks/TaskDetail'
import { HowItWorks } from './tasks/Panels'
import { GROUPS, TYPE_META, TYPE_ORDER, byUrgency, doneAtMap, firstName, groupOf, inMine, isCallType, isManager, useMedia, type TabId, type TypeFilter } from './tasks/helpers'
import './tasks.css'

export default function Tasks() {
  const { state, me, can, route, actions } = useStore()
  const now = useNow(15_000)
  const single = useMedia('(max-width: 980px)')
  const manager = isManager(me, can)

  const open = useMemo(() => state.tasks.filter(t => t.status === 'open'), [state.tasks])
  const lists = useMemo(() => ({
    mine: open.filter(t => inMine(me, t)),
    team: manager ? open : [],
    done: state.tasks.filter(t => t.status !== 'open' && (manager || t.assignedTo === me.id)),
  }), [open, state.tasks, me, manager])
  const doneAt = useMemo(() => doneAtMap(state), [state])

  const tabFor = (t: Task): TabId => (t.status !== 'open' ? 'done' : inMine(me, t) || !manager ? 'mine' : 'team')
  const [tab, setTabState] = useState<TabId>(() => {
    const t = route.id ? byId(state.tasks, route.id) : undefined
    if (t) return tabFor(t)
    // owners and managers with nothing of their own start on the team view
    return manager && !open.some(x => inMine(me, x)) && open.length ? 'team' : 'mine'
  })
  const [type, setType] = useState<TypeFilter>('all')
  const [person, setPerson] = useState<string>('all')
  const [autoId, setAutoId] = useState<string>()
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set())

  // following a link to a task opens the tab that holds it
  useEffect(() => {
    const t = route.id ? byId(state.tasks, route.id) : undefined
    if (!t) return
    const current: TabId = tab === 'team' && !manager ? 'mine' : tab
    if (!lists[current].some(x => x.id === t.id)) setTabState(tabFor(t))
    if (type !== 'all' && t.type !== type) setType('all')
    if (person !== 'all' && t.assignedTo !== person) setPerson('all')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.id])

  const activeTab: TabId = tab === 'team' && !manager ? 'mine' : tab
  const base = lists[activeTab]
  const typed = type === 'all' ? base : base.filter(t => t.type === type)
  const filtered = activeTab === 'team' && person !== 'all' ? typed.filter(t => t.assignedTo === person) : typed

  const groups: TaskGroup[] = useMemo(() => {
    if (activeTab === 'done') {
      const sorted = [...filtered].sort((a, b) => Date.parse(doneAt.get(b.id) ?? b.dueAt) - Date.parse(doneAt.get(a.id) ?? a.dueAt))
      return [
        { id: 'done-today', label: 'Closed today', tasks: sorted.filter(t => sameDay(doneAt.get(t.id) ?? t.dueAt, now)) },
        { id: 'done-earlier', label: 'Earlier', tasks: sorted.filter(t => !sameDay(doneAt.get(t.id) ?? t.dueAt, now)) },
      ]
    }
    const sorted = [...filtered].sort(byUrgency)
    return GROUPS.map(g => ({ id: g.id, label: g.label, tasks: sorted.filter(t => groupOf(t, now) === g.id), tone: g.id === 'overdue' ? 'danger' as const : g.id === 'hour' ? 'warn' as const : undefined }))
  }, [filtered, activeTab, now, doneAt])
  const ordered = groups.flatMap(g => g.tasks)
  const firstId = ordered[0]?.id

  // desktop: keep a task selected even without an id in the address
  useEffect(() => {
    if (route.id || single) return
    if (!autoId || !state.tasks.some(t => t.id === autoId)) setAutoId(firstId)
  }, [route.id, single, autoId, firstId, state.tasks])

  const selectedId = route.id ?? (single ? undefined : autoId ?? firstId)
  const selected = selectedId ? byId(state.tasks, selectedId) : undefined
  const openOrdered = activeTab === 'done' ? [...lists.mine].sort(byUrgency) : ordered.filter(t => t.status === 'open')
  const next = openOrdered.find(t => t.id !== selected?.id && t.status === 'open')

  const setTab = (v: TabId) => {
    setTabState(v)
    setPerson('all')
    setAutoId(undefined)
    if (route.id) {
      const inNew = lists[v].some(t => t.id === route.id)
      if (!inNew) actions.go('tasks')
    }
  }
  const pickType = (v: TypeFilter) => {
    setType(v)
    setAutoId(undefined)
    if (route.id && !single) actions.go('tasks')
  }
  const pickPerson = (id: string) => {
    setPerson(p => (p === id ? 'all' : id))
    setAutoId(undefined)
    if (route.id && !single) actions.go('tasks')
  }

  const reveal = (clientId: string, why: 'call' | 'view') => {
    if (revealed.has(clientId)) return
    const c = byId(state.clients, clientId)
    actions.audit({ action: 'client.view_phone', target: { type: 'client', id: clientId, label: c?.name }, detail: why === 'call' ? 'Phone number revealed to place a call from Tasks' : 'Viewed phone number from a task' })
    setRevealed(s => new Set(s).add(clientId))
  }

  // ---- summary --------------------------------------------------------------------------------
  const scope = activeTab === 'team' ? lists.team : lists.mine
  const overdue = scope.filter(t => groupOf(t, now) === 'overdue').length
  const withinHour = scope.filter(t => groupOf(t, now) === 'hour').length
  const callsWaiting = scope.filter(t => isCallType(t.type)).length
  const doneToday = state.tasks.filter(t => t.status !== 'open' && (activeTab === 'team' || t.assignedTo === me.id) && sameDay(doneAt.get(t.id) ?? '', now)).length
  const soonest = [...scope].sort(byUrgency).find(t => Date.parse(t.dueAt) >= now)
  const subtitle = scope.length === 0
    ? 'Nothing open. New lead calls appear here the moment someone shares a number.'
    : `${scope.length} open${overdue ? ` · ${overdue} overdue` : ''}${soonest ? ` · next due ${until(soonest.dueAt, now)}` : ''}`

  const tabs = [
    { id: 'mine' as const, label: 'My tasks', count: lists.mine.length },
    ...(manager ? [{ id: 'team' as const, label: 'Team', count: lists.team.length }] : []),
    { id: 'done' as const, label: 'Done', count: lists.done.length || undefined },
  ]
  const typeCounts = Object.fromEntries(TYPE_ORDER.map(t => [t, base.filter(x => x.type === t).length])) as Record<TaskType, number>

  // team load: who holds what
  const load = useMemo(() => {
    if (activeTab !== 'team') return []
    const m = new Map<string, { total: number; overdue: number }>()
    for (const t of typed) {
      const e = m.get(t.assignedTo) ?? { total: 0, overdue: 0 }
      e.total += 1
      if (groupOf(t, now) === 'overdue') e.overdue += 1
      m.set(t.assignedTo, e)
    }
    return [...m.entries()].sort((a, b) => b[1].overdue - a[1].overdue || b[1].total - a[1].total)
  }, [activeTab, typed, now])

  const list = (
    <div className="tk-listcol">
      {ordered.length ? (
        <TaskList groups={groups} selectedId={selectedId} onSelect={id => actions.go('tasks', id)} now={now} showAssignee doneAt={doneAt} />
      ) : (
        <div className="card">
          {type !== 'all' || person !== 'all' ? (
            <EmptyState icon="filter" title={`No ${type !== 'all' ? TYPE_META[type].plural.toLowerCase() : 'tasks'} ${person !== 'all' ? `for ${firstName(userName(state, person))}` : 'here'}`}
              body="Clear the filter to see everything else in this list."
              action={<Button size="sm" variant="secondary" onClick={() => { pickType('all'); setPerson('all') }}>Show all tasks</Button>} />
          ) : activeTab === 'done' ? (
            <EmptyState icon="check" title="Nothing closed yet" body="When you log a call outcome or mark a task done, it moves here with its result so the team can see what happened." />
          ) : activeTab === 'team' ? (
            <EmptyState icon="users" title="The team is all caught up" body="Open calls, callbacks and follow-ups for everyone show here, with who holds each one." />
          ) : (
            <EmptyState icon="phone" title="You're all caught up"
              body="New lead calls appear here the moment someone shares a number in a DM, with a 15-minute countdown. Callbacks and follow-ups you schedule land here too."
              action={manager ? <Button size="sm" variant="secondary" icon="users" onClick={() => setTab('team')}>See team tasks</Button> : undefined} />
          )}
        </div>
      )}
      {!single && (selected || route.id) && <HowItWorks />}
    </div>
  )

  const detail = selected ? (
    <TaskDetail key={selected.id} task={selected} onBack={single ? () => actions.go('tasks') : undefined} next={next} phoneShown={revealed.has(selected.clientId)} onReveal={reveal} doneAt={doneAt.get(selected.id)} />
  ) : route.id ? (
    <div className="card">
      <EmptyState icon="tasks" title="This task no longer exists" body="It may have been merged into another task or removed. Pick another one from the list."
        action={<Button size="sm" variant="secondary" icon="chevronLeft" onClick={() => actions.go('tasks')}>Back to tasks</Button>} />
    </div>
  ) : ordered.length ? (
    <div className="card tk-detail-empty">
      <EmptyState icon="phone" title="Pick a task to start" body="The call brief, the client's latest messages and the call buttons appear here." />
    </div>
  ) : (
    <HowItWorks />
  )

  // phones: one pane at a time
  if (single && route.id) {
    return <div className="page tk tk-single-detail">{detail}</div>
  }

  return (
    <div className="page tk">
      <PageHeader title="Tasks & calls" subtitle={subtitle}
        actions={<Button variant="secondary" icon="sparkles" onClick={() => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: activeTab === 'team' ? 'Which open calls across the team are most at risk of missing their deadline, and who should take them?' : 'Which of my open calls should I make first, and what should I say on each?' } }))}>Ask Claude what to do first</Button>} />

      <div className="tk-summary" role="list" aria-label="Summary">
        <div role="listitem" className={`tk-sum ${overdue ? 'is-danger' : ''}`}><span className="tk-sum-value num">{overdue}</span><span className="tk-sum-label">Overdue</span></div>
        <div role="listitem" className={`tk-sum ${withinHour ? 'is-warn' : ''}`}><span className="tk-sum-value num">{withinHour}</span><span className="tk-sum-label">Due within the hour</span></div>
        <div role="listitem" className="tk-sum"><span className="tk-sum-value num">{callsWaiting}</span><span className="tk-sum-label">Calls to make</span></div>
        <div role="listitem" className={`tk-sum ${doneToday ? 'is-ok' : ''}`}><span className="tk-sum-value num">{doneToday}</span><span className="tk-sum-label">Closed today</span></div>
      </div>

      <div className="tk-toolbar">
        <Tabs tabs={tabs} value={activeTab} onChange={setTab} />
        <div className="tk-types" role="group" aria-label="Filter by type">
          <button type="button" className={`tk-type ${type === 'all' ? 'is-active' : ''}`} aria-pressed={type === 'all'} onClick={() => pickType('all')}>
            All<span className="tk-type-count num">{base.length}</span>
          </button>
          {TYPE_ORDER.map(t => (
            <button key={t} type="button" className={`tk-type ${type === t ? 'is-active' : ''} ${typeCounts[t] ? '' : 'is-empty'}`} aria-pressed={type === t} onClick={() => pickType(type === t ? 'all' : t)}>
              <Icon name={TYPE_META[t].icon} size={14} />{TYPE_META[t].plural}<span className="tk-type-count num">{typeCounts[t]}</span>
            </button>
          ))}
        </div>
        {activeTab === 'team' && load.length > 0 && (
          <div className="tk-load" role="group" aria-label="Filter by teammate">
            {load.map(([uid, l]) => (
              <button key={uid} type="button" className={`tk-person ${person === uid ? 'is-active' : ''}`} aria-pressed={person === uid} onClick={() => pickPerson(uid)}>
                <UserAvatar userId={uid} size={22} />
                <span className="tk-person-name">{firstName(userName(state, uid))}</span>
                <span className="tk-person-n num">{l.total}</span>
                {l.overdue > 0 && <span className="tk-person-late num" title={`${l.overdue} overdue`}>{l.overdue} late</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {single ? (
        <>
          {list}
          <HowItWorks />
        </>
      ) : (
        <div className="tk-split">
          {list}
          <div className="tk-detailcol">{detail}</div>
        </div>
      )}
    </div>
  )
}
