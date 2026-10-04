import { useState } from 'react'
import { Button, Card, ChannelBadge, Chip, Dot, EmptyState, Field, Locked, Modal, ReasonDialog, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore } from '../../lib/store'
import { canOpen } from '../../lib/permissions'
import type { AiMode, Appointment, Payment, User } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { DAY, HOUR, MIN, ago, dateTime, iso, money, ms, shortDate, timeOf, useNow } from '../../lib/time'
import { topSources } from '../analytics/data'
import { fmtInt, fmtPct, plural } from '../analytics/format'
import { COLOR } from '../analytics/charts'
import { Deadline } from './parts'
import { ageCheck } from '../calendar/helpers'
import {
  APPT_TYPE, MODE_HINT, MODE_LABEL, MODE_TONE, PAYMENT_KIND, STATUS_LABEL, STATUS_TONE, apptWhat, clientName, isOverdue, lastClientText, openPayments,
} from './compute'

// ---- owner / manager: team SLA -------------------------------------------------------------------

export function TeamSla() {
  const { state, actions, me } = useStore()
  const now = useNow(30_000)
  const [moveFrom, setMoveFrom] = useState<{ from: User; to: User } | null>(null)
  const open = state.tasks.filter(t => t.status === 'open')
  const holders = state.users.filter(u => u.status === 'active' && open.some(t => t.assignedTo === u.id))
  const onShift = holders.filter(u => u.onShift)
  const offShift = holders.filter(u => !u.onShift)
  const cover = (u: User) => state.users.find(x => x.role === u.role && x.onShift && x.status === 'active' && x.id !== u.id)

  return (
    <Card title="Team SLA status" subtitle="On-shift people with open tasks. Lead calls are due within 15 minutes of a number arriving." padded={false} className="td-card"
      actions={canOpen(me, 'tasks') ? <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => actions.go('tasks')}>All tasks</Button> : undefined}>
      {onShift.length === 0 && offShift.length === 0 ? (
        <EmptyState icon="users" title="No open tasks" body="Calls, call-backs, clinical questions and follow-ups appear here per person while they are open." />
      ) : (
        <ul className="td-list">
          {onShift.map(u => {
            const mine = open.filter(t => t.assignedTo === u.id).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
            const overdue = mine.filter(t => ms(t.dueAt) < now)
            const escalated = mine.filter(t => t.escalationLevel > 0)
            const next = mine.find(t => ms(t.dueAt) >= now)
            return (
              <li key={u.id}>
                <button type="button" className="td-item" onClick={() => actions.go('tasks', (overdue[0] ?? mine[0]).id)}>
                  <span className="td-item-lead td-item-avatar"><UserAvatar userId={u.id} size={30} /></span>
                  <span className="td-item-main">
                    <span className="td-item-title">
                      <span className="strong truncate">{u.name}</span>
                      <span className="tiny muted td-nowrap">{ROLE_LABEL[u.role]}</span>
                    </span>
                    <span className="td-item-title td-chips">
                      <Chip>{plural(mine.length, 'open task')}</Chip>
                      {overdue.length > 0 ? <Chip tone="danger" icon="alert">{fmtInt(overdue.length)} overdue</Chip> : <Chip tone="ok" icon="check">On time</Chip>}
                      {escalated.length > 0 && <Chip tone="warn">{fmtInt(escalated.length)} escalated</Chip>}
                    </span>
                  </span>
                  <span className="td-item-trail">{next ? <Deadline due={next.dueAt} /> : <span className="tiny muted">Nothing due</span>}</span>
                </button>
              </li>
            )
          })}
          {offShift.map(u => {
            const mine = open.filter(t => t.assignedTo === u.id)
            const to = cover(u)
            return (
              <li key={u.id} className="td-item td-item-static td-offshift">
                <span className="td-item-lead td-item-avatar"><UserAvatar userId={u.id} size={30} /></span>
                <span className="td-item-main">
                  <span className="td-item-title"><span className="strong truncate">{u.name}</span><Chip tone="warn" icon="moon">Off shift</Chip></span>
                  <span className="td-item-sub"><span>Still holds {plural(mine.length, 'open task')}{mine[0] ? `, next due ${shortDate(mine[0].dueAt)}` : ''}.</span></span>
                </span>
                <span className="td-item-trail">
                  {to ? <Button size="sm" variant="secondary" onClick={() => setMoveFrom({ from: u, to })}>Move to {to.name.split(' ')[0]}</Button> : <span className="tiny muted">No cover on shift</span>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <ReasonDialog
        open={!!moveFrom}
        title={moveFrom ? `Move ${moveFrom.from.name}'s open tasks to ${moveFrom.to.name}?` : ''}
        body={moveFrom ? `${plural(open.filter(t => t.assignedTo === moveFrom.from.id).length, 'open task')} will be reassigned. ${moveFrom.to.name} gets a notification for each one.` : undefined}
        confirmLabel="Move tasks"
        placeholder="e.g. Tom is off today; Priya is covering his leads"
        onClose={() => setMoveFrom(null)}
        onConfirm={reason => {
          if (!moveFrom) return
          const ids = open.filter(t => t.assignedTo === moveFrom.from.id).map(t => t.id)
          ids.forEach(id => actions.assignTask(id, moveFrom.to.id))
          actions.audit({ action: 'task.bulk_reassign', target: { type: 'user', id: moveFrom.from.id, label: moveFrom.from.name }, detail: `${ids.length} open tasks moved to ${moveFrom.to.name}`, reason })
          actions.toast(`Moved ${plural(ids.length, 'task')} to ${moveFrom.to.name}`, 'success', { label: 'View tasks', page: 'tasks' })
        }}
      />
    </Card>
  )
}

// ---- owner / manager: AI status ------------------------------------------------------------------

export function AiStatus() {
  const { state, actions, can, me } = useStore()
  const now = useNow(60_000)
  const [dialog, setDialog] = useState<'pause' | 'resume' | null>(null)
  const ai = state.ai
  const channels: Array<'instagram' | 'tiktok' | 'whatsapp'> = ['instagram', 'tiktok', 'whatsapp']
  return (
    <Card title="AI status" subtitle={ai.killSwitch ? 'All AI replies are paused.' : `Hands to a person below ${Math.round(ai.confidenceThreshold * 100)}% confidence.`} className="td-card"
      actions={canOpen(me, 'ai') ? <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => actions.go('ai')}>AI &amp; playbook</Button> : undefined}>
      <div className="stack">
        {ai.killSwitch && (
          <div className="td-banner tone-danger" role="status">
            <Icon name="pause" size={16} />
            <span>Paused by {state.users.find(u => u.id === ai.killSwitchBy)?.name ?? 'a manager'}{ai.killSwitchAt ? ` ${ago(ai.killSwitchAt, now)}` : ''}. Every DM now waits for staff.</span>
          </div>
        )}
        <ul className="td-modes">
          {channels.map(ch => {
            const mode: AiMode = ai.mode[ch]
            return (
              <li key={ch} className="td-mode">
                <ChannelBadge channel={ch} />
                <span className="td-mode-hint tiny muted">{ai.killSwitch ? 'Paused' : MODE_HINT[mode]}</span>
                <Chip tone={ai.killSwitch ? 'neutral' : MODE_TONE[mode]}>{MODE_LABEL[mode]}</Chip>
              </li>
            )
          })}
        </ul>
        {can('ai.killswitch') ? (
          ai.killSwitch
            ? <Button variant="primary" icon="play" onClick={() => setDialog('resume')}>Resume AI replies</Button>
            : <Button variant="secondary" icon="pause" className="td-pause" onClick={() => setDialog('pause')}>Pause all AI replies</Button>
        ) : <Locked>Only owners and managers can pause AI replies</Locked>}
      </div>
      <ReasonDialog
        open={dialog === 'pause'}
        title="Pause all AI replies?"
        tone="danger"
        body="The AI stops replying on every channel straight away. New DMs wait for staff and are marked as needing a person. Owners, managers and coordinators are notified."
        confirmLabel="Pause AI replies"
        placeholder="e.g. Checking a price error in a reply"
        onClose={() => setDialog(null)}
        onConfirm={reason => { actions.setKillSwitch(true, reason); actions.toast('AI replies paused for everyone', 'warn') }}
      />
      <ReasonDialog
        open={dialog === 'resume'}
        title="Resume AI replies?"
        body="The AI starts answering again in each channel's current mode."
        confirmLabel="Resume AI replies"
        placeholder="e.g. Price list fixed and checked"
        onClose={() => setDialog(null)}
        onConfirm={reason => { actions.setKillSwitch(false, reason); actions.toast('AI replies resumed', 'success') }}
      />
    </Card>
  )
}

// ---- clinician -----------------------------------------------------------------------------------

export function ClinicList() {
  const { state, me, can, actions } = useStore()
  const now = useNow(30_000)
  const mine = state.appointments.filter(a => a.practitionerId === me.id && a.status !== 'cancelled' && new Date(a.start).toDateString() === new Date(now).toDateString()).sort((a, b) => ms(a.start) - ms(b.start))
  const latestNote = (clientId: string) => state.notes.filter(n => n.clientId === clientId && n.clinical).sort((a, b) => ms(b.at) - ms(a.at))[0]
  return (
    <Card title="My clinic today" subtitle={mine.length ? `${plural(mine.length, 'patient')} · last clinical note shown for each` : undefined} padded={false} className="td-card">
      {mine.length === 0 ? (
        <EmptyState icon="calendar" title="No patients booked with you today" body="Consultations and treatment sessions booked with you show here, with the last clinical note for each patient." />
      ) : (
        <ul className="td-list">
          {mine.map(a => {
            const note = latestNote(a.clientId)
            return (
              <li key={a.id}>
                <button type="button" className="td-item" onClick={() => actions.go('client', a.clientId)}>
                  <span className="td-item-lead td-slot-time num"><span className="strong">{timeOf(a.start)}</span><span className="tiny muted">{Math.round((ms(a.end) - ms(a.start)) / MIN)} min</span></span>
                  <span className="td-item-main">
                    <span className="td-item-title">
                      <span className="strong truncate">{clientName(state, a.clientId)}</span>
                      <Chip tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Chip>
                    </span>
                    <span className="small">{apptWhat(state, a)}</span>
                    {can('clinical.view')
                      ? note ? <span className="tiny muted td-clamp">Last note ({shortDate(note.at)}): {note.text}</span> : <span className="tiny faint">No clinical notes yet</span>
                      : <Locked>Clinical notes are restricted</Locked>}
                  </span>
                  <span className="td-item-trail"><Icon name="chevronRight" size={16} /></span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function ClinicalQuestions() {
  const { state, me, actions } = useStore()
  const now = useNow(30_000)
  const tasks = state.tasks.filter(t => t.status === 'open' && t.type === 'clinical_review' && (t.assignedTo === me.id || me.role === 'owner')).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  const [answering, setAnswering] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const task = tasks.find(t => t.id === answering)
  return (
    <Card title="Open clinical questions" subtitle="The AI never answers these. Reply by phone or in the chat, then mark them answered." padded={false} className="td-card">
      {tasks.length === 0 ? (
        <EmptyState icon="shield" title="No clinical questions waiting" body="When a DM mentions pregnancy, medication, allergies or side effects, the AI stops and routes it to the clinician on shift." />
      ) : (
        <ul className="td-list">
          {tasks.map(t => {
            const conv = state.conversations.find(c => c.clientId === t.clientId)
            return (
              <li key={t.id} className="td-item td-item-static">
                <span className="td-item-lead"><Deadline due={t.dueAt} /></span>
                <span className="td-item-main">
                  <span className="td-item-title"><span className="strong truncate">{clientName(state, t.clientId)}</span>{conv && <ChannelBadge channel={conv.channel} label={false} size="sm" />}<span className="tiny muted">{ago(t.createdAt, now)}</span></span>
                  <span className="small td-clamp">“{conv ? lastClientText(conv) : t.brief ?? t.title}”</span>
                </span>
                <span className="td-item-trail td-actions">
                  {conv && <Button size="sm" variant="ghost" onClick={() => actions.go('inbox', conv.id)}>Open chat</Button>}
                  <Button size="sm" variant="secondary" icon="check" onClick={() => { setNote(''); setAnswering(t.id) }}>Mark answered</Button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <Modal open={!!task} title="Mark the question answered" description={task ? `${clientName(state, task.clientId)}: ${task.brief ?? task.title}` : undefined} onClose={() => setAnswering(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setAnswering(null)}>Cancel</Button>
          <Button variant="primary" disabled={note.trim().length < 3} onClick={() => {
            if (!task) return
            actions.completeTask(task.id, `Answered: ${note.trim()}`)
            actions.addNote(task.clientId, `Clinical question answered: ${note.trim()}`, true)
            actions.update(d => {
              const c = d.conversations.find(x => x.clientId === task.clientId && x.needsHumanReason === 'Clinical question')
              if (c) { c.needsHuman = false; c.needsHumanReason = undefined }
            })
            actions.toast(`Answer saved to ${clientName(state, task.clientId)}'s clinical notes`, 'success')
            setAnswering(null)
          }}>Save and close</Button>
        </>}>
        <Field label="What did you advise?" hint="Saved as a clinical note. Only clinical staff can read it.">
          {id => <textarea id={id} className="input" rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Called her. Advised waiting until after the pregnancy; offered a consultation 3 months after birth." />}
        </Field>
      </Modal>
    </Card>
  )
}

// ---- finance -------------------------------------------------------------------------------------

export function PaymentsDue() {
  const { state, can, actions } = useStore()
  const now = useNow(60_000)
  const cur = state.settings.currency
  const p = openPayments(state, now)
  const [recording, setRecording] = useState<Payment | null>(null)
  const [method, setMethod] = useState<NonNullable<Payment['method']>>('card_link')
  if (!can('payments.view')) return <Card title="Payments due"><Locked>Payments are restricted</Locked></Card>

  const remind = (pay: Payment) => {
    const client = state.clients.find(c => c.id === pay.clientId)
    const via = client?.consent.whatsapp ? 'WhatsApp' : client?.consent.sms ? 'SMS' : client?.email ? 'email' : null
    if (!via) { actions.toast(`${client?.name ?? 'This client'} has not agreed to WhatsApp or SMS and has no email. Call them instead.`, 'warn'); return }
    actions.audit({ action: 'payment.reminder', target: { type: 'payment', id: pay.id, label: client?.name }, detail: `${PAYMENT_KIND[pay.kind]} reminder for ${money(pay.amount, cur)} sent by ${via} with a card link` })
    actions.toast(`Reminder with a card link sent to ${client?.name} by ${via}`, 'success')
  }

  return (
    <Card title="Payments due" subtitle={`${money(p.overdueTotal, cur)} overdue · ${money(p.openTotal, cur)} open in total`} padded={false} className="td-card">
      {p.list.length === 0 ? (
        <EmptyState icon="card" title="Nothing due or overdue" body="Deposits, instalments and balances appear here from their due date. Overdue ones go to the top." />
      ) : (
        <ul className="td-list">
          {p.list.map(pay => {
            const late = isOverdue(pay, now)
            return (
              <li key={pay.id} className="td-item td-item-static">
                <span className="td-item-lead td-amount num strong">{money(pay.amount, cur)}</span>
                <span className="td-item-main">
                  <span className="td-item-title">
                    <button type="button" className="td-link strong truncate" onClick={() => actions.go('client', pay.clientId)}>{clientName(state, pay.clientId)}</button>
                    <Chip tone={late ? 'danger' : 'warn'} icon={late ? 'alert' : 'clock'}>{late ? 'Overdue' : 'Due'}</Chip>
                  </span>
                  <span className="tiny muted">{PAYMENT_KIND[pay.kind]} · <span className="td-nowrap">{late ? `was due ${shortDate(pay.dueAt)}` : `due ${dateTime(pay.dueAt)}`}</span></span>
                </span>
                {can('payments.take') && (
                  <span className="td-item-trail td-actions">
                    <Button size="sm" variant="ghost" icon="send" onClick={() => remind(pay)}>Send reminder</Button>
                    <Button size="sm" variant="secondary" icon="check" onClick={() => { setMethod('card_link'); setRecording(pay) }}>Record payment</Button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Modal open={!!recording} title="Record a payment" description={recording ? `${clientName(state, recording.clientId)} · ${PAYMENT_KIND[recording.kind]} of ${money(recording.amount, cur)}` : undefined} onClose={() => setRecording(null)}
        footer={<>
          <Button variant="ghost" onClick={() => setRecording(null)}>Cancel</Button>
          <Button variant="primary" onClick={() => {
            if (!recording) return
            const r = recording
            actions.update(d => {
              const x = d.payments.find(y => y.id === r.id)
              if (x) { x.status = 'paid'; x.paidAt = iso(Date.now()); x.method = method }
              d.tasks.filter(t => t.type === 'payment' && t.status === 'open' && t.clientId === r.clientId).forEach(t => { t.status = 'done' })
            })
            actions.audit({ action: 'payment.recorded', target: { type: 'payment', id: r.id, label: clientName(state, r.clientId) }, detail: `${PAYMENT_KIND[r.kind]} of ${money(r.amount, cur)} marked paid (${METHOD_LABEL[method]})` })
            actions.toast(`${money(r.amount, cur)} from ${clientName(state, r.clientId)} recorded as paid`, 'success')
            setRecording(null)
          }}>Mark as paid</Button>
        </>}>
        <Field label="How did they pay?">
          {id => (
            <select id={id} className="input" value={method} onChange={e => setMethod(e.target.value as NonNullable<Payment['method']>)}>
              {(Object.keys(METHOD_LABEL) as Array<NonNullable<Payment['method']>>).map(m => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
            </select>
          )}
        </Field>
      </Modal>
    </Card>
  )
}

const METHOD_LABEL: Record<NonNullable<Payment['method']>, string> = { card_link: 'Card link', card_in_clinic: 'Card in clinic', bank_transfer: 'Bank transfer', cash: 'Cash' }

// ---- marketing -----------------------------------------------------------------------------------

export function MarketingSources() {
  const { state, actions, me } = useStore()
  const now = useNow(60_000)
  const rows = topSources(state, 30, 'all', now).slice(0, 5)
  const week = state.metrics.slice(-7)
  const ig = week.reduce((a, d) => a + d.byChannel.instagram, 0)
  const tt = week.reduce((a, d) => a + d.byChannel.tiktok, 0)
  return (
    <Card title="Top-performing sources" subtitle="Posts and videos that started chats in the last 30 days, best bookers first." padded={false} className="td-card"
      actions={canOpen(me, 'analytics') ? <Button size="sm" variant="ghost" iconRight="chevronRight" onClick={() => actions.go('analytics')}>All sources</Button> : undefined}>
      <div className="td-mix">
        <div className="row between tiny muted"><span>Channel mix, last 7 days</span><span className="num">{fmtInt(ig + tt)} DMs</span></div>
        <div className="an-share" role="img" aria-label={`Instagram ${fmtPct(ig / (ig + tt || 1))}, TikTok ${fmtPct(tt / (ig + tt || 1))}`}>
          <span style={{ flexGrow: ig, background: COLOR.instagram }} />
          <span style={{ flexGrow: tt, background: COLOR.tiktok }} />
        </div>
        <div className="an-legend">
          <span className="an-legend-item"><span className="an-key-rect" style={{ background: COLOR.instagram }} />Instagram <b className="num">{fmtPct(ig / (ig + tt || 1))}</b></span>
          <span className="an-legend-item"><span className="an-key-rect" style={{ background: COLOR.tiktok }} />TikTok <b className="num">{fmtPct(tt / (ig + tt || 1))}</b></span>
        </div>
      </div>
      {rows.length === 0 ? (
        <EmptyState icon="chart" title="No new leads in 30 days" body="Each DM is tagged with the post or video it came from. Sources rank here by bookings." />
      ) : (
        <ul className="td-list">
          {rows.map((r, i) => (
            <li key={r.detail} className="td-item td-item-static">
              <span className="td-item-lead td-rank num">{i + 1}</span>
              <span className="td-item-main">
                <span className="td-item-title"><ChannelBadge channel={r.channel} label={false} size="sm" /><span className="strong td-wrap">{r.detail}</span></span>
                <span className="tiny muted">{plural(r.leads, 'lead')} · {fmtPct(r.contactRate)} shared a number · {fmtInt(r.booked)} booked</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// ---- front desk ----------------------------------------------------------------------------------

export function Arrivals() {
  const { state, actions } = useStore()
  const now = useNow(30_000)
  const [noShow, setNoShow] = useState<Appointment | null>(null)
  const today = state.appointments.filter(a => new Date(a.start).toDateString() === new Date(now).toDateString() && !['cancelled', 'completed', 'no_show'].includes(a.status)).sort((a, b) => ms(a.start) - ms(b.start))
  return (
    <Card title="Arrivals" subtitle="Everyone still due in today. Mark people arrived as they reach reception." padded={false} className="td-card">
      {today.length === 0 ? (
        <EmptyState icon="user" title="No one else is due in today" body="Booked consultations and sessions appear here on the day, in time order." />
      ) : (
        <ul className="td-list">
          {today.map(a => {
            const late = a.status !== 'arrived' && ms(a.start) + 15 * MIN < now
            const practitioner = state.users.find(u => u.id === a.practitionerId)
            const client = state.clients.find(c => c.id === a.clientId)
            const ageBlocked = !!client && ageCheck(state, client, a.procedureId).blocked
            return (
              <li key={a.id} className="td-item td-item-static">
                <span className="td-item-lead td-slot-time num"><span className="strong">{timeOf(a.start)}</span><span className="tiny muted">{APPT_TYPE[a.type]}</span></span>
                <span className="td-item-main">
                  <span className="td-item-title">
                    <span className="strong truncate">{clientName(state, a.clientId)}</span>
                    <Chip tone={late ? 'danger' : STATUS_TONE[a.status]}>{late ? 'Running late' : STATUS_LABEL[a.status]}</Chip>
                    {a.deposit === 'due' && <Chip tone="warn" icon="card">Deposit due</Chip>}
                  </span>
                  <span className="tiny muted">With {practitioner?.name ?? 'a clinician'} · {state.rooms.find(r => r.id === a.roomId)?.name ?? 'room to confirm'}</span>
                </span>
                <span className="td-item-trail td-actions">
                  {ageBlocked
                    ? <Button size="sm" variant="ghost" icon="alert" onClick={() => actions.go('calendar', a.id)}>Age check: open</Button>
                    : a.status === 'arrived'
                    ? <span className="tiny muted row" style={{ gap: 5 }}><Dot tone="accent" />In reception</span>
                    : <>
                      {late && <Button size="sm" variant="ghost" onClick={() => setNoShow(a)}>No-show</Button>}
                      <Button size="sm" variant="secondary" icon="check" onClick={() => { actions.setAppointmentStatus(a.id, 'arrived'); actions.toast(`${clientName(state, a.clientId)} marked arrived. ${practitioner?.name ?? 'The clinician'} can see it now.`, 'success') }}>Mark arrived</Button>
                    </>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <ReasonDialog
        open={!!noShow}
        title={noShow ? `Mark ${clientName(state, noShow.clientId)} as a no-show?` : ''}
        tone="danger"
        body="A rebooking task is created for the front desk. The client's journey record keeps the no-show."
        confirmLabel="Mark no-show"
        placeholder="e.g. No answer on two calls, 20 minutes late"
        onClose={() => setNoShow(null)}
        onConfirm={reason => { if (noShow) { actions.setAppointmentStatus(noShow.id, 'no_show', reason); actions.toast('Marked as no-show. A rebooking task was added.', 'info', { label: 'View tasks', page: 'tasks' }) } }}
      />
    </Card>
  )
}

export function Unconfirmed() {
  const { state, actions } = useStore()
  const now = useNow(60_000)
  const list = state.appointments.filter(a => a.status === 'unconfirmed' && ms(a.start) > now - HOUR && ms(a.start) < now + 2 * DAY).sort((a, b) => ms(a.start) - ms(b.start))
  return (
    <Card title="Unconfirmed appointments" subtitle="Today and tomorrow. Confirm by phone or WhatsApp, then mark them here." padded={false} className="td-card">
      {list.length === 0 ? (
        <EmptyState icon="check" title="Everyone is confirmed" body="Appointments in the next two days that nobody has confirmed show here. Reminders go out 2 days and 1 day before." />
      ) : (
        <ul className="td-list">
          {list.map(a => {
            const client = state.clients.find(c => c.id === a.clientId)
            return (
              <li key={a.id} className="td-item td-item-static">
                <span className="td-item-lead td-slot-time num"><span className="strong">{timeOf(a.start)}</span><span className="tiny muted">{new Date(a.start).toDateString() === new Date(now).toDateString() ? 'Today' : 'Tomorrow'}</span></span>
                <span className="td-item-main">
                  <span className="td-item-title"><span className="strong truncate">{client?.name ?? 'Unknown client'}</span>{a.deposit === 'due' && <Chip tone="warn" icon="card">Deposit due</Chip>}</span>
                  <span className="tiny muted">{apptWhat(state, a, false)} · reminders {a.reminders.d2 || a.reminders.d1 ? 'sent' : 'not sent yet'}{client && !client.consent.whatsapp ? ' · no WhatsApp consent' : ''}</span>
                </span>
                <span className="td-item-trail td-actions">
                  {client && ageCheck(state, client, a.procedureId).blocked ? <Button size="sm" variant="ghost" icon="alert" onClick={() => actions.go('calendar', a.id)}>Age check: open</Button> : <Button size="sm" variant="secondary" icon="check" onClick={() => {
                    actions.setAppointmentStatus(a.id, 'confirmed')
                    actions.update(d => { const x = d.appointments.find(y => y.id === a.id); if (x) x.reminders.confirmedVia = 'phone' })
                    actions.toast(`${client?.name ?? 'Appointment'} confirmed for ${timeOf(a.start)}`, 'success')
                  }}>Mark confirmed</Button>}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

