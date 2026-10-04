// Book an appointment for this client: a consultation, a plan session or a follow-up.
// Checks the practitioner's diary for clashes before booking.
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import type { Appointment, AppointmentType, Client, Episode } from '../../lib/types'
import { STAGES } from '../../lib/types'
import { canOpen } from '../../lib/permissions'
import { DAY, MIN, dateTime, iso, ms, timeOf } from '../../lib/time'
import { Button, Field, Modal } from '../../components/ui'
import { Icon } from '../../components/icons'
import { localInput, nextSlot, procName } from './helpers'

export interface SchedulePreset {
  type: AppointmentType
  procedureId?: string
  sessionNo?: number
  sessionsTotal?: number
  start?: number
  lockType?: boolean
}

const TYPE_LABEL: Record<AppointmentType, string> = { consultation: 'Consultation', session: 'Treatment session', follow_up: 'Follow-up' }

export function ScheduleModal({ open, onClose, client, episode, preset, onBooked }: {
  open: boolean; onClose: () => void; client: Client; episode: Episode; preset: SchedulePreset; onBooked?: (apptId: string, start: string) => void
}) {
  const { state, me, actions } = useStore()
  const clinicians = useMemo(() => state.users.filter(u => u.role === 'clinician' && u.status === 'active'), [state.users])
  const rooms = useMemo(() => state.rooms.filter(r => r.branchId === client.branchId), [state.rooms, client.branchId])

  const [type, setType] = useState<AppointmentType>(preset.type)
  const [procedureId, setProcedureId] = useState(preset.procedureId ?? episode.interests[0] ?? '')
  const [start, setStart] = useState('')
  const [duration, setDuration] = useState(30)
  const [practitionerId, setPractitionerId] = useState(clinicians[0]?.id ?? '')
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? state.rooms[0]?.id ?? '')
  const [deposit, setDeposit] = useState<Appointment['deposit']>('none')
  const [confirmed, setConfirmed] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!open) return
    const proc = state.procedures.find(p => p.id === (preset.procedureId ?? episode.interests[0]))
    setType(preset.type)
    setProcedureId(preset.procedureId ?? episode.interests[0] ?? '')
    setStart(localInput(nextSlot(preset.start ?? Date.now() + DAY)))
    setDuration(preset.type === 'session' ? proc?.durationMin ?? 45 : 30)
    const usual = state.appointments.filter(a => a.clientId === client.id).sort((a, b) => ms(b.start) - ms(a.start))[0]
    setPractitionerId(usual?.practitionerId ?? clinicians.find(c => c.onShift)?.id ?? clinicians[0]?.id ?? '')
    setRoomId(rooms.find(r => preset.procedureId === 'p_lhr' && /laser/i.test(r.name))?.id ?? rooms[0]?.id ?? state.rooms[0]?.id ?? '')
    setDeposit(preset.type === 'consultation' && (proc?.depositPct ?? 0) > 0 ? 'due' : 'none')
    setConfirmed(false)
    setNotes('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const startMs = start ? new Date(start).getTime() : NaN
  const endMs = startMs + duration * MIN
  const clash = !Number.isNaN(startMs) ? state.appointments.find(a => a.practitionerId === practitionerId && a.status !== 'cancelled' && ms(a.start) < endMs && ms(a.end) > startMs) : undefined
  const roomClash = !Number.isNaN(startMs) ? state.appointments.find(a => a.roomId === roomId && a.status !== 'cancelled' && ms(a.start) < endMs && ms(a.end) > startMs) : undefined
  const past = !Number.isNaN(startMs) && startMs < Date.now() - 5 * MIN
  const invalid = Number.isNaN(startMs) || past || !practitionerId || !roomId || (type !== 'follow_up' && !procedureId)
  const clashName = (a: Appointment) => state.clients.find(c => c.id === a.clientId)?.name ?? 'another client'
  const practitioner = state.users.find(u => u.id === practitionerId)

  const title = type === 'session'
    ? `${procName(state, procedureId)} · session ${preset.sessionNo ?? ''}${preset.sessionsTotal ? ` of ${preset.sessionsTotal}` : ''}`
    : type === 'consultation' ? `Consultation${procedureId ? ` · ${procName(state, procedureId)}` : ''}` : 'Follow-up'

  const book = () => {
    if (invalid || clash || roomClash) return
    const startIso = iso(startMs)
    const id = actions.bookAppointment({
      clientId: client.id, episodeId: episode.id, type, procedureId: procedureId || undefined, sessionNo: type === 'session' ? preset.sessionNo : undefined,
      practitionerId, roomId, branchId: client.branchId, start: startIso, end: iso(endMs), deposit, notes: notes.trim() || undefined,
      status: confirmed ? 'confirmed' : 'unconfirmed',
    })
    if (type === 'consultation' && !episode.exit && STAGES.indexOf(episode.stage) < STAGES.indexOf('booked')) {
      actions.moveStage(episode.id, 'booked', { reason: 'Consultation booked from the client record' })
    }
    // the lead's "call to book a consultation" task is done once one is booked, so its SLA stops counting
    if (type === 'consultation') {
      state.tasks.filter(t => t.clientId === client.id && t.status === 'open' && (t.type === 'call' || t.type === 'callback'))
        .forEach(t => actions.completeTask(t.id, 'Consultation booked from the client record'))
    }
    onBooked?.(id, startIso)
    actions.toast(`Booked: ${title}, ${dateTime(startIso)} with ${practitioner?.name ?? 'the clinician'}.`, 'success', canOpen(me, 'calendar') ? { label: 'Open calendar', page: 'calendar', id } : undefined)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={560} title={preset.type === 'session' ? `Schedule ${title}` : `Book an appointment for ${client.name.split(' ')[0]}`}
      description={`${state.branches.find(b => b.id === client.branchId)?.name ?? ''} branch. Reminders go out 2 days and 1 day before${client.consent.whatsapp ? ' on WhatsApp' : client.consent.sms ? ' by SMS' : ''}.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="calendar" disabled={invalid || !!clash || !!roomClash} onClick={book}>Book {Number.isNaN(startMs) ? '' : dateTime(iso(startMs))}</Button>
      </>}>
      <div className="stack lg">
        {!preset.lockType && (
          <fieldset className="cr-fieldset">
            <legend className="field-label">Type</legend>
            <div className="cr-pills" role="radiogroup" aria-label="Appointment type">
              {(['consultation', 'follow_up'] as AppointmentType[]).map(t => (
                <button key={t} type="button" role="radio" aria-checked={type === t} className={`cr-pill ${type === t ? 'is-active' : ''}`} onClick={() => { setType(t); setDuration(30) }}>{TYPE_LABEL[t]}</button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="cr-form-2">
          {type !== 'session' ? (
            <Field label={type === 'consultation' ? 'Consultation for' : 'Related treatment (optional)'}>
              {id => (
                <select id={id} className="input" value={procedureId} onChange={e => setProcedureId(e.target.value)}>
                  {type === 'follow_up' && <option value="">General follow-up</option>}
                  {state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </Field>
          ) : (
            <Field label="Treatment">
              {id => <input id={id} className="input" value={procName(state, procedureId)} readOnly />}
            </Field>
          )}
          <Field label="Date and time" error={past ? 'That time has already passed.' : undefined}>
            {id => <input id={id} className="input num" type="datetime-local" value={start} step={900} onChange={e => setStart(e.target.value)} />}
          </Field>
          <Field label="Practitioner">
            {id => (
              <select id={id} className="input" value={practitionerId} onChange={e => setPractitionerId(e.target.value)}>
                {clinicians.map(u => <option key={u.id} value={u.id}>{u.name}{u.onShift ? '' : ' · off today'}</option>)}
              </select>
            )}
          </Field>
          <Field label="Room">
            {id => (
              <select id={id} className="input" value={roomId} onChange={e => setRoomId(e.target.value)}>
                {(rooms.length ? rooms : state.rooms).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Length">
            {id => (
              <select id={id} className="input" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                {[15, 30, 45, 60, 90, 120, 240, 480].map(m => <option key={m} value={m}>{m < 60 ? `${m} min` : `${m / 60} h`}</option>)}
              </select>
            )}
          </Field>
          {type === 'consultation' && (
            <Field label="Deposit">
              {id => (
                <select id={id} className="input" value={deposit} onChange={e => setDeposit(e.target.value as Appointment['deposit'])}>
                  <option value="none">No deposit</option>
                  <option value="due">Deposit due (link sent)</option>
                  <option value="paid">Deposit already paid</option>
                </select>
              )}
            </Field>
          )}
        </div>
        {(clash || roomClash) && (
          <div className="cr-callout cr-callout-danger" role="alert">
            <Icon name="alert" size={16} />
            <span className="small">
              {clash
                ? `${practitioner?.name ?? 'The practitioner'} is with ${clashName(clash)} from ${timeOf(clash.start)} to ${timeOf(clash.end)}.`
                : `${state.rooms.find(r => r.id === roomId)?.name} is in use by ${clashName(roomClash!)} until ${timeOf(roomClash!.end)}.`} Pick another time{clash ? ' or practitioner' : ' or room'}.
            </span>
          </div>
        )}
        <Field label="Note for the clinic (optional)">
          {id => <input id={id} className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder={type === 'follow_up' ? 'e.g. 6-week review after session 2' : 'e.g. Prefers morning appointments'} />}
        </Field>
        <label className="checkbox"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{client.name.split(' ')[0]} has already confirmed this time</label>
      </div>
    </Modal>
  )
}
