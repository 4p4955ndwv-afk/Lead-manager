// Journey stepper for one episode: every stage of the main path as done / current / upcoming / skipped,
// with who moved it and when. Override reasons show for the step under the pointer or keyboard focus.
import { useEffect, useRef, useState } from 'react'
import { userName, useStore } from '../../lib/store'
import type { Client, Episode, Stage, StageChange } from '../../lib/types'
import { EXIT_LABEL, STAGES, STAGE_LABEL } from '../../lib/types'
import { dateTime, money, shortDate } from '../../lib/time'
import { Button, Chip, StageBadge } from '../../components/ui'
import { Icon } from '../../components/icons'
import { canRestart, dayYear, procName, stageIndex, yearOf as _y } from './helpers'

const STAGE_HINT: Record<Stage, string> = {
  new: 'A DM arrives on Instagram or TikTok.',
  qualifying: 'The AI asks about treatment, area and timing.',
  contact: 'They share a number or ask for ours. The owner gets 15 minutes to call.',
  call: 'The coordinator calls to confirm details and book.',
  booked: 'A consultation is booked, usually on the call.',
  consultation: 'They attend the consultation.',
  plan: 'A clinician proposes a treatment plan.',
  treatment: 'The first session is done.',
  aftercare: 'All sessions are complete; aftercare check-ins run.',
  alumni: 'Journey complete. A return visit starts a new episode.',
}

type StepState = 'done' | 'current' | 'upcoming' | 'skipped' | 'exit'

export function Journey({ client, episodes, episode, onSelect, onNewEpisode, canStartNew }: {
  client: Client; episodes: Episode[]; episode: Episode; onSelect: (id: string) => void; onNewEpisode: () => void; canStartNew: boolean
}) {
  const { state, can } = useStore()
  const cur = stageIndex(episode.stage)
  const [peek, setPeek] = useState<number>(cur)
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => setPeek(cur), [cur, episode.id])

  // keep the current step in view when the stepper scrolls sideways (phones)
  useEffect(() => {
    const el = scroller.current
    const step = el?.querySelector<HTMLElement>(`[data-step="${cur}"]`)
    if (el && step && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, step.offsetLeft - el.clientWidth / 2 + step.offsetWidth / 2)
  }, [cur, episode.id])

  const steps = STAGES.map((st, i) => {
    const entry: StageChange | undefined = [...episode.history].reverse().find(h => h.to === st)
    let s: StepState = i < cur ? (entry ? 'done' : 'skipped') : i === cur ? 'current' : 'upcoming'
    if (i === cur && episode.exit) s = 'exit'
    if (i === cur && st === 'alumni') s = 'done'
    return { st, i, entry, s }
  })
  const exitEntry = episode.exit ? [...episode.history].reverse().find(h => h.to === episode.exit) : undefined
  const latest = episodes[episodes.length - 1]
  const showNew = canStartNew && canRestart(client, latest)
  const p = steps[peek] ?? steps[cur]
  const showValue = can('payments.view') || can('analytics.revenue')

  const stateWord: Record<StepState, string> = { done: 'Done', current: 'Current stage', upcoming: 'Not reached yet', skipped: 'Skipped', exit: 'Last stage reached' }

  return (
    <section className="card cr-journey" aria-label="Journey">
      <div className="cr-journey-head">
        {episodes.length > 1 ? (
          <div className="cr-eps" role="tablist" aria-label="Episodes">
            {episodes.map(e => {
              const status = e.exit ? EXIT_LABEL[e.exit] : e.stage === 'alumni' ? 'Completed' : 'Active'
              return (
                <button key={e.id} type="button" role="tab" aria-selected={e.id === episode.id} className={`cr-ep ${e.id === episode.id ? 'is-active' : ''}`} onClick={() => onSelect(e.id)}>
                  <span className="strong">Episode {e.number} · {_y(e.startedAt)}</span>
                  <span className={`cr-ep-status ${status === 'Active' ? 'is-live' : ''}`}>{status}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="stack" style={{ gap: 0 }}>
            <h2 className="card-title">Journey</h2>
            <span className="small muted">Episode {episode.number} · started {dayYear(episode.startedAt)}</span>
          </div>
        )}
        <div className="row wrap cr-journey-meta">
          {episode.interests.map(i => <Chip key={i} tone="accent">{procName(state, i)}</Chip>)}
          {showValue && episode.value > 0 && <span className="small muted num" title="Expected or actual value of this episode">{money(episode.value, state.settings.currency)}</span>}
          {showNew && <Button size="sm" variant="subtle" icon="plus" onClick={onNewEpisode}>Start a new episode</Button>}
        </div>
      </div>

      <div className="cr-steps-scroll" ref={scroller}>
        <ol className="cr-steps">
          {steps.map(({ st, i, entry, s }) => (
            <li key={st} className={`cr-step is-${s}`} data-step={i}>
              <button type="button" className={`cr-step-btn ${peek === i ? 'is-peek' : ''}`}
                onMouseEnter={() => setPeek(i)} onFocus={() => setPeek(i)} onClick={() => setPeek(i)}
                aria-describedby="cr-step-detail" aria-current={s === 'current' || s === 'exit' ? 'step' : undefined}
                aria-label={`${STAGE_LABEL[st]}: ${stateWord[s]}${entry ? `, ${dateTime(entry.at)}` : ''}${entry?.override ? ', override' : ''}`}>
                <span className="cr-step-dot" aria-hidden="true">
                  {s === 'done' ? <Icon name="check" size={13} strokeWidth={2.5} /> : s === 'exit' ? <Icon name="x" size={12} strokeWidth={2.5} /> : s === 'current' ? <span className="cr-step-core" /> : null}
                  {entry?.override && <span className="cr-step-flag" title="Override"><Icon name="flag" size={9} strokeWidth={2.5} /></span>}
                </span>
                <span className="cr-step-label">{STAGE_LABEL[st]}</span>
                <span className="cr-step-date num">{entry && s !== 'upcoming' ? shortDate(entry.at) : s === 'skipped' ? 'Skipped' : ''}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div id="cr-step-detail" className={`cr-step-detail ${p.entry?.override ? 'is-override' : ''}`} aria-live="polite">
        <Icon name={p.entry?.override ? 'flag' : p.s === 'done' ? 'check' : p.s === 'upcoming' ? 'clock' : 'info'} size={15} />
        <div className="grow small">
          <strong>{STAGE_LABEL[p.st]}</strong> · {stateWord[p.s]}
          {p.entry && p.s !== 'upcoming' && <> · {p.s === 'exit' ? 'reached' : 'moved'} {p.entry.by === 'ai' ? 'by the AI' : p.entry.by === 'system' ? 'automatically' : `by ${userName(state, p.entry.by)}`} on {dateTime(p.entry.at)}{p.s === 'exit' ? ', then left the path' : ''}</>}
          {p.entry?.override && <> · <span className="cr-override">Override</span></>}
          {p.entry?.reason && <span className="cr-step-reason"> “{p.entry.reason}”</span>}
          {(p.s === 'upcoming' || p.s === 'skipped') && <span className="muted"> · {STAGE_HINT[p.st]}</span>}
        </div>
      </div>

      {episode.exit && (
        <div className={`cr-exit is-${episode.exit === 'nurture' ? 'info' : episode.exit === 'lost' || episode.exit === 'spam' ? 'neutral' : 'danger'}`} role="note">
          <StageBadge stage={episode.stage} exit={episode.exit} />
          <span className="small">
            Left the path at <strong>{STAGE_LABEL[episode.stage]}</strong>
            {exitEntry && <> on {dateTime(exitEntry.at)} by {exitEntry.by === 'ai' ? 'the AI' : userName(state, exitEntry.by)}</>}
            {episode.exitReason && <>: “{episode.exitReason}”</>}
          </span>
        </div>
      )}
      {episode.endedAt && !episode.exit && (
        <p className="tiny muted cr-journey-foot">Completed {dayYear(episode.endedAt)}. {latest?.id === episode.id ? 'A return visit starts a new episode.' : ''}</p>
      )}
    </section>
  )
}
