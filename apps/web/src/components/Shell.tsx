import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import { Avatar, Button, Chip, Countdown, Drawer, IconButton, Modal } from './ui'
import { useStore } from '../lib/store'
import { canOpen } from '../lib/permissions'
import type { PageId } from '../lib/types'
import { ROLE_LABEL } from '../lib/types'
import { ago, nextOpening, timeOf, iso } from '../lib/time'
import { visibleConversations } from '../pages/inbox/helpers'
import { inMine } from '../pages/tasks/helpers'
import '../styles/shell.css'

export const NAV: { id: PageId; label: string; icon: IconName; mobile?: boolean }[] = [
  { id: 'today', label: 'Today', icon: 'home', mobile: true },
  { id: 'inbox', label: 'Inbox', icon: 'inbox', mobile: true },
  { id: 'tasks', label: 'Tasks & calls', icon: 'tasks', mobile: true },
  { id: 'pipeline', label: 'Pipeline', icon: 'board' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar', mobile: true },
  { id: 'ai', label: 'AI & playbook', icon: 'sparkles' },
  { id: 'analytics', label: 'Analytics', icon: 'chart' },
  { id: 'team', label: 'Team & access', icon: 'users' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('lm-theme') || 'system' } catch { return 'system' }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try { localStorage.setItem('lm-theme', theme) } catch { /* ignore */ }
  }, [theme])
  const cycle = () => setTheme(t => (t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'light' : 'dark') : t === 'dark' ? 'light' : 'dark'))
  return [theme, cycle]
}

export function Shell({ children, onOpenClaude }: { children: ReactNode; onOpenClaude: () => void }) {
  const { state, me, route, actions, toasts, dismissToast } = useStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const [roleOpen, setRoleOpen] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [, cycleTheme] = useTheme()

  const nav = NAV.filter(n => canOpen(me, n.id))
  const unread = state.notifications.filter(n => n.userId === me.id && !n.read).length
  const inboxCount = visibleConversations(state, me).filter(c => c.needsHuman || c.draft).length
  const myOpenTasks = state.tasks.filter(t => t.status === 'open' && inMine(me, t)).length
  const counts: Partial<Record<PageId, number>> = { inbox: inboxCount, tasks: myOpenTasks }

  useEffect(() => {
    if (!canOpen(me, route.page)) actions.go('today')
  }, [me, route.page, actions])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const modeName = (m: string) => (m === 'autopilot' ? 'autopilot' : m === 'copilot' ? 'co-pilot' : 'shadow')
  const modes = state.ai.mode
  const allSame = modes.instagram === modes.tiktok && modes.tiktok === modes.whatsapp
  const aiPill = state.ai.killSwitch
    ? { tone: 'danger' as const, text: 'AI paused', title: 'All AI replies are paused' }
    : { tone: 'ok' as const, text: allSame ? `AI ${modeName(modes.instagram)}` : 'AI replying', title: `Instagram ${modeName(modes.instagram)} · TikTok ${modeName(modes.tiktok)} · WhatsApp ${modeName(modes.whatsapp)}` }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><Icon name="zap" size={18} /></span>
          <div className="stack" style={{ gap: 0 }}>
            <span className="brand-name">Lead Manager</span>
            <span className="brand-org">{state.settings.orgName}</span>
          </div>
        </div>
        <nav className="nav">
          {nav.map(n => (
            <button key={n.id} type="button" className={`nav-item ${route.page === n.id || (route.page === 'client' && n.id === 'pipeline') ? 'is-active' : ''}`} onClick={() => actions.go(n.id)}>
              <Icon name={n.icon} size={18} />
              <span className="grow">{n.label}</span>
              {counts[n.id] ? <span className="nav-count num">{counts[n.id]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button type="button" className="claude-cta" onClick={onOpenClaude}>
            <Icon name="sparkles" size={17} />
            <span className="grow">Ask Claude</span>
            <kbd className="mono">MCP</kbd>
          </button>
          <button type="button" className="me" onClick={() => setRoleOpen(true)} aria-label="Switch who you are viewing as">
            <Avatar name={me.name} color={me.color} size={32} />
            <span className="stack grow" style={{ gap: 0, textAlign: 'left' }}>
              <span className="truncate strong">{me.name}</span>
              <span className="truncate tiny muted">{ROLE_LABEL[me.role]}</span>
            </span>
            <Icon name="chevronDown" size={16} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="topbar-brand" onClick={() => actions.go('today')} aria-label="Today">
            <span className="brand-mark" aria-hidden="true"><Icon name="zap" size={16} /></span>
          </button>
          <button type="button" className="search-trigger" onClick={() => setPaletteOpen(true)}>
            <Icon name="search" size={16} />
            <span className="grow truncate">Search clients, chats, pages…</span>
            <kbd className="mono">⌘K</kbd>
          </button>
          <div className="topbar-actions">
            <button type="button" className={`ai-pill ai-pill-${aiPill.tone}`} onClick={() => actions.go(canOpen(me, 'ai') ? 'ai' : 'inbox')} title={aiPill.title}>
              <span className="dot" />{aiPill.text}
            </button>
            <Button variant="ghost" size="sm" icon="play" onClick={() => setDemoOpen(true)} className="hide-sm">Demo</Button>
            <IconButton icon="play" label="Demo controls" onClick={() => setDemoOpen(true)} className="show-sm" />
            <IconButton icon="moon" label="Switch light or dark theme" onClick={cycleTheme} className="hide-sm" />
            <IconButton icon="sparkles" label="Ask Claude" onClick={onOpenClaude} className="show-sm" />
            <IconButton icon="bell" label="Notifications" badge={unread} onClick={() => setNotifOpen(true)} />
            <button type="button" className="topbar-me show-sm" onClick={() => setRoleOpen(true)} aria-label="Switch who you are viewing as">
              <Avatar name={me.name} color={me.color} size={30} />
            </button>
          </div>
        </header>

        <div className="viewing-as" role="status">
          <Icon name="eye" size={14} />
          <span className="truncate">Demo: viewing as <b>{me.name}</b> · {ROLE_LABEL[me.role]}. Switch roles to see what each person can access.</span>
          <button type="button" onClick={() => setRoleOpen(true)}>Switch</button>
        </div>

        <main className="content" id="content">{children}</main>

        <nav className="tabbar" aria-label="Main navigation">
          {nav.filter(n => n.mobile).slice(0, 4).map(n => (
            <button key={n.id} type="button" className={`tab-item ${route.page === n.id ? 'is-active' : ''}`} onClick={() => actions.go(n.id)}>
              <span className="tab-icon"><Icon name={n.icon} size={21} />{counts[n.id] ? <span className="tab-badge num">{counts[n.id]}</span> : null}</span>
              <span>{n.label.split(' ')[0]}</span>
            </button>
          ))}
          <button type="button" className={`tab-item ${moreOpen ? 'is-active' : ''}`} onClick={() => setMoreOpen(true)}>
            <span className="tab-icon"><Icon name="menu" size={21} /></span>
            <span>More</span>
          </button>
        </nav>
      </div>

      <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <RoleSwitcher open={roleOpen} onClose={() => setRoleOpen(false)} />
      <DemoControls open={demoOpen} onClose={() => setDemoOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Drawer open={moreOpen} title="Menu" onClose={() => setMoreOpen(false)} width={320}>
        <div className="stack">
          {nav.map(n => (
            <button key={n.id} type="button" className={`nav-item ${route.page === n.id ? 'is-active' : ''}`} onClick={() => { actions.go(n.id); setMoreOpen(false) }}>
              <Icon name={n.icon} size={18} /><span className="grow">{n.label}</span>
              {counts[n.id] ? <span className="nav-count num">{counts[n.id]}</span> : null}
            </button>
          ))}
          <hr className="divider" />
          <button type="button" className="nav-item" onClick={() => { cycleTheme() }}><Icon name="moon" size={18} /><span>Light or dark theme</span></button>
          <button type="button" className="nav-item" onClick={() => { setMoreOpen(false); onOpenClaude() }}><Icon name="sparkles" size={18} /><span>Ask Claude</span></button>
        </div>
      </Drawer>

      <div className="toasts" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span className="grow">{t.text}</span>
            {t.action && <button type="button" onClick={() => { const ac = t.action!; if (ac.onClick) ac.onClick(); else if (ac.page) actions.go(ac.page, ac.id); dismissToast(t.id) }}>{t.action.label}</button>}
            <IconButton icon="x" size="sm" label="Dismiss" onClick={() => dismissToast(t.id)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function NotificationsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, actions } = useStore()
  const list = state.notifications.filter(n => n.userId === me.id).slice(0, 40)
  const icon: Record<string, IconName> = { lead: 'phone', escalation: 'alert', reminder: 'clock', ai: 'sparkles', system: 'settings', payment: 'card', clinical: 'shield' }
  return (
    <Drawer open={open} title="Notifications" onClose={onClose} width={420}
      footer={<Button variant="ghost" size="sm" onClick={() => actions.markAllRead()}>Mark all as read</Button>}>
      {list.length === 0 ? (
        <p className="muted">Nothing new. Alerts for new leads, escalations and reminders appear here and on your phone.</p>
      ) : (
        <ul className="notif-list">
          {list.map(n => (
            <li key={n.id}>
              <button type="button" className={`notif ${n.read ? '' : 'is-unread'}`} onClick={() => { actions.markRead(n.id); if (n.link) actions.go(n.link.page, n.link.id); onClose() }}>
                <span className={`notif-icon notif-${n.kind}`}><Icon name={icon[n.kind] ?? 'bell'} size={16} /></span>
                <span className="stack grow" style={{ gap: 3 }}>
                  <span className="row between top"><b className="notif-title">{n.title}</b><span className="tiny faint" style={{ whiteSpace: 'nowrap' }}>{ago(n.at)}</span></span>
                  <span className="small muted notif-body">{n.body}</span>
                  {n.deadline && !n.read && <span><Countdown deadline={n.deadline} compact /></span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  )
}

function RoleSwitcher({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, actions } = useStore()
  return (
    <Modal open={open} title="View as a team member" onClose={onClose} width={520}
      description="Each person has their own login. Switch to see exactly what each role can open, edit and see. Phone numbers, clinical notes and money are hidden from roles without access.">
      <ul className="role-list">
        {state.users.map(u => (
          <li key={u.id}>
            <button type="button" className={`role-item ${u.id === me.id ? 'is-active' : ''}`} onClick={() => { actions.setUser(u.id); actions.toast(`Now viewing as ${u.name} (${ROLE_LABEL[u.role]})`, 'info'); onClose() }}>
              <Avatar name={u.name} color={u.color} size={34} />
              <span className="stack grow" style={{ gap: 0 }}>
                <span className="strong">{u.name}</span>
                <span className="small muted">{ROLE_LABEL[u.role]} · {u.branchIds.map(b => state.branches.find(x => x.id === b)?.name).join(', ')}</span>
              </span>
              {u.onShift ? <Chip tone="ok">On shift</Chip> : <Chip>Off shift</Chip>}
              {u.id === me.id && <Icon name="check" size={18} />}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function DemoControls({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions, me } = useStore()
  const opensAt = nextOpening(state.ai.businessHours)
  const closed = opensAt > Date.now() + 60_000
  const openAllHours = () => {
    actions.update(d => {
      d.ai.businessHours = { start: '00:00', end: '23:59', days: [0, 1, 2, 3, 4, 5, 6] }
      d.audit.unshift({ id: 'au_demo_' + Date.now(), at: new Date().toISOString(), actor: d.currentUserId, action: 'settings.business_hours', target: { type: 'settings', id: 'ai', label: 'Opening hours' }, detail: 'Opening hours set to 24/7 for the demo' })
    })
    actions.toast('The clinic is now open 24/7 for this demo, so new leads get the live 15-minute call clock.', 'success')
  }
  const run = (channel: 'instagram' | 'tiktok') => {
    const id = actions.simulateNewLead(channel)
    actions.toast(`New ${channel === 'tiktok' ? 'TikTok' : 'Instagram'} DM arriving. Watch the AI reply, then the number handoff.`, 'info', { label: 'Open chat', page: 'inbox', id })
    onClose()
  }
  return (
    <Modal open={open} title="Demo controls" onClose={onClose} width={500}
      description="Play out the core flow with fake data: a DM arrives, the AI replies in seconds, the person shares a number, and the on-shift coordinator gets an alert with a 15-minute clock.">
      <div className="stack lg">
        <div className="demo-grid">
          <button type="button" className="demo-tile" onClick={() => run('instagram')}>
            <span className="channel channel-instagram"><Icon name="instagram" size={22} /></span>
            <b>Simulate an Instagram DM</b>
            <span className="small muted">AI is on autopilot for Instagram</span>
          </button>
          <button type="button" className="demo-tile" onClick={() => run('tiktok')}>
            <span className="channel channel-tiktok"><Icon name="tiktok" size={22} /></span>
            <b>Simulate a TikTok DM</b>
            <span className="small muted">AI drafts, staff tap send (co-pilot)</span>
          </button>
        </div>
        {closed && (
          <div className="demo-closed">
            <p className="small"><b>The clinic is closed right now</b> (opens {new Date(opensAt).toLocaleDateString('en-GB', { weekday: 'short' })} {timeOf(iso(opensAt))}). New leads that arrive outside opening hours are due when it opens, so you won't see the live 15-minute clock.</p>
            <Button size="sm" variant="subtle" icon="clock" onClick={openAllHours}>Open 24/7 for this demo</Button>
          </div>
        )}
        <p className="small muted">Tip: switch to <b>Priya Nair (Lead coordinator)</b> to receive the new-lead alert{me.role === 'coordinator' ? ' (you are already her)' : ''}. Leave a call task untouched for 15 minutes to see it escalate to the manager.</p>
        <div className="row between wrap">
          <span className="small muted">Changes are saved in this browser only.</span>
          <Button variant="ghost" size="sm" icon="refresh" onClick={() => { actions.resetDemo(); onClose() }}>Reset demo data</Button>
        </div>
      </div>
    </Modal>
  )
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, actions } = useStore()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 10) } }, [open])
  const results = useMemo(() => {
    const s = q.trim().toLowerCase()
    const pages = NAV.filter(n => canOpen(me, n.id) && (!s || n.label.toLowerCase().includes(s))).map(n => ({ key: 'p' + n.id, icon: n.icon, label: n.label, hint: 'Page', go: () => actions.go(n.id) }))
    const clients = state.clients.filter(c => !s || c.name.toLowerCase().includes(s) || Object.values(c.handles).some(h => h?.toLowerCase().includes(s))).slice(0, 8)
      .map(c => ({ key: 'c' + c.id, icon: 'user' as IconName, label: c.name, hint: Object.values(c.handles)[0] ?? '', go: () => actions.go('client', c.id) }))
    const convs = s ? state.conversations.filter(c => c.messages.some(m => m.text.toLowerCase().includes(s))).slice(0, 5).map(c => {
      const cl = state.clients.find(x => x.id === c.clientId)
      return { key: 'm' + c.id, icon: 'message' as IconName, label: `Chat with ${cl?.name ?? 'client'}`, hint: 'Message match', go: () => actions.go('inbox', c.id) }
    }) : []
    return [...pages, ...clients, ...convs]
  }, [q, state, me, actions])
  if (!open) return null
  const choose = (i: number) => { results[i]?.go(); onClose() }
  return (
    <div className="overlay palette-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search">
        <div className="palette-input">
          <Icon name="search" size={18} />
          <input ref={inputRef} value={q} placeholder="Search clients, handles, messages or pages" aria-label="Search"
            onChange={e => { setQ(e.target.value); setIdx(0) }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(results.length - 1, i + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setIdx(i => Math.max(0, i - 1)) }
              if (e.key === 'Enter') choose(idx)
              if (e.key === 'Escape') onClose()
            }} />
        </div>
        <ul className="palette-list" role="listbox">
          {results.length === 0 && <li className="palette-empty muted">No matches for “{q}”.</li>}
          {results.map((r, i) => (
            <li key={r.key} role="option" aria-selected={i === idx}>
              <button type="button" className={`palette-item ${i === idx ? 'is-active' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => choose(i)}>
                <Icon name={r.icon} size={16} /><span className="grow truncate">{r.label}</span><span className="tiny faint truncate">{r.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
