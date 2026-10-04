import { useLayoutEffect, useRef, useState } from 'react'
import type { Conversation } from '../../lib/types'
import { useStore } from '../../lib/store'
import { ago } from '../../lib/time'
import { Button, Chip, Progress, Spinner } from '../../components/ui'
import { Icon } from '../../components/icons'
import { maskPhonesInText } from './helpers'

const INTENT_LABEL: Record<string, string> = {
  price: 'Price question', booking: 'Wants to book', location: 'Location', qualify: 'Qualifying', clinical: 'Clinical question', complaint: 'Complaint',
  contact_shared: 'Number shared', asked_number: 'Asked for our number', opt_out: 'Opt-out', under18: 'Possible minor', reply: 'Reply',
}

export function DraftCard({ conv, sendBlocked, canEdit = true, editing, onEdit, onCancelEdit }: {
  conv: Conversation
  /** Why the draft cannot be sent as-is right now (closed window, opt-out…), or null. */
  sendBlocked: string | null
  /** False when the reply box is locked too (opt-out, closed window), so editing would lead nowhere. */
  canEdit?: boolean
  editing: boolean
  onEdit: () => void
  onCancelEdit: () => void
}) {
  const { state, can, actions, claudeBusy } = useStore()
  const [why, setWhy] = useState(false)
  const [busy, setBusy] = useState<null | 'rule' | 'claude'>(null)
  const [full, setFull] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const textRef = useRef<HTMLParagraphElement>(null)
  const d = conv.draft

  // offer "Show full draft" only when the clamped text is actually cut off
  useLayoutEffect(() => {
    const el = textRef.current
    if (!el) return
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(check) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [d?.text, full, editing, collapsed])
  if (!d) return null
  const canReply = can('chats.reply')
  const threshold = state.ai.confidenceThreshold
  const pct = Math.round(d.confidence * 100)
  const low = d.confidence < threshold

  const regenerate = async (live: boolean) => {
    setBusy(live ? 'claude' : 'rule')
    try {
      const note = await actions.regenerateDraft(conv.id, live)
      if (note) actions.toast(note, 'warn')
      else actions.toast(live ? 'Live Claude wrote a new draft from the approved playbook.' : 'New draft ready for review.', 'success')
    } finally {
      setBusy(null)
    }
    if (editing) onCancelEdit()
  }

  const send = () => {
    actions.approveDraft(conv.id)
    actions.toast('AI draft sent.', 'success')
  }

  const discard = () => {
    actions.discardDraft(conv.id)
    if (editing) onCancelEdit()
    actions.toast('Draft discarded. Write your own reply or ask for a new draft.', 'info')
  }

  const liveBusy = busy === 'claude' || (busy !== null && claudeBusy)

  return (
    <section className="ib-draft" aria-label="AI draft reply">
      <div className="ib-draft-head">
        <span className="ib-draft-title" title={`Drafted ${ago(d.createdAt)}`}><Icon name="sparkles" size={15} />AI draft</span>
        <Chip tone="neutral">{INTENT_LABEL[d.intent] ?? d.intent.replace(/_/g, ' ')}</Chip>
        <span className="ib-draft-conf" title={`The AI hands over to a person below ${Math.round(threshold * 100)}%`}>
          <span className="tiny muted ib-conf-label">Confidence</span>
          <Progress value={pct} tone={low ? 'warn' : 'ok'} label={`Confidence ${pct}%`} />
          <span className={`small strong num ${low ? 'ib-warn-text' : ''}`}>{pct}%</span>
        </span>
        {claudeBusy && <span className="ib-busy tiny muted" role="status"><Spinner />Claude is writing…</span>}
        <button type="button" className="icon-btn icon-btn-sm ib-draft-collapse" aria-expanded={!collapsed} aria-label={collapsed ? 'Show the AI draft' : 'Minimise the AI draft'} title={collapsed ? 'Show the AI draft' : 'Minimise the AI draft'} onClick={() => setCollapsed(c => !c)}>
          <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={16} />
        </button>
      </div>
      {!collapsed && <>

      {editing ? (
        <p className="small muted ib-draft-editing"><Icon name="edit" size={14} />Editing in the reply box below.</p>
      ) : (
        <p ref={textRef} className={`ib-draft-text ${full ? '' : 'is-clamped'}`} dir="auto">{maskPhonesInText(d.text, can('clients.view_phone'))}</p>
      )}

      <div className="ib-draft-links">
        <button type="button" className="ib-link-btn" aria-expanded={why} onClick={() => setWhy(w => !w)}>
          <Icon name={why ? 'chevronDown' : 'chevronRight'} size={14} />Why this reply
        </button>
        {!editing && (overflowing || full) && (
          <button type="button" className="ib-link-btn" onClick={() => setFull(f => !f)}>{full ? 'Show less' : 'Show full draft'}</button>
        )}
      </div>
      {why && (
        <ul className="ib-draft-why">
          {d.reasons.map((r, i) => <li key={i}>{r}</li>)}
          {low && <li>Confidence is below the {Math.round(threshold * 100)}% handoff threshold, so a person must review it.</li>}
        </ul>
      )}

      {sendBlocked && <p className="small ib-warn-text ib-draft-blocked"><Icon name="info" size={14} />{sendBlocked}</p>}

      {canReply ? (
        <div className="ib-draft-actions">
          {editing ? (
            <Button size="sm" variant="ghost" icon="x" onClick={onCancelEdit}>Cancel edit</Button>
          ) : (
            <>
              <Button size="sm" variant="primary" icon="send" onClick={send} disabled={!!sendBlocked || busy !== null}>Send</Button>
              <Button size="sm" variant="secondary" icon="edit" onClick={onEdit} disabled={busy !== null || !canEdit}>Edit</Button>
            </>
          )}
          <Button size="sm" variant="ghost" icon="refresh" title="Write a new draft with the built-in demo engine" onClick={() => regenerate(false)} loading={busy === 'rule'} disabled={busy !== null}><span className="ib-collapse">Regenerate</span></Button>
          <Button size="sm" variant="subtle" icon="sparkles" loading={liveBusy} onClick={() => regenerate(true)} disabled={busy !== null}>
            {liveBusy ? 'Asking Claude…' : 'Draft with live Claude'}
          </Button>
          <Button size="sm" variant="ghost" icon="trash" title="Discard this draft" onClick={discard} disabled={busy !== null}><span className="ib-collapse">Discard</span></Button>
        </div>
      ) : (
        <p className="tiny muted">View only. Your role can read drafts but not send them.</p>
      )}
      </>}
    </section>
  )
}
