// "Off the path": episodes that left the main journey, grouped by exit. Cards can be dropped on a tab
// (with a reason) and anyone here can be brought back to the stage they left from.
import { useState, type DragEvent } from 'react'
import type { Exit } from '../../lib/types'
import { EXITS, EXIT_LABEL, STAGE_LABEL } from '../../lib/types'
import { ago } from '../../lib/time'
import { Button, ChannelBadge, EmptyState } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore, userName } from '../../lib/store'
import { MoveMenu } from './MoveMenu'
import { dropHint, type DragApi } from './Board'
import { EXIT_HELP, moveRule, type Pos, type PRow } from './model'

interface Props {
  rows: PRow[]
  tab: Exit
  onTab: (x: Exit) => void
  now: number
  canMove: boolean
  canOverride: boolean
  drag: DragApi
  onOpen: (row: PRow) => void
  onMove: (row: PRow, to: Pos) => void
}

export function ExitLane({ rows, tab, onTab, now, canMove, canOverride, drag, onOpen, onMove }: Props) {
  const { state } = useStore()
  const [over, setOver] = useState<Exit | null>(null)
  const off = rows.filter(r => !r.onPath)
  const list = off.filter(r => r.pos === tab).sort((a, b) => b.enteredAt - a.enteredAt)
  const dragRow = drag.dragRow

  const dropProps = (x: Exit) => canMove ? {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragRow) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (over !== x) setOver(x)
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(o => (o === x ? null : o))
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault()
      setOver(null)
      drag.drop(x, e)
    },
  } : {}

  return (
    <section className="card pl-exits" aria-labelledby="pl-exits-title">
      <div className="pl-exits-head">
        <div className="stack" style={{ gap: 2 }}>
          <h2 id="pl-exits-title" className="card-title">Off the path</h2>
          <p className="muted small">
            {off.length} {off.length === 1 ? 'person has' : 'people have'} left the main journey.
            {canMove ? ' Drag a card onto a tab to move someone here, or bring someone back when things change.' : ''}
          </p>
        </div>
      </div>

      <div className={`tabs pl-exit-tabs ${dragRow ? 'is-dragging' : ''}`} role="tablist" aria-label="Exits">
        {EXITS.map(x => {
          const n = off.filter(r => r.pos === x).length
          const hint = dragRow ? dropHint(dragRow, x, canOverride) : null
          return (
            <button key={x} type="button" role="tab" id={`pl-exit-tab-${x}`} aria-selected={tab === x} aria-controls="pl-exit-panel"
              className={`tab pl-exit-tab ${tab === x ? 'is-active' : ''} ${over === x ? 'is-over' : ''} ${hint ? 'hint-' + hint.tone : ''}`}
              onClick={() => onTab(x)} {...dropProps(x)}>
              <span>{EXIT_LABEL[x]}</span>
              <span className="tab-count num">{n}</span>
            </button>
          )
        })}
      </div>

      <div id="pl-exit-panel" role="tabpanel" aria-labelledby={`pl-exit-tab-${tab}`} className="pl-exit-panel">
        <p className="small muted pl-exit-what">{EXIT_HELP[tab].what}</p>
        {list.length === 0 ? (
          <EmptyState icon="layers" title={`No one in ${EXIT_LABEL[tab]}`}
            body={<>{EXIT_HELP[tab].empty}{canMove ? <> To move someone here, drag their card onto this tab or choose <strong>Move to… › {EXIT_LABEL[tab]}</strong>.</> : null}</>} />
        ) : (
          <ul className="pl-exit-grid">
            {list.map(r => {
              const back = moveRule(r, r.ep.stage)
              const locked = back.needsOverride && !canOverride
              const by = r.exitEntry?.by
              return (
                <li key={r.ep.id} className={`pl-exit-card ${dragRow?.ep.id === r.ep.id ? 'is-dragging' : ''}`}
                  draggable={canMove} onDragStart={canMove ? e => drag.start(r, e) : undefined} onDragEnd={canMove ? drag.end : undefined}>
                  <div className="pl-card-top">
                    <button type="button" className="pl-card-name truncate" onClick={() => onOpen(r)} title={`Open ${r.client.name}'s record`}>{r.client.name}</button>
                    <ChannelBadge channel={r.client.source.channel} label={false} size="sm" />
                    {canMove && <MoveMenu row={r} canOverride={canOverride} onPick={to => onMove(r, to)} />}
                  </div>
                  <p className="pl-exit-reason small">{r.ep.exitReason ? `“${r.ep.exitReason}”` : <span className="muted">No reason recorded</span>}</p>
                  <p className="tiny muted">
                    Left at {STAGE_LABEL[r.ep.stage]} · {ago(new Date(r.enteredAt).toISOString(), now)}
                    {by ? <> · by {userName(state, by)}</> : null}
                  </p>
                  {canMove && (
                    <div className="pl-exit-actions">
                      <Button size="sm" variant={locked ? 'ghost' : 'secondary'} icon={locked ? 'lock' : 'refresh'} onClick={() => onMove(r, r.ep.stage)}
                        title={locked ? 'Needs a manager or owner (override permission)' : undefined}>
                        Bring back to {STAGE_LABEL[r.ep.stage]}
                      </Button>
                    </div>
                  )}
                  {!canMove && r.client.doNotContact && <span className="tiny muted"><Icon name="shield" size={12} className="pl-inline-icon" /> Do not contact</span>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
