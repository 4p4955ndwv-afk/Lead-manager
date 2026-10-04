// One person's record: header, journey for the selected episode, tabs, and a "Next up" summary.
import { useMemo, useState } from 'react'
import { byId, userName, useStore } from '../../lib/store'
import type { Client, Episode } from '../../lib/types'
import { canOpen } from '../../lib/permissions'
import { ago, dateTime, money, ms, shortDate, timeOf, until, useNow } from '../../lib/time'
import { Button, Chip, Countdown, EmptyState, Tabs, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { Header } from './Header'
import { Journey } from './Journey'
import { NewEpisodeModal } from './dialogs'
import { Overview } from './Overview'
import { PlanTab } from './PlanTab'
import { AppointmentsTab } from './AppointmentsTab'
import { PaymentsTab } from './PaymentsTab'
import { DocumentsTab } from './DocumentsTab'
import { NotesTab } from './NotesTab'
import { ConversationsTab } from './ConversationsTab'
import { ActivityTab } from './ActivityTab'
import { APPT_STATUS_LABEL, APPT_STATUS_TONE, PAY_KIND_LABEL, PAY_STATUS_LABEL, PAY_STATUS_TONE, apptTitle, auditFor, episodesOf } from './helpers'

type TabId = 'overview' | 'plan' | 'appointments' | 'payments' | 'documents' | 'notes' | 'conversations' | 'activity'

export function Record({ clientId }: { clientId: string }) {
  const { state, can, actions } = useStore()
  const client = byId(state.clients, clientId)
  const episodes = useMemo(() => episodesOf(state, clientId), [state, clientId])
  const [epId, setEpId] = useState<string | undefined>()
  const [tab, setTab] = useState<TabId>('overview')
  const [newEpOpen, setNewEpOpen] = useState(false)

  if (!client) return <Missing clientId={clientId} />

  const latest = episodes[episodes.length - 1]
  const episode = episodes.find(e => e.id === epId) ?? latest

  const counts = {
    plan: episode ? state.plans.filter(p => p.episodeId === episode.id).reduce((t, p) => t + p.items.length, 0) : 0,
    appointments: state.appointments.filter(a => a.clientId === client.id).length,
    payments: state.payments.filter(p => p.clientId === client.id).length,
    documents: state.documents.filter(d => d.clientId === client.id).length,
    notes: state.notes.filter(n => n.clientId === client.id).length,
    conversations: state.conversations.filter(c => c.clientId === client.id).length,
    activity: auditFor(state, client.id).length,
  }
  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'plan', label: 'Treatment plan', count: counts.plan || undefined },
    { id: 'appointments', label: 'Appointments', count: counts.appointments || undefined },
    ...(can('payments.view') ? [{ id: 'payments' as const, label: 'Payments', count: counts.payments || undefined }] : []),
    { id: 'documents', label: 'Documents', count: counts.documents || undefined },
    { id: 'notes', label: 'Notes', count: counts.notes || undefined },
    { id: 'conversations', label: 'Conversations', count: counts.conversations || undefined },
    ...(can('audit.view') ? [{ id: 'activity' as const, label: 'Activity log', count: counts.activity || undefined }] : []),
  ]
  const active = tabs.some(t => t.id === tab) ? tab : 'overview'

  return (
    <div className="page cr-rec">
      <nav className="cr-crumbs" aria-label="Breadcrumb">
        <button type="button" className="cr-link" onClick={() => actions.go('client')}><Icon name="chevronLeft" size={15} />Clients</button>
        <span className="faint" aria-hidden="true">/</span>
        <span className="truncate muted" aria-current="page">{client.name}</span>
      </nav>

      <Header client={client} episode={episode} latest={latest} />

      {episode ? (
        <Journey client={client} episodes={episodes} episode={episode} onSelect={setEpId} onNewEpisode={() => setNewEpOpen(true)} canStartNew={can('pipeline.move')} />
      ) : (
        <div className="card card-padded">
          <EmptyState icon="board" title="No journey yet" body="This person has no episode. Start one to track them through the journey."
            action={can('pipeline.move') ? <Button size="sm" variant="primary" icon="plus" onClick={() => setNewEpOpen(true)}>Start a journey</Button> : undefined} />
        </div>
      )}

      <NextUp client={client} episode={latest} onTab={setTab} />

      <div className="cr-main">
        <Tabs tabs={tabs} value={active} onChange={setTab} size="sm" />
        <div className="cr-tabpanel" role="tabpanel" aria-label={tabs.find(t => t.id === active)?.label}>
          {active === 'overview' && <Overview client={client} episodes={episodes} />}
          {active === 'plan' && episode && <PlanTab client={client} episode={episode} />}
          {active === 'plan' && !episode && <EmptyState icon="layers" title="No treatment plan" body="Plans belong to a journey. Start one first." />}
          {active === 'appointments' && <AppointmentsTab client={client} episode={episode} />}
          {active === 'payments' && <PaymentsTab client={client} episode={episode} episodes={episodes} />}
          {active === 'documents' && <DocumentsTab client={client} episode={episode} />}
          {active === 'notes' && <NotesTab client={client} />}
          {active === 'conversations' && <ConversationsTab client={client} />}
          {active === 'activity' && <ActivityTab client={client} />}
        </div>
      </div>

      <NewEpisodeModal open={newEpOpen} onClose={() => setNewEpOpen(false)} client={client} onCreated={id => setEpId(id)} />
    </div>
  )
}

function Missing({ clientId }: { clientId: string }) {
  const { state, actions } = useStore()
  const survivor = state.clients.find(c => c.mergedFrom?.includes(clientId))
  const erased = state.audit.find(a => a.action === 'client.erase' && a.target.id === clientId)
  return (
    <div className="page">
      <div className="card">
        <EmptyState icon="user" title={survivor ? 'This record was merged' : erased ? 'This person was erased' : 'Client not found'}
          body={survivor ? `It now lives inside ${survivor.name}'s record, with all its history.` : erased ? `Their records were erased on ${dateTime(erased.at)}. Only an audit line remains.` : 'The link may be out of date, or the record was merged or erased.'}
          action={<div className="row wrap" style={{ justifyContent: 'center' }}>
            {survivor && <Button variant="primary" icon="user" onClick={() => actions.go('client', survivor.id)}>Open {survivor.name}</Button>}
            <Button icon="users" onClick={() => actions.go('client')}>All clients</Button>
          </div>} />
      </div>
    </div>
  )
}

function NextUp({ client, episode, onTab }: { client: Client; episode?: Episode; onTab: (t: TabId) => void }) {
  const { state, me, can, actions } = useStore()
  const now = useNow(30_000)
  const tasks = state.tasks.filter(t => t.clientId === client.id && t.status === 'open').sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  const appts = state.appointments.filter(a => a.clientId === client.id && ms(a.end) >= now && !['completed', 'cancelled', 'no_show'].includes(a.status)).sort((a, b) => ms(a.start) - ms(b.start)).slice(0, 3)
  const pays = can('payments.view') ? state.payments.filter(p => p.clientId === client.id && (p.status === 'due' || p.status === 'overdue')).sort((a, b) => ms(a.dueAt) - ms(b.dueAt)) : []
  const cur = state.settings.currency
  const empty = !tasks.length && !appts.length && !pays.length
  const hint = client.doNotContact ? 'Do not contact is on, so nothing is scheduled.'
    : !episode ? 'Start a journey to schedule anything.'
    : episode.exit === 'under18' ? 'Under 18, so booking is blocked and nothing is scheduled. Only a manager follows up.'
    : episode.exit === 'spam' ? 'Marked as spam. Nothing is scheduled.'
    : episode.exit ? `Off the path (${episode.exitReason ?? 'no reason given'}). Start a new episode if they come back.`
    : episode.stage === 'alumni' ? 'Journey complete. A return visit starts a new episode.'
    : 'No open tasks, visits or payments. Log a call or book an appointment to set the next step.'

  return (
    <section className="card card-padded cr-next" aria-label="Next up">
      <div className="card-head cr-next-head">
        <div className="row wrap" style={{ gap: 8 }}>
          <h2 className="card-title">Next up</h2>
          {!empty && <span className="tiny muted">{tasks.length} task{tasks.length === 1 ? '' : 's'} · {appts.length} visit{appts.length === 1 ? '' : 's'}{can('payments.view') ? ` · ${pays.length} payment${pays.length === 1 ? '' : 's'} due` : ''}</span>}
        </div>
        <Button size="sm" variant="subtle" icon="sparkles" onClick={() => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: `What should we do next for ${client.name}? Summarise their journey, open tasks and anything overdue.` } }))}>
          Ask Claude what's next
        </Button>
      </div>
      {empty ? <p className="small muted">{hint}</p> : (
        <ul className="cr-next-list">
          {tasks.map(t => (
            <li key={t.id}>
              <button type="button" className="cr-next-item" onClick={() => canOpen(me, 'tasks') ? actions.go('tasks', t.id) : onTab('overview')}>
                <span className={`cr-next-icon ${t.priority === 'urgent' ? 'is-danger' : t.priority === 'high' ? 'is-warn' : ''}`}><Icon name={t.type === 'call' || t.type === 'callback' ? 'phone' : t.type === 'payment' ? 'card' : t.type === 'clinical_review' ? 'shield' : 'tasks'} size={15} /></span>
                <span className="stack grow" style={{ gap: 2 }}>
                  <span className="small strong cr-clamp">{t.title}</span>
                  <span className="row wrap" style={{ gap: 6 }}>
                    {t.slaMinutes ? <Countdown deadline={t.dueAt} compact /> : <span className={`tiny ${ms(t.dueAt) < now ? 'cr-overdue' : 'muted'}`}>{ms(t.dueAt) < now ? `Overdue · ${ago(t.dueAt, now)}` : `Due ${until(t.dueAt, now)}`}</span>}
                    {t.escalationLevel > 0 && <Chip tone="danger">Escalated to {t.escalationLevel === 1 ? 'manager' : 'owner'}</Chip>}
                    <span className="row tiny muted" style={{ gap: 4 }}><UserAvatar userId={t.assignedTo} size={16} />{userName(state, t.assignedTo).split(' ')[0]}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
          {appts.map(a => (
            <li key={a.id}>
              <button type="button" className="cr-next-item" onClick={() => canOpen(me, 'calendar') ? actions.go('calendar', a.id) : onTab('appointments')}>
                <span className="cr-next-icon is-team"><Icon name="calendar" size={15} /></span>
                <span className="stack grow" style={{ gap: 2 }}>
                  <span className="small strong cr-clamp">{apptTitle(state, a)}</span>
                  <span className="row wrap" style={{ gap: 6 }}>
                    <span className="tiny num">{shortDate(a.start)}, {timeOf(a.start)}</span>
                    <Chip tone={APPT_STATUS_TONE[a.status]}>{APPT_STATUS_LABEL[a.status]}</Chip>
                    <span className="tiny muted truncate">{userName(state, a.practitionerId)}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
          {pays.map(p => (
            <li key={p.id}>
              <button type="button" className="cr-next-item" onClick={() => onTab('payments')}>
                <span className={`cr-next-icon ${p.status === 'overdue' ? 'is-danger' : 'is-warn'}`}><Icon name="card" size={15} /></span>
                <span className="stack grow" style={{ gap: 2 }}>
                  <span className="small strong">{PAY_KIND_LABEL[p.kind]} · <span className="num">{money(p.amount, cur)}</span></span>
                  <span className="row wrap" style={{ gap: 6 }}>
                    <Chip tone={PAY_STATUS_TONE[p.status]}>{PAY_STATUS_LABEL[p.status]}</Chip>
                    <span className="tiny muted">{p.status === 'overdue' ? `was due ${ago(p.dueAt, now)}` : `due ${until(p.dueAt, now)}`}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
