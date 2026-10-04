// Outcome dialogs for a call: each one explains what happens next, then logs it with actions.logCall.
import { useEffect, useState } from 'react'
import type { Client, Conversation, Task } from '../../lib/types'
import { useStore } from '../../lib/store'
import { DAY, HOUR, iso, replyWindow, timeOf } from '../../lib/time'
import { Button, Chip, Field, Modal, ReasonDialog } from '../../components/ui'
import { Icon } from '../../components/icons'
import { firstName, fromLocalInput, missedCallTemplate, toLocalInput, tomorrowAt, weekdayTime } from './helpers'

interface Common { open: boolean; onClose: () => void; task: Task; client: Client; callNote: () => string }

const join = (...parts: Array<string | undefined>) => parts.map(p => p?.trim()).filter(Boolean).join(' ')

// ---- no answer -----------------------------------------------------------------------------------

export function NoAnswerModal({ open, onClose, task, client, callNote }: Common) {
  const { state, me, actions } = useStore()
  const [note, setNote] = useState('')
  useEffect(() => { if (open) setNote('') }, [open])
  const missed = task.attempts.filter(a => a.outcome === 'no_answer').length
  const tryNo = Math.min(3, missed + 1)
  const sender = state.users.find(u => u.id === task.assignedTo) ?? me
  const tpl = missedCallTemplate(client, sender.name, state.settings.orgName)
  const viaWhatsApp = client.consent.whatsapp
  const viaSms = !viaWhatsApp && client.consent.sms
  const first = firstName(client.name)

  const steps = [
    { n: 1, title: 'Try 1', then: 'Retry in 2 hours', icon: 'clock' as const },
    { n: 2, title: 'Try 2', then: 'Retry tomorrow', icon: 'calendar' as const },
    { n: 3, title: 'Try 3', then: 'WhatsApp template, then Nurture', icon: 'whatsapp' as const },
  ]
  const nextLine = tryNo === 1
    ? `We'll put this back in your list for ${timeOf(iso(Date.now() + 2 * HOUR))} today (in 2 hours).`
    : tryNo === 2
      ? `We'll put this back in your list for tomorrow at ${timeOf(iso(Date.now() + DAY))}.`
      : `This closes the call task. ${viaWhatsApp ? 'The WhatsApp template below is sent' : viaSms ? 'No WhatsApp consent, so the same text goes by SMS' : 'No WhatsApp or SMS consent, so no message is sent'}, and ${first} moves to Nurture for automated check-ins.`

  const confirm = () => {
    actions.logCall(task.id, 'no_answer', { note: join(note, callNote()) || undefined })
    if (tryNo === 3) {
      if (viaWhatsApp || viaSms) {
        actions.audit({ action: 'message.template_sent', target: { type: 'client', id: client.id, label: client.name }, detail: `Missed-call template sent by ${viaWhatsApp ? 'WhatsApp' : 'SMS'} (${tpl.language}) after 3 unanswered calls` })
      }
      actions.toast(`Third missed call logged. ${viaWhatsApp ? 'WhatsApp follow-up sent' : viaSms ? 'SMS follow-up sent' : 'No message sent (no consent)'} and ${first} moved to Nurture.`, 'success', { label: 'Open record', page: 'client', id: client.id })
    } else {
      actions.toast(tryNo === 1 ? `No answer logged. Try ${first} again at ${timeOf(iso(Date.now() + 2 * HOUR))}.` : `No answer logged. Next try is tomorrow at ${timeOf(iso(Date.now() + DAY))}.`, 'info')
    }
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={560} title="No answer" description={`This is try ${tryNo} of 3 for ${client.name}.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={confirm}>
          {tryNo === 1 ? 'Log it · retry in 2 h' : tryNo === 2 ? 'Log it · retry tomorrow' : viaWhatsApp ? 'Log it · send WhatsApp' : 'Log it · move to Nurture'}
        </Button>
      </>}>
      <div className="stack lg">
        <ol className="tk-cadence" aria-label="Retry cadence">
          {steps.map(s => {
            const state_ = s.n < tryNo ? 'done' : s.n === tryNo ? 'current' : 'next'
            return (
              <li key={s.n} className={`tk-step is-${state_}`} aria-current={state_ === 'current' ? 'step' : undefined}>
                <span className="tk-step-dot" aria-hidden="true">{state_ === 'done' ? <Icon name="check" size={13} /> : s.n}</span>
                <span className="stack" style={{ gap: 0 }}>
                  <span className="strong small">{s.title}{state_ === 'current' ? ' (now)' : state_ === 'done' ? ' · no answer' : ''}</span>
                  <span className="tiny muted">{s.then}</span>
                </span>
              </li>
            )
          })}
        </ol>
        <p className="tk-next-line small"><Icon name="arrowRight" size={15} /><span>{nextLine}</span></p>

        <div className="stack">
          <div className="row between wrap">
            <span className="field-label">WhatsApp template{tryNo < 3 ? ' (sent after try 3)' : ''}</span>
            <span className="row" style={{ gap: 4 }}>
              <Chip tone={viaWhatsApp ? 'ok' : viaSms ? 'warn' : 'neutral'} icon={viaWhatsApp ? 'whatsapp' : viaSms ? 'sms' : 'lock'}>
                {viaWhatsApp ? 'WhatsApp consent' : viaSms ? 'SMS only' : 'No consent'}
              </Chip>
              <Chip>{tpl.language}</Chip>
            </span>
          </div>
          <blockquote className="tk-template" dir="auto">{tpl.text}</blockquote>
          <span className="tiny muted">Approved template "missed_call_v2". Replies land in the Inbox and the AI picks up the chat.</span>
        </div>

        <Field label="Note (optional)">
          {id => <input id={id} className="input" value={note} placeholder="e.g. Went to voicemail, left a message" onChange={e => setNote(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- call back -----------------------------------------------------------------------------------

export function CallbackModal({ open, onClose, task, client, callNote }: Common) {
  const { actions } = useStore()
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  useEffect(() => {
    if (!open) return
    setWhen(toLocalInput(Date.now() + 3 * HOUR - (Date.now() % (15 * 60_000))))
    setNote('')
  }, [open])
  const t = fromLocalInput(when)
  const error = !Number.isFinite(t) ? 'Pick a date and time.' : t < Date.now() ? 'That time has passed. Pick a time later than now.' : undefined
  const evening = (() => { const d = new Date(); d.setHours(18, 0, 0, 0); return d.getTime() })()
  const quick: Array<{ label: string; at: number }> = [
    { label: 'In 1 hour', at: Date.now() + HOUR },
    ...(evening > Date.now() + 30 * 60_000 ? [{ label: 'This evening, 18:00', at: evening }] : []),
    { label: 'Tomorrow, 10:00', at: tomorrowAt(Date.now(), 10) },
    { label: 'Tomorrow, 18:00', at: tomorrowAt(Date.now(), 18) },
  ]
  const confirm = () => {
    if (error) return
    actions.logCall(task.id, 'call_back', { callbackAt: iso(t), note: join(note, callNote()) || undefined })
    actions.toast(`Callback set for ${weekdayTime(t)}. It's in your list with a reminder.`, 'success')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} width={480} title={`Call ${firstName(client.name)} back`} description="The task stays open as a callback and moves to the time you pick."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" disabled={!!error} onClick={confirm}>{error ? 'Set callback' : `Call back ${weekdayTime(t)}`}</Button>
      </>}>
      <div className="stack lg">
        <div className="row wrap" role="group" aria-label="Quick picks">
          {quick.map(q => (
            <Button key={q.label} size="sm" variant={toLocalInput(q.at) === when ? 'subtle' : 'secondary'} onClick={() => setWhen(toLocalInput(q.at))}>{q.label}</Button>
          ))}
        </div>
        <Field label="Call back at" error={error}>
          {id => <input id={id} type="datetime-local" className="input" value={when} onChange={e => setWhen(e.target.value)} />}
        </Field>
        <Field label="What did they say? (optional)">
          {id => <input id={id} className="input" value={note} placeholder="e.g. Driving, asked for a call after work" onChange={e => setNote(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- not interested ------------------------------------------------------------------------------

const LOST_REASONS = ['Price too high', 'Chose another clinic', 'Not the right time', 'Booked elsewhere', 'Changed their mind', 'Worried about the treatment', 'Other']

export function NotInterestedModal({ open, onClose, task, client }: Common) {
  const { actions } = useStore()
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  useEffect(() => { if (open) { setReason(''); setDetail('') } }, [open])
  const needsDetail = reason === 'Other'
  const ok = !!reason && (!needsDetail || detail.trim().length >= 3)
  const confirm = () => {
    if (!ok) return
    const text = needsDetail ? detail.trim() : join(reason + (detail.trim() ? ':' : ''), detail)
    // the note becomes the stage-change reason, so it carries only the reason itself
    actions.logCall(task.id, 'not_interested', { note: text })
    actions.toast(`${firstName(client.name)} marked as lost: ${needsDetail ? detail.trim() : reason}.`, 'info', { label: 'Open record', page: 'client', id: client.id })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} width={480} title="Not interested" description={`The task closes and ${client.name} moves to Lost. The reason is saved in the audit log and feeds the lost-reasons report.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={!ok} onClick={confirm}>Close as lost</Button>
      </>}>
      <div className="stack lg">
        <Field label="Main reason">
          {id => (
            <select id={id} className="input" value={reason} onChange={e => setReason(e.target.value)}>
              <option value="" disabled>Choose a reason…</option>
              {LOST_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
        </Field>
        <Field label={needsDetail ? 'What happened?' : 'Details (optional)'} hint={needsDetail ? 'Required when the reason is "Other".' : undefined}>
          {id => <textarea id={id} className="input" rows={2} value={detail} placeholder="e.g. Found a clinic in Leeds closer to home" onChange={e => setDetail(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- thinking about it ---------------------------------------------------------------------------

export function ThinkingModal({ open, onClose, task, client, callNote }: Common) {
  const { actions } = useStore()
  const [note, setNote] = useState('')
  useEffect(() => { if (open) setNote('') }, [open])
  const at = Date.now() + 2 * DAY
  const confirm = () => {
    actions.logCall(task.id, 'thinking', { note: join(note, callNote()) || undefined })
    actions.toast(`Follow-up set for ${weekdayTime(at)}. We'll remind you.`, 'success')
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} width={460} title="Thinking about it" description={`${firstName(client.name)} wants time to decide. The task becomes a follow-up call in 2 days.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={confirm}>Follow up {weekdayTime(at)}</Button>
      </>}>
      <div className="stack lg">
        <p className="tk-next-line small"><Icon name="calendar" size={15} /><span>Follow-up call due <strong>{weekdayTime(at)}</strong>, assigned to you.</span></p>
        <Field label="What are they weighing up? (optional)" hint="Shown in the brief when you call back.">
          {id => <textarea id={id} className="input" rows={2} value={note} placeholder="e.g. Wants to check instalments with her partner" onChange={e => setNote(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- wrong number --------------------------------------------------------------------------------

export function WrongNumberDialog({ open, onClose, task, client, callNote, conversation }: Common & { conversation?: Conversation }) {
  const { actions, can } = useStore()
  const [askInDm, setAskInDm] = useState(true)
  useEffect(() => { if (open) setAskInDm(true) }, [open])
  const win = conversation ? replyWindow(conversation) : undefined
  const canDm = !!conversation && can('chats.reply') && !!win && (win.open || !!win.humanAgentOpen)
  const first = firstName(client.name)
  const dmText = `Hi ${first}, we tried to call you but the number didn't reach you. Could you double-check it and send it again? Thank you!`
  return (
    <ReasonDialog open={open} onClose={onClose} tone="danger" title="Mark as wrong number?" confirmLabel="Mark wrong number"
      reasonLabel="What happened? (saved in the audit log)" placeholder="e.g. Number belongs to someone else; disconnected tone"
      body={
        <div className="stack">
          <span>The call task closes and {client.name} moves to Nurture until we have a working number.</span>
          {canDm && (
            <label className="checkbox tk-check">
              <input type="checkbox" checked={askInDm} onChange={e => setAskInDm(e.target.checked)} />
              <span>Ask for the right number in the {conversation?.channel === 'tiktok' ? 'TikTok' : conversation?.channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'} chat</span>
            </label>
          )}
        </div>
      }
      onConfirm={reason => {
        actions.logCall(task.id, 'wrong_number', { note: join(reason, callNote()) })
        if (canDm && askInDm && conversation) {
          actions.sendMessage(conversation.id, { author: 'human', text: dmText, humanAgentTag: win && !win.open && win.humanAgentOpen ? true : undefined })
        }
        actions.toast(`Marked as wrong number. ${first} moved to Nurture${canDm && askInDm ? ' and we asked for the right number in the chat' : ''}.`, 'info', canDm && askInDm && conversation ? { label: 'Open chat', page: 'inbox', id: conversation.id } : undefined)
      }}
    />
  )
}
