// Clinic calendar: day diary by practitioner or room, week overview and agenda, with booking and day-of actions.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Appointment, User } from '../lib/types'
import { useStore } from '../lib/store'
import { ms, useNow } from '../lib/time'
import { Button, EmptyState, IconButton, PageHeader, Segmented, Toggle } from '../components/ui'
import { Icon } from '../components/icons'
import {
  type CalView, addDays, clientOf, combine, currencySymbol, dateInput, dayMonth, fullDay, mediumDay, hm, isSameDay, parseDateInput, rangeLabel, relativeDay,
  startOfLocalDay, weekStart,
} from './calendar/helpers'
import { DayGrid, type GridColumn } from './calendar/DayGrid'
import { WeekView } from './calendar/WeekView'
import { AgendaView } from './calendar/AgendaView'
import { ApptDrawer } from './calendar/ApptDrawer'
import { BookingModal, type BookingPreset } from './calendar/BookingModal'
import { Legend } from './calendar/parts'
import './calendar.css'

const VIEW_KEY = 'lm-ca-view'
const VIEWS: CalView[] = ['practitioner', 'room', 'week', 'agenda']

function initialView(): CalView {
  try {
    if (window.matchMedia('(max-width: 640px)').matches) return 'agenda'
  } catch {
    /* no matchMedia */
  }
  try {
    const v = localStorage.getItem(VIEW_KEY)
    if (v && (VIEWS as string[]).includes(v)) return v as CalView
  } catch {
    /* storage blocked */
  }
  return 'practitioner'
}
const defaultBranch = (u: User) => (u.branchIds.length === 1 ? u.branchIds[0] : 'all')

export default function Calendar() {
  const { state, me, can, route, actions } = useStore()
  const now = useNow(60_000)
  const canManage = can('appointments.manage')
  const symbol = currencySymbol(state.settings.currency)

  const [view, setViewState] = useState<CalView>(initialView)
  const [day, setDay] = useState(() => startOfLocalDay(Date.now()))
  const [branch, setBranch] = useState<string>(() => defaultBranch(me))
  const [mine, setMine] = useState(me.role === 'clinician')
  const [showCancelled, setShowCancelled] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [booking, setBooking] = useState<BookingPreset | null>(null)

  const setView = (v: CalView) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* ignore */
    }
  }

  // Switching person (demo role switcher) resets the diary defaults for that person.
  const lastMe = useRef(me.id)
  useEffect(() => {
    if (lastMe.current === me.id) return
    lastMe.current = me.id
    setMine(me.role === 'clinician')
    setBranch(defaultBranch(me))
  }, [me])

  // #calendar~<appointmentId> opens that appointment on its day.
  useEffect(() => {
    if (route.page !== 'calendar' || !route.id) return
    const a = state.appointments.find(x => x.id === route.id)
    if (!a) {
      actions.toast('That appointment could not be found. It may have been removed.', 'warn')
      return
    }
    setDay(startOfLocalDay(ms(a.start)))
    setBranch(b => (b !== 'all' && b !== a.branchId ? 'all' : b))
    setMine(m => (m && a.practitionerId !== me.id ? false : m))
    if (a.status === 'cancelled') setShowCancelled(true)
    setOpenId(a.id)
    // only when the route changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  useEffect(() => {
    if (!flashId) return
    const t = setTimeout(() => setFlashId(null), 4000)
    return () => clearTimeout(t)
  }, [flashId])

  // ---- range -------------------------------------------------------------------------------------
  const isDayView = view === 'practitioner' || view === 'room'
  const from = view === 'week' ? weekStart(day) : day
  const to = isDayView ? addDays(day, 1) : addDays(from, 7)
  const step = isDayView ? 1 : 7
  const todayStart = startOfLocalDay(now)
  const coversToday = todayStart >= from && todayStart < to
  const atToday = isDayView ? day === todayStart : view === 'week' ? coversToday : day === todayStart

  const label = isDayView ? fullDay(day) : rangeLabel(from, to)
  const shortLabel = isDayView ? mediumDay(day) : `${dayMonth(from)} – ${dayMonth(addDays(to, -1))}`
  const rel = isDayView ? relativeDay(day, now) : coversToday ? (view === 'week' ? 'This week' : 'Next 7 days') : null

  const branchName = branch === 'all' ? 'All branches' : state.branches.find(b => b.id === branch)?.name ?? 'Branch'

  const visible = useMemo(() => state.appointments.filter(a => {
    const t = ms(a.start)
    if (t < from || t >= to) return false
    if (branch !== 'all' && a.branchId !== branch) return false
    if (mine && a.practitionerId !== me.id) return false
    if (!showCancelled && a.status === 'cancelled') return false
    return true
  }), [state.appointments, from, to, branch, mine, me.id, showCancelled])

  const live = visible.filter(a => a.status !== 'cancelled')
  const counts = {
    booked: live.length,
    unconfirmed: live.filter(a => a.status === 'unconfirmed').length,
    deposits: live.filter(a => a.deposit === 'due' && a.status !== 'no_show').length,
    arrived: live.filter(a => a.status === 'arrived').length,
    noShows: live.filter(a => a.status === 'no_show').length,
    completed: live.filter(a => a.status === 'completed').length,
  }
  const nextUp = coversToday
    ? live.filter(a => isSameDay(ms(a.start), now) && ms(a.start) > now && (a.status === 'confirmed' || a.status === 'unconfirmed')).sort((a, b) => ms(a.start) - ms(b.start))[0]
    : undefined

  // ---- columns -----------------------------------------------------------------------------------
  const columns = useMemo<GridColumn[]>(() => {
    if (view === 'practitioner') {
      let users = state.users.filter(u => u.role === 'clinician' && u.status === 'active' && (branch === 'all' || u.branchIds.includes(branch)))
      if (mine) users = users.filter(u => u.id === me.id)
      const extra = Array.from(new Set(visible.map(a => a.practitionerId))).filter(id => !users.some(u => u.id === id))
      users = [...users, ...state.users.filter(u => extra.includes(u.id))]
      if (mine && !users.length) users = [me]
      return users.map(u => ({ id: u.id, title: u.name, userId: u.id }))
    }
    if (view === 'room') {
      return state.rooms
        .filter(r => branch === 'all' || r.branchId === branch)
        .map(r => ({ id: r.id, title: r.name, sub: branch === 'all' ? state.branches.find(b => b.id === r.branchId)?.name : undefined }))
    }
    return []
  }, [view, state.users, state.rooms, state.branches, branch, mine, me, visible])

  // ---- handlers ----------------------------------------------------------------------------------
  const openAppt = (a: Appointment) => setOpenId(a.id)
  const closeDrawer = () => {
    setOpenId(null)
    if (route.id) {
      try {
        history.replaceState(null, '', '#calendar')
      } catch {
        /* sandboxed */
      }
    }
  }
  const pickDay = (d: number) => {
    setDay(d)
    setView('practitioner')
  }
  const startBooking = (preset: BookingPreset) => {
    setOpenId(null)
    setBooking(preset)
  }
  const askClaude = () => {
    const who = mine ? 'my diary' : `the ${branchName === 'All branches' ? 'clinic' : branchName} calendar`
    const prompt = isDayView
      ? `Look at ${who} for ${label}. Who still needs to confirm, which deposits are due, are there any double bookings, and where are the free slots?`
      : `Summarise ${who} for ${label}: busiest days, unconfirmed appointments, deposits due and free time for new consultations.`
    window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt } }))
  }

  const selectedId = openId ?? flashId
  const emptyHint = canManage ? (isDayView ? 'Click a free half hour in the grid, or use New booking.' : 'Use New booking to add one.') : 'Bookings made by the front desk and coordinators appear here.'
  const unit = isDayView ? 'day' : 'week'

  return (
    <div className="page ca-page">
      <PageHeader
        title="Calendar"
        subtitle={mine ? `Your diary · ${branchName}` : `${branchName} · consultations, treatment sessions and follow-ups`}
        actions={<>
          <Button variant="ghost" icon="sparkles" onClick={askClaude}>Ask Claude</Button>
          {canManage && <Button variant="primary" icon="plus" onClick={() => startBooking({ start: isDayView && day !== todayStart ? combine(day, '10:00') : undefined })}>New booking</Button>}
        </>}
      />

      <div className="ca-toolbar">
        <div className="ca-datenav">
          <div className="ca-datenav-btns">
            <IconButton icon="chevronLeft" label={`Previous ${unit}`} onClick={() => setDay(d => addDays(d, -step))} />
            <Button size="sm" variant="secondary" onClick={() => setDay(todayStart)} disabled={atToday}>Today</Button>
            <IconButton icon="chevronRight" label={`Next ${unit}`} onClick={() => setDay(d => addDays(d, step))} />
          </div>
          <div className="ca-date-text">
            <h2 className="ca-date-label" aria-live="polite">
              <span className="ca-date-long">{label}</span>
              <span className="ca-date-short" aria-hidden="true">{shortLabel}</span>
            </h2>
            {rel && <span className={`ca-rel ${rel === 'Today' || rel === 'This week' || rel === 'Next 7 days' ? 'is-today' : ''}`}>{rel}</span>}
          </div>
          <label className="ca-date-pick" title="Go to a date">
            <Icon name="calendar" size={16} />
            <span className="sr-only">Go to date</span>
            <input type="date" value={dateInput(day)}
              onClick={e => { try { e.currentTarget.showPicker?.() } catch { /* not supported */ } }}
              onChange={e => { const t = parseDateInput(e.target.value); if (t != null) setDay(t) }} />
          </label>
        </div>

        <div className="ca-filters">
          <div className="ca-seg-wrap">
            <Segmented<CalView> label="Calendar view" value={view} onChange={setView} options={[
              { id: 'practitioner', label: 'By practitioner' },
              { id: 'room', label: 'By room' },
              { id: 'week', label: 'Week' },
              { id: 'agenda', label: 'Agenda' },
            ]} />
          </div>
          <div className="ca-filter-row">
            <label className="ca-branch">
              <span className="sr-only">Branch</span>
              <Icon name="pin" size={15} />
              <select className="input" value={branch} onChange={e => setBranch(e.target.value)} aria-label="Branch">
                <option value="all">All branches</option>
                {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </label>
            {me.role === 'clinician' && <Toggle checked={mine} onChange={v => { setMine(v); actions.toast(v ? 'Showing only your appointments.' : 'Showing every practitioner.', 'info') }} label="My diary" />}
            <label className="checkbox ca-check">
              <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
              Show cancelled
            </label>
          </div>
        </div>
      </div>

      <div className="ca-summary" aria-label="Summary">
        {nextUp && (() => {
          const c = clientOf(state, nextUp)
          return (
            <button type="button" className="ca-sum ca-sum-next" onClick={() => setOpenId(nextUp.id)}>
              <span className="ca-sum-label">Next up</span>
              <span className="ca-sum-value ca-sum-text truncate">{hm(nextUp.start)} · {c?.name ?? 'Client'}</span>
              <span className="ca-sum-hint truncate">{state.users.find(u => u.id === nextUp.practitionerId)?.name ?? ''}</span>
            </button>
          )
        })()}
        <div className="ca-sum">
          <span className="ca-sum-label">Booked</span>
          <span className="ca-sum-value num">{counts.booked}</span>
          <span className="ca-sum-hint">{isDayView ? (rel ?? 'this day').toLowerCase() : rel ? rel.toLowerCase() : view === 'week' ? 'Monday to Sunday' : 'over 7 days'}</span>
        </div>
        <div className={`ca-sum ${counts.unconfirmed ? 'is-warn' : ''}`}>
          <span className="ca-sum-label">To confirm</span>
          <span className="ca-sum-value num">{counts.unconfirmed}</span>
          <span className="ca-sum-hint">{counts.unconfirmed ? 'send a reminder' : 'all confirmed'}</span>
        </div>
        <div className={`ca-sum ${counts.deposits ? 'is-warn' : ''}`}>
          <span className="ca-sum-label">Deposits due</span>
          <span className="ca-sum-value num">{counts.deposits}</span>
          <span className="ca-sum-hint">{counts.deposits ? 'take before treatment' : 'none outstanding'}</span>
        </div>
        {coversToday && (
          <div className={`ca-sum ${counts.arrived ? 'is-accent' : ''}`}>
            <span className="ca-sum-label">In clinic</span>
            <span className="ca-sum-value num">{counts.arrived}</span>
            <span className="ca-sum-hint">{counts.completed} completed</span>
          </div>
        )}
        {counts.noShows > 0 && (
          <div className="ca-sum is-danger">
            <span className="ca-sum-label">No-shows</span>
            <span className="ca-sum-value num">{counts.noShows}</span>
            <span className="ca-sum-hint">rebook task created</span>
          </div>
        )}
      </div>

      {isDayView && live.length === 0 && (
        <p className="ca-empty-day small">
          <Icon name="calendar" size={15} />
          {mine ? 'Nothing in your diary' : 'Nothing booked'} {rel ? rel.toLowerCase() : `on ${label}`}{branch !== 'all' ? ` at ${branchName}` : ''}. {emptyHint}
        </p>
      )}

      {isDayView && (
        columns.length ? (
          <DayGrid state={state} day={day} mode={view === 'room' ? 'room' : 'practitioner'} columns={columns} appts={visible} selectedId={selectedId} symbol={symbol}
            onOpen={openAppt}
            onSlot={canManage ? (startMin, colId) => startBooking({
              start: combine(day, `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`),
              practitionerId: view === 'practitioner' ? colId : undefined,
              roomId: view === 'room' ? colId : undefined,
            }) : undefined} />
        ) : (
          <div className="card"><EmptyState icon="users" title={view === 'room' ? 'No rooms at this branch' : 'No practitioners at this branch'} body="Rooms and practitioners are set up in Settings and Team. Pick another branch to see its diary." /></div>
        )
      )}

      {view === 'week' && <WeekView state={state} from={from} appts={visible} selectedId={selectedId} symbol={symbol} onOpen={openAppt} onPickDay={pickDay} />}

      {view === 'agenda' && (
        visible.length ? (
          <AgendaView state={state} from={from} days={7} appts={visible} selectedId={selectedId} symbol={symbol} onOpen={openAppt} onPickDay={pickDay} />
        ) : (
          <div className="card">
            <EmptyState icon="calendar" title={mine ? 'Your diary is clear for these 7 days' : 'Nothing booked for these 7 days'}
              body={`${label}${branch !== 'all' ? ` at ${branchName}` : ''}. Consultations booked on calls, plan sessions and follow-ups appear here. ${emptyHint}`}
              action={<Button size="sm" variant="secondary" iconRight="chevronRight" onClick={() => setDay(d => addDays(d, 7))}>Next 7 days</Button>} />
          </div>
        )
      )}

      <Legend symbol={symbol} />

      <ApptDrawer appointmentId={openId} onClose={closeDrawer} onBook={startBooking} />
      {booking && (
        <BookingModal open preset={booking} onClose={() => setBooking(null)}
          onBooked={(id, start, where) => {
            setDay(startOfLocalDay(start))
            if (branch !== 'all' && branch !== where.branchId) setBranch('all')
            if (mine && where.practitionerId !== me.id) setMine(false)
            setFlashId(id)
          }} />
      )}
    </div>
  )
}
