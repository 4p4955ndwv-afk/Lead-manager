import type { Conversation } from '../../lib/types'
import { byId, useStore } from '../../lib/store'
import { ago, replyWindow, HOUR } from '../../lib/time'
import { Avatar, Button, ChannelBadge, Chip, Countdown, EmptyState } from '../../components/ui'
import { Icon } from '../../components/icons'
import { TABS, firstName, maskPhonesInText, reasonIcon, reasonLabel, reasonTone, snippetOf, type ChannelFilter, type InboxTab } from './helpers'

const EMPTY: Record<InboxTab, { title: string; body: string }> = {
  needs: { title: 'Nobody is waiting for a person', body: 'When the AI hands a chat over (a phone number, a clinical question, a complaint, a possible minor or a reply it is unsure about) it appears here.' },
  drafts: { title: 'No drafts waiting for approval', body: 'In co-pilot mode the AI writes a reply and waits for someone to tap Send. Those drafts appear here.' },
  ai: { title: 'The AI is not handling any chats right now', body: 'Chats the AI is answering on its own, with nothing for the team to do, appear here.' },
  all: { title: 'No chats yet', body: 'Instagram, TikTok and WhatsApp messages appear here as soon as they arrive.' },
  closing: { title: 'No reply windows closing soon', body: 'Chats with less than 3 hours left to reply under Instagram, TikTok or WhatsApp rules appear here, so nobody misses the window.' },
}

export function ConversationList({ items, counts, tab, onTab, q, onQ, channel, onChannel, selectedId, onOpen, restricted, now }: {
  items: Conversation[]
  counts: Record<InboxTab, number>
  tab: InboxTab
  onTab: (t: InboxTab) => void
  q: string
  onQ: (q: string) => void
  channel: ChannelFilter
  onChannel: (c: ChannelFilter) => void
  selectedId?: string
  onOpen: (id: string) => void
  restricted: boolean
  now: number
}) {
  const { state, me, can } = useStore()
  const showPhone = can('clients.view_phone')
  const filtering = q.trim() !== '' || channel !== 'all'

  return (
    <section className="ib-list" aria-label="Conversations">
      <div className="ib-list-head">
        <div className="row between">
          <h1 className="ib-title">Inbox</h1>
          {state.ai.killSwitch
            ? <Chip tone="danger" icon="pause">AI paused for everyone</Chip>
            : <span className="small muted num">{counts.all} {counts.all === 1 ? 'chat' : 'chats'}{restricted ? ' assigned to you' : ''}</span>}
        </div>
        <div className="ib-filters">
          <div className="search-wrap grow">
            <Icon name="search" size={16} />
            <input className="input input-search" type="search" value={q} onChange={e => onQ(e.target.value)} placeholder="Search" aria-label="Search chats" />
          </div>
          <select className="input ib-channel" value={channel} onChange={e => onChannel(e.target.value as ChannelFilter)} aria-label="Filter by channel">
            <option value="all">All channels</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
        </div>
        <div className="ib-tabs" role="tablist" aria-label="Show chats">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`ib-tab ${tab === t.id ? 'is-active' : ''} ${t.id === 'needs' && counts.needs ? 'is-alert' : ''}`} onClick={() => onTab(t.id)}>
              <span>{t.label}</span>
              <span className="ib-tab-count num">{counts[t.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="ib-list-empty">
          {filtering ? (
            <EmptyState icon="search" title="No chats match your filters" body={q.trim() ? `Nothing in “${TABS.find(t => t.id === tab)?.label}” matches “${q.trim()}”${channel !== 'all' ? ' on this channel' : ''}.` : 'No chats on this channel in this view.'}
              action={<Button size="sm" variant="secondary" onClick={() => { onQ(''); onChannel('all') }}>Clear search and filters</Button>} />
          ) : restricted && tab === 'all' ? (
            <EmptyState icon="inbox" title="No chats assigned to you yet" body="Chats assigned to you, chats with clients you look after, and chats you have a task for appear here. A coordinator or manager can assign one to you." />
          ) : (
            <EmptyState icon="inbox" title={EMPTY[tab].title} body={EMPTY[tab].body}
              action={tab !== 'all' && counts.all > 0 ? <Button size="sm" variant="secondary" onClick={() => onTab('all')}>Show all chats</Button> : undefined} />
          )}
        </div>
      ) : (
        <ul className="ib-items">
          {items.map(c => {
            const client = byId(state.clients, c.clientId)
            const name = client?.name ?? 'Unknown client'
            const sn = snippetOf(state, me, c)
            const reason = reasonLabel(c)
            const win = replyWindow(c, now)
            const closing = win.open && win.msLeft <= 3 * HOUR
            const selected = c.id === selectedId
            const holder = c.handling === 'human' ? (c.assignedTo === me.id ? 'You' : c.assignedTo ? firstName(state.users.find(u => u.id === c.assignedTo)?.name ?? 'Staff') : 'Staff') : null
            return (
              <li key={c.id}>
                <button type="button" className={`ib-item ${selected ? 'is-selected' : ''} ${c.unread ? 'is-unread' : ''}`} aria-current={selected ? 'true' : undefined} onClick={() => onOpen(c.id)}>
                  <Avatar name={name} size={36} />
                  <span className="ib-item-body">
                    <span className="ib-item-top">
                      <span className="ib-item-name truncate">{name}</span>
                      <ChannelBadge channel={c.channel} label={false} size="sm" />
                      {c.pinned && <span className="ib-item-pin" title="Pinned"><Icon name="pin" size={13} /></span>}
                      <span className="ib-item-time num">{ago(c.lastMessageAt, now)}</span>
                    </span>
                    <span className="ib-item-snippet">
                      <span className="truncate">{sn.prefix && <span className="ib-item-prefix">{sn.prefix}</span>}{maskPhonesInText(sn.text, showPhone)}</span>
                      {c.unread > 0 && <span className="ib-unread" role="img" aria-label={`${c.unread} unread`} />}
                    </span>
                    <span className="ib-item-chips">
                      {client?.doNotContact && <Chip tone="danger" icon="x">Do not contact</Chip>}
                      {reason && <Chip tone={reasonTone(reason)} icon={reasonIcon(reason)}>{reason}</Chip>}
                      {c.draft && <Chip tone="accent" icon="edit">Draft ready</Chip>}
                      {c.handling === 'ai' && <Chip tone="accent" icon="sparkles">AI handling</Chip>}
                      {holder && <Chip tone="team" icon="hand">{holder}</Chip>}
                      {c.handling === 'paused' && <Chip icon="pause">Paused</Chip>}
                      {closing && <span className="ib-item-window" title="Reply window closes in"><Countdown deadline={win.closesAt} compact /></span>}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
