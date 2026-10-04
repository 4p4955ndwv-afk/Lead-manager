// New booking: pick a client, what they are coming in for, who sees them, where and when.
// Checks practitioner, room and client clashes, and hard-blocks anyone who may be under 18.
import { useEffect, useMemo, useState } from 'react'
import type { Appointment, AppointmentType, Client } from '../../lib/types'
import { STAGES } from '../../lib/types'
import { activeEpisode, useStore } from '../../lib/store'
import { maskPhone } from '../../lib/permissions'
import { MIN, iso } from '../../lib/time'
import { Avatar, Button, Chip, Field, Modal, ReasonDialog, Segmented, StageBadge } from '../../components/ui'
import { Icon } from '../../components/icons'
import {
  DAY_END_MIN, TIME_OPTIONS, TYPE_LABEL, ageCheck, clashLines, combine, dateInput, durationLabel, findClashes, firstName, hasClash, hm, mediumDay,
  minutesOfDay, parseDateInput, planItemFor, procOf, timeInput,
} from './helpers'

export interface BookingPreset {
  clientId?: string
  type?: AppointmentType
  procedureId?: string
  sessionNo?: number
  practitionerId?: string
  roomId?: string
  start?: number
  title?: string
}

const BOOKABLE_STAGES = new Set(['contact', 'call', 'booked', 'consultation', 'plan', 'treatment', 'aftercare', 'alumni'])

function defaultDuration(type: AppointmentType, durationMin?: number) {
  return type === 'session' ? durationMin ?? 45 : 30
}

export function BookingModal({ open, preset, onClose, onBooked }: {
  open: boolean
  preset: BookingPreset
  onClose: () => void
  onBooked: (id: string, start: number, where: { practitionerId: string; branchId: string }) => void
}) {
  const { state, me, can, actions } = useStore()
  const showPhone = can('clients.view_phone')
  const clinicians = useMemo(() => state.users.filter(u => u.role === 'clinician' && u.status === 'active'), [state.users])

  const [query, setQuery] = useState('')
  const [clientId, setClientId] = useState<string>('')
  const [type, setType] = useState<AppointmentType>('consultation')
  const [procedureId, setProcedureId] = useState('')
  const [sessionNo, setSessionNo] = useState(1)
  const [practitionerId, setPractitionerId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(30)
  const [deposit, setDeposit] = useState<Appointment['deposit']>('none')
  const [notes, setNotes] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const client = state.clients.find(c => c.id === clientId)
  const episode = client ? activeEpisode(state, client.id) : undefined
  const proc = procOf(state, procedureId)
  const planHit = client ? planItemFor(state, client.id, episode?.id, procedureId) : undefined

  // Fill sensible defaults whenever the modal opens.
  useEffect(() => {
    if (!open) return
    const c = state.clients.find(x => x.id === preset.clientId)
    const t = preset.type ?? 'consultation'
    const ep = c ? activeEpisode(state, c.id) : undefined
    const pid = preset.procedureId ?? ep?.interests[0] ?? ''
    const p = procOf(state, pid)
    const start = preset.start ?? nextFreeHalfHour()
    setQuery('')
    setClientId(c?.id ?? '')
    setType(t)
    setProcedureId(t === 'follow_up' && !preset.procedureId ? '' : pid)
    setSessionNo(preset.sessionNo ?? 1)
    setDate(dateInput(start))
    const tm = timeInput(start)
    setTime(TIME_OPTIONS.includes(tm) ? tm : '10:00')
    setDuration(defaultDuration(t, p?.durationMin))
    setDeposit(t === 'consultation' && (p?.depositPct ?? 0) > 0 ? 'due' : 'none')
    setNotes('')
    setConfirmed(false)
    const lastAppt = c ? state.appointments.filter(a => a.clientId === c.id).sort((a, b) => b.start.localeCompare(a.start))[0] : undefined
    const prac = preset.practitionerId ?? lastAppt?.practitionerId ?? clinicians.find(u => u.onShift)?.id ?? clinicians[0]?.id ?? ''
    setPractitionerId(prac)
    const branch = c?.branchId ?? state.rooms.find(r => r.id === preset.roomId)?.branchId ?? me.branchIds[0] ?? state.branches[0]?.id
    const branchRooms = state.rooms.filter(r => r.branchId === branch)
    setRoomId(preset.roomId ?? (pid === 'p_lhr' ? branchRooms.find(r => /laser/i.test(r.name))?.id : undefined) ?? branchRooms[0]?.id ?? state.rooms[0]?.id ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // When the plan is known, suggest the next session that still needs booking.
  useEffect(() => {
    if (!open || type !== 'session' || !planHit) return
    if (preset.sessionNo && preset.procedureId === procedureId && preset.clientId === clientId) return
    const next = planHit.item.sessions.find(s => s.status === 'due') ?? planHit.item.sessions.find(s => s.status !== 'done')
    if (next) setSessionNo(next.no)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, procedureId, clientId])

  const pickClient = (c: Client) => {
    setClientId(c.id)
    setQuery('')
    const ep = activeEpisode(state, c.id)
    if (!preset.procedureId && type !== 'follow_up' && ep?.interests[0]) {
      setProcedureId(ep.interests[0])
      const p = procOf(state, ep.interests[0])
      setDuration(defaultDuration(type, p?.durationMin))
      setDeposit(type === 'consultation' && (p?.depositPct ?? 0) > 0 ? 'due' : 'none')
    }
    const branchRooms = state.rooms.filter(r => r.branchId === c.branchId)
    if (!branchRooms.some(r => r.id === roomId) && branchRooms[0]) setRoomId(branchRooms[0].id)
  }

  const changeType = (t: AppointmentType) => {
    setType(t)
    let pid = procedureId
    if (t !== 'follow_up' && !pid) pid = episode?.interests[0] ?? state.procedures[0]?.id ?? ''
    setProcedureId(pid)
    const p = procOf(state, pid)
    setDuration(defaultDuration(t, p?.durationMin))
    setDeposit(t === 'consultation' && (p?.depositPct ?? 0) > 0 ? 'due' : 'none')
  }
  const changeProcedure = (pid: string) => {
    setProcedureId(pid)
    const p = procOf(state, pid)
    setDuration(defaultDuration(type, p?.durationMin))
    if (type === 'consultation') setDeposit((p?.depositPct ?? 0) > 0 ? 'due' : 'none')
    if (pid === 'p_lhr') {
      const room = state.rooms.find(r => r.id === roomId)
      const laser = state.rooms.find(r => r.branchId === room?.branchId && /laser/i.test(r.name))
      if (laser) setRoomId(laser.id)
    }
  }

  // ---- search ------------------------------------------------------------------------------
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const digits = q.replace(/\D/g, '')
    const pool = state.clients
    if (!q) {
      return pool
        .map(c => ({ c, ep: activeEpisode(state, c.id) }))
        .filter(x => x.ep && !x.ep.exit && BOOKABLE_STAGES.has(x.ep.stage) && x.ep.stage !== 'alumni')
        .sort((a, b) => STAGES.indexOf(a.ep!.stage) - STAGES.indexOf(b.ep!.stage) || b.c.score - a.c.score)
        .slice(0, 6)
        .map(x => x.c)
    }
    return pool.filter(c =>
      c.name.toLowerCase().includes(q)
      || (c.handles.instagram ?? '').toLowerCase().includes(q)
      || (c.handles.tiktok ?? '').toLowerCase().includes(q)
      || (showPhone && digits.length >= 4 && (c.phone ?? '').replace(/\D/g, '').includes(digits)),
    ).slice(0, 8)
  }, [query, state, showPhone])

  // ---- checks ------------------------------------------------------------------------------
  const dayMs = parseDateInput(date)
  const startMs = dayMs != null ? combine(dayMs, time) : NaN
  const endMs = startMs + duration * MIN
  const room = state.rooms.find(r => r.id === roomId)
  const practitioner = state.users.find(u => u.id === practitionerId)
  const age = client ? ageCheck(state, client, procedureId) : undefined
  const blocked = !!age?.blocked
  const past = !Number.isNaN(startMs) && startMs < Date.now() - 5 * MIN
  const bookingToday = dayMs != null && dayMs === new Date(new Date().setHours(0, 0, 0, 0)).getTime()
  const lateFinish = !Number.isNaN(startMs) && minutesOfDay(startMs) + duration > DAY_END_MIN
  const clashes = !Number.isNaN(startMs) && practitionerId && roomId
    ? findClashes(state, { start: startMs, end: endMs, practitionerId, roomId, clientId: client?.id })
    : undefined
  const clash = clashes ? hasClash(clashes) : false
  const clashText = clashes && clash ? clashLines(state, clashes, practitionerId, roomId) : []
  const pracBranches = practitioner?.branchIds ?? []
  const wrongBranch = !!room && !!practitioner && !pracBranches.includes(room.branchId)
  const sessionEntry = planHit?.item.sessions.find(s => s.no === sessionNo)
  const sessionTotal = planHit?.item.sessionsTotal ?? proc?.sessions ?? 1

  const problems: string[] = []
  if (!client) problems.push('Choose a client.')
  else if (!episode) problems.push('This client has no journey yet. Open their record first.')
  if (type !== 'follow_up' && !procedureId) problems.push('Choose a treatment.')
  if (Number.isNaN(startMs)) problems.push('Choose a date.')
  if (past) problems.push('That time has already passed.')
  if (!practitionerId || !roomId) problems.push('Choose a practitioner and a room.')
  const canSubmit = can('appointments.manage') && problems.length === 0 && !blocked

  const summary = !Number.isNaN(startMs)
    ? `${mediumDay(startMs)} · ${hm(startMs)}–${hm(endMs)} · ${practitioner?.name ?? 'No practitioner'} · ${room?.name ?? 'No room'}`
    : ''

  const book = (overrideReason?: string) => {
    if (!client || !episode || !room || !canSubmit) return
    const startIso = iso(startMs)
    const id = actions.bookAppointment({
      clientId: client.id,
      episodeId: episode.id,
      type,
      procedureId: procedureId || undefined,
      sessionNo: type === 'session' ? sessionNo : undefined,
      practitionerId,
      roomId,
      branchId: room.branchId,
      start: startIso,
      end: iso(endMs),
      deposit,
      notes: notes.trim() || undefined,
      status: confirmed ? 'confirmed' : 'unconfirmed',
    })
    if (type === 'session' && planHit) {
      actions.update(d => {
        const plan = d.plans.find(p => p.id === planHit.plan.id)
        const item = plan?.items.find(i => i.id === planHit.item.id)
        const s = item?.sessions.find(x => x.no === sessionNo)
        if (s && s.status !== 'done') {
          s.status = 'booked'
          s.appointmentId = id
          s.date = startIso
        }
      })
    }
    if (type === 'consultation' && !episode.exit && STAGES.indexOf(episode.stage) < STAGES.indexOf('booked')) {
      actions.moveStage(episode.id, 'booked', { reason: 'Consultation booked in the calendar' })
    }
    if (overrideReason) {
      actions.audit({
        action: 'appointment.double_booked',
        target: { type: 'appointment', id, label: client.name },
        detail: `Booked despite a clash: ${clashText.join(' ')}`,
        reason: overrideReason,
      })
    }
    const what = type === 'session' ? `${proc?.name ?? 'Session'} session ${sessionNo}` : type === 'consultation' ? `consultation${proc ? ` for ${proc.name.toLowerCase()}` : ''}` : 'follow-up'
    actions.toast(`Booked ${firstName(client.name)}'s ${what}: ${mediumDay(startMs)}, ${hm(startMs)} with ${practitioner?.name ?? 'the clinician'}.`, 'success')
    onBooked(id, startMs, { practitionerId, branchId: room.branchId })
    onClose()
  }

  const roomsByBranch = state.branches.map(b => ({ b, rooms: state.rooms.filter(r => r.branchId === b.id) })).filter(x => x.rooms.length)

  return (
    <>
      <Modal open={open && !overrideOpen} onClose={onClose} width={640}
        title={preset.title ?? 'New booking'}
        description={client ? `${state.branches.find(b => b.id === client.branchId)?.name ?? ''} client. Reminders go out 2 days and 1 day before${client.doNotContact ? ', unless they asked not to be contacted' : client.consent.whatsapp ? ' on WhatsApp' : client.consent.sms ? ' by SMS' : ''}.` : 'Search for the client first, then choose the time.'}
        footer={<>
          <span className="ca-modal-summary small muted truncate">{canSubmit ? summary : problems[0] ?? (blocked ? 'Booking is blocked for this client.' : '')}</span>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {clash && canSubmit
            ? <Button variant="danger" icon="alert" onClick={() => setOverrideOpen(true)}>Book anyway…</Button>
            : <Button variant="primary" icon="calendar" disabled={!canSubmit} onClick={() => book()}>Book appointment</Button>}
        </>}>
        <div className="stack lg">
          {/* client */}
          {client ? (
            <div className="ca-picked">
              <Avatar name={client.name} size={36} />
              <div className="grow stack" style={{ gap: 2 }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="strong">{client.name}</span>
                  {episode && <StageBadge stage={episode.stage} exit={episode.exit} />}
                  {client.ageVerified ? <Chip tone="ok" icon="shield">Age verified</Chip> : <Chip tone="warn" icon="shield">Age not verified</Chip>}
                </div>
                <span className="small muted truncate">
                  {maskPhone(client.phone, showPhone)}
                  {client.handles.instagram ? ` · ${client.handles.instagram}` : client.handles.tiktok ? ` · ${client.handles.tiktok}` : ''}
                  {episode && episode.number > 1 ? ` · Returning client, journey ${episode.number}` : ''}
                </span>
              </div>
              {!preset.clientId && <Button size="sm" variant="ghost" onClick={() => setClientId('')}>Change</Button>}
            </div>
          ) : (
            <div className="stack">
              <Field label="Client" hint={showPhone ? 'Search by name, Instagram or TikTok handle, or the last digits of their phone.' : 'Search by name or Instagram or TikTok handle.'}>
                {id => (
                  <div className="search-wrap">
                    <Icon name="search" size={16} />
                    <input id={id} className="input input-search" value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. Omar or @omar.fades" autoComplete="off" />
                  </div>
                )}
              </Field>
              <div className="ca-results" role="list" aria-label={query ? 'Matching clients' : 'Suggested clients waiting for a booking'}>
                {!query && <span className="eyebrow">Ready to book</span>}
                {results.length === 0 && <p className="small muted">No client matches “{query}”. New leads are added from the inbox or the client directory.</p>}
                {results.map(c => {
                  const ep = activeEpisode(state, c.id)
                  return (
                    <button key={c.id} type="button" role="listitem" className="ca-result" onClick={() => pickClient(c)}>
                      <Avatar name={c.name} size={28} />
                      <span className="grow stack" style={{ gap: 0 }}>
                        <span className="strong truncate">{c.name}</span>
                        <span className="tiny muted truncate">{maskPhone(c.phone, showPhone)} · {c.handles.instagram ?? c.handles.tiktok ?? 'No handle'}</span>
                      </span>
                      {ep && <StageBadge stage={ep.stage} exit={ep.exit} />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {age?.blocked && (
            <div className="ca-callout ca-callout-danger" role="alert">
              <Icon name="shield" size={18} />
              <div className="stack" style={{ gap: 4 }}>
                <strong>{age.title}</strong>
                <span className="small">{age.detail}</span>
                <span className="small">If this is wrong, check photo ID in person and record it on the client record. Only then can a booking be made.</span>
              </div>
            </div>
          )}

          <fieldset className="ca-fieldset" disabled={blocked || !client}>
            <legend className="sr-only">Appointment details</legend>
            <div className="stack lg">
              <div className="stack" style={{ gap: 6 }}>
                <span className="field-label" aria-hidden="true">Type</span>
                <div className="ca-seg-wrap">
                  <Segmented label="Appointment type" value={type} onChange={changeType}
                    options={(['consultation', 'session', 'follow_up'] as AppointmentType[]).map(t => ({ id: t, label: TYPE_LABEL[t] }))} />
                </div>
              </div>

              <div className="ca-form-2">
                <Field label={type === 'follow_up' ? 'Related treatment (optional)' : 'Treatment'}>
                  {id => (
                    <select id={id} className="input" value={procedureId} onChange={e => changeProcedure(e.target.value)}>
                      {type === 'follow_up' && <option value="">General follow-up</option>}
                      {type !== 'follow_up' && !procedureId && <option value="">Choose a treatment</option>}
                      {state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </Field>

                {type === 'session' ? (
                  planHit ? (
                    <Field label="Session" hint={sessionEntry?.status === 'booked' ? 'Already booked on the plan. Booking again links the plan to this new time.' : `From ${firstName(client?.name ?? 'the client')}'s treatment plan.`}>
                      {id => (
                        <select id={id} className="input" value={sessionNo} onChange={e => setSessionNo(Number(e.target.value))}>
                          {planHit.item.sessions.map(s => (
                            <option key={s.no} value={s.no} disabled={s.status === 'done'}>
                              Session {s.no} of {planHit.item.sessionsTotal}{s.status === 'done' ? ' · done' : s.status === 'booked' ? ' · booked' : s.status === 'skipped' ? ' · skipped' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </Field>
                  ) : (
                    <Field label={`Session number (of ${sessionTotal})`} hint="No treatment plan includes this yet, so it will not be linked to a plan.">
                      {id => <input id={id} className="input num" type="number" min={1} max={Math.max(sessionTotal, 1)} value={sessionNo} onChange={e => setSessionNo(Math.max(1, Math.min(Math.max(sessionTotal, 1), Number(e.target.value) || 1)))} />}
                    </Field>
                  )
                ) : (
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

                <Field label="Practitioner" error={clashes?.practitioner.length ? 'Busy at this time' : undefined} hint={wrongBranch ? `Not usually at ${state.branches.find(b => b.id === room?.branchId)?.name}.` : undefined}>
                  {id => (
                    <select id={id} className="input" value={practitionerId} onChange={e => setPractitionerId(e.target.value)}>
                      {clinicians.map(u => <option key={u.id} value={u.id}>{u.name}{u.onShift || !bookingToday ? '' : ' · off shift today'}</option>)}
                    </select>
                  )}
                </Field>

                <Field label="Room" error={clashes?.room.length ? 'In use at this time' : undefined}>
                  {id => (
                    <select id={id} className="input" value={roomId} onChange={e => setRoomId(e.target.value)}>
                      {roomsByBranch.map(({ b, rooms }) => (
                        <optgroup key={b.id} label={b.name}>
                          {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  )}
                </Field>

                <Field label="Date" error={past ? 'That time has already passed.' : undefined}>
                  {id => <input id={id} className="input num" type="date" value={date} onChange={e => setDate(e.target.value)} />}
                </Field>

                <div className="ca-form-2 ca-form-tight">
                  <Field label="Start">
                    {id => (
                      <select id={id} className="input num" value={time} onChange={e => setTime(e.target.value)}>
                        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label="Length" hint={proc && type === 'session' ? `${proc.name}: ${durationLabel(proc.durationMin)}` : undefined}>
                    {id => (
                      <select id={id} className="input num" value={duration} onChange={e => setDuration(Number(e.target.value))}>
                        {Array.from(new Set([15, 30, 45, 60, 90, 120, 180, 240, 480, duration])).sort((a, b) => a - b).map(m => <option key={m} value={m}>{durationLabel(m)}</option>)}
                      </select>
                    )}
                  </Field>
                </div>
              </div>

              {clash && (
                <div className="ca-callout ca-callout-warn" role="alert">
                  <Icon name="alert" size={18} />
                  <div className="stack" style={{ gap: 4 }}>
                    <strong>Double booking</strong>
                    {clashText.map(t => <span key={t} className="small">{t}</span>)}
                    <span className="small">Pick another time, practitioner or room. Booking anyway needs a reason, which goes in the audit log.</span>
                  </div>
                </div>
              )}
              {lateFinish && !past && (
                <p className="ca-note small"><Icon name="clock" size={14} />Finishes after the clinic closes at 20:00.</p>
              )}
              {client?.doNotContact && (
                <p className="ca-note small"><Icon name="info" size={14} />{firstName(client.name)} asked not to be contacted, so no reminders will be sent.</p>
              )}
              {client && age && !age.blocked && age.unverified && (
                <p className="ca-note small"><Icon name="shield" size={14} />Age not verified yet. Check photo ID at reception before treatment.</p>
              )}

              <Field label="Note for the team (optional)">
                {id => <input id={id} className="input" value={notes} onChange={e => setNotes(e.target.value)} placeholder={type === 'follow_up' ? 'e.g. 6-week review after session 2' : 'e.g. Prefers the end of the day'} />}
              </Field>
              <label className="checkbox">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                {client ? `${firstName(client.name)} has already confirmed this time` : 'Client has already confirmed this time'}
              </label>
            </div>
          </fieldset>
        </div>
      </Modal>
      <ReasonDialog open={overrideOpen} title="Book a double appointment?" tone="danger" confirmLabel="Book anyway"
        body={<div className="stack" style={{ gap: 4 }}>{clashText.map(t => <span key={t}>{t}</span>)}<span>Say why this is OK, for example a short check-in during a long procedure.</span></div>}
        placeholder="e.g. 10-minute review while the FUE patient rests"
        onConfirm={reason => book(reason)}
        onClose={() => setOverrideOpen(false)} />
    </>
  )
}

/** The next half hour from now, nudged into clinic hours. */
function nextFreeHalfHour(): number {
  const d = new Date()
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60)
  const m = d.getHours() * 60 + d.getMinutes()
  if (m < 9 * 60) d.setHours(9, 0, 0, 0)
  if (m > 19 * 60) {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  }
  return d.getTime()
}
