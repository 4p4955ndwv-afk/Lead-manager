// Small popover menu (more actions, saved replies, assign). Keyboard: arrows move, Escape closes.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon, type IconName } from '../../components/icons'

export interface MenuItem {
  id: string
  label: string
  hint?: string
  icon?: IconName
  leading?: ReactNode
  checked?: boolean
  disabled?: boolean
  tone?: 'danger'
  onSelect: () => void
}

export function Menu({ buttonLabel, buttonContent, buttonClass = 'icon-btn icon-btn-md', items, title, align = 'end', placement = 'bottom', width = 260, disabled }: {
  buttonLabel: string
  buttonContent: ReactNode
  buttonClass?: string
  items: Array<MenuItem | 'sep'>
  title?: string
  align?: 'start' | 'end'
  placement?: 'top' | 'bottom'
  width?: number
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    list.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const btns = Array.from(list.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
    const i = btns.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      btns[(i + 1) % btns.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      btns[(i - 1 + btns.length) % btns.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      btns[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      btns[btns.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      btn.current?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="ib-menu" ref={wrap}>
      <button ref={btn} type="button" className={buttonClass} aria-haspopup="menu" aria-expanded={open} aria-label={buttonLabel} title={buttonLabel} disabled={disabled}
        onClick={() => setOpen(o => !o)}>
        {buttonContent}
      </button>
      {open && (
        <div ref={list} className={`ib-menu-pop ib-menu-${align} ib-menu-${placement}`} role="menu" aria-label={title ?? buttonLabel} style={{ width }} onKeyDown={onKey}>
          {title && <div className="ib-menu-title eyebrow">{title}</div>}
          {items.map((it, i) => it === 'sep' ? <hr key={'sep' + i} className="ib-menu-sep" /> : (
            <button key={it.id} type="button" role="menuitem" className={`ib-menu-item ${it.tone === 'danger' ? 'is-danger' : ''}`} disabled={it.disabled}
              onClick={() => { setOpen(false); it.onSelect() }}>
              {it.leading ?? (it.icon ? <Icon name={it.icon} size={16} /> : null)}
              <span className="ib-menu-text">
                <span className="ib-menu-label">{it.label}</span>
                {it.hint && <span className="ib-menu-hint">{it.hint}</span>}
              </span>
              {it.checked && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
