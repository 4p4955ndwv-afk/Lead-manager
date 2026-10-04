import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { AiMode, Conversation } from '../../lib/types'
import { CHANNEL_LABEL, ROLE_LABEL } from '../../lib/types'
import { activeEpisode, byId, useStore, userName } from '../../lib/store'
import { maskPhone } from '../../lib/permissions'
import { ago, countdown, longDate, ms, replyWindow, until, useNow, HOUR, type WindowState } from '../../lib/time'
import { Avatar, Button, ChannelBadge, Chip, IconButton, ReasonDialog, Segmented, StageBadge, Toggle, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { Menu, type MenuItem } from './Menu'
import { MessageList } from './Messages'
import { DraftCard } from './DraftCard'
import { Composer, type ComposerBlock } from './Composer'
import { DemoClientReply } from './DemoClientReply'
import { CreateTaskModal } from './dialogs'
import { firstName, needsPerson, reasonLabel } from './helpers'

/** Unsent text per chat, so switching chats does not lose a half-written reply (this tab only). */
const unsent = new Map<string, string>()

const MODE_LABEL: Record<AiMode, string> = { shadow: 'Shadow', copilot: 'Co-pilot', autopilot: 'Autopilot' }
const MODE_HINT: Record<AiMode, string> = {
  shadow: 'The AI drafts privately; staff write every reply.',
  copilot: 'The AI drafts; a person taps Send.',
  autopilot: 'The AI replies on its own and hands over when needed.',
}

export function Thread({ conv, isPhone, onBack, onOpenDetails, onMarkedUnread }: {
  conv: Conversation
  isPhone: boolean
  onBack?: () => void
  onOpenDetails?: () => void
  onMarkedUnread: (id: string) => void
}) {
  const { state, me, can, actions } = useStore()
  const now = useNow(1000)
  const client = byId(state.clients, conv.clientId)
  const ep = activeEpisode(state, conv.clientId)
  const win = replyWindow(conv, now)
  const canReply = can('chats.reply')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const [text, setTextState] = useState(() => unsent.get(conv.id) ?? '')
  const [editingDraft, setEditingDraft] = useState(false)
  const [humanAgent, setHumanAgent] = useState(false)
  const [pendingHandling, setPendingHandling] = useState<Conversation['handling'] | null>(null)
  const [taskOpen, setTaskOpen] = useState(false)
  const [drafting, setDrafting] = useState(false)

  const setText = useCallback((t: string) => {
    setTextState(t)
    if (t) unsent.set(conv.id, t)
    else unsent.delete(conv.id)
  }, [conv.id])

  const copyShadow = useCallback((t: string) => {
    setText(t)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [setText])

  // a new client message (or a colleague) can replace the draft mid-edit: keep the text as a normal reply
  const hasDraft = !!conv.draft
  useEffect(() => {
    if (editingDraft && !hasDraft) setEditingDraft(false)
  }, [editingDraft, hasDraft])

  if (!client) return null
  const first = firstName(client.name)
  const handle = client.handles[conv.channel as 'instagram' | 'tiktok'] ?? (conv.channel === 'whatsapp' ? maskPhone(client.phone, can('clients.view_phone')) : client.handles.instagram ?? client.handles.tiktok ?? '')
  const heldByOther = conv.handling === 'human' && !!conv.assignedTo && conv.assignedTo !== me.id
  const holder = heldByOther ? userName(state, conv.assignedTo) : ''
  const mode: AiMode | null = conv.channel === 'instagram' || conv.channel === 'tiktok' || conv.channel === 'whatsapp' ? state.ai.mode[conv.channel] : null
  const lastMsg = conv.messages[conv.messages.length - 1]

  // ---- handling ---------------------------------------------------------------------------------
  const applyHandling = (h: Conversation['handling'], reason?: string) => {
    actions.setHandling(conv.id, h, reason)
    if (h === 'ai') {
      actions.toast(state.ai.killSwitch ? 'Handed back to the AI, but AI replies are paused for everyone, so nothing is sent automatically until the kill switch is off.' : 'Handed back. The AI is replying in this chat again.', state.ai.killSwitch ? 'warn' : 'success')
    } else if (h === 'human') {
      setEditingDraft(false)
      actions.toast(heldByOther ? `You took over from ${holder}. The AI stays paused here.` : 'You’re replying now. The AI is paused in this chat.', 'success')
    } else {
      actions.toast('AI paused in this chat. Nobody replies automatically until someone takes over or hands back.', 'info')
    }
  }
  const changeHandling = (h: Conversation['handling']) => {
    if (heldByOther) return setPendingHandling(h)
    if (h === conv.handling) return
    applyHandling(h)
  }

  // ---- what can be sent right now ---------------------------------------------------------------
  const tagReply = conv.channel === 'instagram' && !win.open && !!win.humanAgentOpen
  let block: ComposerBlock | null = null
  if (client.doNotContact) {
    block = { title: `${first} asked us to stop messaging`, body: `Replies are blocked on every channel. If ${first} asks to hear from us again, use Move stage in the lead details to bring them back; it asks for a reason.` }
  } else if (heldByOther) {
    block = { title: `${holder} is replying in this chat`, body: 'Take over to reply. Taking over a colleague’s chat asks for a reason, which goes in the audit log.', action: <Button size="sm" variant="secondary" icon="hand" onClick={() => setPendingHandling('human')}>Take over</Button> }
  } else if (!win.open) {
    if (conv.channel === 'instagram') {
      block = win.humanAgentOpen
        ? (humanAgent ? null : { title: 'The 24-hour reply window has closed', body: `Turn on the Human Agent tag above to send a personal reply. Instagram allows this for 7 days after ${first}’s last message, for replies written by a person only.` })
        : { title: 'Instagram reply window closed', body: `Instagram allows replies within 24 hours of the client’s last message, or 7 days with the Human Agent tag. Both have passed. You can reply as soon as ${first} messages again.` }
    } else if (conv.channel === 'tiktok') {
      block = win.messagesLeft === 0 && win.msLeft > 0
        ? { title: '10-message limit reached', body: `TikTok allows up to 10 messages for each message the client sends. You can reply again once ${first} writes back.` }
        : { title: 'TikTok reply window closed', body: `TikTok allows replies within 48 hours of the client’s last message. You can reply as soon as ${first} messages again.` }
    } else {
      block = { title: 'WhatsApp 24-hour window closed', body: `Outside the 24-hour window WhatsApp only allows pre-approved template messages. You can reply freely once ${first} messages again.` }
    }
  }

  const draftBlocked: string | null = !conv.draft ? null
    : client.doNotContact && conv.draft.intent !== 'opt_out' ? `${first} opted out, so this draft cannot be sent.`
    : heldByOther ? `${holder} is replying in this chat. Take over to send drafts.`
    : state.ai.killSwitch ? 'AI replies are paused for everyone. Edit the draft to send it as your own reply.'
    : !win.open ? (tagReply ? 'AI replies cannot use the Human Agent tag. Edit it and send it as your own reply instead.' : 'The reply window has closed, so this draft cannot be sent.')
    : null

  /** An edited draft goes out as a staff reply when an AI reply is not allowed right now. */
  const draftAsHuman = state.ai.killSwitch || !win.open

  const send = () => {
    const t = text.trim()
    if (!t || block) return
    if (editingDraft && conv.draft && !draftAsHuman && !heldByOther) {
      const unchanged = t === conv.draft.text.trim()
      actions.approveDraft(conv.id, unchanged ? undefined : t)
      actions.toast(unchanged ? 'AI draft sent.' : 'Edited draft sent. The edit is logged to improve the playbook.', 'success')
    } else {
      if (conv.handling === 'ai') {
        actions.setHandling(conv.id, 'human')
        actions.toast('You took over this chat, so the AI is paused here. Use “AI replying” in the header to hand back.', 'info')
      }
      actions.sendMessage(conv.id, { author: 'human', text: t, humanAgentTag: tagReply && humanAgent ? true : undefined })
    }
    setText('')
    setEditingDraft(false)
  }

  const startEdit = () => {
    if (!conv.draft) return
    setText(conv.draft.text)
    setEditingDraft(true)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }
    })
  }
  const cancelEdit = () => {
    setEditingDraft(false)
    setText('')
  }

  const draftReply = async () => {
    setDrafting(true)
    try {
      const note = await actions.regenerateDraft(conv.id, false)
      actions.toast(note ?? 'Draft ready. Check it, then send, edit or discard.', note ? 'warn' : 'success')
    } finally {
      setDrafting(false)
    }
  }

  // AI reacts ~2 s after a client message: show a typing hint meanwhile
  const typing = lastMsg?.author === 'client' && conv.handling === 'ai' && !state.ai.killSwitch && !conv.draft && now - ms(lastMsg.at) < 3500
    ? (mode === 'autopilot' ? 'AI is replying' : 'AI is drafting a reply') : null

  const placeholder = editingDraft ? 'Edit the AI draft…'
    : tagReply ? `Personal reply to ${first} with the Human Agent tag…`
    : conv.handling === 'ai' ? `Reply to ${first}. Sending takes over from the AI.`
    : conv.handling === 'paused' ? `Reply to ${first}. The AI is paused here.`
    : `Reply to ${first}…`

  const markHandled = () => {
    const reason = reasonLabel(conv)
    actions.update(d => {
      const c = d.conversations.find(x => x.id === conv.id)
      if (!c) return
      c.needsHuman = false
      c.needsHumanReason = undefined
    })
    actions.audit({ action: 'conversation.resolved', target: { type: 'conversation', id: conv.id, label: client.name }, detail: `Marked as handled${reason ? ` (${reason})` : ''}` })
    actions.toast('Removed from Needs a person.', 'success')
  }

  // ---- header menus -----------------------------------------------------------------------------
  const moreItems: Array<MenuItem | 'sep'> = []
  if (canReply || can('pipeline.move')) moreItems.push({ id: 'task', label: 'Create task', hint: 'Follow-up for you or a colleague', icon: 'tasks', onSelect: () => setTaskOpen(true) })
  moreItems.push({ id: 'client', label: 'Open client record', icon: 'user', onSelect: () => actions.go('client', client.id) })
  moreItems.push({ id: 'claude', label: 'Ask Claude about this chat', icon: 'sparkles', onSelect: () => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: `Summarise my ${CHANNEL_LABEL[conv.channel]} chat with ${client.name} and suggest the next step.` } })) })
  if (canReply) {
    moreItems.push('sep')
    moreItems.push({
      id: 'pin', label: conv.pinned ? 'Unpin from top' : 'Pin to top of the list', icon: 'pin', onSelect: () => {
        actions.update(d => { const c = d.conversations.find(x => x.id === conv.id); if (c) c.pinned = !c.pinned })
        actions.toast(conv.pinned ? 'Unpinned.' : 'Pinned to the top of the list.', 'success')
      },
    })
    moreItems.push({
      id: 'unread', label: 'Mark as unread', icon: 'message', onSelect: () => {
        actions.update(d => { const c = d.conversations.find(x => x.id === conv.id); if (c) c.unread = Math.max(1, c.unread) })
        onMarkedUnread(conv.id)
        actions.toast('Marked as unread.', 'info')
      },
    })
    if (needsPerson(conv)) {
      moreItems.push({
        id: 'handled', label: 'Mark as handled', hint: 'Removes it from Needs a person', icon: 'check', onSelect: () => markHandled(),
      })
    }
  }

  const reason = reasonLabel(conv)
  const handlingOptions: { id: Conversation['handling']; label: string; icon: 'sparkles' | 'hand' | 'pause' }[] = [
    { id: 'ai', label: 'AI replying', icon: 'sparkles' },
    { id: 'human', label: heldByOther ? `${firstName(holder)} replying` : 'You’re replying', icon: 'hand' },
    { id: 'paused', label: 'Paused', icon: 'pause' },
  ]

  return (
    <div className="ib-thread">
      <header className="ib-th-head">
        <div className="ib-th-id">
          {onBack && <IconButton icon="chevronLeft" label="Back to all chats" onClick={onBack} />}
          <Avatar name={client.name} size={36} />
          <div className="ib-th-who">
            <button type="button" className="ib-th-name" onClick={() => actions.go('client', client.id)} title="Open client record">
              <span className="truncate">{client.name}</span>
              <Icon name="arrowUpRight" size={15} />
            </button>
            <div className="ib-th-sub">
              {handle && <span className="truncate">{handle}</span>}
              <ChannelBadge channel={conv.channel} size="sm" label={!isPhone} />
              {ep && <StageBadge stage={ep.stage} exit={ep.exit} />}
            </div>
          </div>
          <div className="ib-th-actions">
            <AssignMenu conv={conv} compact={isPhone} clientName={client.name} />
            {onOpenDetails && <IconButton icon="info" label="Lead details" onClick={onOpenDetails} />}
            <Menu buttonLabel="More actions" buttonContent={<Icon name="more" size={19} />} items={moreItems} />
          </div>
        </div>
        <div className="ib-th-controls">
          {canReply ? (
            <div className="ib-handling">
              <Segmented label="Who is replying" value={conv.handling} onChange={changeHandling} options={handlingOptions} />
            </div>
          ) : (
            <Chip tone={conv.handling === 'ai' ? 'accent' : conv.handling === 'human' ? 'team' : 'neutral'} icon={conv.handling === 'ai' ? 'sparkles' : conv.handling === 'human' ? 'hand' : 'pause'}>
              {conv.handling === 'ai' ? 'AI replying' : conv.handling === 'human' ? `${userName(state, conv.assignedTo)} replying` : 'Paused'}
            </Chip>
          )}
        </div>
      </header>

      <WindowBar conv={conv} win={win} now={now} humanAgent={humanAgent} onHumanAgent={setHumanAgent} canReply={canReply} first={first}
        mode={mode && <ModeChip channel={conv.channel} mode={mode} killed={state.ai.killSwitch} />} />

      <div className="ib-banners">
        {state.ai.killSwitch && (
          <div className="ib-banner is-danger" role="status">
            <Icon name="pause" size={15} />
            <span className="grow">AI replies are paused for everyone{state.ai.killSwitchBy ? ` by ${userName(state, state.ai.killSwitchBy)}` : ''}. New messages wait for a person.</span>
          </div>
        )}
        {reason && reason !== 'Reply needed' && (
          <div className={`ib-banner ${/minor|complaint/i.test(reason) ? 'is-danger' : /clinical/i.test(reason) ? 'is-info' : 'is-warn'}`} role="status">
            <Icon name={/minor|complaint/i.test(reason) ? 'alert' : /clinical/i.test(reason) ? 'shield' : 'hand'} size={15} />
            <span className="grow">
              <b>{reason}.</b>{' '}
              {/minor/i.test(reason) ? 'Booking is blocked and a manager has been alerted. Don’t ask for personal details.'
                : /clinical/i.test(reason) ? 'No medical advice in the chat; a clinician has a review task.'
                : /complaint/i.test(reason) ? 'A manager has been alerted. Reply personally, calmly and specifically.'
                : /shadow/i.test(reason) ? 'The AI drafted privately; a person writes the reply.'
                : 'The AI handed this over. Reply, or mark it handled.'}
            </span>
            {canReply && <button type="button" className="ib-link-btn" onClick={markHandled}>Mark as handled</button>}
          </div>
        )}
      </div>

      <MessageList conv={conv} typing={typing} onUseShadow={canReply && !block ? copyShadow : undefined} />

      <div className="ib-footer">
        {conv.draft && (
          <DraftCard conv={conv} sendBlocked={draftBlocked} canEdit={!block || (tagReply && !humanAgent)} editing={editingDraft} onEdit={startEdit} onCancelEdit={cancelEdit} />
        )}
        <Composer
          clientName={client.name}
          text={text}
          onText={setText}
          inputRef={inputRef}
          editingDraft={editingDraft}
          editNote={draftAsHuman ? `Editing the AI draft. It goes out as your own reply because ${state.ai.killSwitch ? 'AI replies are paused for everyone' : 'AI replies are not allowed outside the reply window'}.` : undefined}
          onCancelEdit={cancelEdit}
          block={block}
          placeholder={placeholder}
          onSend={send}
          onDraft={!conv.draft && conv.handling !== 'paused' && !heldByOther && !state.ai.killSwitch ? draftReply : undefined}
          drafting={drafting}
          humanAgent={tagReply && humanAgent}
        />
        <DemoClientReply convId={conv.id} clientName={client.name} />
      </div>

      <ReasonDialog
        open={pendingHandling !== null}
        title={pendingHandling === 'human' ? `Take over from ${holder}?` : pendingHandling === 'ai' ? `Hand ${holder}’s chat back to the AI?` : `Pause the AI in ${holder}’s chat?`}
        body={`${holder} is replying to ${client.name} right now. They will see that you changed this, and your reason is saved in the audit log.`}
        confirmLabel={pendingHandling === 'human' ? 'Take over' : pendingHandling === 'ai' ? 'Hand back to the AI' : 'Pause the AI'}
        placeholder={`e.g. ${firstName(holder || 'They')} is off shift and the client is waiting for an answer`}
        onClose={() => setPendingHandling(null)}
        onConfirm={r => { if (pendingHandling) applyHandling(pendingHandling, r) }}
      />
      <CreateTaskModal open={taskOpen} onClose={() => setTaskOpen(false)} convId={conv.id} />
    </div>
  )
}

// ---- reply window ---------------------------------------------------------------------------------

function ModeChip({ channel, mode, killed }: { channel: Conversation['channel']; mode: AiMode; killed: boolean }) {
  return (
    <span className="ib-window-mode" title={killed ? 'All AI replies are paused by the kill switch.' : `${CHANNEL_LABEL[channel]} AI mode. ${MODE_HINT[mode]}`}>
      <span className="ib-window-mode-label tiny">{CHANNEL_LABEL[channel]} AI</span>
      {killed ? <Chip tone="danger" icon="pause">Paused</Chip> : <Chip tone={mode === 'autopilot' ? 'ok' : mode === 'copilot' ? 'info' : 'neutral'}>{MODE_LABEL[mode]}</Chip>}
    </span>
  )
}

function WindowBar({ conv, win, now, humanAgent, onHumanAgent, canReply, first, mode }: {
  conv: Conversation; win: WindowState; now: number; humanAgent: boolean; onHumanAgent: (v: boolean) => void; canReply: boolean; first: string; mode?: ReactNode
}) {
  const left = countdown(win.closesAt, now).text
  const tone = !win.open ? 'danger' : win.msLeft <= 3 * HOUR ? 'warn' : 'ok'

  if (conv.channel === 'instagram') {
    if (win.open) {
      return (
        <div className={`ib-window is-${tone}`}>
          <Icon name="clock" size={15} />
          <span title="Instagram allows replies within 24 hours of the client's last message.">Reply window closes in <b className="mono num">{left}</b></span>
          {mode}
        </div>
      )
    }
    if (win.humanAgentOpen) {
      return (
        <div className="ib-window is-warn ib-window-tag">
          <div className="ib-window-line">
            <Icon name="clock" size={15} />
            <span className="grow">24-hour window closed {ago(win.closesAt, now)}. A person can still reply with the Human Agent tag {until(win.humanAgentUntil, now).replace(/^in /, 'for ')}.</span>
            {mode}
          </div>
          {canReply && (
            <div className="ib-window-toggle">
              <Toggle checked={humanAgent} onChange={onHumanAgent} label="Reply with the Human Agent tag" />
              <span className="tiny muted">Only for personal support replies written by a person, never for AI or promotional messages. Misuse can get the account restricted.</span>
            </div>
          )}
        </div>
      )
    }
    return (
      <div className="ib-window is-danger">
        <Icon name="lock" size={15} />
        <span className="grow">Reply window closed. The 7-day Human Agent period ended {win.humanAgentUntil ? longDate(win.humanAgentUntil) : ''}. You can reply when {first} writes again.</span>
        {mode}
      </div>
    )
  }

  if (conv.channel === 'tiktok') {
    const n = win.messagesLeft ?? 0
    if (!win.open) {
      return (
        <div className="ib-window is-danger">
          <Icon name="lock" size={15} />
          <span className="grow">{n === 0 && win.msLeft > 0 ? `All 10 messages used. TikTok lets you reply again once ${first} writes back.` : `48-hour window closed ${ago(win.closesAt, now)}. TikTok lets you reply again once ${first} writes back.`}</span>
          {mode}
        </div>
      )
    }
    return (
      <div className={`ib-window is-${n <= 2 ? 'warn' : tone}`} title="TikTok allows up to 10 messages within 48 hours of each client message.">
        <Icon name="clock" size={15} />
        <span><span className="ib-nowrap">48h window · <b className="mono num">{left}</b> left</span> · <span className="ib-nowrap"><b className="num">{n} of 10</b> messages left</span></span>
        {mode}
      </div>
    )
  }

  if (conv.channel === 'whatsapp') {
    return win.open ? (
      <div className={`ib-window is-${tone}`}>
        <Icon name="clock" size={15} />
        <span title="WhatsApp allows free-form replies within 24 hours of the client's last message.">Reply window closes in <b className="mono num">{left}</b></span>
        {mode}
      </div>
    ) : (
      <div className="ib-window is-danger">
        <Icon name="lock" size={15} />
        <span className="grow">24-hour window closed {ago(win.closesAt, now)}. Only approved WhatsApp templates can be sent until {first} replies.</span>
        {mode}
      </div>
    )
  }
  return null
}

// ---- assign -------------------------------------------------------------------------------------

function AssignMenu({ conv, compact, clientName }: { conv: Conversation; compact: boolean; clientName: string }) {
  const { state, me, can, actions } = useStore()
  const current = byId(state.users, conv.assignedTo)
  const people = state.users.filter(u => u.status === 'active' && (u.role === 'coordinator' || u.role === 'frontdesk'))
  if (!can('chats.reply')) {
    return current ? <span className="ib-assign-static tiny muted" title="Assigned to">{compact ? <UserAvatar userId={current.id} size={24} /> : <>Assigned to {current.name}</>}</span> : null
  }
  const lastClient = [...conv.messages].reverse().find(m => m.author === 'client')

  const assign = (userId: string | undefined) => {
    if (userId === conv.assignedTo) return
    const from = conv.assignedTo
    if (userId) actions.assignConversation(conv.id, userId)
    else actions.update(d => { const c = d.conversations.find(x => x.id === conv.id); if (c) c.assignedTo = undefined })
    actions.audit({ action: 'conversation.assigned', target: { type: 'conversation', id: conv.id, label: clientName }, detail: `${from ? userName(state, from) : 'Unassigned'} → ${userId ? userName(state, userId) : 'Unassigned'}` })
    if (userId && userId !== me.id) {
      actions.notify({ userIds: [userId] }, { kind: 'lead', title: `Chat assigned to you · ${clientName}`, body: lastClient?.text ?? 'Open the chat to catch up.', link: { page: 'inbox', id: conv.id } })
    }
    actions.toast(userId ? (userId === me.id ? 'Assigned to you.' : `Assigned to ${userName(state, userId)}. They’ve been notified.`) : 'Chat unassigned.', 'success')
  }

  const items: Array<MenuItem | 'sep'> = people.map(u => ({
    id: u.id,
    label: u.id === me.id ? `${u.name} (you)` : u.name,
    hint: `${ROLE_LABEL[u.role]} · ${u.onShift ? 'on shift' : 'off shift'}`,
    leading: <UserAvatar userId={u.id} size={22} />,
    checked: u.id === conv.assignedTo,
    onSelect: () => assign(u.id),
  }))
  if (people.every(p => p.id !== me.id) && conv.assignedTo !== me.id) {
    items.unshift({ id: 'me', label: `Assign to me (${me.name})`, icon: 'user', onSelect: () => assign(me.id) })
  }
  items.push('sep', {
    id: 'none', label: 'Unassign', icon: 'x', disabled: !conv.assignedTo || conv.handling === 'human',
    hint: conv.handling === 'human' ? 'Hand back to the AI or pause first' : undefined, onSelect: () => assign(undefined),
  })

  return (
    <Menu
      buttonLabel={current ? `Assigned to ${current.name}. Change` : 'Assign this chat'}
      buttonClass={`btn btn-ghost btn-sm ib-assign-btn ${compact ? 'is-compact' : ''}`}
      buttonContent={<>
        {current ? <UserAvatar userId={current.id} size={22} /> : <Icon name="userPlus" size={16} />}
        {!compact && <span className="truncate ib-assign-name">{current ? (current.id === me.id ? 'You' : current.name) : 'Assign to'}</span>}
        <Icon name="chevronDown" size={14} />
      </>}
      title="Assign to"
      items={items}
      width={280}
    />
  )
}
