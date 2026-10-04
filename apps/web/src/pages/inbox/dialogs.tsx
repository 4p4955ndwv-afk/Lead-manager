import { useEffect, useMemo, useState } from 'react'
import type { Exit, Stage, Task } from '../../lib/types'
import { EXITS, EXIT_LABEL, ROLE_LABEL, STAGES, STAGE_LABEL } from '../../lib/types'
import { activeEpisode, byId, useStore, userName } from '../../lib/store'
import { DAY, HOUR, dateTime, iso, startOfDay, uid } from '../../lib/time'
import { Button, Chip, Field, Modal, ReasonDialog, Segmented } from '../../components/ui'

// ---- create a follow-up task from a chat --------------------------------------------------------

type DuePreset = '1h' | 'today' | 'tomorrow' | '2d' | 'week'

function dueAt(p: DuePreset, now: number): number {
  const today = startOfDay(now)
  switch (p) {
    case '1h': return now + HOUR
    case 'today': return now < today + 16 * HOUR ? today + 17 * HOUR : today + DAY + 9 * HOUR
    case 'tomorrow': return today + DAY + 10 * HOUR
    case '2d': return today + 2 * DAY + 10 * HOUR
    case 'week': return today + 7 * DAY + 10 * HOUR
  }
}

export function CreateTaskModal({ open, onClose, convId }: { open: boolean; onClose: () => void; convId: string }) {
  const { state, me, actions } = useStore()
  const conv = byId(state.conversations, convId)
  const client = conv ? byId(state.clients, conv.clientId) : undefined
  const ep = client ? activeEpisode(state, client.id) : undefined
  const interest = ep?.interests.map(i => byId(state.procedures, i)?.name).filter(Boolean)[0]
  const people = useMemo(() => state.users.filter(u => u.status === 'active' && ['coordinator', 'frontdesk', 'clinician', 'manager'].includes(u.role)), [state.users])
  const defaultAssignee = (client?.ownerId && people.some(p => p.id === client.ownerId) ? client.ownerId : people.some(p => p.id === me.id) ? me.id : people.find(p => p.role === 'coordinator' && p.onShift)?.id) ?? people[0]?.id ?? me.id

  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(defaultAssignee)
  const [due, setDue] = useState<DuePreset>('tomorrow')
  const [priority, setPriority] = useState<Task['priority']>('normal')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open || !client) return
    setTitle(`Follow up with ${client.name}${interest ? ` about ${interest.toLowerCase()}` : ''}`)
    setAssignee(defaultAssignee)
    setDue('tomorrow')
    setPriority('normal')
    setNote('')
  }, [open])

  if (!conv || !client) return null
  const now = Date.now()
  const presets: { id: DuePreset; label: string }[] = [
    { id: '1h', label: 'In 1 hour' },
    { id: 'today', label: now < startOfDay(now) + 16 * HOUR ? 'Today at 17:00' : 'Tomorrow at 09:00' },
    { id: 'tomorrow', label: 'Tomorrow at 10:00' },
    { id: '2d', label: 'In 2 days, 10:00' },
    { id: 'week', label: 'In a week, 10:00' },
  ]

  const save = () => {
    const t: Task = {
      id: uid('tk'), type: 'follow_up', title: title.trim(), clientId: client.id, episodeId: ep?.id, assignedTo: assignee, createdAt: iso(now),
      dueAt: iso(dueAt(due, now)), escalationLevel: 0, status: 'open', attempts: [], priority, brief: note.trim() || undefined,
    }
    actions.update(d => {
      d.tasks.unshift(t)
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'task.created', target: { type: 'task', id: t.id, label: client.name }, detail: `Follow-up created from the ${conv.channel} chat, assigned to ${userName(d, assignee)}` })
    })
    if (assignee !== me.id) actions.notify({ userIds: [assignee] }, { kind: 'reminder', title: `New follow-up · ${client.name}`, body: t.title, link: { page: 'tasks', id: t.id } })
    actions.toast(`Task created for ${assignee === me.id ? 'you' : userName(state, assignee)}, due ${dateTime(t.dueAt)}.`, 'success', { label: 'Open task', page: 'tasks', id: t.id })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a follow-up task" description={`Linked to ${client.name} and this chat. It appears in Tasks & calls for the person you pick.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="plus" disabled={title.trim().length < 3} onClick={save}>Create task</Button>
      </>}>
      <div className="stack lg">
        <Field label="What needs doing">
          {id => <input id={id} className="input" value={title} onChange={e => setTitle(e.target.value)} />}
        </Field>
        <div className="ib-form-2">
          <Field label="Assign to">
            {id => (
              <select id={id} className="input" value={assignee} onChange={e => setAssignee(e.target.value)}>
                {people.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === me.id ? ' (you)' : ''} · {ROLE_LABEL[u.role]}{u.onShift ? '' : ' · off shift'}</option>)}
              </select>
            )}
          </Field>
          <Field label="Due">
            {id => (
              <select id={id} className="input" value={due} onChange={e => setDue(e.target.value as DuePreset)}>
                {presets.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            )}
          </Field>
        </div>
        <div className="field">
          <span className="field-label" aria-hidden="true">Priority</span>
          <Segmented label="Priority" value={priority} onChange={setPriority} options={[{ id: 'normal', label: 'Normal' }, { id: 'high', label: 'High' }, { id: 'urgent', label: 'Urgent' }]} />
        </div>
        <Field label="Note for the assignee" hint="Optional. Shown on the task.">
          {id => <textarea id={id} className="input" rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Wants evening appointments; check instalment options first." />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- move the episode along the journey ---------------------------------------------------------

type MoveKind = 'same' | 'next' | 'skip' | 'back' | 'exit' | 'reopen'

export function MoveStageDialog({ open, onClose, episodeId }: { open: boolean; onClose: () => void; episodeId: string }) {
  const { state, can, actions } = useStore()
  const ep = byId(state.episodes, episodeId)
  const client = ep ? byId(state.clients, ep.clientId) : undefined
  const [target, setTarget] = useState<Stage | Exit | null>(null)
  const [pending, setPending] = useState<{ to: Stage | Exit; kind: MoveKind } | null>(null)

  useEffect(() => {
    if (open) setTarget(null)
  }, [open])

  if (!ep || !client) return null
  const current: Stage | Exit = ep.exit ?? ep.stage
  const label = (s: Stage | Exit) => (STAGES as string[]).includes(s) ? STAGE_LABEL[s as Stage] : EXIT_LABEL[s as Exit]
  const first = client.name.split(' ')[0]

  const classify = (to: Stage | Exit): MoveKind => {
    if (to === current) return 'same'
    if ((EXITS as string[]).includes(to)) return 'exit'
    const idx = STAGES.indexOf(to as Stage)
    const at = STAGES.indexOf(ep.stage)
    if (ep.exit) return idx === at ? 'reopen' : idx > at ? 'skip' : 'back'
    if (idx === at + 1) return 'next'
    return idx > at ? 'skip' : 'back'
  }
  const allowed = (k: MoveKind) => k !== 'same' && can('pipeline.move') && (k === 'skip' || k === 'back' ? can('pipeline.override') : true)
  const note = (k: MoveKind): string => {
    switch (k) {
      case 'same': return ''
      case 'next': return 'Next step'
      case 'exit': return 'Reason needed'
      case 'reopen': return 'Reopen · reason needed'
      case 'skip': case 'back': return can('pipeline.override') ? 'Override · reason needed' : 'Needs a manager'
    }
  }

  const confirm = () => {
    if (!target) return
    const kind = classify(target)
    if (kind === 'next') {
      actions.moveStage(ep.id, target)
      actions.toast(`${first} moved to ${label(target)}.`, 'success')
      onClose()
      return
    }
    setPending({ to: target, kind })
    onClose()
  }

  const reasonCopy = (p: { to: Stage | Exit; kind: MoveKind }) => {
    switch (p.kind) {
      case 'skip': return `Skipping from ${label(current)} to ${label(p.to)} jumps over steps the team normally completes. This is an override and is saved with your reason.`
      case 'back': return `Moving ${first} back from ${label(current)} to ${label(p.to)} is an override and is saved with your reason.`
      case 'reopen': return `This puts ${first} back on the main journey at ${label(p.to)}.`
      default: return `This takes ${first} off the main journey and marks the episode as ${label(p.to)}.`
    }
  }

  const row = (s: Stage | Exit, i?: number) => {
    const k = classify(s)
    const ok = allowed(k)
    return (
      <label key={s} className={`ib-stage-opt ${target === s ? 'is-selected' : ''} ${!ok && k !== 'same' ? 'is-disabled' : ''} ${k === 'same' ? 'is-current' : ''}`}>
        <input type="radio" name="ib-stage" value={s} disabled={!ok} checked={target === s} onChange={() => setTarget(s)} />
        {i != null && <span className="ib-stage-no num">{i + 1}</span>}
        <span className="grow">{label(s)}</span>
        {k === 'same' ? <Chip tone="accent">Current</Chip> : <span className="tiny muted">{note(k)}</span>}
      </label>
    )
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Move ${first} to another stage`} width={520}
        description={can('pipeline.override') ? 'Moving to the next step is instant. Skipping, going back or leaving the journey asks for a reason, which goes in the audit log.' : 'You can move to the next step or take the lead off the journey with a reason. Skipping steps or going back needs a manager.'}
        footer={<>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!target} onClick={confirm}>{target ? `Move to ${label(target)}` : 'Pick a stage'}</Button>
        </>}>
        <div className="ib-stage-groups">
          <fieldset className="ib-stage-list">
            <legend className="eyebrow">Main journey</legend>
            {STAGES.map((s, i) => row(s, i))}
          </fieldset>
          <fieldset className="ib-stage-list">
            <legend className="eyebrow">Leave the journey</legend>
            {EXITS.map(s => row(s))}
          </fieldset>
        </div>
      </Modal>
      <ReasonDialog
        open={!!pending}
        title={pending ? `Move ${first} to ${label(pending.to)}?` : ''}
        body={pending ? reasonCopy(pending) : undefined}
        confirmLabel={pending ? `Move to ${label(pending.to)}` : 'Move'}
        tone={pending && (pending.kind === 'exit' && ['dnc', 'spam', 'lost'].includes(pending.to)) ? 'danger' : 'primary'}
        placeholder={pending?.kind === 'exit' ? 'e.g. Chose a clinic closer to home' : 'e.g. Consultation already happened on the phone with the clinician'}
        onClose={() => setPending(null)}
        onConfirm={reason => {
          if (!pending) return
          const override = pending.kind === 'skip' || pending.kind === 'back'
          actions.moveStage(ep.id, pending.to, { reason, override })
          actions.toast(`${first} moved to ${label(pending.to)}.${override ? ' Override logged.' : ''}`, 'success')
        }}
      />
    </>
  )
}
