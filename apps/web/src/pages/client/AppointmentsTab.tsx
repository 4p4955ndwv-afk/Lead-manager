// Appointments tab: upcoming and past visits with status, and the actions front desk needs on the day.
import { useState } from 'react'
import { userName, useStore } from '../../lib/store'
import type { Appointment, Client, Episode } from '../../lib/types'
import { canOpen } from '../../lib/permissions'
import { ms, sameDay, timeOf, until, useNow } from '../../lib/time'
import { Button, Chip, EmptyState, ReasonDialog } from '../../components/ui'
import { Icon } from '../../components/icons'
import { APPT_STATUS_LABEL, APPT_STATUS_TONE, apptTitle, bookingBlock, stageIndex } from './helpers'
import { ScheduleModal } from './Schedule'
import { markSessionDone } from './planOps'
import { first } from './dialogs'

const FINAL: Appointment['status'][] = ['completed', 'cancelled', 'no_show']

export function AppointmentsTab({ client, episode }: { client: Client; episode?: Episode }) {
  const { state, me, can, actions } = useStore()
  const now = useNow(30_000)
  const [bookOpen, setBookOpen] = useState(false)
  const [cancel, setCancel] = useState<Appointment | null>(null)
  const all = state.appointments.filter(a => a.clientId === client.id)
  const upcoming = all.filter(a => ms(a.end) >= now && !FINAL.includes(a.status)).sort((a, b) => ms(a.start) - ms(b.start))
  const past = all.filter(a => !upcoming.includes(a)).sort((a, b) => ms(b.start) - ms(a.start))
  const manage = can('appointments.manage')
  const calendar = canOpen(me, 'calendar')
  const multi = state.episodes.filter(e => e.clientId === client.id).length > 1
  const blocked = bookingBlock(client, episode)
  const canBook = manage && !!episode && !blocked

  const setStatus = (a: Appointment, status: Appointment['status'], reason?: string) => {
    actions.setAppointmentStatus(a.id, status, reason)
    if (status === 'completed' && a.type === 'session') {
      const plan = state.plans.find(p => p.episodeId === a.episodeId && p.items.some(i => i.procedureId === a.procedureId))
      const item = plan?.items.find(i => i.procedureId === a.procedureId)
      const session = item?.sessions.find(s => s.appointmentId === a.id || s.no === a.sessionNo)
      if (plan && item && session && session.status !== 'done') { markSessionDone(actions, state, plan.id, item.id, session.no); return }
    }
    const msg: Partial<Record<Appointment['status'], string>> = {
      confirmed: `Marked confirmed. ${first(client.name)} won't get the confirm-or-cancel reminder.`,
      arrived: `${first(client.name)} has arrived. The practitioner can see it in their day.`,
      completed: 'Marked completed.',
      no_show: 'Marked as a no-show. Front desk has a task to rebook.',
      cancelled: 'Appointment cancelled and the slot freed up.',
    }
    actions.toast(msg[status] ?? 'Updated.', status === 'no_show' || status === 'cancelled' ? 'info' : 'success')
  }

  const row = (a: Appointment) => {
    const d = new Date(a.start)
    const today = sameDay(a.start, now)
    const started = ms(a.start) <= now
    const ep = state.episodes.find(e => e.id === a.episodeId)
    return (
      <li key={a.id} className={`cr-appt ${FINAL.includes(a.status) ? 'is-final' : ''}`}>
        <div className="cr-appt-date" aria-hidden="true">
          <span className="tiny muted">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
          <span className="cr-appt-day num">{d.getDate()}</span>
          <span className="tiny muted">{d.toLocaleDateString(undefined, { month: 'short' })}{d.getFullYear() !== new Date(now).getFullYear() ? ` ${d.getFullYear()}` : ''}</span>
        </div>
        <div className="stack grow" style={{ gap: 3 }}>
          <span className="row wrap" style={{ gap: 6 }}>
            <span className="strong">{apptTitle(state, a)}</span>
            <Chip tone={APPT_STATUS_TONE[a.status]}>{APPT_STATUS_LABEL[a.status]}</Chip>
            {a.deposit === 'due' && <Chip tone="warn" icon="card">Deposit due</Chip>}
            {a.deposit === 'paid' && <Chip tone="ok" icon="card">Deposit paid</Chip>}
            {today && !FINAL.includes(a.status) && <Chip tone="accent">Today</Chip>}
            {multi && ep && <Chip tone="team">Episode {ep.number}</Chip>}
          </span>
          <span className="small muted">
            <span className="num">{d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} {timeOf(a.start)}–{timeOf(a.end)}</span>
            {' · '}{userName(state, a.practitionerId)} · {state.rooms.find(r => r.id === a.roomId)?.name} · {state.branches.find(b => b.id === a.branchId)?.name}
            {!FINAL.includes(a.status) && !started ? ` · ${until(a.start, now)}` : ''}
          </span>
          {a.notes && a.type !== 'follow_up' && <span className="tiny muted">“{a.notes}”</span>}
          {!FINAL.includes(a.status) && (a.reminders.d2 || a.reminders.d1 || a.reminders.confirmedVia) && (
            <span className="tiny faint">Reminders: {[a.reminders.d2 && '2 days before sent', a.reminders.d1 && '1 day before sent', a.reminders.confirmedVia && `confirmed by ${a.reminders.confirmedVia === 'whatsapp' ? 'WhatsApp' : a.reminders.confirmedVia}`].filter(Boolean).join(' · ')}</span>
          )}
        </div>
        <div className="row wrap cr-appt-actions">
          {manage && a.status === 'unconfirmed' && !started && <Button size="sm" icon="check" onClick={() => setStatus(a, 'confirmed')}>Mark confirmed</Button>}
          {manage && (a.status === 'confirmed' || a.status === 'unconfirmed') && today && <Button size="sm" variant="primary" onClick={() => setStatus(a, 'arrived')}>Mark arrived</Button>}
          {manage && a.status === 'arrived' && <Button size="sm" variant="primary" icon="check" onClick={() => setStatus(a, 'completed')}>Mark completed</Button>}
          {manage && (a.status === 'confirmed' || a.status === 'unconfirmed') && started && <Button size="sm" onClick={() => setStatus(a, 'no_show')}>No-show</Button>}
          {manage && !FINAL.includes(a.status) && <Button size="sm" variant="ghost" onClick={() => setCancel(a)}>Cancel</Button>}
          {calendar && <Button size="sm" variant="ghost" icon="arrowUpRight" onClick={() => actions.go('calendar', a.id)} aria-label={`Open ${apptTitle(state, a)} in the calendar`}>Calendar</Button>}
        </div>
      </li>
    )
  }

  const bookType = episode && stageIndex(episode.stage) >= stageIndex('consultation') ? 'follow_up' : 'consultation'

  return (
    <div className="stack lg">
      <div className="row between wrap">
        <span className="small muted">{upcoming.length} upcoming · {past.length} past{past.filter(a => a.status === 'no_show').length ? ` · ${past.filter(a => a.status === 'no_show').length} no-show` : ''}</span>
        <div className="row wrap">
          {calendar && <Button size="sm" variant="ghost" icon="calendar" onClick={() => actions.go('calendar')}>Open calendar</Button>}
          {canBook && <Button size="sm" variant="primary" icon="plus" onClick={() => setBookOpen(true)}>Book an appointment</Button>}
          {manage && blocked && <span className="locked"><Icon name="lock" size={14} />{blocked}</span>}
        </div>
      </div>

      {all.length === 0 ? (
        <div className="card">
          <EmptyState icon="calendar" title="No appointments yet"
            body={`${first(client.name)} hasn't booked anything. Consultations are usually booked on the first call; sessions are scheduled from the treatment plan.`}
            action={canBook ? <Button size="sm" variant="primary" icon="plus" onClick={() => setBookOpen(true)}>Book a consultation</Button> : undefined} />
        </div>
      ) : (
        <>
          <section className="card cr-appt-card" aria-label="Upcoming">
            <h3 className="cr-sec-title">Upcoming</h3>
            {upcoming.length ? <ul className="cr-appts">{upcoming.map(row)}</ul>
              : <p className="small muted cr-pad">Nothing booked. {episode?.stage === 'treatment' ? 'Schedule the next session from the Treatment plan tab.' : 'Book a follow-up if they need one.'}</p>}
          </section>
          {past.length > 0 && (
            <section className="card cr-appt-card" aria-label="Past">
              <h3 className="cr-sec-title">Past</h3>
              <ul className="cr-appts">{past.map(row)}</ul>
            </section>
          )}
        </>
      )}

      {episode && <ScheduleModal open={bookOpen} onClose={() => setBookOpen(false)} client={client} episode={episode} preset={{ type: bookType }} />}
      <ReasonDialog open={!!cancel} onClose={() => setCancel(null)} tone="danger" title={cancel ? `Cancel ${apptTitle(state, cancel)}?` : ''} confirmLabel="Cancel appointment"
        body={`${first(client.name)} is not told automatically; message or call them too.`} placeholder="e.g. Client asked to move it to next week"
        onConfirm={reason => { if (cancel) setStatus(cancel, 'cancelled', reason) }} />
    </div>
  )
}
