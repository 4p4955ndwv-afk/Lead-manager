// The call itself: a big tap-to-dial button with an on-screen timer, then one tap per outcome.
import { useEffect, useState } from 'react'
import type { CallOutcome, Client, Conversation, Episode, Task } from '../../lib/types'
import { STAGES } from '../../lib/types'
import { useStore } from '../../lib/store'
import { maskPhone } from '../../lib/permissions'
import { useNow } from '../../lib/time'
import { Button } from '../../components/ui'
import { Icon, type IconName } from '../../components/icons'
import { BookModal } from './BookModal'
import { CallbackModal, NoAnswerModal, NotInterestedModal, ThinkingModal, WrongNumberDialog } from './Outcomes'
import { firstName, mmss } from './helpers'

export function CallFlow({ task, client, episode, conversation, phoneShown, onReveal, canAct, blockedReason }: {
  task: Task
  client: Client
  episode?: Episode
  conversation?: Conversation
  phoneShown: boolean
  onReveal: (why: 'call' | 'view') => void
  canAct: boolean
  blockedReason?: string
}) {
  const { can } = useStore()
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [endedAt, setEndedAt] = useState<number | null>(null)
  const [dialog, setDialog] = useState<CallOutcome | null>(null)

  // a new task, or a logged outcome, ends the on-screen call
  useEffect(() => { setStartedAt(null); setEndedAt(null); setDialog(null) }, [task.id])
  useEffect(() => { setStartedAt(null); setEndedAt(null) }, [task.attempts.length])

  const canPhone = can('clients.view_phone')
  const phone = client.phone
  const callable = !!phone && canPhone && !client.doNotContact
  const callNote = () => (startedAt ? `Call lasted ${mmss((endedAt ?? Date.now()) - startedAt)}.` : '')
  const missed = task.attempts.filter(a => a.outcome === 'no_answer').length
  const pastBooking = !!episode && !episode.exit && STAGES.indexOf(episode.stage) >= STAGES.indexOf('booked')
  const canBook = can('appointments.manage') && !pastBooking

  const startCall = () => {
    if (!phoneShown) onReveal('call')
    if (startedAt == null || endedAt != null) {
      setStartedAt(Date.now())
      setEndedAt(null)
    }
  }

  const outcomes: Array<{ id: CallOutcome; label: string; sub: string; icon: IconName; tone: string; disabled?: boolean; title?: string }> = [
    { id: 'booked', label: 'Booked', sub: pastBooking ? 'Already past booking' : !can('appointments.manage') ? 'Needs booking access' : 'Pick a slot and deposit', icon: 'calendar', tone: 'ok', disabled: !canBook, title: pastBooking ? 'This client is already past the booking stage. Use Mark done or book from the calendar.' : undefined },
    { id: 'no_answer', label: 'No answer', sub: missed === 0 ? 'Retry in 2 h' : missed === 1 ? 'Retry tomorrow' : 'WhatsApp, then Nurture', icon: 'phone', tone: 'warn' },
    { id: 'call_back', label: 'Call back', sub: 'Pick a time', icon: 'history', tone: 'info' },
    { id: 'thinking', label: 'Thinking about it', sub: 'Follow up in 2 days', icon: 'clock', tone: 'team' },
    { id: 'not_interested', label: 'Not interested', sub: 'Close as lost', icon: 'x', tone: 'neutral' },
    { id: 'wrong_number', label: 'Wrong number', sub: 'Move to Nurture', icon: 'alert', tone: 'danger' },
  ]

  const running = startedAt != null && endedAt == null

  return (
    <section className={`card tk-call ${running ? 'is-live' : ''}`} aria-label="Call">
      <div className="tk-call-top">
        {callable ? (
          <a className="tk-call-btn" href={`tel:${phone}`} onClick={startCall} aria-label={`Call ${client.name} on ${maskPhone(phone, phoneShown)}`}>
            <Icon name="phone" size={20} />
            <span className="tk-call-label">
              <span className="tk-call-verb">{running ? 'Calling' : task.attempts.length ? 'Call again' : 'Call'}</span>
              <span className="tk-call-num num">{maskPhone(phone, phoneShown)}</span>
            </span>
          </a>
        ) : (
          <button type="button" className="tk-call-btn" disabled>
            <Icon name="phone" size={20} />
            <span className="tk-call-label">
              <span className="tk-call-verb">Call</span>
              <span className="tk-call-num">{client.doNotContact ? 'Do not contact' : !phone ? 'No number yet' : 'Number hidden for your role'}</span>
            </span>
          </button>
        )}
        {startedAt != null && <CallTimer startedAt={startedAt} endedAt={endedAt} onEnd={() => setEndedAt(Date.now())} onRestart={() => { setStartedAt(Date.now()); setEndedAt(null) }} />}
      </div>
      <p className="tk-call-hint small muted">
        {!phone
          ? `${firstName(client.name)} hasn't shared a number yet. If they call us, log the outcome here.`
          : client.doNotContact
            ? `${firstName(client.name)} asked not to be contacted. Calls are blocked.`
            : running
              ? 'Timer running. When you hang up, tap what happened below.'
              : `Tap to dial from this device${phoneShown ? '' : ' (this reveals the number and is logged)'}. Then tap what happened; the next step is scheduled for you.`}
      </p>

      <div className="tk-outcomes-head">
        <h3 className="tk-h3">What happened?</h3>
        {!canAct && blockedReason && <span className="tiny muted">{blockedReason}</span>}
      </div>
      <div className="tk-outcomes" role="group" aria-label="Call outcome">
        {outcomes.map(o => (
          <button key={o.id} type="button" className={`tk-outcome tk-outcome-${o.tone}`} disabled={!canAct || o.disabled} title={o.title} onClick={() => setDialog(o.id)}>
            <span className="tk-outcome-ic" aria-hidden="true"><Icon name={o.icon} size={16} /></span>
            <span className="tk-outcome-text">
              <span className="tk-outcome-label">{o.label}</span>
              <span className="tk-outcome-sub">{o.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <BookModal open={dialog === 'booked'} onClose={() => setDialog(null)} task={task} client={client} episode={episode} callNote={callNote} />
      <NoAnswerModal open={dialog === 'no_answer'} onClose={() => setDialog(null)} task={task} client={client} callNote={callNote} />
      <CallbackModal open={dialog === 'call_back'} onClose={() => setDialog(null)} task={task} client={client} callNote={callNote} />
      <NotInterestedModal open={dialog === 'not_interested'} onClose={() => setDialog(null)} task={task} client={client} callNote={callNote} />
      <ThinkingModal open={dialog === 'thinking'} onClose={() => setDialog(null)} task={task} client={client} callNote={callNote} />
      <WrongNumberDialog open={dialog === 'wrong_number'} onClose={() => setDialog(null)} task={task} client={client} callNote={callNote} conversation={conversation} />
    </section>
  )
}

function CallTimer({ startedAt, endedAt, onEnd, onRestart }: { startedAt: number; endedAt: number | null; onEnd: () => void; onRestart: () => void }) {
  const now = useNow(1000)
  const running = endedAt == null
  return (
    <div className={`tk-timer ${running ? 'is-running' : ''}`} role="timer" aria-live="off">
      <span className="tk-timer-dot" aria-hidden="true" />
      <span className="stack" style={{ gap: 0 }}>
        <span className="tiny muted">{running ? 'On call' : 'Call ended'}</span>
        <span className="tk-timer-value num">{mmss((endedAt ?? now) - startedAt)}</span>
      </span>
      {running
        ? <Button size="sm" variant="secondary" icon="x" onClick={onEnd}>End call</Button>
        : <Button size="sm" variant="ghost" icon="refresh" onClick={onRestart}>Restart timer</Button>}
    </div>
  )
}
