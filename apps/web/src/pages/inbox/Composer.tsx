import { useId, type ReactNode, type RefObject } from 'react'
import { useStore } from '../../lib/store'
import { Button, Chip } from '../../components/ui'
import { Icon } from '../../components/icons'
import { Menu } from './Menu'
import { SAVED_REPLIES, fillReply } from './helpers'

export interface ComposerBlock { title: string; body: string; action?: ReactNode }

export function Composer({ clientName, text, onText, inputRef, editingDraft, editNote, onCancelEdit, block, placeholder, hint, onSend, onDraft, drafting, humanAgent }: {
  clientName: string
  text: string
  onText: (t: string) => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  editingDraft: boolean
  /** Replaces the default "sent as an approved AI reply" note while editing a draft. */
  editNote?: string
  onCancelEdit: () => void
  /** When set, replying is not possible right now; explains why. */
  block: ComposerBlock | null
  placeholder: string
  hint?: string
  onSend: () => void
  /** Shown as "Draft a reply" when there is no draft yet. */
  onDraft?: () => void
  drafting?: boolean
  humanAgent?: boolean
}) {
  const { me, can } = useStore()
  const id = useId()

  if (!can('chats.reply')) {
    return (
      <div className="ib-composer ib-composer-readonly" role="note">
        <Icon name="eye" size={16} />
        <span><b>View only.</b> Your role can read this chat but not reply or take it over. Ask a coordinator or manager if it needs a response.</span>
      </div>
    )
  }

  if (block) {
    return (
      <div className="ib-composer ib-composer-blocked" role="note">
        <Icon name="lock" size={16} />
        <div className="stack" style={{ gap: 2 }}>
          <b>{block.title}</b>
          <span className="small muted">{block.body}</span>
        </div>
        {block.action && <div className="ib-composer-block-action">{block.action}</div>}
      </div>
    )
  }

  const insert = (t: string) => {
    const filled = fillReply(t, clientName, me.name)
    onText(text.trim() ? `${text.replace(/\s+$/, '')}\n${filled}` : filled)
    requestAnimationFrame(() => {
      const el = inputRef.current
      if (el) {
        el.focus()
        el.setSelectionRange(el.value.length, el.value.length)
      }
    })
  }

  return (
    <div className={`ib-composer ${editingDraft ? 'is-editing' : ''}`}>
      {editingDraft && (
        <div className="ib-composer-banner">
          <Icon name="edit" size={14} />
          <span className="grow">{editNote ?? 'Editing the AI draft. Your version is sent as an approved AI reply and the edit is logged.'}</span>
          <button type="button" className="ib-link-btn" onClick={onCancelEdit}>Cancel</button>
        </div>
      )}
      <label htmlFor={id} className="sr-only">Reply to {clientName}</label>
      <textarea
        id={id}
        ref={inputRef}
        className="input ib-textarea"
        rows={2}
        value={text}
        placeholder={placeholder}
        onChange={e => onText(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            onSend()
          }
        }}
      />
      <div className="ib-composer-bar">
        <Menu
          buttonLabel="Saved replies"
          buttonClass="btn btn-ghost btn-sm"
          buttonContent={<><Icon name="message" size={15} /><span className="ib-hide-xs">Saved replies</span></>}
          placement="top"
          align="start"
          width={300}
          title="Saved replies"
          items={SAVED_REPLIES.map(r => ({ id: r.id, label: r.title, hint: fillReply(r.text, clientName, me.name).slice(0, 72) + '…', onSelect: () => insert(r.text) }))}
        />
        {onDraft && (
          <Button size="sm" variant="ghost" icon="sparkles" onClick={onDraft} loading={drafting}>Draft a reply</Button>
        )}
        {humanAgent && <Chip tone="info" icon="user">Human Agent tag on</Chip>}
        <span className="grow ib-composer-hint tiny faint">{hint ?? 'Enter to send · Shift+Enter for a new line'}</span>
        <Button size="sm" variant="primary" icon="send" onClick={onSend} disabled={!text.trim()}>{editingDraft ? 'Send edited draft' : 'Send'}</Button>
      </div>
    </div>
  )
}
