// Week view: seven day columns (Monday first) with compact appointment items.
import { useLayoutEffect, useRef } from 'react'
import type { Appointment, DemoState } from '../../lib/types'
import { ms, useNow } from '../../lib/time'
import { STATUS_LABEL, addDays, apptLine, clientOf, hm, isSameDay, procOf, sessionInfo, weekdayShort } from './helpers'
import { ApptMarks } from './parts'

export function WeekView({ state, from, appts, selectedId, symbol, onOpen, onPickDay }: {
  state: DemoState
  from: number
  appts: Appointment[]
  selectedId?: string | null
  symbol: string
  onOpen: (a: Appointment) => void
  onPickDay: (day: number) => void
}) {
  const now = useNow(60_000)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  const scroller = useRef<HTMLDivElement>(null)
  // On narrow screens, bring today's column into view instead of always opening on Monday.
  useLayoutEffect(() => {
    const el = scroller.current
    const today = el?.querySelector<HTMLElement>('.ca-wday.is-today')
    if (!el) return
    el.scrollLeft = today && el.scrollWidth > el.clientWidth ? Math.max(0, today.offsetLeft - 8) : 0
  }, [from])
  return (
    <div className="ca-week-scroll" ref={scroller} role="region" aria-label="Week overview" tabIndex={0}>
      <div className="ca-week">
        {days.map(d => {
          const list = appts.filter(a => isSameDay(ms(a.start), d)).sort((a, b) => ms(a.start) - ms(b.start))
          const live = list.filter(a => a.status !== 'cancelled')
          const today = isSameDay(d, now)
          const past = d < addDays(now, 0)
          return (
            <section key={d} className={`ca-wday ${today ? 'is-today' : ''} ${past && !today ? 'is-past' : ''}`} aria-label={new Date(d).toDateString()}>
              <button type="button" className="ca-wday-head" onClick={() => onPickDay(d)} aria-label={`Open ${new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} in the day view`}>
                <span className="ca-wday-dow">{weekdayShort(d)}</span>
                <span className="ca-wday-num num">{new Date(d).getDate()}</span>
                <span className="ca-wday-count">{live.length ? `${live.length} booked` : 'Free'}</span>
              </button>
              <div className="ca-wday-list">
                {list.length === 0 && <p className="ca-wday-empty">Nothing booked</p>}
                {list.map(a => {
                  const client = clientOf(state, a)
                  const si = sessionInfo(state, a)
                  const proc = procOf(state, a.procedureId)
                  const short = a.type === 'session' ? `${proc?.name ?? 'Session'}${si ? ` · ${si.no}/${si.total}` : ''}` : a.type === 'consultation' ? `Consult${proc ? ` · ${proc.name}` : ''}` : 'Follow-up'
                  return (
                    <button key={a.id} type="button" className={`ca-witem ca-t-${a.type} ca-s-${a.status} ${a.id === selectedId ? 'is-selected' : ''}`} onClick={() => onOpen(a)}
                      aria-label={`${hm(a.start)}, ${client?.name ?? 'Client'}, ${apptLine(state, a)}, ${STATUS_LABEL[a.status]}. Open details`}>
                      <span className="ca-witem-top">
                        <span className="ca-witem-time num">{hm(a.start)}</span>
                        <ApptMarks a={a} symbol={symbol} />
                      </span>
                      <span className="ca-witem-name truncate">{client?.name ?? 'Unknown client'}</span>
                      <span className="ca-witem-line">{short}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
