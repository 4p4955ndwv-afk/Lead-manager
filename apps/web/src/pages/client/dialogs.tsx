// Dialogs opened from the client record header: log a call, edit details, merge a duplicate, erase a person,
// move the journey stage and start a new episode for a returning client.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '../../lib/store'
import type { CallOutcome, Client, Episode, Exit, Stage, Task } from '../../lib/types'
import { EXITS, EXIT_LABEL, ROLE_LABEL, STAGES, STAGE_LABEL } from '../../lib/types'
import { can as userCan, formatPhone, maskPhone } from '../../lib/permissions'
import { DAY, HOUR, MIN, dateTime, iso, ms, uid } from '../../lib/time'
import { Avatar, Button, Chip, Field, Modal, ReasonDialog, StageBadge, Toggle } from '../../components/ui'
import { Icon } from '../../components/icons'
import { moveRule, type MoveKind } from '../pipeline/model'
import { CALL_OUTCOME_LABEL, LANG_LABEL, bookingBlock, episodesOf, handlesOf, initials, latestEpisode, localInput, nextSlot, relatedIds, stageIndex, toE164 } from './helpers'

const first = (name: string) => name.split(' ')[0]

// ---- Log a call ------------------------------------------------------------------------------------

export function LogCallModal({ open, onClose, client, episode }: { open: boolean; onClose: () => void; client: Client; episode?: Episode }) {
  const { state, actions } = useStore()
  const clinicians = state.users.filter(u => u.role === 'clinician' && u.status === 'active')
  const lateStage = !!episode && !episode.exit && stageIndex(episode.stage) >= stageIndex('booked')
  const blocked = bookingBlock(client, episode)
  const outcomes: CallOutcome[] = (['booked', 'no_answer', 'call_back', 'thinking', 'not_interested', 'wrong_number'] as CallOutcome[]).filter(o => !((lateStage || blocked) && o === 'booked'))
  const openTask = state.tasks.filter(t => t.clientId === client.id && t.status === 'open' && (t.type === 'call' || t.type === 'callback' || t.type === 'follow_up')).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))[0]
  const prevNoAnswer = openTask?.attempts.filter(a => a.outcome === 'no_answer').length ?? 0

  const [outcome, setOutcome] = useState<CallOutcome>('no_answer')
  const [note, setNote] = useState('')
  const [start, setStart] = useState('')
  const [procedureId, setProcedureId] = useState('')
  const [practitionerId, setPractitionerId] = useState('')
  const [deposit, setDeposit] = useState(true)
  const [callbackAt, setCallbackAt] = useState('')

  useEffect(() => {
    if (!open) return
    setOutcome(lateStage || blocked ? 'no_answer' : 'booked')
    setNote('')
    setStart(localInput(nextSlot(Date.now() + DAY)))
    setProcedureId(episode?.interests[0] ?? state.procedures[0]?.id ?? '')
    setPractitionerId(clinicians.find(c => c.onShift)?.id ?? clinicians[0]?.id ?? '')
    setDeposit(true)
    setCallbackAt(localInput(nextSlot(Date.now() + 3 * HOUR)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const proc = state.procedures.find(p => p.id === procedureId)
  const needsNote = outcome === 'not_interested' || outcome === 'wrong_number'
  const startMs = start ? new Date(start).getTime() : NaN
  const cbMs = callbackAt ? new Date(callbackAt).getTime() : NaN
  const startPast = outcome === 'booked' && !Number.isNaN(startMs) && startMs < Date.now() - 5 * MIN
  const cbPast = outcome === 'call_back' && !Number.isNaN(cbMs) && cbMs < Date.now() - 5 * MIN
  const invalid = (needsNote && note.trim().length < 3) || (outcome === 'booked' && Number.isNaN(startMs)) || (outcome === 'call_back' && Number.isNaN(cbMs)) || startPast || cbPast

  const save = () => {
    if (invalid) return
    let taskId = openTask?.id
    if (!taskId) {
      const id = uid('tk')
      taskId = id
      const t: Task = {
        id, type: 'call', title: `Call ${client.name}`, clientId: client.id, episodeId: episode?.id, assignedTo: state.currentUserId,
        createdAt: iso(Date.now()), dueAt: iso(Date.now()), escalationLevel: 0, status: 'open', attempts: [], priority: 'normal',
      }
      actions.update(d => { d.tasks.unshift(t) })
    }
    const depositDueAt = outcome === 'booked' && deposit && proc && proc.depositPct > 0
      ? iso(Math.max(Date.now() + HOUR, Math.min(Date.now() + DAY, startMs - DAY))) : undefined
    actions.logCall(taskId, outcome, {
      note: note.trim() || undefined,
      start: outcome === 'booked' ? iso(startMs) : undefined,
      procedureId: outcome === 'booked' ? procedureId : undefined,
      practitionerId: outcome === 'booked' ? practitionerId : undefined,
      depositDueAt,
      callbackAt: outcome === 'call_back' ? iso(cbMs) : undefined,
    })
    const msg: Record<CallOutcome, string> = {
      booked: `Consultation booked for ${Number.isNaN(startMs) ? '' : dateTime(iso(startMs))}. The journey moved to Appointment booked.`,
      no_answer: prevNoAnswer + 1 >= 3 ? 'Third missed call. Moved to Nurture; a WhatsApp follow-up goes out.' : `No answer logged. Try again ${prevNoAnswer === 0 ? 'in 2 hours' : 'tomorrow'}; the task stays open.`,
      call_back: `Callback set for ${Number.isNaN(cbMs) ? '' : dateTime(iso(cbMs))}.`,
      thinking: 'Logged. A follow-up call is due in 2 days.',
      not_interested: 'Logged as not interested. The journey moved to Lost.',
      wrong_number: 'Wrong number logged. Moved to Nurture; ask for the right number by DM.',
    }
    actions.toast(msg[outcome], outcome === 'booked' ? 'success' : 'info')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={520} title={`Log a call with ${first(client.name)}`}
      description={openTask ? `Logged against “${openTask.title}”${openTask.attempts.length ? ` (${openTask.attempts.length} earlier attempt${openTask.attempts.length > 1 ? 's' : ''})` : ''}.` : 'No open call task, so this call is logged as a new one.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={invalid} onClick={save}>{outcome === 'booked' ? 'Log call and book' : 'Log call'}</Button>
      </>}>
      <div className="stack lg">
        <fieldset className="cr-fieldset">
          <legend className="field-label">What happened?</legend>
          <div className="cr-pills" role="radiogroup" aria-label="Call outcome">
            {outcomes.map(o => (
              <button key={o} type="button" role="radio" aria-checked={outcome === o} className={`cr-pill ${outcome === o ? 'is-active' : ''}`} onClick={() => setOutcome(o)}>{CALL_OUTCOME_LABEL[o]}</button>
            ))}
          </div>
          {blocked && !lateStage && <p className="tiny muted">{blocked}, so a booking cannot be logged.</p>}
          {lateStage && <p className="tiny muted">Already past booking. To book a session or follow-up, use the Treatment plan or Appointments tab.</p>}
        </fieldset>

        {outcome === 'booked' && (
          <div className="cr-form-2">
            <Field label="Consultation date and time" error={startPast ? 'That time has already passed.' : undefined}>
              {id => <input id={id} className="input num" type="datetime-local" step={900} value={start} onChange={e => setStart(e.target.value)} />}
            </Field>
            <Field label="For">
              {id => (
                <select id={id} className="input" value={procedureId} onChange={e => setProcedureId(e.target.value)}>
                  {state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              )}
            </Field>
            <Field label="With">
              {id => (
                <select id={id} className="input" value={practitionerId} onChange={e => setPractitionerId(e.target.value)}>
                  {clinicians.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              )}
            </Field>
            {proc && proc.depositPct > 0 && (
              <label className="checkbox cr-checkbox-field"><input type="checkbox" checked={deposit} onChange={e => setDeposit(e.target.checked)} />Send a {proc.depositPct}% deposit link</label>
            )}
          </div>
        )}
        {outcome === 'call_back' && (
          <Field label="Call back at" error={cbPast ? 'That time has already passed.' : undefined}>
            {id => <input id={id} className="input num" type="datetime-local" step={900} value={callbackAt} onChange={e => setCallbackAt(e.target.value)} />}
          </Field>
        )}
        <Field label={needsNote ? 'What did they say? (saved as the reason)' : 'Note (optional)'} hint={needsNote ? 'Required, because this takes them off the path.' : undefined}>
          {id => <textarea id={id} className="input" rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder={outcome === 'booked' ? 'e.g. Wants Dr Clarke; parking info sent' : outcome === 'not_interested' ? 'e.g. Found a clinic closer to home' : 'e.g. Busy at work, try after 6pm'} />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- Edit details --------------------------------------------------------------------------------

export function EditClientModal({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const { state, can, actions } = useStore()
  const showPhone = can('clients.view_phone')
  const owners = state.users.filter(u => u.status === 'active' && ['coordinator', 'frontdesk', 'manager', 'owner'].includes(u.role))
  const [f, setF] = useState(() => toForm(client))
  const [tried, setTried] = useState(false)
  useEffect(() => { if (open) { setF(toForm(client)); setTried(false) } }, [open, client])
  const set = <K extends keyof ReturnType<typeof toForm>>(k: K, v: ReturnType<typeof toForm>[K]) => setF(x => ({ ...x, [k]: v }))

  const e164 = f.phone.trim() ? toE164(f.phone) : null
  const errs = {
    name: f.name.trim().length < 2 ? 'Enter their full name.' : undefined,
    phone: f.phone.trim() && !e164 ? 'That does not look like a phone number.' : undefined,
    email: f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? 'That does not look like an email address.' : undefined,
  }
  const hasErr = Object.values(errs).some(Boolean)

  const save = () => {
    setTried(true)
    if (hasErr) return
    const tags = f.tags.split(',').map(t => t.trim()).filter(Boolean)
    const changes: string[] = []
    const next: Partial<Client> = {}
    const cmp = <K extends keyof Client>(k: K, v: Client[K], label: string) => { if (JSON.stringify(client[k] ?? '') !== JSON.stringify(v ?? '')) { changes.push(label); next[k] = v } }
    cmp('name', f.name.trim(), 'name')
    if (showPhone) cmp('phone', e164 ?? undefined, 'phone')
    cmp('email', f.email.trim() || undefined, 'email')
    cmp('language', f.language, 'language')
    cmp('dateOfBirth', f.dob || undefined, 'date of birth')
    cmp('ageVerified', f.ageVerified, 'age check')
    cmp('ownerId', f.ownerId || undefined, 'owner')
    cmp('branchId', f.branchId, 'branch')
    cmp('tags', tags, 'tags')
    cmp('doNotContact', f.dnc, f.dnc ? 'do not contact (on)' : 'do not contact (off)')
    const consentChanged = (['whatsapp', 'sms', 'marketing', 'callRecording'] as const).filter(k => client.consent[k] !== f[k])
    if (consentChanged.length) changes.push(`consent (${consentChanged.join(', ')})`)
    if (!changes.length) { actions.toast('Nothing changed.', 'info'); onClose(); return }
    actions.update(d => {
      const c = d.clients.find(x => x.id === client.id)
      if (!c) return
      Object.assign(c, next)
      if ('phone' in next && !next.phone) delete c.phone
      if ('email' in next && !next.email) delete c.email
      if (consentChanged.length) c.consent = { whatsapp: f.whatsapp, sms: f.sms, marketing: f.marketing, callRecording: f.callRecording, updatedAt: iso(Date.now()) }
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'client.edit', target: { type: 'client', id: client.id, label: c.name }, detail: `Changed ${changes.join(', ')}` })
    })
    actions.toast(`Saved ${client.name.split(' ')[0]}'s details (${changes.join(', ')}).`, 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={620} title={`Edit ${client.name}`} description="Changes are saved to the audit log with your name."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save}>Save changes</Button>
      </>}>
      <form className="stack lg" onSubmit={e => { e.preventDefault(); save() }}>
        <div className="cr-form-2">
          <Field label="Full name" error={tried ? errs.name : undefined}>{id => <input id={id} className="input" value={f.name} onChange={e => set('name', e.target.value)} />}</Field>
          {showPhone ? (
            <Field label="Phone" error={tried ? errs.phone : undefined}>{id => <input id={id} className="input num" type="tel" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="07700 900123" />}</Field>
          ) : (
            <Field label="Phone" hint="Your role cannot see or change phone numbers.">{id => <input id={id} className="input num" value={maskPhone(client.phone, false)} readOnly />}</Field>
          )}
          <Field label="Email" error={tried ? errs.email : undefined}>{id => <input id={id} className="input" type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com" />}</Field>
          <Field label="Preferred language">
            {id => <select id={id} className="input" value={f.language} onChange={e => set('language', e.target.value)}>{Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}
          </Field>
          <Field label="Date of birth">{id => <input id={id} className="input num" type="date" value={f.dob} onChange={e => set('dob', e.target.value)} />}</Field>
          <label className="checkbox cr-checkbox-field"><input type="checkbox" checked={f.ageVerified} onChange={e => set('ageVerified', e.target.checked)} />ID seen: confirmed 18 or over</label>
          <Field label="Owner">
            {id => <select id={id} className="input" value={f.ownerId} onChange={e => set('ownerId', e.target.value)}><option value="">Unassigned</option>{owners.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>}
          </Field>
          <Field label="Branch">
            {id => <select id={id} className="input" value={f.branchId} onChange={e => set('branchId', e.target.value)}>{state.branches.map(b => <option key={b.id} value={b.id}>{b.name}, {b.city}</option>)}</select>}
          </Field>
        </div>
        <Field label="Tags" hint="Separate with commas, e.g. VIP, Referral">{id => <input id={id} className="input" value={f.tags} onChange={e => set('tags', e.target.value)} />}</Field>
        <fieldset className="cr-fieldset">
          <legend className="field-label">Consent</legend>
          <div className="cr-toggles">
            <Toggle checked={f.whatsapp} onChange={v => set('whatsapp', v)} label="WhatsApp messages" />
            <Toggle checked={f.sms} onChange={v => set('sms', v)} label="SMS reminders" />
            <Toggle checked={f.marketing} onChange={v => set('marketing', v)} label="Marketing offers" />
            <Toggle checked={f.callRecording} onChange={v => set('callRecording', v)} label="Call recording" />
          </div>
        </fieldset>
        <div className={`cr-callout ${f.dnc ? 'cr-callout-danger' : ''}`}>
          <Toggle checked={f.dnc} onChange={v => set('dnc', v)} label="Do not contact" />
          <span className="small muted">Stops all messages, calls and AI replies to this person. Use when they ask us to stop.</span>
        </div>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

function toForm(c: Client) {
  return {
    name: c.name, phone: c.phone ? formatPhone(c.phone) : '', email: c.email ?? '', language: c.language, dob: c.dateOfBirth ?? '', ageVerified: c.ageVerified,
    ownerId: c.ownerId ?? '', branchId: c.branchId, tags: c.tags.join(', '), dnc: c.doNotContact,
    whatsapp: c.consent.whatsapp, sms: c.consent.sms, marketing: c.consent.marketing, callRecording: c.consent.callRecording,
  }
}

// ---- Merge duplicate -------------------------------------------------------------------------------

export function MergeModal({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const { state, can, actions } = useStore()
  const showPhone = can('clients.view_phone')
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<string | undefined>()
  const [confirm, setConfirm] = useState(false)
  useEffect(() => { if (open) { setQ(''); setPick(undefined) } }, [open])

  const candidates = useMemo(() => {
    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '')
    const myHandles = handlesOf(client).map(h => norm(h.handle))
    return state.clients.filter(c => c.id !== client.id).map(c => {
      const why: string[] = []
      if (client.phone && c.phone === client.phone) why.push('Same phone number')
      if (client.email && c.email && c.email.toLowerCase() === client.email.toLowerCase()) why.push('Same email')
      if (norm(c.name) === norm(client.name)) why.push('Same name')
      else if (norm(c.name.split(' ')[0]) === norm(client.name.split(' ')[0]) && norm(c.name.split(' ').slice(-1)[0]) === norm(client.name.split(' ').slice(-1)[0])) why.push('Similar name')
      if (handlesOf(c).some(h => myHandles.includes(norm(h.handle)))) why.push('Same handle')
      return { c, why }
    })
  }, [state.clients, client])

  const s = q.trim().toLowerCase()
  const list = candidates
    .filter(x => !s || x.c.name.toLowerCase().includes(s) || Object.values(x.c.handles).some(h => h?.toLowerCase().includes(s)) || (showPhone && s.replace(/\D/g, '').length >= 4 && (x.c.phone ?? '').includes(s.replace(/\D/g, '').replace(/^0/, ''))))
    .sort((a, b) => b.why.length - a.why.length || a.c.name.localeCompare(b.c.name))
    .slice(0, s ? 30 : 8)
  const suggested = candidates.filter(x => x.why.length).length

  const other = state.clients.find(c => c.id === pick)
  const counts = other ? {
    episodes: state.episodes.filter(e => e.clientId === other.id).length,
    conversations: state.conversations.filter(c => c.clientId === other.id).length,
    tasks: state.tasks.filter(t => t.clientId === other.id).length,
    appointments: state.appointments.filter(a => a.clientId === other.id).length,
    payments: state.payments.filter(p => p.clientId === other.id).length,
    notes: state.notes.filter(n => n.clientId === other.id).length + state.documents.filter(d => d.clientId === other.id).length,
  } : undefined
  const newHandles = other ? handlesOf(other).filter(h => !client.handles[h.channel]) : []

  const doMerge = (reason: string) => {
    if (!other || !counts) return
    const summary = `${counts.episodes} episode${counts.episodes === 1 ? '' : 's'}, ${counts.conversations} conversation${counts.conversations === 1 ? '' : 's'}, ${counts.tasks} task${counts.tasks === 1 ? '' : 's'}, ${counts.appointments} appointment${counts.appointments === 1 ? '' : 's'}, ${counts.payments} payment${counts.payments === 1 ? '' : 's'}`
    actions.update(d => {
      const keep = d.clients.find(c => c.id === client.id)
      const dup = d.clients.find(c => c.id === other.id)
      if (!keep || !dup) return
      keep.handles = { instagram: keep.handles.instagram ?? dup.handles.instagram, tiktok: keep.handles.tiktok ?? dup.handles.tiktok }
      if (!keep.handles.instagram) delete keep.handles.instagram
      if (!keep.handles.tiktok) delete keep.handles.tiktok
      keep.phone = keep.phone ?? dup.phone
      keep.email = keep.email ?? dup.email
      keep.dateOfBirth = keep.dateOfBirth ?? dup.dateOfBirth
      keep.ownerId = keep.ownerId ?? dup.ownerId
      keep.ageVerified = keep.ageVerified || dup.ageVerified
      keep.doNotContact = keep.doNotContact || dup.doNotContact
      keep.tags = Array.from(new Set([...keep.tags, ...dup.tags]))
      keep.score = Math.max(keep.score, dup.score)
      if (ms(dup.consent.updatedAt) > ms(keep.consent.updatedAt)) keep.consent = { ...dup.consent }
      if (ms(dup.createdAt) < ms(keep.createdAt)) { keep.createdAt = dup.createdAt; keep.source = dup.source }
      keep.mergedFrom = Array.from(new Set([...(keep.mergedFrom ?? []), dup.id, ...(dup.mergedFrom ?? [])]))
      const move = <T extends { clientId: string }>(arr: T[]) => arr.forEach(x => { if (x.clientId === dup.id) x.clientId = keep.id })
      move(d.episodes); move(d.conversations); move(d.tasks); move(d.appointments); move(d.plans); move(d.payments); move(d.notes); move(d.documents)
      d.episodes.filter(e => e.clientId === keep.id).sort((a, b) => ms(a.startedAt) - ms(b.startedAt)).forEach((e, i) => { e.number = i + 1 })
      d.notifications.forEach(n => { if (n.link?.page === 'client' && n.link.id === dup.id) n.link.id = keep.id })
      d.clients = d.clients.filter(c => c.id !== dup.id)
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'client.merge', target: { type: 'client', id: keep.id, label: keep.name }, detail: `Merged ${dup.name} (${dup.id}) into this record: ${summary}`, reason })
    })
    actions.toast(`Merged ${other.name} into ${client.name}. Moved ${summary}.`, 'success')
    onClose()
  }

  return (
    <>
      <Modal open={open && !confirm} onClose={onClose} width={620} title={`Merge a duplicate into ${client.name}`}
        description={`Everything from the record you pick moves into ${first(client.name)}'s record, and the duplicate is deleted.`}
        footer={<>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="merge" disabled={!other} onClick={() => setConfirm(true)}>{other ? `Merge ${first(other.name)} into ${first(client.name)}` : 'Pick a record to merge'}</Button>
        </>}>
        <div className="stack lg">
          <div className="search-wrap">
            <Icon name="search" size={16} />
            <input className="input input-search" type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or handle" aria-label="Search for the duplicate record" />
          </div>
          {!s && <p className="tiny muted">{suggested ? `${suggested} possible duplicate${suggested > 1 ? 's' : ''} found by phone, email, name or handle. Shown first.` : 'No obvious duplicates found. Search to pick any record.'}</p>}
          <ul className="cr-pick-list" role="listbox" aria-label="Records">
            {list.map(({ c, why }) => {
              const ep = latestEpisode(state, c.id)
              return (
                <li key={c.id}>
                  <button type="button" role="option" aria-selected={pick === c.id} className={`cr-pick ${pick === c.id ? 'is-active' : ''}`} onClick={() => setPick(c.id)}>
                    <Avatar name={c.name} size={30} />
                    <span className="stack grow" style={{ gap: 2 }}>
                      <span className="row wrap" style={{ gap: 6 }}>
                        <span className="strong">{c.name}</span>
                        {why.map(w => <Chip key={w} tone="warn">{w}</Chip>)}
                      </span>
                      <span className="tiny muted truncate">{[...handlesOf(c).map(h => h.handle), maskPhone(c.phone, false)].join(' · ')}</span>
                    </span>
                    {ep && <StageBadge stage={ep.stage} exit={ep.exit} />}
                  </button>
                </li>
              )
            })}
            {list.length === 0 && <li className="small muted cr-pick-empty">Nobody matches “{q}”.</li>}
          </ul>
          {other && counts && (
            <div className="cr-callout">
              <Icon name="merge" size={16} />
              <div className="small">
                Moves into {first(client.name)}: {newHandles.length ? `${newHandles.map(h => h.handle).join(', ')}, ` : ''}{counts.episodes} episode{counts.episodes === 1 ? '' : 's'}, {counts.conversations} conversation{counts.conversations === 1 ? '' : 's'}, {counts.tasks} task{counts.tasks === 1 ? '' : 's'}, {counts.appointments} appointment{counts.appointments === 1 ? '' : 's'}, {counts.payments} payment{counts.payments === 1 ? '' : 's'} and {counts.notes} note{counts.notes === 1 ? '' : 's'} or document{counts.notes === 1 ? '' : 's'}. Then {other.name}'s record is deleted; this record keeps a link to it.
              </div>
            </div>
          )}
        </div>
      </Modal>
      <ReasonDialog open={open && confirm} onClose={() => setConfirm(false)} title={`Merge ${other?.name ?? ''} into ${client.name}?`} confirmLabel="Merge records"
        body={`This cannot be undone. ${other?.name ?? 'The duplicate'}'s record is deleted after its history moves across.`}
        placeholder="e.g. Same person: messaged on TikTok, then phoned the clinic"
        onConfirm={reason => { setConfirm(false); doMerge(reason) }} />
    </>
  )
}

// ---- Erase person ---------------------------------------------------------------------------------

export function EraseFlow({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const { state, actions } = useStore()
  const [typed, setTyped] = useState('')
  const [step, setStep] = useState<'type' | 'reason'>('type')
  useEffect(() => { if (open) { setTyped(''); setStep('type') } }, [open])
  const match = typed.trim().toLowerCase() === client.name.trim().toLowerCase()
  const n = {
    episodes: state.episodes.filter(e => e.clientId === client.id).length,
    conversations: state.conversations.filter(c => c.clientId === client.id).length,
    messages: state.conversations.filter(c => c.clientId === client.id).reduce((t, c) => t + c.messages.length, 0),
    tasks: state.tasks.filter(t => t.clientId === client.id).length,
    appointments: state.appointments.filter(a => a.clientId === client.id).length,
    plans: state.plans.filter(p => p.clientId === client.id).length,
    payments: state.payments.filter(p => p.clientId === client.id).length,
    notes: state.notes.filter(x => x.clientId === client.id).length,
    documents: state.documents.filter(x => x.clientId === client.id).length,
  }
  const parts = [
    [n.episodes, 'episode'], [n.conversations, 'conversation'], [n.messages, 'message'], [n.tasks, 'task'], [n.appointments, 'appointment'],
    [n.plans, 'treatment plan'], [n.payments, 'payment record'], [n.notes, 'note'], [n.documents, 'document'],
  ].filter(([c]) => (c as number) > 0).map(([c, w]) => `${c} ${w}${c === 1 ? '' : 's'}`)

  const erase = (reason: string) => {
    const label = `Erased person (${initials(client.name)})`
    actions.update(d => {
      const ids = relatedIds(d, client.id)
      d.clients = d.clients.filter(c => c.id !== client.id)
      d.episodes = d.episodes.filter(x => x.clientId !== client.id)
      d.conversations = d.conversations.filter(x => x.clientId !== client.id)
      d.tasks = d.tasks.filter(x => x.clientId !== client.id)
      d.appointments = d.appointments.filter(x => x.clientId !== client.id)
      d.plans = d.plans.filter(x => x.clientId !== client.id)
      d.payments = d.payments.filter(x => x.clientId !== client.id)
      d.notes = d.notes.filter(x => x.clientId !== client.id)
      d.documents = d.documents.filter(x => x.clientId !== client.id)
      d.qa = d.qa.filter(x => !ids.has(x.conversationId))
      d.notifications = d.notifications.filter(x => !(x.link?.id && ids.has(x.link.id)))
      d.audit.forEach(a => { if (ids.has(a.target.id)) a.target.label = label })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'client.erase', target: { type: 'client', id: client.id, label }, detail: `Erased all personal records: ${parts.join(', ') || 'profile only'}`, reason })
    })
    actions.toast(`${client.name} has been erased. The audit log keeps a record of the erasure without their name.`, 'success')
    onClose()
    actions.go('client')
  }

  return (
    <>
      <Modal open={open && step === 'type'} onClose={onClose} width={520} title={`Erase ${client.name}?`}
        description="Use this for a verified erasure request. It cannot be undone."
        footer={<>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon="trash" disabled={!match} onClick={() => setStep('reason')}>Continue</Button>
        </>}>
        <div className="stack lg">
          <div className="cr-callout cr-callout-danger">
            <Icon name="alert" size={16} />
            <div className="small">
              Permanently removes {first(client.name)}'s profile{parts.length ? `, ${parts.join(', ')}` : ''}. The audit log keeps a line saying an erasure happened, with initials only. If they asked for a copy, export their data first.
            </div>
          </div>
          <Field label={`Type “${client.name}” to confirm`}>
            {id => <input id={id} className="input" value={typed} onChange={e => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />}
          </Field>
        </div>
      </Modal>
      <ReasonDialog open={open && step === 'reason'} onClose={() => setStep('type')} tone="danger" confirmLabel="Erase permanently" title={`Erase ${client.name} permanently`}
        reasonLabel="Why is this person being erased? (saved in the audit log)" placeholder="e.g. Erasure request received by email on 3 Oct, identity checked"
        onConfirm={erase} />
    </>
  )
}

// ---- Move stage ------------------------------------------------------------------------------------
// Uses the same move rules as the pipeline board, so a move that needs an override there needs one here too.

export function MoveStageFlow({ open, onClose, client, episode }: { open: boolean; onClose: () => void; client: Client; episode: Episode }) {
  const { state, me, can, actions } = useStore()
  const [target, setTarget] = useState<Stage | Exit | undefined>()
  const [reasonFor, setReasonFor] = useState<{ to: Stage | Exit; kind: MoveKind; override: boolean } | undefined>()
  useEffect(() => { if (open) setTarget(undefined) }, [open])
  const canMove = can('pipeline.move')
  const canOverride = can('pipeline.override')
  const pos: Stage | Exit = episode.exit ?? episode.stage
  const rule = (to: Stage | Exit) => moveRule({ pos, ep: episode }, to)
  const allowed = (to: Stage | Exit) => { const r = rule(to); return r.kind !== 'same' && canMove && (!r.needsOverride || canOverride) }
  const label = (x: Stage | Exit) => (EXITS as string[]).includes(x) ? EXIT_LABEL[x as Exit] : STAGE_LABEL[x as Stage]
  const overriders = state.users.filter(u => u.status === 'active' && userCan(u, 'pipeline.override') && u.id !== me.id)

  const hint = (to: Stage | Exit): string => {
    const r = rule(to)
    if (r.kind === 'same') return 'Current'
    if (r.needsOverride && !canOverride) return 'Manager only'
    return ({
      next: 'Next step', skip: 'Skip · override', back: 'Back · override', exit: r.needsOverride ? 'Override · reason' : 'Needs a reason',
      return: r.needsOverride ? 'Return · override' : 'Return · needs a reason', same: 'Current',
    } as Record<MoveKind, string>)[r.kind]
  }

  const go = () => {
    if (!target || !allowed(target)) return
    const r = rule(target)
    if (!r.needsReason) {
      actions.moveStage(episode.id, target)
      actions.toast(`${first(client.name)} moved to ${label(target)}.`, 'success')
      onClose()
      return
    }
    setReasonFor({ to: target, kind: r.kind, override: r.needsOverride })
  }

  const apply = (reason: string) => {
    if (!reasonFor) return
    const { to, kind, override } = reasonFor
    actions.moveStage(episode.id, to, { reason, override: override || undefined })
    if (to === 'dnc') actions.update(d => { const c = d.clients.find(x => x.id === client.id); if (c) c.doNotContact = true })
    if (kind === 'return' && episode.exit === 'dnc' && client.doNotContact) {
      actions.update(d => { const c = d.clients.find(x => x.id === client.id); if (c) c.doNotContact = false })
      actions.audit({ action: 'client.dnc_cleared', target: { type: 'client', id: client.id, label: client.name }, detail: 'Do-not-contact switched off when brought back to the journey', reason })
    }
    actions.toast(kind === 'exit' ? `${first(client.name)} is off the path: ${label(to)}.` : `${first(client.name)} moved to ${label(to)}${override ? ' (override logged)' : ''}.`, 'success')
    setReasonFor(undefined)
    onClose()
  }

  const skipped = reasonFor && reasonFor.kind === 'skip' ? STAGES.slice(stageIndex(episode.stage) + 1, stageIndex(reasonFor.to as Stage)).map(s => STAGE_LABEL[s]) : []
  const titles: Record<MoveKind, string> = {
    skip: `Skip to ${reasonFor ? label(reasonFor.to) : ''}?`, back: `Move back to ${reasonFor ? label(reasonFor.to) : ''}?`, exit: `Take ${first(client.name)} off the path: ${reasonFor ? label(reasonFor.to) : ''}?`,
    return: `Bring ${first(client.name)} back to ${reasonFor ? label(reasonFor.to) : ''}?`, next: '', same: '',
  }
  const bodies: Record<MoveKind, string> = {
    skip: `This skips ${skipped.join(', ')}. It is logged as an override.`,
    back: 'Moving backwards is logged as an override. Tasks and appointments are not changed.',
    exit: reasonFor?.to === 'dnc' ? 'This also turns on Do not contact: no calls, messages or AI replies.' : 'Open tasks stay open until someone closes them.',
    return: `They left the path as ${episode.exit ? EXIT_LABEL[episode.exit] : ''}${episode.exitReason ? ` (“${episode.exitReason}”)` : ''}. Say what changed.${episode.exit === 'dnc' ? ' Their do-not-contact flag will be switched off.' : ''}${reasonFor?.override ? ' This is logged as an override.' : ''}`,
    next: '', same: '',
  }
  const anyLocked = canMove && !canOverride && [...STAGES, ...EXITS].some(x => rule(x).needsOverride)

  const option = (x: Stage | Exit, lead: ReactNode) => {
    const ok = allowed(x)
    const current = rule(x).kind === 'same'
    return (
      <button key={x} type="button" className={`cr-move-opt ${target === x ? 'is-active' : ''} ${current ? 'is-current' : ''}`} disabled={!ok} aria-pressed={target === x} onClick={() => setTarget(x)}>
        {lead}
        <span className="grow">{label(x)}</span>
        <span className="tiny muted">{!ok && !current && !canOverride && rule(x).needsOverride ? <><Icon name="lock" size={12} /> {hint(x)}</> : hint(x)}</span>
      </button>
    )
  }

  return (
    <>
      <Modal open={open && !reasonFor} onClose={onClose} width={560} title={`Move ${first(client.name)}'s journey`}
        description={<>Episode {episode.number} is at <strong>{label(pos)}</strong>. One step forward needs no reason; skipping, going back or leaving the path asks for one.</>}
        footer={<>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="arrowRight" disabled={!target || !allowed(target)} onClick={go}>{target ? `Move to ${label(target)}` : 'Pick a stage'}</Button>
        </>}>
        <div className="stack lg">
          <div className="cr-move">
            <div className="stack" style={{ gap: 4 }}>
              <span className="eyebrow">Journey</span>
              {STAGES.map((s, i) => option(s, <span className="cr-move-no num">{i + 1}</span>))}
            </div>
            <div className="stack" style={{ gap: 4 }}>
              <span className="eyebrow">Off the path</span>
              {EXITS.map(x => option(x, <Icon name={x === 'nurture' ? 'clock' : x === 'dnc' ? 'shield' : x === 'under18' ? 'alert' : 'x'} size={15} />))}
            </div>
          </div>
          {anyLocked && (
            <p className="tiny muted">
              <Icon name="shield" size={12} /> Skipping stages, moving back and bringing people back from a protective exit are overrides.
              {overriders.length ? ` Ask ${overriders.map(u => `${u.name} (${ROLE_LABEL[u.role]})`).join(' or ')}.` : ' Ask a manager or the owner.'}
            </p>
          )}
        </div>
      </Modal>
      <ReasonDialog open={!!reasonFor} onClose={() => setReasonFor(undefined)} title={reasonFor ? titles[reasonFor.kind] : ''} body={reasonFor ? bodies[reasonFor.kind] : undefined}
        tone={reasonFor?.kind === 'exit' && reasonFor.to !== 'nurture' ? 'danger' : 'primary'} confirmLabel={reasonFor ? `Move to ${label(reasonFor.to)}` : 'Move'}
        placeholder={reasonFor?.kind === 'exit' ? 'e.g. Chose a clinic closer to home' : reasonFor?.kind === 'skip' ? 'e.g. Booked directly at reception, no call needed' : reasonFor?.kind === 'return' ? 'e.g. Messaged again asking to book for October' : 'e.g. Consultation was cancelled and needs rebooking'}
        onConfirm={apply} />
    </>
  )
}

// ---- New episode ----------------------------------------------------------------------------------

export function NewEpisodeModal({ open, onClose, client, onCreated }: { open: boolean; onClose: () => void; client: Client; onCreated: (episodeId: string) => void }) {
  const { state, me, actions } = useStore()
  const eps = episodesOf(state, client.id)
  const prev = eps[eps.length - 1]
  const nextNo = (eps[eps.length - 1]?.number ?? 0) + 1
  const owners = state.users.filter(u => u.status === 'active' && ['coordinator', 'frontdesk', 'manager', 'owner'].includes(u.role))
  const [interest, setInterest] = useState('')
  const [start, setStart] = useState<'contact' | 'new'>('contact')
  const [ownerId, setOwnerId] = useState('')
  const [makeTask, setMakeTask] = useState(true)
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!open) return
    setInterest((prev?.exit && prev.interests[0]) || state.procedures.find(p => !prev?.interests.includes(p.id))?.id || state.procedures[0]?.id || '')
    setStart(client.phone && !client.doNotContact ? 'contact' : 'new')
    setOwnerId(client.ownerId ?? owners.find(u => u.role === 'coordinator' && u.onShift)?.id ?? me.id)
    setMakeTask(!!client.phone && !client.doNotContact)
    setNote('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const create = () => {
    const at = iso(Date.now())
    const id = uid('ep')
    const proc = state.procedures.find(p => p.id === interest)
    const ownerName = state.users.find(u => u.id === ownerId)?.name ?? 'the coordinator'
    const withTask = start === 'contact' && makeTask && !!client.phone
    actions.update(d => {
      d.episodes.unshift({ id, clientId: client.id, number: nextNo, startedAt: at, stage: start, interests: proc ? [proc.id] : [], value: proc?.price ?? 0,
        history: [{ at, to: start, by: d.currentUserId, reason: `Returning client · episode ${nextNo}${note.trim() ? ` · ${note.trim()}` : ''}` }] })
      const c = d.clients.find(x => x.id === client.id)
      if (c && ownerId) c.ownerId = ownerId
      if (withTask) {
        const tk = uid('tk')
        d.tasks.unshift({ id: tk, type: 'call', title: `Call ${client.name} about ${proc?.name.toLowerCase() ?? 'their return'}`, clientId: client.id, episodeId: id, assignedTo: ownerId, createdAt: at,
          dueAt: iso(Date.now() + 15 * MIN), slaMinutes: 15, escalationLevel: 0, status: 'open', attempts: [], priority: 'urgent',
          brief: `Returning client (episode ${nextNo}). ${prev ? `Last time: ${prev.interests.map(i => d.procedures.find(p => p.id === i)?.name).filter(Boolean).join(', ')}.` : ''} Now interested in ${proc?.name ?? 'a new treatment'}. Goal: book a consultation.` })
        if (ownerId !== d.currentUserId) d.notifications.unshift({ id: uid('nt'), at, userId: ownerId, kind: 'lead', title: `Returning client · ${client.name}`, body: `Interested in ${proc?.name ?? 'a new treatment'}.`, link: { page: 'tasks', id: tk }, read: false, deadline: iso(Date.now() + 15 * MIN) })
      }
      d.audit.unshift({ id: uid('au'), at, actor: d.currentUserId, action: 'episode.start', target: { type: 'episode', id, label: client.name }, detail: `Episode ${nextNo} started at ${STAGE_LABEL[start]}${proc ? ` for ${proc.name}` : ''}` })
    })
    actions.toast(`Episode ${nextNo} started for ${first(client.name)}${withTask ? `. ${ownerName} has 15 minutes to call.` : '.'}`, 'success')
    onCreated(id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={540} title={`Start episode ${nextNo} for ${first(client.name)}`}
      description={prev ? `Episode ${prev.number} ${prev.exit ? `left the path as ${EXIT_LABEL[prev.exit]}` : 'is complete'}. A new episode keeps the history and starts a fresh journey.` : undefined}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="plus" onClick={create}>Start episode {nextNo}</Button>
      </>}>
      <div className="stack lg">
        <Field label="Interested in">
          {id => <select id={id} className="input" value={interest} onChange={e => setInterest(e.target.value)}>{state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        </Field>
        <fieldset className="cr-fieldset">
          <legend className="field-label">Where does this journey start?</legend>
          <div className="cr-pills" role="radiogroup" aria-label="Starting stage">
            <button type="button" role="radio" aria-checked={start === 'contact'} disabled={!client.phone} className={`cr-pill ${start === 'contact' ? 'is-active' : ''}`} onClick={() => setStart('contact')}>Contact captured (we have their number)</button>
            <button type="button" role="radio" aria-checked={start === 'new'} className={`cr-pill ${start === 'new' ? 'is-active' : ''}`} onClick={() => setStart('new')}>DM received (AI qualifies first)</button>
          </div>
        </fieldset>
        <Field label="Owner">
          {id => <select id={id} className="input" value={ownerId} onChange={e => setOwnerId(e.target.value)}>{owners.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === client.ownerId ? ' (looked after them before)' : ''}</option>)}</select>}
        </Field>
        {start === 'contact' && client.phone && (
          <label className="checkbox"><input type="checkbox" checked={makeTask} onChange={e => setMakeTask(e.target.checked)} />Create a call task with the 15-minute SLA</label>
        )}
        <Field label="Note (optional)">
          {id => <input id={id} className="input" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Asked about peels at her laser aftercare check" />}
        </Field>
      </div>
    </Modal>
  )
}

export { first }
