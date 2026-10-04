// Shared UI kit. Pages compose these; page-specific styling lives in each page's own CSS file.
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import type { Channel, Exit, Stage } from '../lib/types'
import { CHANNEL_LABEL, EXIT_LABEL, STAGE_LABEL } from '../lib/types'
import { countdown, useNow } from '../lib/time'
import { useStore } from '../lib/store'

export type Tone = 'neutral' | 'accent' | 'team' | 'ok' | 'warn' | 'danger' | 'info' | 'ig' | 'tt'

// ---- buttons -----------------------------------------------------------------------------------

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle'
  size?: 'sm' | 'md'
  icon?: IconName
  iconRight?: IconName
  loading?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, iconRight, loading, className = '', children, disabled, ...rest }: BtnProps) {
  return (
    <button type="button" className={`btn btn-${variant} btn-${size} ${className}`} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={size === 'sm' ? 15 : 17} /> : null}
      {children != null && <span>{children}</span>}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 15 : 17} />}
    </button>
  )
}

export function IconButton({ icon, label, size = 'md', tone, className = '', badge, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; size?: 'sm' | 'md'; tone?: 'danger' | 'accent'; badge?: number }) {
  return (
    <button type="button" className={`icon-btn icon-btn-${size} ${tone ? 'icon-btn-' + tone : ''} ${className}`} aria-label={label} title={label} {...rest}>
      <Icon name={icon} size={size === 'sm' ? 16 : 19} />
      {badge ? <span className="icon-btn-badge num">{badge > 99 ? '99+' : badge}</span> : null}
    </button>
  )
}

// ---- labels ------------------------------------------------------------------------------------

export function Chip({ tone = 'neutral', icon, children, title, className = '' }: { tone?: Tone; icon?: IconName; children: ReactNode; title?: string; className?: string }) {
  return (
    <span className={`chip chip-${tone} ${className}`} title={title}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}

export function Dot({ tone = 'neutral' }: { tone?: Tone }) {
  return <span className={`dot dot-${tone}`} aria-hidden="true" />
}

export function ChannelBadge({ channel, label = true, size = 'md' }: { channel: Channel; label?: boolean; size?: 'sm' | 'md' }) {
  const icon: IconName = channel === 'instagram' ? 'instagram' : channel === 'tiktok' ? 'tiktok' : channel === 'whatsapp' ? 'whatsapp' : channel === 'sms' ? 'sms' : channel === 'phone' ? 'phone' : 'user'
  return (
    <span className={`channel channel-${channel} channel-${size}`} title={CHANNEL_LABEL[channel]}>
      <Icon name={icon} size={size === 'sm' ? 13 : 15} />
      {label && <span>{CHANNEL_LABEL[channel]}</span>}
    </span>
  )
}

const STAGE_TONE: Record<Stage, Tone> = {
  new: 'info', qualifying: 'info', contact: 'warn', call: 'warn', booked: 'team', consultation: 'team', plan: 'accent', treatment: 'accent', aftercare: 'ok', alumni: 'ok',
}
export function StageBadge({ stage, exit }: { stage: Stage; exit?: Exit }) {
  if (exit) return <Chip tone={exit === 'nurture' ? 'info' : exit === 'lost' || exit === 'spam' ? 'neutral' : 'danger'}>{EXIT_LABEL[exit]}</Chip>
  return <Chip tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Chip>
}

export function Avatar({ name, color, size = 32, title }: { name: string; color?: string; size?: number; title?: string }) {
  const initials = name.replace(/^Dr\.? /, '').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: color ?? 'var(--sunk)', color: color ? '#fff' : 'var(--ink-2)' }} title={title ?? name} aria-hidden="true">
      {initials}
    </span>
  )
}

export function UserAvatar({ userId, size = 28 }: { userId?: string; size?: number }) {
  const { state } = useStore()
  if (userId === 'ai') return <span className="avatar avatar-ai" style={{ width: size, height: size }} title="AI assistant"><Icon name="sparkles" size={Math.round(size * 0.55)} /></span>
  const u = state.users.find(x => x.id === userId)
  if (!u) return <Avatar name="?" size={size} />
  return <Avatar name={u.name} color={u.color} size={size} />
}

// ---- layout ------------------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  )
}

export function Card({ title, subtitle, actions, children, className = '', padded = true, as: As = 'section' }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode; className?: string; padded?: boolean; as?: 'section' | 'div' | 'article' }) {
  return (
    <As className={`card ${padded ? 'card-padded' : ''} ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          <div className="stack" style={{ gap: 2 }}>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          {actions && <div className="row wrap">{actions}</div>}
        </div>
      )}
      {children}
    </As>
  )
}

export function Stat({ label, value, hint, tone, icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone; icon?: IconName }) {
  return (
    <div className={`stat ${tone ? 'stat-' + tone : ''}`}>
      <span className="stat-label">{icon && <Icon name={icon} size={14} />}{label}</span>
      <span className="stat-value num">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  )
}

export function Progress({ value, max = 100, tone = 'accent', label }: { value: number; max?: number; tone?: Tone; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100))
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span className={`progress-bar tone-${tone}`} style={{ width: pct + '%' }} />
    </div>
  )
}

export function EmptyState({ icon = 'inbox', title, body, action }: { icon?: IconName; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <h3>{title}</h3>
      {body && <p className="muted small">{body}</p>}
      {action}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange, size = 'md' }: { tabs: { id: T; label: string; count?: number; icon?: IconName }[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div className={`tabs tabs-${size}`} role="tablist">
      {tabs.map(t => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`tab ${value === t.id ? 'is-active' : ''}`} onClick={() => onChange(t.id)}>
          {t.icon && <Icon name={t.icon} size={15} />}
          <span>{t.label}</span>
          {t.count != null && <span className="tab-count num">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string; icon?: IconName }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'is-active' : ''} onClick={() => onChange(o.id)}>
          {o.icon && <Icon name={o.icon} size={15} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ---- forms -------------------------------------------------------------------------------------

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; error?: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">{label}</label>
      {children(id)}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  )
}

export function Toggle({ checked, onChange, label, disabled, hideLabel }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; hideLabel?: boolean }) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden="true"><span className="toggle-thumb" /></span>
      <span className={hideLabel ? 'sr-only' : 'toggle-label'}>{label}</span>
    </label>
  )
}

// ---- overlays ----------------------------------------------------------------------------------

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
}

export function Modal({ open, title, onClose, children, footer, width = 520, description }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number; description?: ReactNode }) {
  useEscape(open, onClose)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLElement>('input, textarea, select, button.btn-primary')?.focus()
  }, [open])
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ maxWidth: width }} ref={ref}>
        <div className="modal-head">
          <div className="stack" style={{ gap: 2 }}>
            <h2>{title}</h2>
            {description && <p className="muted small">{description}</p>}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Drawer({ open, title, onClose, children, footer, width = 440, side = 'right' }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; width?: number; side?: 'right' | 'left' }) {
  useEscape(open, onClose)
  if (!open) return null
  return (
    <div className="overlay overlay-drawer" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <aside className={`drawer drawer-${side}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} style={{ width }}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </div>
  )
}

/** Confirmation that can require a written reason (used for every override, so it lands in the audit log). */
export function ReasonDialog({ open, title, body, confirmLabel = 'Confirm', tone = 'primary', requireReason = true, reasonLabel = 'Reason (saved in the audit log)', placeholder, onConfirm, onClose }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel?: string; tone?: 'primary' | 'danger'; requireReason?: boolean; reasonLabel?: string; placeholder?: string
  onConfirm: (reason: string) => void; onClose: () => void
}) {
  const [reason, setReason] = useState('')
  useEffect(() => { if (open) setReason('') }, [open])
  const ok = !requireReason || reason.trim().length >= 3
  return (
    <Modal open={open} title={title} onClose={onClose} width={480}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} disabled={!ok} onClick={() => { onConfirm(reason.trim()); onClose() }}>{confirmLabel}</Button>
      </>}>
      <div className="stack lg">
        {body && <div className="muted">{body}</div>}
        <Field label={reasonLabel} hint={requireReason ? 'Required. Everyone with audit access can see it.' : 'Optional.'}>
          {id => <textarea id={id} className="input" rows={3} value={reason} placeholder={placeholder} onChange={e => setReason(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- live time -----------------------------------------------------------------------------------

/** A live SLA countdown. Turns amber under 5 minutes and red when overdue. */
export function Countdown({ deadline, compact }: { deadline: string; compact?: boolean }) {
  const now = useNow(1000)
  const c = countdown(deadline, now)
  const tone = c.overdue ? 'danger' : c.msLeft < 5 * 60_000 ? 'warn' : 'ok'
  return (
    <span className={`countdown countdown-${tone} num ${compact ? 'countdown-compact' : ''}`} title={c.overdue ? 'Overdue' : 'Time left'}>
      <Icon name="clock" size={13} />
      {c.overdue ? `${c.text} overdue` : c.text}
    </span>
  )
}

// ---- small helpers ------------------------------------------------------------------------------

export function KeyValue({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="kv">
      {items.map(([k, v], i) => (
        <div key={i} className="kv-row">
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Locked({ children = 'Restricted to clinical staff' }: { children?: ReactNode }) {
  return (
    <span className="locked"><Icon name="lock" size={14} />{children}</span>
  )
}

export function Spinner() {
  return <span className="spinner" aria-label="Loading" />
}
