// Small dropdown menu used by the client record header ("More" actions).
import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../../components/icons'

export interface MenuItem {
  id: string
  label: string
  icon: IconName
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  hint?: string
}

export function Menu({ label, icon = 'more', items, text }: { label: string; icon?: IconName; items: MenuItem[]; text?: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); btn.current?.focus() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const els = Array.from(wrap.current?.querySelectorAll<HTMLButtonElement>('.cr-menu-item:not(:disabled)') ?? [])
        const i = els.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'ArrowDown' ? (i + 1) % els.length : (i - 1 + els.length) % els.length
        els[next]?.focus()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    wrap.current?.querySelector<HTMLButtonElement>('.cr-menu-item:not(:disabled)')?.focus()
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  if (!items.length) return null
  return (
    <div className="cr-menu" ref={wrap}>
      <button ref={btn} type="button" className={`btn btn-secondary btn-md ${text ? '' : 'cr-menu-iconbtn'}`} aria-haspopup="menu" aria-expanded={open} aria-label={text ? undefined : label} title={label} onClick={() => setOpen(o => !o)}>
        <Icon name={icon} size={17} />
        {text && <span>{text}</span>}
      </button>
      {open && (
        <div className="cr-menu-pop" role="menu" aria-label={label}>
          {items.map(it => (
            <button key={it.id} type="button" role="menuitem" className={`cr-menu-item ${it.danger ? 'is-danger' : ''}`} disabled={it.disabled}
              onClick={() => { setOpen(false); it.onSelect() }} title={it.hint}>
              <Icon name={it.icon} size={16} />
              <span className="stack" style={{ gap: 0 }}>
                <span>{it.label}</span>
                {it.hint && <span className="tiny muted">{it.hint}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
