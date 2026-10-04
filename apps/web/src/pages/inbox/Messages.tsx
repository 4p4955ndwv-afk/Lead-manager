import { Fragment, useEffect, useLayoutEffect, useRef } from 'react'
import type { Conversation, Message } from '../../lib/types'
import { useStore, userName } from '../../lib/store'
import { longDate, sameDay, timeOf, DAY } from '../../lib/time'
import { Chip } from '../../components/ui'
import { Icon } from '../../components/icons'
import { FLAG_META, maskPhonesInText } from './helpers'

function dayLabel(at: string, now: number): string {
  if (sameDay(at, now)) return 'Today'
  if (sameDay(at, now - DAY)) return 'Yesterday'
  return longDate(at)
}

const STATUS: Record<NonNullable<Message['status']>, { label: string; icon: 'check' | 'eye' | 'alert' | 'clock' }> = {
  sent: { label: 'Sent', icon: 'check' },
  delivered: { label: 'Delivered', icon: 'check' },
  read: { label: 'Seen', icon: 'eye' },
  failed: { label: 'Not delivered', icon: 'alert' },
  shadow: { label: 'Not sent', icon: 'clock' },
}

export function MessageList({ conv, typing, onUseShadow }: {
  conv: Conversation
  /** e.g. "AI is drafting a reply" while the engine reacts to a new client message */
  typing?: string | null
  /** Copies a shadow draft into the reply box; omitted when the viewer cannot reply. */
  onUseShadow?: (text: string) => void
}) {
  const { state, me, can } = useStore()
  const showPhone = can('clients.view_phone')
  const ref = useRef<HTMLDivElement>(null)
  const now = Date.now()

  const pinned = useRef(true)

  // keep the newest message in view when the chat opens or grows
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    pinned.current = true
  }, [conv.id, conv.messages.length, typing])

  // stay pinned to the bottom while the draft card or composer changes height, unless the reader scrolled up
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => { pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48 }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (pinned.current) el.scrollTop = el.scrollHeight }) : null
    ro?.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
    }
  }, [])

  return (
    <div className="ib-messages" ref={ref} role="log" aria-label="Messages" aria-live="polite">
      {conv.messages.length === 0 && <p className="ib-sys">No messages yet. The first message from the client will appear here.</p>}
      {conv.messages.map((m, i) => {
        const prev = conv.messages[i - 1]
        const newDay = !prev || !sameDay(prev.at, m.at)
        return (
          <Fragment key={m.id}>
            {newDay && <div className="ib-day" role="separator"><span>{dayLabel(m.at, now)}</span></div>}
            <MessageRow m={m} showPhone={showPhone} meId={me.id} nameOf={id => userName(state, id)} onUseShadow={onUseShadow} />
          </Fragment>
        )
      })}
      {typing && (
        <div className="ib-msg ib-msg-out">
          <div className="ib-typing" aria-label={typing}>
            <Icon name="sparkles" size={14} />
            <span>{typing}</span>
            <span className="ib-typing-dots" aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>
      )}
    </div>
  )
}

function MessageRow({ m, showPhone, meId, nameOf, onUseShadow }: { m: Message; showPhone: boolean; meId: string; nameOf: (id: string) => string; onUseShadow?: (text: string) => void }) {
  const text = maskPhonesInText(m.text, showPhone)
  if (m.author === 'system') {
    return (
      <div className="ib-sys">
        <span>{text}</span>
        <span className="ib-sys-time num">{timeOf(m.at)}</span>
      </div>
    )
  }
  if (m.author === 'client') {
    // "call me on 07700…" shares a number; it is not a request for ours
    const flags = (m.flags ?? []).filter(f => !(f === 'asked_number' && m.flags?.includes('phone_detected')))
    return (
      <div className="ib-msg ib-msg-in">
        <div className="ib-bubble" dir="auto">{text}</div>
        <div className="ib-meta"><span className="num">{timeOf(m.at)}</span></div>
        {flags.length > 0 && (
          <div className="ib-flags">
            {flags.map(f => <Chip key={f} tone={FLAG_META[f].tone} icon={FLAG_META[f].icon}>{FLAG_META[f].label}</Chip>)}
          </div>
        )}
      </div>
    )
  }
  const shadow = m.status === 'shadow'
  const isAi = m.author === 'ai'
  const st = m.status ? STATUS[m.status] : null
  return (
    <div className={`ib-msg ib-msg-out ${isAi ? 'is-ai' : 'is-staff'} ${shadow ? 'is-shadow' : ''}`}>
      {shadow && <div className="ib-shadow-label"><Icon name="eyeOff" size={13} />Shadow draft · not sent</div>}
      <div className="ib-bubble" dir="auto">{text}</div>
      <div className="ib-meta">
        {isAi ? (
          <span className="ib-author ib-author-ai"><Icon name="sparkles" size={13} />AI assistant{m.userId && !shadow ? <span className="ib-approved"> · approved by {m.userId === meId ? 'you' : nameOf(m.userId)}</span> : null}</span>
        ) : (
          <span className="ib-author">{m.userId === meId ? 'You' : nameOf(m.userId ?? '')}</span>
        )}
        <span aria-hidden="true">·</span>
        <span className="num">{timeOf(m.at)}</span>
        {st && !shadow && (
          <span className={`ib-status ${m.status === 'failed' ? 'is-failed' : ''}`}><Icon name={st.icon} size={13} />{st.label}</span>
        )}
        {m.humanAgentTag && <Chip tone="info" icon="user" title="Sent with Instagram's Human Agent tag (a person replying within 7 days)">Human Agent tag</Chip>}
      </div>
      {shadow && onUseShadow && (
        <button type="button" className="ib-link-btn" onClick={() => onUseShadow(m.text)}>
          <Icon name="copy" size={13} />Copy to reply box
        </button>
      )}
    </div>
  )
}
