// Pipeline: every client's current journey, from first DM to alumni, as a board or a sortable list.
import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useStore } from '../lib/store'
import { can as userCan } from '../lib/permissions'
import type { Channel, Exit } from '../lib/types'
import { EXITS, EXIT_LABEL, ROLE_LABEL, STAGES, STAGE_LABEL } from '../lib/types'
import { money, ms, useNow } from '../lib/time'
import { Button, Chip, Modal, PageHeader, ReasonDialog, Segmented, Stat, EmptyState } from '../components/ui'
import { Icon } from '../components/icons'
import { Board, type DragApi } from './pipeline/Board'
import { ExitLane } from './pipeline/ExitLane'
import { ListView } from './pipeline/ListView'
import { FilterBar } from './pipeline/Filters'
import {
  EXIT_HELP, NO_FILTERS, activeFilterCount, applyFilters, buildRows, isExit, isStage, moveRule, nextStage, posLabel, summarise,
  type Filters, type Pos, type PRow, type Sort,
} from './pipeline/model'
import './pipeline.css'

type View = 'board' | 'list'
interface Prefs { view: View; filters: Filters; sort: Sort; exitTab: Exit }

const PREFS_KEY = 'lm-pipeline-prefs'
const DEFAULT_PREFS: Prefs = { view: 'board', filters: NO_FILTERS, sort: { key: 'changed', dir: 'desc' }, exitTab: 'nurture' }
const DRAG_TYPE = 'application/x-lm-episode'

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const p = JSON.parse(raw) as Partial<Prefs>
    return {
      view: p.view === 'list' ? 'list' : 'board',
      filters: { ...NO_FILTERS, ...(p.filters ?? {}) },
      sort: p.sort?.key ? p.sort : DEFAULT_PREFS.sort,
      exitTab: p.exitTab && (EXITS as string[]).includes(p.exitTab) ? p.exitTab : 'nurture',
    }
  } catch {
    return DEFAULT_PREFS
  }
}

interface Pending { row: PRow; to: Pos }
interface Undo { token: number; epId: string; clientId: string; name: string; from: Pos; to: Pos; noAppt: boolean }

export default function Pipeline() {
  const { state, me, can, actions } = useStore()
  const now = useNow(15_000)
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs)
  const [dragId, setDragId] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [blocked, setBlocked] = useState<Pending | null>(null)
  const [undo, setUndo] = useState<Undo | null>(null)
  const undoSeq = useRef(0)

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)) } catch { /* per-viewer convenience only */ }
  }, [prefs])

  const canMove = can('pipeline.move')
  const canOverride = can('pipeline.override')
  const showMoney = can('payments.view') || can('analytics.revenue')
  const currency = state.settings.currency
  const fmtMoney = (n: number) => money(n, currency)
  const fmtCompact = (n: number) => {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n) } catch { return money(n, currency) }
  }

  const allRows = useMemo(() => buildRows(state, now), [state, now])
  const rows = useMemo(() => applyFilters(allRows, prefs.filters, me.id, can('clients.view_phone')), [allRows, prefs.filters, me.id, can])
  const sum = useMemo(() => summarise(state, rows, now), [state, rows, now])
  const filtered = activeFilterCount(prefs.filters) > 0
  const dragRow = dragId ? allRows.find(r => r.ep.id === dragId) : undefined

  const ownerIds = useMemo(() => {
    const ids = new Set<string>()
    state.users.filter(u => u.role === 'coordinator' && u.status !== 'suspended').forEach(u => ids.add(u.id))
    state.clients.forEach(c => c.ownerId && ids.add(c.ownerId))
    return [...ids]
  }, [state.users, state.clients])
  const channels = useMemo(() => [...new Set(state.clients.map(c => c.source.channel))] as Channel[], [state.clients])
  const overriders = state.users.filter(u => u.status === 'active' && userCan(u, 'pipeline.override'))

  // ---- undo bar ---------------------------------------------------------------------------------
  useEffect(() => {
    if (!undo) return
    const t = setTimeout(() => setUndo(u => (u?.token === undo.token ? null : u)), 9000)
    return () => clearTimeout(t)
  }, [undo])

  const doUndo = () => {
    if (!undo) return
    const ep = state.episodes.find(e => e.id === undo.epId)
    setUndo(null)
    if (!ep || (ep.exit ?? ep.stage) !== undo.to) {
      actions.toast(`${undo.name} has moved again since, so there is nothing to undo.`, 'warn')
      return
    }
    actions.moveStage(undo.epId, undo.from, { reason: 'Undo' })
    actions.toast(`${undo.name} is back in ${posLabel(undo.from)}.`, 'info')
  }

  useEffect(() => {
    if (!undo) return
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); doUndo() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  // ---- moving -------------------------------------------------------------------------------------
  const perform = (row: PRow, to: Pos, reason?: string) => {
    const rule = moveRule(row, to)
    const name = row.client.name
    actions.moveStage(row.ep.id, to, { reason, override: rule.needsOverride || undefined })
    if (to === 'dnc') {
      actions.update(d => {
        const c = d.clients.find(x => x.id === row.client.id)
        if (c) c.doNotContact = true
      })
    }
    if (rule.kind === 'return' && row.pos === 'dnc' && row.client.doNotContact) {
      actions.update(d => {
        const c = d.clients.find(x => x.id === row.client.id)
        if (c) c.doNotContact = false
      })
      actions.audit({ action: 'client.dnc_cleared', target: { type: 'client', id: row.client.id, label: name }, detail: 'Do-not-contact switched off when brought back to the pipeline', reason })
    }

    if (rule.kind === 'next') {
      undoSeq.current += 1
      const noAppt = to === 'booked' && !state.appointments.some(a => a.clientId === row.client.id && ms(a.start) > now && a.status !== 'cancelled')
      setUndo({ token: undoSeq.current, epId: row.ep.id, clientId: row.client.id, name, from: row.pos, to, noAppt })
    } else if (rule.kind === 'skip' || rule.kind === 'back') {
      actions.toast(`${name} moved to ${posLabel(to)}. Your reason is in the audit log.`, 'success')
    } else if (rule.kind === 'exit') {
      actions.toast(`${name} moved to ${EXIT_LABEL[to as Exit]}.`, 'info')
    } else if (rule.kind === 'return') {
      actions.toast(`${name} is back in ${posLabel(to)}.`, 'success')
    }
  }

  const requestMove = (row: PRow, to: Pos) => {
    if (!canMove) {
      actions.toast('Your role can see the pipeline but not move people. Ask a coordinator or manager.', 'warn')
      return
    }
    const rule = moveRule(row, to)
    if (rule.kind === 'same') return
    if (rule.needsOverride && !canOverride) { setBlocked({ row, to }); return }
    if (!rule.needsReason) { perform(row, to); return }
    setPending({ row, to })
  }

  const askManager = (p: Pending) => {
    const name = p.row.client.name
    actions.notify({ userIds: overriders.filter(u => u.id !== me.id).map(u => u.id) }, {
      kind: 'system',
      title: `Stage change requested · ${name}`,
      body: `${me.name} asks to move ${name} from ${posLabel(p.row.pos)} to ${posLabel(p.to)}.`,
      link: { page: 'client', id: p.row.client.id },
    })
    actions.audit({ action: 'stage.override_requested', target: { type: 'episode', id: p.row.ep.id, label: name }, detail: `${p.row.pos} → ${p.to} requested` })
    actions.toast(`Request sent to ${overriders.filter(u => u.id !== me.id).map(u => u.name.split(' ')[0]).join(' and ') || 'a manager'}.`, 'success')
    setBlocked(null)
  }

  const drag: DragApi = {
    dragRow,
    start: (row: PRow, e: DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData(DRAG_TYPE, row.ep.id)
      setDragId(row.ep.id)
      setUndo(null)
    },
    end: () => setDragId(null),
    drop: (to: Pos, e: DragEvent<HTMLElement>) => {
      const id = dragId ?? e.dataTransfer.getData(DRAG_TYPE)
      setDragId(null)
      const row = allRows.find(r => r.ep.id === id)
      if (row) requestMove(row, to)
    },
  }

  const open = (row: PRow) => actions.go('client', row.client.id)
  const setFilters = (filters: Filters) => setPrefs(p => ({ ...p, filters }))

  // ---- summary --------------------------------------------------------------------------------------
  const worst = sum.breaches[0]
  const worstClient = worst ? state.clients.find(c => c.id === worst.clientId) : undefined
  const pct = sum.conversion === null ? '—' : `${Math.round(sum.conversion * 100)}%`

  return (
    <div className="page pl-page">
      <PageHeader
        title="Pipeline"
        subtitle={canMove
          ? "Every client's journey from first DM to alumni. Drag a card or use its menu to move someone along."
          : "Every client's journey from first DM to alumni. You can view it; coordinators and managers move people along."}
        actions={<>
          {!canMove && <Chip tone="neutral" icon="eye" title="Your role can see the pipeline but not move people">View only</Chip>}
          <Segmented label="Layout" value={prefs.view} onChange={view => setPrefs(p => ({ ...p, view }))}
            options={[{ id: 'board', label: 'Board', icon: 'board' }, { id: 'list', label: 'List', icon: 'menu' }]} />
          <Button variant="ghost" icon="sparkles" onClick={() => window.dispatchEvent(new CustomEvent('lm:open-claude', {
            detail: { prompt: 'Look at the pipeline. Which leads are most at risk of going cold this week, and who should contact them first?' },
          }))}>Ask Claude</Button>
        </>}
      />

      <div className="pl-summary" aria-label="Pipeline summary">
        <Stat label="On the path" icon="users" value={sum.onPath}
          hint={`${sum.alumni} alumni · ${sum.off} off the path`} />
        {showMoney && (
          <Stat label="Expected value" icon="card" value={fmtMoney(sum.value)}
            hint={`Across ${sum.onPath} active ${sum.onPath === 1 ? 'journey' : 'journeys'}`} />
        )}
        <Stat label="Contact to booked, 30 days" icon="chart" value={pct}
          tone={sum.conversion !== null && sum.conversion >= 0.5 ? 'ok' : undefined}
          hint={sum.contacts30 ? `${sum.booked30} of ${sum.contacts30} new contacts booked` : 'No new contacts in 30 days'} />
        <Stat label="SLA breaches now" icon="alert" value={sum.breaches.length} tone={sum.breaches.length ? 'danger' : 'ok'}
          hint={worst && worstClient ? (
            <span className="pl-stat-hint">
              <span className="truncate">{worstClient.name}{sum.breaches.length > 1 ? ` +${sum.breaches.length - 1}` : ''}, {Math.max(1, Math.round((now - ms(worst.dueAt)) / 60_000))} min late</span>
              {!prefs.filters.overdue && <button type="button" className="pl-link" onClick={() => setFilters({ ...prefs.filters, overdue: true })}>Show</button>}
            </span>
          ) : 'Every new lead called on time'} />
      </div>

      <FilterBar filters={prefs.filters} onChange={setFilters} ownerIds={ownerIds} channels={channels} shown={rows.length} total={allRows.length} />

      {filtered && rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="filter"
            title={prefs.filters.owner === 'me' && activeFilterCount(prefs.filters) === 1 ? 'No clients are assigned to you yet' : 'No one matches these filters'}
            body={prefs.filters.owner === 'me' && activeFilterCount(prefs.filters) === 1
              ? 'Clients become yours when a lead is handed to you or you take their call. Switch to All owners to see the whole pipeline.'
              : 'Try a different owner, channel or procedure, or clear the filters to see the whole pipeline.'}
            action={<Button variant="secondary" icon="x" onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>} />
        </div>
      ) : prefs.view === 'board' ? (
        <>
          <Board rows={rows} now={now} showMoney={showMoney} fmtMoney={fmtCompact} canMove={canMove} canOverride={canOverride}
            drag={drag} onOpen={open} onMove={requestMove} />
          <ExitLane rows={rows} tab={prefs.exitTab} onTab={exitTab => setPrefs(p => ({ ...p, exitTab }))} now={now}
            canMove={canMove} canOverride={canOverride} drag={drag} onOpen={open} onMove={requestMove} />
        </>
      ) : (
        <ListView rows={rows} sort={prefs.sort} onSort={sort => setPrefs(p => ({ ...p, sort }))} now={now} showMoney={showMoney} fmtMoney={fmtMoney}
          canMove={canMove} canOverride={canOverride} onOpen={open} onMove={requestMove} />
      )}

      {/* reason for skips, moves back, exits and bring-backs */}
      {pending && (() => {
        const copy = dialogCopy(pending)
        return (
          <ReasonDialog open title={copy.title} body={copy.body} confirmLabel={copy.confirm} tone={copy.tone}
            reasonLabel={copy.reasonLabel} placeholder={copy.placeholder}
            onConfirm={reason => perform(pending.row, pending.to, reason)} onClose={() => setPending(null)} />
        )
      })()}

      {/* explains who can override, offers the allowed alternative */}
      {blocked && (() => {
        const rule = moveRule(blocked.row, blocked.to)
        const next = nextStage(blocked.row)
        const oneStep = rule.kind === 'skip' && next
        const names = overriders.map(u => `${u.name} (${ROLE_LABEL[u.role]})`)
        return (
          <Modal open title={blockedTitle(blocked)} onClose={() => setBlocked(null)} width={480}
            footer={<>
              <Button variant="ghost" onClick={() => setBlocked(null)}>Close</Button>
              {oneStep && next && (
                <Button variant="secondary" icon="arrowRight" onClick={() => { const b = blocked; setBlocked(null); perform(b.row, next) }}>
                  Move to {STAGE_LABEL[next]} instead
                </Button>
              )}
              <Button variant="primary" icon="send" onClick={() => askManager(blocked)}>Ask a manager to do it</Button>
            </>}>
            <div className="stack lg">
              <p className="muted">
                {rule.kind === 'return'
                  ? `Bringing someone back from ${posLabel(blocked.row.pos)}${blocked.to !== blocked.row.ep.stage ? ' to a different stage' : ''} is an override.`
                  : rule.kind === 'exit'
                    ? `Moving someone out of ${posLabel(blocked.row.pos)} is an override.`
                    : rule.kind === 'skip' ? 'Skipping stages is an override.' : 'Moving someone back along the path is an override.'}
                {' '}Overrides need the “Override stages and SLAs” permission, which your role ({ROLE_LABEL[me.role]}) does not have.
              </p>
              <div className="stack" style={{ gap: 6 }}>
                <span className="eyebrow">Who can do this</span>
                <ul className="pl-who">
                  {names.map(n => <li key={n} className="small"><Icon name="shield" size={14} className="pl-inline-icon" /> {n}</li>)}
                </ul>
              </div>
              <p className="small muted">Asking sends them a notification with a link to {blocked.row.client.name}'s record.</p>
            </div>
          </Modal>
        )
      })()}

      {undo && (
        <div className="pl-undo" role="status">
          <Icon name="check" size={16} />
          <span className="grow small">
            <strong>{undo.name}</strong> moved to {posLabel(undo.to)}.
            {undo.noAppt && <span className="pl-undo-note"> No appointment is in the calendar yet.</span>}
          </span>
          {undo.noAppt && <button type="button" className="pl-undo-btn" onClick={() => { setUndo(null); actions.go('client', undo.clientId) }}>Open record</button>}
          <button type="button" className="pl-undo-btn" onClick={doUndo}>Undo</button>
          <button type="button" className="pl-undo-close" aria-label="Dismiss" onClick={() => setUndo(null)}><Icon name="x" size={15} /></button>
        </div>
      )}
    </div>
  )
}

// ---- copy ---------------------------------------------------------------------------------------------

function blockedTitle({ row, to }: Pending): string {
  const rule = moveRule(row, to)
  if (rule.kind === 'return') return `Only a manager can bring ${row.client.name} back`
  if (rule.kind === 'skip') return 'Only a manager can skip stages'
  if (rule.kind === 'back') return 'Only a manager can move people back'
  return `Only a manager can move ${row.client.name} out of ${posLabel(row.pos)}`
}

function dialogCopy({ row, to }: Pending): { title: string; body: ReactNode; confirm: string; tone: 'primary' | 'danger'; reasonLabel: string; placeholder: string } {
  const name = row.client.name
  const rule = moveRule(row, to)
  const from = posLabel(row.pos)
  const audit = 'Reason (saved in the audit log)'
  if (rule.kind === 'skip' && isStage(row.pos) && isStage(to)) {
    const skipped = STAGES.slice(STAGES.indexOf(row.pos) + 1, STAGES.indexOf(to)).map(s => STAGE_LABEL[s])
    return {
      title: `Skip ${name} ahead to ${STAGE_LABEL[to]}?`,
      body: <>{name} is in <strong>{from}</strong>. This skips {skipped.join(', ')}. Skipping is an override, so your reason goes in the audit log.</>,
      confirm: `Skip to ${STAGE_LABEL[to]}`, tone: 'primary', reasonLabel: audit, placeholder: 'e.g. Booked by phone before the call task was created',
    }
  }
  if (rule.kind === 'back') {
    return {
      title: `Move ${name} back to ${posLabel(to)}?`,
      body: <>{name} is in <strong>{from}</strong>. Moving back is an override, so your reason goes in the audit log.</>,
      confirm: 'Move back', tone: 'primary', reasonLabel: audit, placeholder: 'e.g. Consultation was cancelled and needs rebooking',
    }
  }
  if (rule.kind === 'return') {
    const extra: Partial<Record<Exit, string>> = {
      dnc: 'Only do this if they asked to hear from us again. Their do-not-contact flag will be switched off.',
      under18: 'Only do this once you have seen ID showing they are 18 or over.',
      spam: 'Only do this if the account turned out to be a real person.',
      not_suitable: 'Only do this if a clinician has reviewed them again.',
    }
    return {
      title: `Bring ${name} back to ${posLabel(to)}?`,
      body: <>
        {name} is in <strong>{from}</strong>{row.ep.exitReason ? <> (“{row.ep.exitReason}”)</> : null}.
        {isExit(row.pos) && extra[row.pos] ? <> {extra[row.pos]}</> : null}
        {to !== row.ep.stage ? <> They left at {STAGE_LABEL[row.ep.stage]}, so this is also an override.</> : null}
      </>,
      confirm: 'Bring back', tone: 'primary', reasonLabel: audit, placeholder: 'e.g. Messaged again asking to book for October',
    }
  }
  const x = to as Exit
  return {
    title: `Move ${name} to ${EXIT_LABEL[x]}?`,
    body: <>{EXIT_HELP[x].what}{x === 'dnc' ? ' Their do-not-contact flag will be switched on.' : ''}</>,
    confirm: `Move to ${EXIT_LABEL[x]}`,
    tone: x === 'dnc' || x === 'spam' ? 'danger' : 'primary',
    reasonLabel: 'Reason (shown on their card and saved in the audit log)',
    placeholder: EXIT_HELP[x].placeholder,
  }
}
