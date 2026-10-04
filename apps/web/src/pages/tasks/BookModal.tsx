// "Booked" outcome: pick a consultation slot that avoids the practitioner's diary, and agree the deposit.
import { useEffect, useMemo, useState } from 'react'
import type { Client, Episode, Task } from '../../lib/types'
import { useStore } from '../../lib/store'
import { dateTime, iso, money, shortDate, timeOf, useNow } from '../../lib/time'
import { Button, Field, Modal } from '../../components/ui'
import { Icon } from '../../components/icons'
import { CONSULT_MIN, dayLabel, daySlots, dayStarts, firstName, fromLocalInput, toLocalInput, tomorrowAt, weekdayTime } from './helpers'

type PayWhen = 'link' | 'clinic' | 'instalments'
const PAY_OPTIONS: { id: PayWhen; label: string; hint: string }[] = [
  { id: 'link', label: 'Deposit now by card link', hint: 'We text a secure link after the call.' },
  { id: 'clinic', label: 'Pay at the clinic', hint: 'Deposit taken on arrival, before the consultation.' },
  { id: 'instalments', label: 'Instalments discussed', hint: 'Deposit by the due date; the rest is agreed at the consultation.' },
]

export function BookModal({ open, onClose, task, client, episode, callNote }: {
  open: boolean
  onClose: () => void
  task: Task
  client: Client
  episode?: Episode
  callNote: () => string
}) {
  const { state, actions } = useStore()
  const now = useNow(60_000)
  const clinicians = useMemo(() => state.users.filter(u => u.role === 'clinician' && u.status === 'active'), [state.users])
  const branch = state.branches.find(b => b.id === client.branchId)
  const defaultProc = episode?.interests.find(id => state.procedures.some(p => p.id === id)) ?? state.procedures[0]?.id

  const [procedureId, setProcedureId] = useState(defaultProc)
  const [practitionerId, setPractitionerId] = useState(clinicians.find(c => c.onShift)?.id ?? clinicians[0]?.id ?? '')
  const days = useMemo(() => dayStarts(now, 7), [now])
  const [day, setDay] = useState<number>(() => days[0])
  const [start, setStart] = useState<number | null>(null)
  const [payWhen, setPayWhen] = useState<PayWhen>('link')
  const [due, setDue] = useState(() => toLocalInput(tomorrowAt(Date.now(), 12)))
  const [dueTouched, setDueTouched] = useState(false)
  const [dueMoved, setDueMoved] = useState(false)
  const [note, setNote] = useState('')

  // reset every time the dialog opens
  useEffect(() => {
    if (!open) return
    const pid = clinicians.find(c => c.onShift)?.id ?? clinicians[0]?.id ?? ''
    setProcedureId(defaultProc)
    setPractitionerId(pid)
    const firstOpen = dayStarts(Date.now(), 7).find(d => daySlots(state, pid, d, Date.now()).slots.some(s => !s.taken && !s.past))
    setDay(firstOpen ?? dayStarts(Date.now(), 7)[0])
    setStart(null)
    setPayWhen('link')
    setDue(toLocalInput(tomorrowAt(Date.now(), 12)))
    setDueTouched(false)
    setDueMoved(false)
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const proc = state.procedures.find(p => p.id === procedureId) ?? state.procedures[0]
  const askedAbout = (episode?.interests ?? []).map(id => state.procedures.find(p => p.id === id)?.name).filter((x): x is string => !!x)
  const practitioner = clinicians.find(c => c.id === practitionerId)
  const deposit = proc ? Math.round(proc.price * proc.depositPct / 100) : 0
  const { open: dayOpen, slots } = daySlots(state, practitionerId, day, now)
  const freeCount = slots.filter(s => !s.taken && !s.past).length

  // a chosen slot can become unavailable when the practitioner changes
  useEffect(() => {
    if (start == null) return
    const s = daySlots(state, practitionerId, day, Date.now()).slots.find(x => x.start === start)
    if (!s || s.taken || s.past) setStart(null)
  }, [practitionerId, day, start, state])

  // "pay at the clinic" means the deposit is due when they arrive; otherwise the default (tomorrow 12:00)
  // moves earlier when the appointment itself is before then, unless the coordinator set a time by hand
  useEffect(() => {
    if (start == null) return
    if (payWhen === 'clinic') { setDue(toLocalInput(start)); return }
    if (dueTouched) return
    const def = tomorrowAt(Date.now(), 12)
    if (start >= def) { setDue(toLocalInput(def)); setDueMoved(false); return }
    const q = 15 * 60_000
    const earliest = Math.ceil((Date.now() + q) / q) * q
    setDue(toLocalInput(Math.min(start, Math.max(earliest, start - 2 * 60 * 60_000))))
    setDueMoved(true)
  }, [payWhen, start, dueTouched])

  const dueMs = fromLocalInput(due)
  const needsDeposit = deposit > 0
  let dueError: string | undefined
  if (needsDeposit) {
    if (!Number.isFinite(dueMs)) dueError = 'Pick a date and time for the deposit.'
    else if (dueMs < Date.now()) dueError = 'This time has already passed. Pick a time later than now.'
    else if (start != null && dueMs > start) dueError = `This is after the appointment starts (${shortDate(iso(start))}, ${timeOf(iso(start))}). Pick an earlier time, or choose "Pay at the clinic".`
  }
  const canConfirm = start != null && !!proc && !!practitioner && !dueError

  const fmt = (n: number) => money(n, state.settings.currency)
  const payLine = !needsDeposit
    ? `No deposit for ${proc?.name ?? 'this treatment'}.`
    : payWhen === 'link'
      ? `Deposit ${fmt(deposit)} by card link, due ${dateTime(iso(dueMs))}.`
      : payWhen === 'clinic'
        ? `Deposit ${fmt(deposit)} to be paid at the clinic on arrival.`
        : `Deposit ${fmt(deposit)} due ${dateTime(iso(dueMs))}; instalments discussed for the rest.`

  const confirm = () => {
    if (!canConfirm || start == null || !proc || !practitioner) return
    const fullNote = [payLine, note.trim(), callNote()].filter(Boolean).join(' ')
    actions.logCall(task.id, 'booked', {
      start: iso(start),
      procedureId: proc.id,
      practitionerId: practitioner.id,
      depositDueAt: needsDeposit ? iso(dueMs) : undefined,
      note: fullNote,
    })
    actions.toast(`Consultation booked for ${firstName(client.name)}: ${weekdayTime(start)} with ${practitioner.name}.`, 'success', { label: 'Open calendar', page: 'calendar' })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={600} title={`Book ${firstName(client.name)}'s consultation`}
      description={`Free ${CONSULT_MIN}-minute consultation at ${branch ? `${branch.name}, ${branch.city}` : 'the clinic'}. The task closes and the lead moves to Appointment booked.`}
      footer={<>
        {start != null && dueError && <span className="tk-foot-note small">Check the deposit due time</span>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={!canConfirm} onClick={confirm}>
          {start != null ? `Book ${weekdayTime(start)}` : 'Pick a time to book'}
        </Button>
      </>}>
      <div className="stack lg">
        <div className="tk-form-2">
          <Field label="Treatment" hint={askedAbout.length ? `Asked about: ${askedAbout.join(', ')}` : undefined}>
            {id => (
              <select id={id} className="input" value={procedureId} onChange={e => setProcedureId(e.target.value)}>
                {state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Practitioner">
            {id => (
              <select id={id} className="input" value={practitionerId} onChange={e => setPractitionerId(e.target.value)}>
                {clinicians.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Field>
        </div>

        <div className="stack">
          <span className="field-label" id="tk-day-label">Day</span>
          <div className="tk-days" role="radiogroup" aria-labelledby="tk-day-label">
            {days.map(d => {
              const l = dayLabel(d, now)
              const info = daySlots(state, practitionerId, d, now)
              const free = info.slots.filter(s => !s.taken && !s.past).length
              return (
                <button key={d} type="button" role="radio" aria-checked={d === day} className={`tk-day ${d === day ? 'is-active' : ''} ${!info.open || !free ? 'is-closed' : ''}`} onClick={() => setDay(d)}>
                  <span className="tk-day-top">{l.top}</span>
                  <span className="tk-day-date num">{l.bottom}</span>
                  <span className="tk-day-free">{!info.open ? 'Closed' : free ? `${free} free` : 'Full'}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="stack">
          <div className="row between wrap">
            <span className="field-label" id="tk-slot-label">Time</span>
            {practitioner && dayOpen && <span className="tiny muted">Greyed-out times are already in {practitioner.name}'s diary</span>}
          </div>
          {!dayOpen ? (
            <p className="tk-slot-empty small muted">The clinic is closed on this day. Pick another day.</p>
          ) : freeCount === 0 ? (
            <p className="tk-slot-empty small muted">{practitioner?.name ?? 'This practitioner'} has no free {CONSULT_MIN}-minute slots left on this day. Try another day or practitioner.</p>
          ) : (
            <div className="tk-slots" role="radiogroup" aria-labelledby="tk-slot-label">
              {slots.map(s => {
                const disabled = s.taken || s.past
                return (
                  <button key={s.start} type="button" role="radio" aria-checked={s.start === start} disabled={disabled}
                    className={`tk-slot num ${s.start === start ? 'is-active' : ''} ${s.taken ? 'is-taken' : ''}`}
                    aria-label={`${timeOf(iso(s.start))}${s.taken ? ', already booked' : s.past ? ', too soon' : ''}`}
                    title={s.taken ? 'Already booked' : s.past ? 'Too soon to book' : undefined}
                    onClick={() => setStart(s.start)}>
                    {timeOf(iso(s.start))}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="tk-deposit">
          <div className="row between wrap">
            <span className="strong">Deposit</span>
            <span className="tk-deposit-amount num">{needsDeposit ? fmt(deposit) : 'None'}</span>
          </div>
          <p className="small muted">
            {needsDeposit && proc
              ? `${proc.depositPct}% of the ${fmt(proc.price)} course price for ${proc.name}. It is taken off the final bill.`
              : `${proc?.name ?? 'This treatment'} does not need a deposit.`}
          </p>
          {needsDeposit && (
            <>
              <fieldset className="tk-pay">
                <legend className="field-label">When will they pay?</legend>
                {PAY_OPTIONS.map(o => (
                  <label key={o.id} className={`tk-pay-opt ${payWhen === o.id ? 'is-active' : ''}`}>
                    <input type="radio" name={`tk-pay-${task.id}`} value={o.id} checked={payWhen === o.id} onChange={() => setPayWhen(o.id)} />
                    <span className="stack" style={{ gap: 0 }}>
                      <span className="strong small">{o.label}</span>
                      <span className="tiny muted">{o.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <Field label="Deposit due" error={dueError} hint={payWhen === 'clinic' ? 'Set to the appointment time.' : dueMoved && !dueTouched ? 'Moved earlier so it falls before the appointment.' : 'Defaults to tomorrow at 12:00.'}>
                {id => <input id={id} type="datetime-local" className="input" value={due} disabled={payWhen === 'clinic' && start != null} onChange={e => { setDue(e.target.value); setDueTouched(true) }} />}
              </Field>
            </>
          )}
        </div>

        <Field label="Note for the clinic (optional)" hint="Saved on the appointment with the payment choice above.">
          {id => <textarea id={id} className="input" rows={2} value={note} placeholder="e.g. Nervous about needles; wants Dr Clarke if possible" onChange={e => setNote(e.target.value)} />}
        </Field>

        <div className="tk-summary-line small" aria-live="polite">
          <Icon name="calendar" size={15} />
          <span>
            {start != null
              ? <><strong>{weekdayTime(start)}</strong> · {proc?.name} · {practitioner?.name} · {payLine}</>
              : 'Pick a day and time to see the booking summary.'}
          </span>
        </div>
      </div>
    </Modal>
  )
}
