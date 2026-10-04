// Unified DM inbox: conversation list | thread | lead context. One pane at a time on phones.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useStore } from '../lib/store'
import { useNow } from '../lib/time'
import { Button, Drawer, EmptyState } from '../components/ui'
import { ConversationList } from './inbox/ConversationList'
import { Thread } from './inbox/Thread'
import { ContextPanel } from './inbox/ContextPanel'
import { TABS, canSeeConversation, inTab, maskPhonesInText, sortConversations, visibleConversations, type ChannelFilter, type InboxTab } from './inbox/helpers'
import './inbox.css'

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const h = () => setMatch(mq.matches)
    h()
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [query])
  return match
}

/** Fills the space between the top of the inbox and the bottom of the viewport (above the phone tab bar). */
function useFillHeight(ref: RefObject<HTMLElement | null>): number | undefined {
  const [h, setH] = useState<number>()
  useLayoutEffect(() => {
    const calc = () => {
      const el = ref.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY
      const bar = document.querySelector<HTMLElement>('.tabbar')
      const barH = bar && getComputedStyle(bar).display !== 'none' ? bar.offsetHeight : 0
      setH(Math.max(440, Math.floor(window.innerHeight - top - barH)))
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
    }
  }, [ref])
  return h
}

const TAB_KEY = 'lm-inbox-tab'

export default function Inbox() {
  const { state, me, can, route, actions } = useStore()
  const isPhone = useMedia('(max-width: 860px)')
  const isWide = useMedia('(min-width: 1240px)')
  const now = useNow(20_000)
  const rootRef = useRef<HTMLDivElement>(null)
  const height = useFillHeight(rootRef)

  const visible = useMemo(() => visibleConversations(state, me), [state, me])
  const [tab, setTabState] = useState<InboxTab>(() => {
    if (route.id) return 'all'
    try {
      const saved = sessionStorage.getItem(TAB_KEY) as InboxTab | null
      if (saved && TABS.some(t => t.id === saved)) return saved
    } catch { /* storage unavailable */ }
    return visible.some(c => inTab(c, 'needs', Date.now())) ? 'needs' : 'all'
  })
  const setTab = (t: InboxTab) => {
    setTabState(t)
    try { sessionStorage.setItem(TAB_KEY, t) } catch { /* storage unavailable */ }
  }
  const [q, setQ] = useState('')
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const readGuard = useRef<string | null>(null)

  const counts = useMemo(() => {
    const byChannel = channel === 'all' ? visible : visible.filter(c => c.channel === channel)
    const out = {} as Record<InboxTab, number>
    for (const t of TABS) out[t.id] = byChannel.filter(c => inTab(c, t.id, now)).length
    return out
  }, [visible, channel, now])

  const items = useMemo(() => {
    const s = q.trim().toLowerCase()
    const showPhone = can('clients.view_phone')
    return sortConversations(visible.filter(c => {
      if (channel !== 'all' && c.channel !== channel) return false
      if (!inTab(c, tab, now)) return false
      if (!s) return true
      const client = state.clients.find(x => x.id === c.clientId)
      if (client?.name.toLowerCase().includes(s)) return true
      if (Object.values(client?.handles ?? {}).some(h => h?.toLowerCase().includes(s))) return true
      return c.messages.some(m => maskPhonesInText(m.text, showPhone).toLowerCase().includes(s))
    }))
  }, [visible, channel, tab, now, q, state.clients, can])

  // desktop shows the first chat in the list when none is picked; phones show the list
  const selectedId = route.id ?? (!isPhone ? items[0]?.id : undefined)
  const conv = selectedId ? state.conversations.find(c => c.id === selectedId) : undefined
  const allowed = conv ? canSeeConversation(state, me, conv) : false

  // opening a chat marks it read for the team (view-only roles don't clear the team's unread state)
  useEffect(() => {
    if (readGuard.current && readGuard.current !== selectedId) readGuard.current = null
  }, [selectedId])
  useEffect(() => {
    if (!conv || !allowed || !can('chats.reply') || conv.unread === 0) return
    if (readGuard.current === conv.id) return
    if (isPhone && !route.id) return
    actions.update(d => {
      const c = d.conversations.find(x => x.id === conv.id)
      if (c) c.unread = 0
    })
  }, [conv?.id, conv?.unread, allowed, isPhone, route.id])

  useEffect(() => {
    if (isWide) setDetailsOpen(false)
  }, [isWide])

  const open = (id: string) => actions.go('inbox', id)
  const back = () => actions.go('inbox')
  const markedUnread = (id: string) => {
    readGuard.current = id
    if (isPhone) back()
  }

  const showList = !isPhone || !route.id
  const showThread = !isPhone || !!route.id
  const cls = isPhone ? 'ib-phone' : isWide ? 'ib-wide' : 'ib-mid'

  let threadPane: ReactNode
  if (route.id && !conv) {
    threadPane = <div className="ib-thread-empty"><EmptyState icon="message" title="This chat isn’t available" body="It may have been merged into another client or removed. Pick another chat from the list." action={<Button size="sm" variant="secondary" icon="chevronLeft" onClick={back}>Back to all chats</Button>} /></div>
  } else if (conv && !allowed) {
    threadPane = <div className="ib-thread-empty"><EmptyState icon="lock" title="This chat isn’t assigned to you" body="Your role can open chats assigned to you, chats with clients you look after, and chats you have a task for. Ask a coordinator or manager to assign it to you." action={<Button size="sm" variant="secondary" icon="chevronLeft" onClick={back}>Back to your chats</Button>} /></div>
  } else if (conv) {
    threadPane = <Thread key={conv.id} conv={conv} isPhone={isPhone} onBack={isPhone ? back : undefined} onOpenDetails={!isWide ? () => setDetailsOpen(true) : undefined} onMarkedUnread={markedUnread} />
  } else {
    threadPane = <div className="ib-thread-empty"><EmptyState icon="inbox" title={visible.length ? 'Pick a chat to read it here' : 'Nothing to read yet'} body={visible.length ? 'Choose a conversation on the left. Its messages, the AI draft and the reply box appear here.' : !can('chats.view_all') ? 'When a coordinator or manager assigns you a chat, or you get a task for a client who messaged us, it opens here.' : 'When a DM arrives on Instagram, TikTok or WhatsApp, the AI answers within seconds and the chat shows up here.'} /></div>
  }

  return (
    <div className={`ib ${cls}`} ref={rootRef} style={height ? { height } : undefined}>
      {showList && (
        <ConversationList items={items} counts={counts} tab={tab} onTab={setTab} q={q} onQ={setQ} channel={channel} onChannel={setChannel}
          selectedId={selectedId} onOpen={open} restricted={!can('chats.view_all')} now={now} />
      )}
      {showThread && <section className="ib-thread-pane" aria-label="Conversation">{threadPane}</section>}
      {isWide && (
        <aside className="ib-context-pane" aria-label="Lead details">
          {conv && allowed ? <ContextPanel conv={conv} /> : <p className="small muted ib-ctx-pad">Lead details for the open chat appear here: score, stage, consent, tasks and the next appointment.</p>}
        </aside>
      )}
      {!isWide && conv && allowed && (
        <Drawer open={detailsOpen} title="Lead details" onClose={() => setDetailsOpen(false)} width={400}>
          <ContextPanel conv={conv} />
        </Drawer>
      )}
    </div>
  )
}
