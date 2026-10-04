// "Move to…" menu: the keyboard and touch alternative to dragging a card.
// Renders in a portal so the board's scroll containers never clip it; on phones it becomes a bottom sheet.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../components/icons'
import { EXITS, STAGES, EXIT_LABEL, STAGE_LABEL } from '../../lib/types'
import { moveRule, nextStage, type Pos, type PRow } from './model'

interface Props {
  row: PRow
  canOverride: boolean
  onPick: (to: Pos) => void
  className?: string
}

const SHEET_BREAKPOINT = 600

/** True while the trigger is visible: inside the viewport and not clipped by a scrolling column or board. */
function inView(el: HTMLElement, r: DOMRect): boolean {
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2
  if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) return false
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p)
    if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue
    const pr = p.getBoundingClientRect()
    if (cx < pr.left || cx > pr.right || cy < pr.top || cy > pr.bottom) return false
  }
  return true
}

export function MoveMenu({ row, canOverride, onPick, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const pop = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null)
  const name = row.client.name

  const close = useCallback((focusBack = true) => {
    setOpen(false)
    if (focusBack) btn.current?.focus()
  }, [])

  // position next to the trigger (desktop) — phones use a bottom sheet from CSS
  const place = useCallback((): boolean => {
    if (!btn.current) return false
    if (window.innerWidth < SHEET_BREAKPOINT) { setPos(null); return true }
    const r = btn.current.getBoundingClientRect()
    if (!inView(btn.current, r)) return false
    const width = 280
    const margin = 8
    const spaceBelow = window.innerHeight - r.bottom - margin
    const spaceAbove = r.top - margin
    const below = spaceBelow >= 320 || spaceBelow >= spaceAbove
    const maxHeight = Math.max(200, Math.min(520, (below ? spaceBelow : spaceAbove) - 4))
    const left = Math.min(Math.max(margin, r.right - width), window.innerWidth - width - margin)
    const top = below ? r.bottom + 4 : Math.max(margin, r.top - 4 - maxHeight)
    setPos({ top, left, maxHeight })
    return true
  }, [])

  useLayoutEffect(() => {
    if (open && !place()) setOpen(false)
  }, [open, place])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (pop.current?.contains(t) || btn.current?.contains(t)) return
      setOpen(false)
    }
    // the board scrolls (and snaps) under the menu: follow the trigger, and close only once it is out of view
    const onScroll = (e: Event) => {
      if (pop.current && e.target instanceof Node && pop.current.contains(e.target)) return
      if (window.innerWidth >= SHEET_BREAKPOINT && !place()) setOpen(false)
    }
    const onResize = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onResize)
    pop.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [open, place])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(pop.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus() }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close() }
    else if (e.key === 'Tab') { e.preventDefault(); close() }
  }

  const pick = (to: Pos) => {
    close(false)
    onPick(to)
  }

  const next = nextStage(row)
  const item = (to: Pos, label: string, extra?: { primary?: boolean }) => {
    const rule = moveRule(row, to)
    const current = rule.kind === 'same'
    const locked = rule.needsOverride && !canOverride
    const hint = current ? 'Now'
      : rule.kind === 'next' ? 'Moves now'
      : rule.kind === 'skip' ? `Skips ${rule.steps - 1}`
      : rule.kind === 'back' ? 'Back'
      : rule.kind === 'return' ? 'Bring back'
      : 'Reason'
    return (
      <button key={to + (extra?.primary ? '-next' : '')} type="button" role="menuitem" disabled={current}
        className={`pl-menu-item ${extra?.primary ? 'is-primary' : ''} ${current ? 'is-current' : ''}`}
        aria-current={current ? 'step' : undefined}
        title={locked ? 'Needs a manager or owner (override permission)' : undefined}
        onClick={() => pick(to)}>
        <span className="pl-menu-icon" aria-hidden="true">
          {current ? <Icon name="check" size={15} /> : extra?.primary ? <Icon name="arrowRight" size={15} /> : locked ? <Icon name="lock" size={14} /> : null}
        </span>
        <span className="grow truncate">{label}</span>
        <span className={`pl-menu-hint ${locked ? 'is-locked' : rule.needsReason && !current ? 'is-reason' : ''}`}>{locked ? 'Manager' : hint}</span>
      </button>
    )
  }

  // React events bubble through portals, so keep clicks inside the menu from reaching the card underneath
  const panel = open ? (
    <div className="pl-menu-layer" onClick={e => e.stopPropagation()} onDragStart={e => e.stopPropagation()}>
      <div className="pl-menu-scrim" aria-hidden="true" onMouseDown={() => close(false)} />
      <div ref={pop} className="pl-menu" role="menu" aria-label={`Move ${name} to`} onKeyDown={onKey}
        style={pos ? { top: pos.top, left: pos.left, maxHeight: pos.maxHeight } : undefined}>
        <div className="pl-menu-head">
          <span className="strong truncate">Move {name} to…</span>
          <button type="button" className="icon-btn icon-btn-sm" aria-label="Close menu" onClick={() => close()}>
            <Icon name="x" size={16} />
          </button>
        </div>
        {next && (
          <div className="pl-menu-group" role="group" aria-label="Next step">
            <div className="pl-menu-title eyebrow">Next step</div>
            {item(next, STAGE_LABEL[next], { primary: true })}
          </div>
        )}
        <div className="pl-menu-group" role="group" aria-label="Main path">
          <div className="pl-menu-title eyebrow">Main path</div>
          {STAGES.map(st => item(st, STAGE_LABEL[st]))}
        </div>
        <div className="pl-menu-group" role="group" aria-label="Off the path">
          <div className="pl-menu-title eyebrow">Off the path</div>
          {EXITS.map(x => item(x, EXIT_LABEL[x]))}
        </div>
        <p className="pl-menu-foot tiny muted">One step forward moves straight away. Anything else asks for a reason for the audit log.</p>
      </div>
    </div>
  ) : null

  return (
    <>
      <button ref={btn} type="button" className={`icon-btn icon-btn-sm pl-move-btn ${className}`} aria-haspopup="menu" aria-expanded={open}
        aria-label={`Move ${name} to…`} title="Move to…"
        onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
        onKeyDown={e => e.stopPropagation()}>
        <Icon name="more" size={16} />
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  )
}
