// Sortable table of every client's current journey. Row click opens the client record.
import { ChannelBadge, StageBadge, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { ago, shortDate } from '../../lib/time'
import { MoveMenu } from './MoveMenu'
import { scoreTone } from './PipelineCard'
import { sortRows, type Pos, type PRow, type Sort, type SortKey } from './model'

interface Props {
  rows: PRow[]
  sort: Sort
  onSort: (s: Sort) => void
  now: number
  showMoney: boolean
  fmtMoney: (n: number) => string
  canMove: boolean
  canOverride: boolean
  onOpen: (row: PRow) => void
  onMove: (row: PRow, to: Pos) => void
}

const COLS: { key: SortKey; label: string; money?: boolean; num?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'stage', label: 'Stage' },
  { key: 'channel', label: 'Channel' },
  { key: 'owner', label: 'Owner' },
  { key: 'value', label: 'Value', money: true, num: true },
  { key: 'score', label: 'Score', num: true },
  { key: 'created', label: 'Created' },
  { key: 'changed', label: 'Last change' },
]

/** Sensible first direction per column: text A→Z, numbers and dates biggest/newest first. */
const FIRST_DIR: Record<SortKey, Sort['dir']> = { name: 'asc', stage: 'asc', channel: 'asc', owner: 'asc', value: 'desc', score: 'desc', created: 'desc', changed: 'desc' }

export function ListView({ rows, sort, onSort, now, showMoney, fmtMoney, canMove, canOverride, onOpen, onMove }: Props) {
  const sorted = sortRows(rows, sort)
  const cols = COLS.filter(c => !c.money || showMoney)

  return (
    <div className="table-wrap pl-table-wrap">
      <table className="table pl-table">
        <caption className="sr-only">Clients in the pipeline, sorted by {cols.find(c => c.key === sort.key)?.label.toLowerCase()} ({sort.dir === 'asc' ? 'ascending' : 'descending'})</caption>
        <thead>
          <tr>
            {cols.map(c => {
              const active = sort.key === c.key
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={c.num ? 'pl-th-num' : undefined}>
                  <button type="button" className={`pl-sort ${active ? 'is-active' : ''}`}
                    onClick={() => onSort({ key: c.key, dir: active ? (sort.dir === 'asc' ? 'desc' : 'asc') : FIRST_DIR[c.key] })}>
                    {c.label}
                    <Icon name="chevronDown" size={13} className={`pl-sort-icon ${active && sort.dir === 'asc' ? 'is-asc' : ''}`} />
                  </button>
                </th>
              )
            })}
            {canMove && <th scope="col"><span className="sr-only">Move</span></th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(r => (
            <tr key={r.ep.id} className="is-clickable" onClick={() => onOpen(r)}>
              <td className="pl-td-name">
                <button type="button" className="pl-row-link" onClick={e => { e.stopPropagation(); onOpen(r) }}>
                  <span className="strong truncate">{r.client.name}</span>
                  <span className="tiny muted truncate">{r.procedure?.name ?? 'Procedure not known yet'}{r.ep.number > 1 ? ' · Returning' : ''}</span>
                </button>
              </td>
              <td><StageBadge stage={r.ep.stage} exit={r.ep.exit} /></td>
              <td><ChannelBadge channel={r.client.source.channel} size="sm" /></td>
              <td>
                {r.owner ? (
                  <span className="row" style={{ gap: 6 }}><UserAvatar userId={r.owner.id} size={22} /><span className="truncate">{r.owner.name}</span></span>
                ) : <span className="muted small">{r.onPath && ['new', 'qualifying'].includes(r.pos) ? 'AI assistant' : 'Unassigned'}</span>}
              </td>
              {showMoney && <td className="num pl-td-num">{fmtMoney(r.ep.value)}</td>}
              <td className="pl-td-num"><span className={`pl-score pl-score-${scoreTone(r.client.score)} num`} title={`Lead score ${r.client.score} out of 100`}>{r.client.score}</span></td>
              <td className="small muted" title={new Date(r.client.createdAt).toLocaleString()}>{shortDate(r.client.createdAt)}</td>
              <td className="small muted" title={new Date(r.lastChange).toLocaleString()}>{ago(new Date(r.lastChange).toISOString(), now)}</td>
              {canMove && (
                <td className="pl-td-move" onClick={e => e.stopPropagation()}>
                  <MoveMenu row={r} canOverride={canOverride} onPick={to => onMove(r, to)} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sr-only" aria-live="polite">{sorted.length} {sorted.length === 1 ? 'client' : 'clients'} listed.</p>
    </div>
  )
}
