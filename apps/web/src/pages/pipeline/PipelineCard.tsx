// One client on the board: who they are, what they want, who owns them and what is urgent.
import type { DragEvent } from 'react'
import { ChannelBadge, Chip, Countdown, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { STAGES } from '../../lib/types'
import { DAY, ms, sameDay, shortDate, timeOf, until } from '../../lib/time'
import { MoveMenu } from './MoveMenu'
import { isStage, type Pos, type PRow } from './model'

export function daysIn(enteredAt: number, now: number): string {
  const d = Math.floor((now - enteredAt) / DAY)
  if (d < 1) return 'Today'
  return d === 1 ? '1 day' : `${d} days`
}

export function scoreTone(score: number): 'hi' | 'mid' | 'lo' {
  return score >= 75 ? 'hi' : score >= 50 ? 'mid' : 'lo'
}

export function apptLabel(iso: string, now: number): string {
  if (sameDay(iso, now)) return `Today ${timeOf(iso)}`
  if (sameDay(iso, now + DAY)) return `Tomorrow ${timeOf(iso)}`
  return `${shortDate(iso)}, ${timeOf(iso)}`
}

interface Props {
  row: PRow
  now: number
  canMove: boolean
  canOverride: boolean
  dragging: boolean
  onOpen: () => void
  onMove: (to: Pos) => void
  onDragStart: (e: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}

export function PipelineCard({ row, now, canMove, canOverride, dragging, onOpen, onMove, onDragStart, onDragEnd }: Props) {
  const { client, ep } = row
  const sla = row.slaTask
  const call = !sla ? row.callTask : undefined
  const callOverdue = call ? ms(call.dueAt) < now : false
  const slaOverdue = sla ? ms(sla.dueAt) < now : false
  const tone = scoreTone(client.score)
  const aiHandling = !row.ownerId && isStage(row.pos) && STAGES.indexOf(row.pos) < STAGES.indexOf('contact')

  return (
    <article
      className={`pl-card ${slaOverdue ? 'is-breach' : ''} ${dragging ? 'is-dragging' : ''} ${canMove ? 'is-draggable' : ''}`}
      draggable={canMove}
      onDragStart={canMove ? onDragStart : undefined}
      onDragEnd={canMove ? onDragEnd : undefined}
      onClick={onOpen}
      aria-label={`${client.name}, ${row.procedure?.name ?? 'no procedure yet'}`}
    >
      <div className="pl-card-top">
        <button type="button" className="pl-card-name truncate" onClick={e => { e.stopPropagation(); onOpen() }} title={`Open ${client.name}'s record`}>
          {client.name}
        </button>
        <ChannelBadge channel={client.source.channel} label={false} size="sm" />
        {canMove && <MoveMenu row={row} canOverride={canOverride} onPick={onMove} />}
      </div>

      <div className="pl-card-proc small muted truncate">
        {row.procedure ? row.procedure.name : 'Procedure not known yet'}
        {row.extraInterests > 0 && <span className="faint"> +{row.extraInterests}</span>}
      </div>

      {(sla || call || row.nextAppt || ep.number > 1) && (
        <div className="pl-card-chips">
          {sla && <Countdown deadline={sla.dueAt} compact />}
          {sla && sla.escalationLevel > 0 && (
            <Chip tone="danger" icon="alert" title={`Escalated to the ${sla.escalationLevel === 1 ? 'manager' : 'owner'}`}>
              {sla.escalationLevel === 1 ? 'Manager' : 'Owner'}
            </Chip>
          )}
          {call && (
            <Chip tone={callOverdue ? 'danger' : 'neutral'} icon="phone" title={call.title}>
              {callOverdue ? 'Call overdue' : `Call ${until(call.dueAt, now)}`}
            </Chip>
          )}
          {row.nextAppt && (
            <Chip tone="team" icon="calendar" title={`Next ${row.nextAppt.type.replace('_', '-')}`}>
              {apptLabel(row.nextAppt.start, now)}
            </Chip>
          )}
          {ep.number > 1 && <Chip tone="accent" icon="refresh" title={`Journey ${ep.number}: came back after an earlier treatment`}>Returning</Chip>}
        </div>
      )}

      <div className="pl-card-foot">
        {row.ownerId ? <span className="pl-owner" title={`Owner: ${row.owner?.name ?? 'Unknown'}`}><UserAvatar userId={row.ownerId} size={22} /></span>
          : aiHandling ? <UserAvatar userId="ai" size={22} />
          : <span className="pl-unowned" title="No coordinator yet"><Icon name="user" size={12} /></span>}
        <span className="tiny muted truncate grow" title="Time in this stage">
          <Icon name="clock" size={12} className="pl-inline-icon" /> {daysIn(row.enteredAt, now)}
        </span>
        <span className={`pl-score pl-score-${tone} num`} title={`Lead score ${client.score} out of 100`}>
          {client.score}
        </span>
      </div>
    </article>
  )
}
