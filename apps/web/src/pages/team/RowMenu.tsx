import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Icon, type IconName } from '../../components/icons'

export interface MenuItem { label: string; icon?: IconName; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }

/** A small actions menu anchored to its button. Positioned `fixed` so table scroll containers do not clip it. */
export function RowMenu({ label, items }: { label: string; items: Array<MenuItem | null | false> }) {
  const list = items.filter(Boolean) as MenuItem[]
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 })
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)

  const place = () => {
    if (!btn.current) return false
    const r = btn.current.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight) return false
    const h = list.length * 40 + 12
    const right = Math.max(8, window.innerWidth - r.right)
    setPos(r.bottom + h + 8 > window.innerHeight ? { bottom: window.innerHeight - r.top + 4, right } : { top: r.bottom + 4, right })
    return true
  }

  const toggle = () => {
    if (!open) place()
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    // follow the button while the page scrolls; close once it has left the screen
    const onScroll = (e: Event) => {
      if (menu.current?.contains(e.target as Node)) return
      if (!place()) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btn.current?.focus()
      }
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKey)
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onMenuKey = (e: ReactKeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const btns = Array.from(menu.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length
    btns[next]?.focus()
  }

  return (
    <>
      <button ref={btn} type="button" className="icon-btn icon-btn-sm" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} onClick={toggle}>
        <Icon name="more" size={16} />
      </button>
      {open && (
        <div ref={menu} className="tm-menu" role="menu" aria-label={label} style={{ top: pos.top, bottom: pos.bottom, right: pos.right }} onKeyDown={onMenuKey}>
          {list.map(it => (
            <button key={it.label} type="button" role="menuitem" className={`tm-menu-item ${it.danger ? 'is-danger' : ''}`} disabled={it.disabled} title={it.hint}
              onClick={() => { setOpen(false); it.onSelect() }}>
              {it.icon && <Icon name={it.icon} size={16} />}
              <span className="grow">{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </>
  )
}
