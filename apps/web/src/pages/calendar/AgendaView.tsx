// Agenda: appointments grouped by day as a list. The default on phones.
import type { Appointment, DemoState } from '../../lib/types'
import { ms, useNow } from '../../lib/time'
import { UserAvatar } from '../../components/ui'
import { STATUS_LABEL, addDays, apptLine, apptMinutes, clientOf, durationLabel, fullDay, hm, isSameDay, mediumDay, relativeDay } from './helpers'
import { ApptMarks, StatusChip } from './parts'

export function AgendaView({ state, from, days, appts, selectedId, symbol, onOpen, onPickDay }: {
  state: DemoState
  from: number
  days: number
  appts: Appointment[]
  selectedId?: string | null
  symbol: string
  onOpen: (a: Appointment) => void
  onPickDay: (day: number) => void
}) {
  const now = useNow(60_000)
  const list = Array.from({ length: days }, (_, i) => addDays(from, i))
  return (
    <div className="ca-agenda">
      {list.map(d => {
        const items = appts.filter(a => isSameDay(ms(a.start), d)).sort((a, b) => ms(a.start) - ms(b.start))
        const rel = relativeDay(d, now)
        const label = fullDay(d)
        if (!items.length) {
          return (
            <div key={d} className="ca-agenda-empty">
              <button type="button" className="ca-agenda-daylink" onClick={() => onPickDay(d)}>{rel ? `${rel} · ` : ''}{label}</button>
              <span className="faint small">Nothing booked</span>
            </div>
          )
        }
        const live = items.filter(a => a.status !== 'cancelled')
        return (
          <section key={d} className="ca-agenda-day" aria-label={label}>
            <header className="ca-agenda-head">
              <button type="button" className="ca-agenda-daylink" onClick={() => onPickDay(d)} aria-label={`Open ${label} in the day view`}>
                {rel && <span className="ca-agenda-rel">{rel}</span>}
                <span className="ca-date-long">{label}</span>
                <span className="ca-date-short" aria-hidden="true">{mediumDay(d)}</span>
              </button>
              <span className="muted small num ca-nowrap">{live.length} booked</span>
            </header>
            <ul className="ca-agenda-list">
              {items.map(a => {
                const client = clientOf(state, a)
                const room = state.rooms.find(r => r.id === a.roomId)
                const prac = state.users.find(u => u.id === a.practitionerId)
                return (
                  <li key={a.id}>
                    <button type="button" className={`ca-arow ca-t-${a.type} ca-s-${a.status} ${a.id === selectedId ? 'is-selected' : ''}`} onClick={() => onOpen(a)}
                      aria-label={`${hm(a.start)} to ${hm(a.end)}, ${client?.name ?? 'Client'}, ${apptLine(state, a)}, ${STATUS_LABEL[a.status]}. Open details`}>
                      <span className="ca-arow-time num">
                        <span className="strong">{hm(a.start)}</span>
                        <span className="faint tiny">{durationLabel(apptMinutes(a))}</span>
                      </span>
                      <span className="ca-arow-bar" aria-hidden="true" />
                      <span className="ca-arow-main">
                        <span className="ca-arow-name-row">
                          <span className="ca-arow-name truncate">{client?.name ?? 'Unknown client'}</span>
                          <ApptMarks a={a} symbol={symbol} />
                        </span>
                        <span className="ca-arow-line truncate">{apptLine(state, a)}</span>
                        <span className="ca-arow-meta">
                          <UserAvatar userId={a.practitionerId} size={18} />
                          <span className="truncate">{prac?.name ?? 'Unassigned'} · {room?.name ?? 'No room'}</span>
                        </span>
                      </span>
                      <span className="ca-arow-status"><StatusChip status={a.status} /></span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
