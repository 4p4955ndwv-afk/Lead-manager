// Conversations tab: every DM or WhatsApp thread with this person, with who is answering and the latest message.
import { userName, useStore } from '../../lib/store'
import type { Client } from '../../lib/types'
import { canOpen } from '../../lib/permissions'
import { ago, dateTime, ms, replyWindow, useNow } from '../../lib/time'
import { Button, ChannelBadge, Chip, EmptyState } from '../../components/ui'
import { first } from './dialogs'
import { channelPhrase } from './helpers'

export function ConversationsTab({ client }: { client: Client }) {
  const { state, me, actions } = useStore()
  const now = useNow(30_000)
  const convs = state.conversations.filter(c => c.clientId === client.id).sort((a, b) => ms(b.lastMessageAt) - ms(a.lastMessageAt))
  const inbox = canOpen(me, 'inbox')

  if (!convs.length) {
    return (
      <div className="card">
        <EmptyState icon="message" title="No message threads"
          body={`${first(client.name)} came in via ${channelPhrase(client.source.channel)}. If they DM us on Instagram or TikTok, the thread is linked here automatically.`} />
      </div>
    )
  }

  return (
    <ul className="cr-convs">
      {convs.map(c => {
        const last = [...c.messages].reverse().find(m => m.author !== 'system')
        const win = replyWindow(c, now)
        const who = !last ? '' : last.author === 'client' ? first(client.name) : last.author === 'ai' ? (last.status === 'shadow' ? 'AI draft (not sent)' : 'AI') : userName(state, last.userId).split(' ')[0]
        return (
          <li key={c.id} className="card cr-conv">
            <div className="row between wrap">
              <span className="row wrap" style={{ gap: 8 }}>
                <ChannelBadge channel={c.channel} />
                <span className="tiny muted">{c.messages.filter(m => m.author !== 'system').length} messages</span>
                {c.unread > 0 && <Chip tone="accent">{c.unread} unread</Chip>}
              </span>
              <time className="tiny muted" dateTime={c.lastMessageAt} title={dateTime(c.lastMessageAt)}>{ago(c.lastMessageAt, now)}</time>
            </div>
            {last && <p className="small cr-conv-last"><span className="strong">{who}:</span> {last.text}</p>}
            <div className="row wrap" style={{ gap: 6 }}>
              {c.handling === 'ai' && state.ai.killSwitch ? (
                <Chip tone="warn" icon="pause" title="The kill switch has paused AI replies in every chat">AI paused for everyone</Chip>
              ) : (
                <Chip tone={c.handling === 'ai' ? 'accent' : c.handling === 'human' ? 'team' : 'neutral'} icon={c.handling === 'ai' ? 'sparkles' : c.handling === 'human' ? 'hand' : 'pause'}>
                  {c.handling === 'ai' ? 'AI answering' : c.handling === 'human' ? `${c.assignedTo ? userName(state, c.assignedTo).split(' ')[0] : 'Staff'} answering` : 'Paused'}
                </Chip>
              )}
              {c.needsHuman && <Chip tone="warn" icon="alert">{c.needsHumanReason ?? 'Needs a person'}</Chip>}
              {c.draft && <Chip tone="info">Draft ready</Chip>}
              {c.channel !== 'whatsapp' && c.channel !== 'sms' && (
                <Chip tone={win.open ? 'ok' : win.humanAgentOpen ? 'warn' : 'neutral'} title={`Reply window closes ${dateTime(win.closesAt)}`}>
                  {win.open ? `Reply window open · ${Math.max(1, Math.round(win.msLeft / 3_600_000))} h left` : win.humanAgentOpen ? 'Staff reply only (Human Agent tag)' : 'Reply window closed'}
                </Chip>
              )}
            </div>
            {inbox && (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button size="sm" variant="secondary" iconRight="arrowRight" onClick={() => actions.go('inbox', c.id)}>Open in inbox</Button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
