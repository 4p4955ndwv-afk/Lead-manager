// Appointment details: who, what, where and when, reminders and notes, plus the actions the clinic takes on the day.
import { useEffect, useState, type ReactNode } from 'react'
import type { Appointment, DemoState, Role, User } from '../../lib/types'
import { useStore, userName } from '../../lib/store'
import { maskPhone } from '../../lib/permissions'
import { DAY, MIN, ago, iso, money, ms, until, useNow } from '../../lib/time'
import { Button, Chip, Drawer, Field, KeyValue, Locked, Progress, ReasonDialog, UserAvatar, type Tone } from '../../components/ui'
import { Icon } from '../../components/icons'
import {
  TIME_OPTIONS, TYPE_LABEL, addDays, apptMinutes, clashLines, clientOf, combine, dateInput, durationLabel, findClashes, firstName, fullDay, hasClash, hm,
  isSameDay, mediumDay, parseDateInput, planItemFor, procOf, sessionInfo, timeInput,
} from './helpers'
import { StatusChip } from './parts'
import type { BookingPreset } from './BookingModal'

const TYPE_TONE: Record<Appointment['type'], Tone> = { consultation: 'team', session: 'accent', follow_up: 'ok' }

/** Mirrors the store: the rebook task goes to the front desk on shift, else a coordinator. */
function rebookOwner(s: DemoState): User | undefined {
  const pick = (role: Role) => {
    const pool = s.users.filter(u => u.role === role && u.status === 'active')
    return pool.find(u => u.onShift) ?? pool[0]
  }
  return pick('frontdesk') ?? pick('coordinator')
}

export function ApptDrawer({ appointmentId, onClose, onBook }: {
  appointmentId: string | null
  onClose: () => void
  onBook: (preset: BookingPreset) => void
}) {
  const { state, can, actions } = useStore()
  const now = useNow(30_000)
  const a = appointmentId ? state.appointments.find(x => x.id === appointmentId) : undefined

  const [mode, setMode] = useState<'view' | 'move'>('view')
  const [dialog, setDialog] = useState<null | 'cancel' | 'noshow' | 'move-override'>(null)
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  // reschedule form
  const [mDate, setMDate] = useState('')
  const [mTime, setMTime] = useState('10:00')
  const [mPrac, setMPrac] = useState('')
  const [mRoom, setMRoom] = useState('')

  useEffect(() => {
    setMode('view')
    setDialog(null)
    setEditingNote(false)
  }, [appointmentId])

  if (!a) return null

  const client = clientOf(state, a)
  const proc = procOf(state, a.procedureId)
  const si = sessionInfo(state, a)
  const prac = state.users.find(u => u.id === a.practitionerId)
  const room = state.rooms.find(r => r.id === a.roomId)
  const branch = state.branches.find(b => b.id === a.branchId)
  const canManage = can('appointments.manage')
  const startMs = ms(a.start), endMs = ms(a.end)
  const minutes = apptMinutes(a)
  const started = now >= startMs
  const inProgress = now >= startMs && now < endMs
  const isToday = isSameDay(startMs, now)
  const open = a.status === 'unconfirmed' || a.status === 'confirmed'
  const first = firstName(client?.name ?? 'the client')
  const depositPay = state.payments.filter(p => p.episodeId === a.episodeId && p.kind === 'deposit').sort((x, y) => ms(y.dueAt) - ms(x.dueAt))[0]
  const planHit = planItemFor(state, a.clientId, a.episodeId, a.procedureId)
  const clinicalNotes = client ? state.notes.filter(n => n.clientId === client.id && n.clinical).slice(0, 2) : []
  const history = state.audit.filter(e => e.target.id === a.id).slice(0, 6)
  const clinicians = state.users.filter(u => u.role === 'clinician' && u.status === 'active')

  const closed = a.status === 'cancelled' || a.status === 'no_show'
  const when = a.status === 'cancelled' ? 'Cancelled' : a.status === 'no_show' ? 'Did not attend' : a.status === 'completed' ? (endMs < now ? `Completed · ended ${ago(a.end, now)}` : 'Completed')
    : inProgress ? 'Happening now' : started ? `Started ${ago(a.start, now)}` : `Starts ${until(a.start, now)}`

  // ---- actions ---------------------------------------------------------------------------------
  const releasePlanSession = () => {
    if (a.type !== 'session') return
    actions.update(d => {
      d.plans.forEach(p => p.items.forEach(i => i.sessions.forEach(s => {
        if (s.appointmentId === a.id && s.status === 'booked') {
          s.status = 'due'
          s.appointmentId = undefined
          s.date = undefined
        }
      })))
    })
  }

  const confirm = () => {
    actions.setAppointmentStatus(a.id, 'confirmed')
    actions.update(d => {
      const x = d.appointments.find(y => y.id === a.id)
      if (x && !x.reminders.confirmedVia) x.reminders.confirmedVia = 'phone'
    })
    actions.toast(`${first} is confirmed for ${mediumDay(startMs)} at ${hm(startMs)}.`, 'success')
  }

  const arrive = () => {
    actions.setAppointmentStatus(a.id, 'arrived')
    actions.toast(`${first} is in clinic. ${prac ? `${prac.name} can see them in the diary.` : ''}`, 'success')
  }

  const complete = () => {
    actions.setAppointmentStatus(a.id, 'completed')
    if (a.type === 'session' && a.sessionNo && planHit) {
      actions.update(d => {
        const item = d.plans.find(p => p.id === planHit.plan.id)?.items.find(i => i.id === planHit.item.id)
        const s = item?.sessions.find(x => x.no === a.sessionNo)
        if (s) {
          s.status = 'done'
          s.date = a.start
          s.appointmentId = a.id
        }
      })
      actions.audit({ action: 'plan.session_done', target: { type: 'plan', id: planHit.plan.id, label: client?.name }, detail: `${proc?.name ?? 'Treatment'} session ${a.sessionNo} of ${planHit.item.sessionsTotal} marked done from the calendar` })
      const remaining = planHit.item.sessions.filter(s => s.no !== a.sessionNo && s.status !== 'done' && s.status !== 'skipped').length
      actions.toast(remaining === 0
        ? `Session ${a.sessionNo} done. That completes ${first}'s ${proc?.name.toLowerCase() ?? 'course'}.`
        : `Session ${a.sessionNo} of ${planHit.item.sessionsTotal} marked done on ${first}'s plan. ${remaining} to go.`, 'success')
    } else if (a.type === 'session') {
      actions.toast(`Session completed. ${first} has no treatment plan with this treatment, so no plan was updated.`, 'info')
    } else {
      actions.toast(`${TYPE_LABEL[a.type]} with ${first} marked completed.`, 'success')
    }
  }

  const noShow = (reason: string) => {
    const owner = rebookOwner(state)
    actions.setAppointmentStatus(a.id, 'no_show', reason || undefined)
    releasePlanSession()
    actions.toast(`Marked as a no-show. ${owner ? `${owner.name} has a task to rebook ${first}.` : 'A rebook task was created.'}`, 'warn', { label: 'Open tasks', page: 'tasks' })
  }

  const cancel = (reason: string) => {
    actions.setAppointmentStatus(a.id, 'cancelled', reason)
    releasePlanSession()
    actions.toast(`Appointment cancelled and the slot is free.${a.deposit === 'paid' ? ' The deposit stays on account until finance decides on a refund.' : ''}`, 'info')
  }

  const sendReminder = () => {
    if (!client) return
    if (client.doNotContact) {
      actions.toast(`${client.name} asked not to be contacted. No reminder was sent.`, 'warn')
      return
    }
    const channel = client.consent.whatsapp ? 'WhatsApp' : client.consent.sms ? 'SMS' : null
    if (!channel) {
      actions.toast(`${first} has not agreed to WhatsApp or SMS. Call them instead.`, 'warn')
      return
    }
    const daysAway = (startMs - Date.now()) / DAY
    const flag: 'd1' | 'd2' = !a.reminders.d2 && daysAway > 1.5 ? 'd2' : 'd1'
    actions.update(d => {
      const x = d.appointments.find(y => y.id === a.id)
      if (x) x.reminders[flag] = true
    })
    actions.audit({ action: 'appointment.reminder', target: { type: 'appointment', id: a.id, label: client.name }, detail: `${flag === 'd2' ? 'D-2' : 'D-1'} reminder sent now by ${channel}` })
    actions.toast(`${channel} reminder sent to ${client.name} for ${mediumDay(startMs)} at ${hm(startMs)}.`, 'success')
    // Demo: an unconfirmed client replies "Yes" on WhatsApp a few seconds later.
    if (a.status === 'unconfirmed' && channel === 'WhatsApp') {
      const id = a.id, name = client.name
      window.setTimeout(() => {
        actions.update(d => {
          const x = d.appointments.find(y => y.id === id)
          if (!x || x.status !== 'unconfirmed') return
          x.status = 'confirmed'
          x.reminders.confirmedVia = 'whatsapp'
          d.audit.unshift({ id: `au_${id}_${Date.now().toString(36)}`, at: iso(Date.now()), actor: 'system', action: 'appointment.status', target: { type: 'appointment', id, label: name }, detail: 'unconfirmed → confirmed (replied YES on WhatsApp)' })
        })
        actions.toast(`${name} confirmed by replying YES on WhatsApp.`, 'success')
      }, 6000)
    }
  }

  const markDepositPaid = () => {
    actions.update(d => {
      const x = d.appointments.find(y => y.id === a.id)
      if (x) x.deposit = 'paid'
      const p = d.payments.find(y => y.id === depositPay?.id)
      if (p && p.status !== 'paid') {
        p.status = 'paid'
        p.paidAt = iso(Date.now())
        p.method = 'card_in_clinic'
      }
    })
    actions.audit({ action: 'payment.deposit_paid', target: { type: 'appointment', id: a.id, label: client?.name }, detail: `Deposit${depositPay ? ` of ${money(depositPay.amount, state.settings.currency)}` : ''} taken in clinic` })
    actions.toast(`Deposit marked paid for ${first}.`, 'success')
  }

  const saveNote = () => {
    const text = noteDraft.trim()
    actions.update(d => {
      const x = d.appointments.find(y => y.id === a.id)
      if (x) x.notes = text || undefined
    })
    actions.audit({ action: 'appointment.note', target: { type: 'appointment', id: a.id, label: client?.name }, detail: text ? `Note updated: ${text}` : 'Note removed' })
    setEditingNote(false)
    actions.toast('Note saved on the appointment.', 'success')
  }

  // ---- reschedule ------------------------------------------------------------------------------
  const startMove = () => {
    const suggestion = startMs > Date.now() ? startMs : combine(addDays(Date.now(), 1), timeInput(startMs))
    setMDate(dateInput(suggestion))
    const t = timeInput(suggestion)
    setMTime(TIME_OPTIONS.includes(t) ? t : '10:00')
    setMPrac(a.practitionerId)
    setMRoom(a.roomId)
    setMode('move')
  }
  const mDay = parseDateInput(mDate)
  const newStart = mDay != null ? combine(mDay, mTime) : NaN
  const newEnd = newStart + minutes * MIN
  const movePast = !Number.isNaN(newStart) && newStart < Date.now()
  const unchanged = newStart === startMs && mPrac === a.practitionerId && mRoom === a.roomId
  const moveClashes = mode === 'move' && !Number.isNaN(newStart) ? findClashes(state, { start: newStart, end: newEnd, practitionerId: mPrac, roomId: mRoom, clientId: a.clientId, excludeId: a.id }) : undefined
  const moveClash = moveClashes ? hasClash(moveClashes) : false
  const moveClashText = moveClashes && moveClash ? clashLines(state, moveClashes, mPrac, mRoom) : []
  const canMove = !Number.isNaN(newStart) && !movePast && !unchanged && !!mPrac && !!mRoom

  const doMove = (reason?: string) => {
    const newRoom = state.rooms.find(r => r.id === mRoom)
    const fromText = `${mediumDay(startMs)} ${hm(startMs)}`
    const toText = `${mediumDay(newStart)} ${hm(newStart)}`
    actions.update(d => {
      const x = d.appointments.find(y => y.id === a.id)
      if (!x) return
      x.start = iso(newStart)
      x.end = iso(newEnd)
      x.practitionerId = mPrac
      x.roomId = mRoom
      if (newRoom) x.branchId = newRoom.branchId
      if (newStart !== startMs) {
        x.status = 'unconfirmed'
        x.reminders = { d2: false, d1: false }
      }
      d.plans.forEach(p => p.items.forEach(i => i.sessions.forEach(s => {
        if (s.appointmentId === a.id) s.date = iso(newStart)
      })))
    })
    const changes = [
      newStart !== startMs ? `${fromText} → ${toText}` : null,
      mPrac !== a.practitionerId ? `practitioner ${userName(state, a.practitionerId)} → ${userName(state, mPrac)}` : null,
      mRoom !== a.roomId ? `room ${room?.name ?? ''} → ${newRoom?.name ?? ''}` : null,
    ].filter(Boolean).join('; ')
    actions.audit({ action: reason ? 'appointment.rescheduled_double_booked' : 'appointment.rescheduled', target: { type: 'appointment', id: a.id, label: client?.name }, detail: changes, reason })
    setMode('view')
    actions.toast(newStart !== startMs
      ? `Moved to ${toText}. ${first} needs to confirm the new time, so send a reminder.`
      : 'Appointment updated.', 'success')
  }

  // ---- rebook ----------------------------------------------------------------------------------
  const nextSession = planHit?.item.sessions.find(s => s.status === 'due' && s.no !== a.sessionNo)
  const rebook = () => onBook({
    clientId: a.clientId, type: a.type, procedureId: a.procedureId, sessionNo: a.sessionNo, practitionerId: a.practitionerId, roomId: a.roomId,
    start: combine(addDays(Math.max(Date.now(), startMs), 7), timeInput(startMs)),
    title: `Rebook ${first}`,
  })
  const bookNext = () => onBook({
    clientId: a.clientId, type: 'session', procedureId: a.procedureId, sessionNo: nextSession?.no, practitionerId: a.practitionerId, roomId: a.roomId,
    start: combine(addDays(startMs, Math.max(1, proc?.intervalWeeks ?? 1) * 7), timeInput(startMs)),
    title: `Book session ${nextSession?.no ?? ''} of ${planHit?.item.sessionsTotal ?? ''} for ${first}`,
  })
  const bookFollowUp = () => onBook({
    clientId: a.clientId, type: 'follow_up', procedureId: a.procedureId, practitionerId: a.practitionerId, roomId: a.roomId,
    start: combine(addDays(startMs, 42), timeInput(startMs)),
    title: `Book a follow-up for ${first}`,
  })

  // ---- footer ----------------------------------------------------------------------------------
  let footer: ReactNode
  if (!canManage) {
    footer = <Locked>Only staff who book appointments can change this</Locked>
  } else if (mode === 'move') {
    footer = <>
      <Button variant="ghost" onClick={() => setMode('view')}>Back</Button>
      {moveClash && canMove
        ? <Button variant="danger" icon="alert" onClick={() => setDialog('move-override')}>Move anyway…</Button>
        : <Button variant="primary" icon="calendar" disabled={!canMove} onClick={() => doMove()}>{Number.isNaN(newStart) ? 'Move' : `Move to ${mediumDay(newStart)}, ${hm(newStart)}`}</Button>}
    </>
  } else {
    footer = (
      <div className="ca-dr-actions">
        <div className="ca-dr-actions-secondary">
          {open && <Button size="sm" variant="ghost" icon="calendar" onClick={startMove}>Reschedule</Button>}
          {open && started && <Button size="sm" variant="ghost" icon="x" onClick={() => setDialog('noshow')}>No-show</Button>}
          {open && <Button size="sm" variant="ghost" icon="trash" onClick={() => setDialog('cancel')}>Cancel</Button>}
          {a.status === 'arrived' && <Button size="sm" variant="ghost" icon="x" onClick={() => setDialog('noshow')}>Left without treatment</Button>}
        </div>
        <div className="ca-dr-actions-primary">
          {open && !started && <Button size="sm" variant="secondary" icon="bell" onClick={sendReminder}>Send reminder now</Button>}
          {a.status === 'unconfirmed' && <Button size="sm" variant={isToday ? 'secondary' : 'primary'} icon="check" onClick={confirm}>Confirm</Button>}
          {open && isToday && <Button size="sm" variant="primary" icon="pin" onClick={arrive}>Mark arrived</Button>}
          {(a.status === 'arrived' || (open && started)) && <Button size="sm" variant="primary" icon="check" onClick={complete}>{a.type === 'session' ? 'Complete session' : 'Complete'}</Button>}
          {a.status === 'completed' && a.type === 'session' && nextSession && <Button size="sm" variant="primary" icon="plus" onClick={bookNext}>Book session {nextSession.no}</Button>}
          {a.status === 'completed' && !(a.type === 'session' && nextSession) && <Button size="sm" variant="secondary" icon="plus" onClick={bookFollowUp}>Book a follow-up</Button>}
          {(a.status === 'no_show' || a.status === 'cancelled') && <Button size="sm" variant="primary" icon="refresh" onClick={rebook}>Rebook {first}</Button>}
        </div>
      </div>
    )
  }

  const reminderRow = (done: boolean, label: string, doneText: string, pendingText: string, icon: 'bell' | 'whatsapp' | 'check' = 'bell') => (
    <li className={`ca-rem-row ${done ? 'is-done' : ''}`}>
      <span className="ca-rem-icon"><Icon name={done ? (icon === 'bell' ? 'check' : icon) : 'clock'} size={14} /></span>
      <span className="grow">{label}</span>
      <span className={done ? 'ca-rem-ok' : 'muted'}>{done ? doneText : pendingText}</span>
    </li>
  )
  // Reminders go out at 10:00 two days and one day before.
  const d2Due = addDays(startMs, -2) + 10 * 60 * MIN
  const d1Due = addDays(startMs, -1) + 10 * 60 * MIN
  const pendingText = (due: number) => closed ? 'Not needed' : started || due < now ? 'Not sent' : `Goes out ${mediumDay(due)}`

  return (
    <>
      <Drawer open={!dialog} title={client?.name ?? 'Appointment'} onClose={onClose} footer={footer} width={460}>
        <div className="stack lg">
          {/* summary */}
          <div className={`ca-dr-hero ca-t-${a.type}`}>
            <div className="row wrap" style={{ gap: 6 }}>
              <StatusChip status={a.status} />
              <Chip tone={TYPE_TONE[a.type]}>{TYPE_LABEL[a.type]}</Chip>
              {a.deposit === 'due' && a.status !== 'cancelled' && <Chip tone="warn" icon="card">Deposit due</Chip>}
            </div>
            <div className="ca-dr-when">
              <span className="ca-dr-time num">{hm(startMs)}–{hm(endMs)}</span>
              <span className="muted">{fullDay(startMs)} · {durationLabel(minutes)}</span>
              <span className={`small ${inProgress ? 'ca-dr-live' : 'muted'}`}>{when}</span>
            </div>
            <div className="ca-dr-what">
              <span className="strong">{proc?.name ?? (a.type === 'follow_up' ? 'General follow-up' : 'Treatment')}</span>
              {si && <span className="muted"> · Session {si.no} of {si.total}</span>}
            </div>
            {client && <Button size="sm" variant="secondary" icon="user" iconRight="arrowRight" onClick={() => actions.go('client', client.id)}>Open {first}'s record</Button>}
          </div>

          {mode === 'move' && canManage && (
            <section className="ca-dr-section ca-dr-move" aria-label="Reschedule">
              <h3>Move this appointment</h3>
              <p className="small muted">Same length ({durationLabel(minutes)}). Moving to a new time sets it back to unconfirmed and resets reminders.</p>
              <div className="ca-form-2">
                <Field label="New date" error={movePast ? 'That time has already passed.' : undefined}>
                  {id => <input id={id} className="input num" type="date" value={mDate} onChange={e => setMDate(e.target.value)} />}
                </Field>
                <Field label="Start">
                  {id => (
                    <select id={id} className="input num" value={mTime} onChange={e => setMTime(e.target.value)}>
                      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Practitioner" error={moveClashes?.practitioner.length ? 'Busy at this time' : undefined}>
                  {id => (
                    <select id={id} className="input" value={mPrac} onChange={e => setMPrac(e.target.value)}>
                      {clinicians.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  )}
                </Field>
                <Field label="Room" error={moveClashes?.room.length ? 'In use at this time' : undefined}>
                  {id => (
                    <select id={id} className="input" value={mRoom} onChange={e => setMRoom(e.target.value)}>
                      {state.branches.map(b => (
                        <optgroup key={b.id} label={b.name}>
                          {state.rooms.filter(r => r.branchId === b.id).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </Field>
              </div>
              {moveClash ? (
                <div className="ca-callout ca-callout-warn" role="alert">
                  <Icon name="alert" size={16} />
                  <div className="stack" style={{ gap: 2 }}>
                    {moveClashText.map(t => <span key={t} className="small">{t}</span>)}
                  </div>
                </div>
              ) : canMove ? (
                <p className="ca-note small ca-note-ok"><Icon name="check" size={14} />{userName(state, mPrac)} and {state.rooms.find(r => r.id === mRoom)?.name} are free {hm(newStart)}–{hm(newEnd)}.</p>
              ) : null}
            </section>
          )}

          {open && started && !inProgress && canManage && mode === 'view' && (
            <div className="ca-callout ca-callout-warn">
              <Icon name="clock" size={16} />
              <span className="small">This appointment has passed. Mark it completed or as a no-show so the plan and follow-ups stay right.</span>
            </div>
          )}

          <section className="ca-dr-section">
            <h3>Details</h3>
            <KeyValue items={[
              ['Treatment', proc?.name ?? (a.type === 'follow_up' ? 'General follow-up' : '—')],
              ...(si ? [['Session', (
                <div className="stack" style={{ gap: 4 }}>
                  <span>Session {si.no} of {si.total}{si.fromPlan ? ` · ${si.done} done` : ' · not on a plan'}</span>
                  {si.fromPlan && <Progress value={si.done} max={si.total} label={`${si.done} of ${si.total} sessions done`} />}
                </div>
              )] as [ReactNode, ReactNode]] : []),
              ['Practitioner', <span className="row" style={{ gap: 6 }}><UserAvatar userId={a.practitionerId} size={20} />{prac?.name ?? 'Unassigned'}</span>],
              ['Room', `${room?.name ?? '—'}${branch ? ` · ${branch.name}` : ''}`],
              ['Time', `${mediumDay(startMs)}, ${hm(startMs)}–${hm(endMs)}`],
              ['Deposit', (
                <span className="row wrap" style={{ gap: 6 }}>
                  {a.deposit === 'paid' ? <Chip tone="ok" icon="check">Paid</Chip> : a.deposit === 'due' ? <Chip tone="warn">Due</Chip> : <span className="muted">No deposit needed</span>}
                  {depositPay && a.deposit !== 'none' && can('payments.view') && <span className="num">{money(depositPay.amount, state.settings.currency)}</span>}
                  {a.deposit === 'due' && can('payments.take') && a.status !== 'cancelled' && <Button size="sm" variant="ghost" icon="card" onClick={markDepositPaid}>Mark paid</Button>}
                </span>
              )],
              ['Phone', client ? maskPhone(client.phone, can('clients.view_phone')) : '—'],
            ]} />
          </section>

          <section className="ca-dr-section">
            <h3>Reminders</h3>
            <ul className="ca-rem-list">
              {reminderRow(a.reminders.d2, 'D-2 reminder', 'Sent', pendingText(d2Due))}
              {reminderRow(a.reminders.d1, 'D-1 reminder', 'Sent', pendingText(d1Due))}
              {reminderRow(!!a.reminders.confirmedVia || a.status === 'confirmed' || a.status === 'arrived' || a.status === 'completed', 'Confirmation',
                a.reminders.confirmedVia === 'whatsapp' ? 'Confirmed via WhatsApp' : a.reminders.confirmedVia ? `Confirmed by ${a.reminders.confirmedVia}` : 'Confirmed',
                a.status === 'unconfirmed' ? 'Not confirmed yet' : closed ? 'Not needed' : '—', a.reminders.confirmedVia === 'whatsapp' ? 'whatsapp' : 'check')}
            </ul>
            {client?.doNotContact && <p className="ca-note small"><Icon name="info" size={14} />{first} asked not to be contacted. Reminders are off.</p>}
          </section>

          <section className="ca-dr-section">
            <div className="row between">
              <h3>Notes</h3>
              {canManage && !editingNote && <Button size="sm" variant="ghost" icon="edit" onClick={() => { setNoteDraft(a.notes ?? ''); setEditingNote(true) }}>{a.notes ? 'Edit' : 'Add note'}</Button>}
            </div>
            {editingNote ? (
              <div className="stack">
                <Field label="Note for the team" hint="Visible to everyone who can see the calendar. Clinical details belong in clinical notes.">
                  {id => <textarea id={id} className="input" rows={3} value={noteDraft} onChange={e => setNoteDraft(e.target.value)} />}
                </Field>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Button size="sm" variant="ghost" onClick={() => setEditingNote(false)}>Discard</Button>
                  <Button size="sm" variant="primary" onClick={saveNote}>Save note</Button>
                </div>
              </div>
            ) : a.notes ? <p className="ca-dr-note">{a.notes}</p> : <p className="small muted">No notes. Add anything the team should know on the day, like parking or a preferred name.</p>}
          </section>

          <section className="ca-dr-section">
            <h3>Clinical notes</h3>
            {!can('clinical.view') ? <Locked /> : clinicalNotes.length ? (
              <ul className="ca-dr-clinical">
                {clinicalNotes.map(n => (
                  <li key={n.id}>
                    <p>{n.text}</p>
                    <span className="tiny muted">{userName(state, n.authorId)} · {ago(n.at, now)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="small muted">No clinical notes for {first} yet. They are written on the client record.</p>}
          </section>

          {history.length > 0 && (
            <section className="ca-dr-section">
              <h3>History</h3>
              <ul className="ca-dr-history">
                {history.map(h => (
                  <li key={h.id}>
                    <span className="grow">{h.detail}{h.reason ? <span className="muted"> · “{h.reason}”</span> : null}</span>
                    <span className="tiny muted">{userName(state, h.actor)} · {ago(h.at, now)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Drawer>

      <ReasonDialog open={dialog === 'cancel'} title={`Cancel ${first}'s appointment?`} tone="danger" confirmLabel="Cancel appointment"
        body={<div className="stack" style={{ gap: 4 }}>
          <span>{TYPE_LABEL[a.type]} on {mediumDay(startMs)} at {hm(startMs)} with {prac?.name ?? 'the practitioner'}. The slot becomes free.</span>
          {a.type === 'session' && a.sessionNo && <span>Session {a.sessionNo} goes back to “due” on the plan.</span>}
          {a.deposit === 'paid' && <span>The deposit stays on account. Finance decides on any refund.</span>}
        </div>}
        placeholder="e.g. Client asked to cancel by WhatsApp; will rebook after holiday"
        onConfirm={cancel} onClose={() => setDialog(null)} />
      <ReasonDialog open={dialog === 'noshow'} title={a.status === 'arrived' ? `${first} left without treatment?` : `Mark ${first} as a no-show?`} confirmLabel="Mark no-show" tone="danger"
        requireReason={!started}
        body={<div className="stack" style={{ gap: 4 }}>
          {!started && <span>This appointment has not started yet, so a reason is required.</span>}
          <span>{rebookOwner(state)?.name ?? 'The front desk'} gets a task to rebook {first} within 2 hours.</span>
        </div>}
        placeholder="e.g. No answer on two calls, 15 minutes late"
        onConfirm={noShow} onClose={() => setDialog(null)} />
      <ReasonDialog open={dialog === 'move-override'} title="Move into a clash?" tone="danger" confirmLabel="Move anyway"
        body={<div className="stack" style={{ gap: 4 }}>{moveClashText.map(t => <span key={t}>{t}</span>)}<span>Say why the double booking is OK.</span></div>}
        onConfirm={reason => doMove(reason)} onClose={() => setDialog(null)} />
    </>
  )
}
