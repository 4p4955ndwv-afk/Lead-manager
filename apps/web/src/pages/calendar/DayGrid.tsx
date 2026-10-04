// Day view: a time grid from 08:00 to 20:00 with one column per practitioner or per room.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { Appointment, DemoState } from '../../lib/types'
import { useNow, ms } from '../../lib/time'
import { UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import {
  DAY_END_MIN, DAY_START_MIN, GRID_HEIGHT, PX_PER_MIN, STATUS_LABEL, apptLine, apptMinutes, clientOf, hm, isSameDay, layoutLanes, minutesOfDay, startOfLocalDay,
} from './helpers'
import { ApptMarks } from './parts'

export interface GridColumn {
  id: string
  title: string
  sub?: string
  userId?: string
  muted?: boolean
}

const HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 60 + 1 }, (_, i) => DAY_START_MIN / 60 + i)
const slotLabel = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
const HALF_HOURS = Array.from({ length: (DAY_END_MIN - DAY_START_MIN) / 30 }, (_, i) => i)

export function DayGrid({ state, day, mode, columns, appts, selectedId, symbol, onOpen, onSlot }: {
  state: DemoState
  day: number
  mode: 'practitioner' | 'room'
  columns: GridColumn[]
  appts: Appointment[]
  selectedId?: string | null
  symbol: string
  onOpen: (a: Appointment) => void
  /** Present only for people who can book: clicking an empty half hour starts a booking there. */
  onSlot?: (startMin: number, columnId: string) => void
}) {
  const now = useNow(30_000)
  const scroller = useRef<HTMLDivElement>(null)
  const isToday = isSameDay(day, now)
  const nowMin = minutesOfDay(now)
  const showNow = isToday && nowMin >= DAY_START_MIN && nowMin <= DAY_END_MIN

  const byColumn = useMemo(() => {
    const m = new Map<string, Appointment[]>()
    columns.forEach(c => m.set(c.id, []))
    appts.forEach(a => m.get(mode === 'practitioner' ? a.practitionerId : a.roomId)?.push(a))
    return m
  }, [appts, columns, mode])

  // Bring the useful part of the day into view: now on today, otherwise the first appointment.
  const firstMin = useMemo(() => {
    const starts = appts.map(a => minutesOfDay(ms(a.start)))
    return starts.length ? Math.min(...starts) : 9 * 60
  }, [appts])
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    let target = isToday && showNow ? nowMin - 60 : firstMin - 30
    // Never open with an appointment cut off at the top: start from the earliest one that spans the target.
    for (const a of appts) {
      const s = minutesOfDay(ms(a.start)), e = s + apptMinutes(a)
      if (a.status !== 'cancelled' && s < target && e > target) target = Math.min(target, s - 10)
    }
    el.scrollTop = Math.max(0, (target - DAY_START_MIN) * PX_PER_MIN - 10)
    // only when the day or view changes, not on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, mode])

  // Keep the open appointment visible when it is opened from a link.
  useEffect(() => {
    if (!selectedId) return
    const el = scroller.current?.querySelector<HTMLElement>(`[data-appt="${selectedId}"]`)
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [selectedId])

  const template = `var(--ca-gutter) repeat(${Math.max(columns.length, 1)}, minmax(var(--ca-col-min), 1fr))`

  return (
    <div className="ca-grid-scroll" ref={scroller} role="region" aria-label={`Day diary by ${mode}`} tabIndex={0}>
      <div className="ca-grid-head" style={{ gridTemplateColumns: template }}>
        <div className="ca-corner" aria-hidden="true" />
        {columns.map(c => {
          const list = byColumn.get(c.id) ?? []
          const live = list.filter(a => a.status !== 'cancelled')
          return (
            <div key={c.id} className={`ca-col-head ${c.muted ? 'is-muted' : ''}`}>
              {c.userId && <UserAvatar userId={c.userId} size={26} />}
              <div className="ca-col-head-text">
                <span className="ca-col-title truncate">{c.title}</span>
                <span className="ca-col-sub truncate">{c.sub ? `${c.sub} · ` : ''}{live.length === 0 ? 'Free all day' : `${live.length} booked`}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="ca-grid-body" style={{ gridTemplateColumns: template, height: GRID_HEIGHT }}>
        <div className="ca-gutter" aria-hidden="true">
          {HOURS.map((h, i) => (
            <span key={h} className={`ca-hour ${i === 0 ? 'is-first' : i === HOURS.length - 1 ? 'is-last' : ''}`} style={{ top: (h * 60 - DAY_START_MIN) * PX_PER_MIN }}>{String(h).padStart(2, '0')}:00</span>
          ))}
          {showNow && <span className="ca-now-label num" style={{ top: (nowMin - DAY_START_MIN) * PX_PER_MIN }}>{hm(now)}</span>}
        </div>

        <div className="ca-lines" aria-hidden="true">
          {HALF_HOURS.map(i => <span key={i} className={`ca-line ${i % 2 ? 'is-half' : ''}`} style={{ top: i * 30 * PX_PER_MIN }} />)}
        </div>
        {showNow && <span className="ca-now" style={{ top: (nowMin - DAY_START_MIN) * PX_PER_MIN }} aria-hidden="true" />}

        {columns.map(c => {
          const list = byColumn.get(c.id) ?? []
          const lanes = layoutLanes(list.filter(a => a.status !== 'cancelled'))
          return (
            <div key={c.id} className="ca-col">
              {onSlot && HALF_HOURS.map(i => {
                const startMin = DAY_START_MIN + i * 30
                const past = isToday ? startMin + 30 <= nowMin : day < startOfLocalDay(now)
                if (past) return null
                return (
                  <div key={i} className="ca-slot" style={{ top: i * 30 * PX_PER_MIN, height: 30 * PX_PER_MIN }} onClick={() => onSlot(startMin, c.id)} title={`Book ${c.title} at ${slotLabel(startMin)}`} aria-hidden="true">
                    <span className="ca-slot-hint"><Icon name="plus" size={12} />{slotLabel(startMin)}</span>
                  </div>
                )
              })}
              {list.map(a => (
                <GridBlock key={a.id} state={state} a={a} mode={mode} lane={lanes.get(a.id)} selected={a.id === selectedId} symbol={symbol} onOpen={onOpen} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function GridBlock({ state, a, mode, lane, selected, symbol, onOpen }: {
  state: DemoState; a: Appointment; mode: 'practitioner' | 'room'; lane?: { lane: number; lanes: number }; selected: boolean; symbol: string; onOpen: (a: Appointment) => void
}) {
  const client = clientOf(state, a)
  const startMin = Math.min(DAY_END_MIN - 15, Math.max(DAY_START_MIN, minutesOfDay(ms(a.start))))
  const endMin = Math.min(DAY_END_MIN, startMin + apptMinutes(a))
  const height = Math.max(26, (endMin - startMin) * PX_PER_MIN - 3)
  const top = (startMin - DAY_START_MIN) * PX_PER_MIN + 1
  const lanes = lane?.lanes ?? 1
  const idx = lane?.lane ?? 0
  const where = mode === 'practitioner' ? state.rooms.find(r => r.id === a.roomId)?.name : state.users.find(u => u.id === a.practitionerId)?.name
  const line = apptLine(state, a)
  const size = height < 44 ? 'xs' : height < 70 ? 'sm' : 'lg'
  const label = `${hm(a.start)} to ${hm(a.end)}, ${client?.name ?? 'Client'}, ${line}, ${STATUS_LABEL[a.status]}${a.deposit === 'due' ? ', deposit due' : ''}. Open details`
  return (
    <button
      type="button"
      data-appt={a.id}
      className={`ca-block ca-t-${a.type} ca-s-${a.status} ca-size-${size} ${selected ? 'is-selected' : ''}`}
      style={{ top, height, left: `calc(${(idx / lanes) * 100}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` }}
      onClick={() => onOpen(a)}
      aria-label={label}
      title={`${hm(a.start)}–${hm(a.end)} · ${client?.name ?? ''} · ${line} · ${STATUS_LABEL[a.status]}`}
    >
      <span className="ca-block-top">
        <span className="ca-block-name truncate">{client?.name ?? 'Unknown client'}</span>
        <ApptMarks a={a} symbol={symbol} />
      </span>
      <span className="ca-block-time num truncate">
        {hm(a.start)}–{hm(a.end)}
        {size !== 'lg' && where ? <span className="ca-block-where"> · {where}</span> : null}
        {size !== 'lg' && a.status === 'arrived' && <span className="ca-block-flag"> · In clinic</span>}
        {size !== 'lg' && a.status === 'no_show' && <span className="ca-block-flag ca-flag-danger"> · No-show</span>}
      </span>
      <span className="ca-block-line truncate">{line}</span>
      {size === 'lg' && (
        <span className="ca-block-foot truncate">
          {where}
          {a.status !== 'confirmed' && <span className="ca-block-status"> · {STATUS_LABEL[a.status]}</span>}
        </span>
      )}
    </button>
  )
}
