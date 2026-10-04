// Kanban board: one column per main stage. Cards drag between columns (HTML5 drag and drop);
// the stage rail above doubles as a jump bar and as drop targets for columns that are scrolled out of view.
import { useRef, useState, type DragEvent } from 'react'
import type { Stage } from '../../lib/types'
import { STAGES, STAGE_LABEL } from '../../lib/types'
import { ms } from '../../lib/time'
import { PipelineCard } from './PipelineCard'
import { isCardDrag, moveRule, type Pos, type PRow } from './model'

export const STAGE_HELP: Record<Stage, string> = {
  new: 'New DMs the AI has not qualified yet.',
  qualifying: 'The AI is chatting and finding out what they want.',
  contact: 'Shared a number. A coordinator calls within 15 minutes.',
  call: 'Being called to confirm a consultation date.',
  booked: 'Consultation is in the diary.',
  consultation: 'Came to a consultation.',
  plan: 'Treatment plan proposed, waiting on a decision.',
  treatment: 'Sessions in progress.',
  aftercare: 'Course finished. Follow-ups and aftercare.',
  alumni: 'Finished journeys, ready for reviews and returns.',
}

export interface DragApi {
  dragRow?: PRow
  start: (row: PRow, e: DragEvent<HTMLElement>) => void
  end: () => void
  drop: (to: Pos, e: DragEvent<HTMLElement>) => void
}

/** Short label for what dropping the dragged card on `to` would do. */
export function dropHint(row: PRow, to: Pos, canOverride: boolean): { text: string; tone: 'ok' | 'warn' | 'locked' | 'here' } {
  const rule = moveRule(row, to)
  if (rule.kind === 'same') return { text: 'Here now', tone: 'here' }
  if (rule.needsOverride && !canOverride) return { text: 'Manager only', tone: 'locked' }
  if (rule.kind === 'next') return { text: 'Next step', tone: 'ok' }
  if (rule.kind === 'skip') return { text: 'Skip · reason', tone: 'warn' }
  if (rule.kind === 'back') return { text: 'Back · reason', tone: 'warn' }
  if (rule.kind === 'return') return { text: 'Bring back · reason', tone: 'warn' }
  return { text: 'Reason needed', tone: 'warn' }
}

/** Most urgent first: SLA calls (most overdue on top), then overdue callbacks, then longest in the stage. */
function byUrgency(a: PRow, b: PRow): number {
  const group = (r: PRow) => (r.slaTask ? 0 : r.overdueCall ? 1 : 2)
  const ga = group(a), gb = group(b)
  if (ga !== gb) return ga - gb
  if (a.slaTask && b.slaTask) return ms(a.slaTask.dueAt) - ms(b.slaTask.dueAt)
  return a.enteredAt - b.enteredAt
}

interface Props {
  rows: PRow[]
  now: number
  showMoney: boolean
  fmtMoney: (n: number) => string
  canMove: boolean
  canOverride: boolean
  drag: DragApi
  onOpen: (row: PRow) => void
  onMove: (row: PRow, to: Pos) => void
}

export function Board({ rows, now, showMoney, fmtMoney, canMove, canOverride, drag, onOpen, onMove }: Props) {
  const [over, setOver] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragRow = drag.dragRow

  const byStage = new Map<Stage, PRow[]>(STAGES.map(st => [st, []]))
  for (const r of rows) if (r.onPath) byStage.get(r.pos as Stage)?.push(r)
  for (const list of byStage.values()) list.sort(byUrgency)

  const jump = (st: Stage) => {
    const col = boardRef.current?.querySelector<HTMLElement>(`[data-stage="${st}"]`)
    const board = boardRef.current
    if (!col || !board) return
    board.scrollTo({ left: col.offsetLeft - board.offsetLeft - parseFloat(getComputedStyle(board).paddingLeft || '0'), behavior: 'smooth' })
    col.querySelector<HTMLElement>('.pl-col-title')?.focus({ preventScroll: true })
  }

  const dropProps = (key: string, to: Pos) => canMove ? {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragRow && !isCardDrag(e.dataTransfer)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (over !== key) setOver(key)
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(o => (o === key ? null : o))
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      setOver(null)
      drag.drop(to, e)
    },
  } : {}

  return (
    <div className="pl-board-wrap">
      <nav className="pl-rail" aria-label="Jump to a stage">
        {STAGES.map((st, i) => {
          const n = byStage.get(st)!.length
          const hint = dragRow ? dropHint(dragRow, st, canOverride) : null
          return (
            <button key={st} type="button" className={`pl-rail-item ${over === 'rail-' + st ? 'is-over' : ''} ${hint ? 'hint-' + hint.tone : ''}`}
              onClick={() => jump(st)} {...dropProps('rail-' + st, st)} title={STAGE_HELP[st]}>
              <span className="pl-rail-no num">{i + 1}</span>
              <span className="truncate">{STAGE_LABEL[st]}</span>
              <span className="pl-rail-count num">{n}</span>
            </button>
          )
        })}
      </nav>

      <div className={`pl-board ${dragRow ? 'is-dragging' : ''}`} ref={boardRef} role="list" aria-label="Pipeline stages">
        {STAGES.map((st, i) => {
          const list = byStage.get(st)!
          const value = list.reduce((s, r) => s + r.ep.value, 0)
          const late = list.filter(r => r.slaTask && ms(r.slaTask.dueAt) < now).length
          const hint = dragRow ? dropHint(dragRow, st, canOverride) : null
          return (
            <section key={st} role="listitem" data-stage={st} aria-labelledby={`pl-col-${st}`}
              className={`pl-col ${over === st ? 'is-over' : ''} ${hint ? 'hint-' + hint.tone : ''}`} {...dropProps(st, st)}>
              <header className="pl-col-head" title={STAGE_HELP[st]}>
                <div className="row">
                  <span className="pl-col-no num" aria-hidden="true">{i + 1}</span>
                  <h2 id={`pl-col-${st}`} className="pl-col-title truncate grow" tabIndex={-1}>{STAGE_LABEL[st]}</h2>
                  <span className="pl-col-count num" aria-label={`${list.length} ${list.length === 1 ? 'person' : 'people'}`}>{list.length}</span>
                </div>
                <div className="row pl-col-meta">
                  {showMoney && <span className="tiny muted num" title="Expected value in this stage">{fmtMoney(value)}</span>}
                  {late > 0 && <span className="pl-col-late tiny" title="Calls past their 15-minute SLA">{late} late</span>}
                  {hint && <span className={`pl-drop-hint hint-${hint.tone}`}>{hint.text}</span>}
                </div>
              </header>
              <div className="pl-col-body">
                {list.length === 0 ? (
                  <p className="pl-col-empty tiny muted">{dragRow ? 'Drop here' : 'No one here.'} {STAGE_HELP[st]}</p>
                ) : list.map(r => (
                  <PipelineCard key={r.ep.id} row={r} now={now} canMove={canMove} canOverride={canOverride}
                    dragging={dragRow?.ep.id === r.ep.id}
                    onOpen={() => onOpen(r)} onMove={to => onMove(r, to)}
                    onDragStart={e => drag.start(r, e)} onDragEnd={drag.end} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
