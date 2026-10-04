import { useState } from 'react'
import { useStore, userName } from '../../lib/store'
import { canOpen } from '../../lib/permissions'
import { ago, dateTime, iso, ms, uid } from '../../lib/time'
import type { Proposal, QaFinding } from '../../lib/types'
import { Button, Card, ChannelBadge, Chip, EmptyState, ReasonDialog, Segmented } from '../../components/ui'
import { Icon } from '../../components/icons'
import { canSeeConversation, clientName, maskDigits } from './compute'
import { applyProposal, proposalTarget, pushAudit } from './playbookOps'

const openClaude = (prompt: string) => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt } }))

export function Improve() {
  return (
    <div className="stack xl">
      <Proposals />
      <QaFindings />
    </div>
  )
}

// ---- proposals ---------------------------------------------------------------------------------

function Proposals() {
  const { state, can, actions } = useStore()
  const [ask, setAsk] = useState<{ p: Proposal; kind: 'accept' | 'reject' } | null>(null)
  const canDecide = can('playbook.approve')
  const list = [...state.proposals].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || ms(b.createdAt) - ms(a.createdAt))
  const open = list.filter(p => p.status === 'open').length

  const decide = (p: Proposal, kind: 'accept' | 'reject', reason: string) => {
    if (kind === 'accept') {
      const target = proposalTarget(state.playbooks)
      const draftId = target.existing?.id ?? target.ids.id
      const draftName = target.existing?.version ?? target.ids.version
      actions.update(d => {
        const x = d.proposals.find(y => y.id === p.id)
        if (!x) return
        x.status = 'accepted'
        x.decidedBy = d.currentUserId
        applyProposal(d, x, target.ids)
        pushAudit(d, 'playbook.proposal_accepted', { id: p.id, label: p.title }, `Accepted; added to draft ${draftName}`, reason)
      })
      actions.toast(`Accepted. Added to draft ${draftName}, which needs an evaluation and both approvals before it goes live.`, 'success', { label: 'Open draft', page: 'ai', id: draftId })
    } else {
      actions.update(d => {
        const x = d.proposals.find(y => y.id === p.id)
        if (!x) return
        x.status = 'rejected'
        x.decidedBy = d.currentUserId
        pushAudit(d, 'playbook.proposal_rejected', { id: p.id, label: p.title }, 'Rejected', reason)
      })
      actions.toast('Rejected. Claude will take your reason into account next week.', 'info')
    }
  }

  return (
    <section aria-labelledby="ai-prop-title" className="stack">
      <div className="ai-section-head">
        <h2 id="ai-prop-title" className="ai-section-title">Claude's weekly proposals</h2>
        <span className="small muted">Every Monday Claude reads last week's chats and suggests playbook changes. Accepted changes go into a draft that still needs approval.</span>
      </div>
      {list.length === 0 ? (
        <Card><EmptyState icon="sparkles" title="No proposals yet" body="Claude's suggestions appear here every Monday, each with the evidence from real chats and the expected impact." /></Card>
      ) : (
        <div className="ai-proposals">
          {list.map(p => {
            const decision = state.audit.find(a => a.target.id === p.id && (a.action === 'playbook.proposal_accepted' || a.action === 'playbook.proposal_rejected'))
            return (
              <article key={p.id} className={`card card-padded ai-proposal is-${p.status}`}>
                <div className="row between wrap">
                  <span className="row tiny muted" style={{ gap: 6 }}>
                    <span className="ai-claude-mark" style={{ width: 20, height: 20 }} aria-hidden="true"><Icon name="sparkles" size={12} /></span>
                    Claude · <span title={dateTime(p.createdAt)}>{ago(p.createdAt)}</span>
                  </span>
                  <Chip tone={p.status === 'open' ? 'warn' : p.status === 'accepted' ? 'ok' : 'neutral'} icon={p.status === 'accepted' ? 'check' : p.status === 'rejected' ? 'x' : undefined}>
                    {p.status === 'open' ? 'Waiting for a decision' : p.status === 'accepted' ? 'Accepted' : 'Rejected'}
                  </Chip>
                </div>
                <h3 className="ai-proposal-title">{p.title}</h3>
                <dl className="ai-proposal-dl">
                  <div><dt>Evidence</dt><dd>{p.evidence}</dd></div>
                  <div><dt>Proposed change</dt><dd>{p.change}</dd></div>
                  <div><dt>Expected impact</dt><dd>{p.impact}</dd></div>
                </dl>
                <div className="ai-proposal-foot">
                  {p.status === 'open' ? (
                    canDecide ? (
                      <span className="row" style={{ gap: 8 }}>
                        <Button size="sm" variant="ghost" icon="x" onClick={() => setAsk({ p, kind: 'reject' })}>Reject</Button>
                        <Button size="sm" variant="primary" icon="check" onClick={() => setAsk({ p, kind: 'accept' })}>Accept</Button>
                      </span>
                    ) : <span className="tiny muted row" style={{ gap: 4 }}><Icon name="lock" size={12} /> A manager decides on proposals.</span>
                  ) : (
                    <span className="tiny muted">
                      {p.status === 'accepted' ? 'Accepted' : 'Rejected'} by {userName(state, p.decidedBy)}
                      {decision?.detail && p.status === 'accepted' && decision.detail.includes('draft') ? ` · ${decision.detail.replace(/^Accepted; /, '')}` : ''}
                      {decision?.reason ? ` · “${decision.reason}”` : ''}
                    </span>
                  )}
                  <Button size="sm" variant="ghost" icon="sparkles" onClick={() => openClaude(`Explain Claude's proposal "${p.title}". How strong is the evidence, and what could go wrong if we accept it?`)}>Discuss</Button>
                </div>
              </article>
            )
          })}
        </div>
      )}
      {open > 0 && !canDecide && <p className="tiny muted">{open} {open === 1 ? 'proposal is' : 'proposals are'} waiting for a manager.</p>}
      <ReasonDialog
        open={!!ask}
        onClose={() => setAsk(null)}
        title={ask?.kind === 'accept' ? 'Accept this proposal?' : 'Reject this proposal?'}
        confirmLabel={ask?.kind === 'accept' ? 'Accept and add to draft' : 'Reject proposal'}
        tone={ask?.kind === 'reject' ? 'danger' : 'primary'}
        requireReason={ask?.kind === 'reject'}
        reasonLabel={ask?.kind === 'accept' ? 'Note (optional, saved in the audit log)' : 'Why not? (saved in the audit log and shared with Claude)'}
        placeholder={ask?.kind === 'reject' ? 'e.g. Evening calls are not staffed on Fridays.' : undefined}
        body={ask ? (ask.kind === 'accept'
          ? <>“{ask.p.title}” goes into Claude's working draft. Nothing changes for clients until that draft is evaluated, approved by a manager, signed off by a clinician and published.</>
          : <>“{ask.p.title}” is closed and won't be added to the playbook.</>) : null}
        onConfirm={r => ask && decide(ask.p, ask.kind, r)}
      />
    </section>
  )
}

// ---- nightly QA --------------------------------------------------------------------------------

const SEVERITY: Record<QaFinding['severity'], { label: string; tone: 'danger' | 'warn' | 'info'; icon: 'alert' | 'info' }> = {
  violation: { label: 'Violation', tone: 'danger', icon: 'alert' },
  warn: { label: 'Warning', tone: 'warn', icon: 'alert' },
  info: { label: 'Info', tone: 'info', icon: 'info' },
}

function QaFindings() {
  const { state, me, can, actions } = useStore()
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [resolving, setResolving] = useState<QaFinding | null>(null)
  const canResolve = can('playbook.approve') || can('ai.mode')
  const canAll = can('chats.view_all')
  const canAssigned = can('chats.view_assigned')
  const inbox = canOpen(me, 'inbox')
  const sorted = [...state.qa].sort((a, b) => ms(b.at) - ms(a.at))
  const openList = sorted.filter(q => !q.resolved)
  const rows = filter === 'open' ? openList : sorted
  const lastRun = sorted[0]?.at
  const checked = state.metrics[state.metrics.length - 2]?.aiReplies ?? 0

  const setResolved = (q: QaFinding, resolved: boolean, note: string) => {
    const conv = state.conversations.find(c => c.id === q.conversationId)
    actions.update(d => {
      const x = d.qa.find(y => y.id === q.id)
      if (!x) return
      x.resolved = resolved
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: resolved ? 'qa.resolved' : 'qa.reopened', target: { type: 'conversation', id: q.conversationId, label: conv ? clientName(d, conv.clientId) : undefined }, detail: `${resolved ? 'Resolved' : 'Reopened'} QA finding: ${q.rule}`, reason: note || undefined })
    })
    actions.toast(resolved ? 'Finding resolved. Channel gates update straight away.' : 'Finding reopened.', resolved ? 'success' : 'info')
  }

  return (
    <section aria-labelledby="ai-qa-title" className="stack">
      <div className="ai-section-head">
        <h2 id="ai-qa-title" className="ai-section-title">Nightly QA findings</h2>
        <span className="small muted">
          {lastRun ? <>Last run <span title={dateTime(lastRun)}>{ago(lastRun)}</span> · {checked.toLocaleString()} AI replies checked against the guardrails · </> : null}
          {openList.length ? `${openList.length} ${openList.length === 1 ? 'needs' : 'need'} review` : 'Nothing needs review'}
        </span>
      </div>
      <div className="row between wrap">
        <Segmented label="Which findings to show" value={filter} onChange={setFilter} options={[{ id: 'open', label: `Needs review (${openList.length})` }, { id: 'all', label: `All findings (${sorted.length})` }]} />
        {!canResolve && <span className="tiny muted row" style={{ gap: 4 }}><Icon name="lock" size={12} /> Resolving needs AI mode or playbook approval rights.</span>}
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState icon="shield" title={filter === 'open' ? 'Nothing needs review' : 'No findings yet'} body="Every night Claude rereads the day's AI replies and flags banned phrases, missing disclosures, clinical advice and minors. Findings appear here the next morning." /></Card>
      ) : (
        <div className="table-wrap ai-qa-wrap">
          <table className="table ai-qa">
            <thead>
              <tr><th>Severity</th><th>Rule</th><th>Excerpt</th><th>Chat</th><th>Found</th><th><span className="sr-only">Action</span></th></tr>
            </thead>
            <tbody>
              {rows.map(q => {
                const conv = state.conversations.find(c => c.id === q.conversationId)
                const visible = conv ? canSeeConversation(conv, me, canAll, canAssigned) : false
                const sev = SEVERITY[q.severity]
                return (
                  <tr key={q.id} className={q.resolved ? 'is-resolved' : ''}>
                    <td data-label="Severity"><Chip tone={sev.tone} icon={sev.icon}>{sev.label}</Chip></td>
                    <td data-label="Rule" className="strong">{q.rule}</td>
                    <td data-label="Excerpt" className="ai-qa-excerpt">“{maskDigits(q.excerpt, can('clients.view_phone'))}”</td>
                    <td data-label="Chat">
                      {conv ? (
                        <span className="row" style={{ gap: 6 }}>
                          <ChannelBadge channel={conv.channel} label={false} size="sm" />
                          {visible && inbox
                            ? <button type="button" className="ai-link" onClick={() => actions.go('inbox', conv.id)}>{clientName(state, conv.clientId)}</button>
                            : <span>{clientName(state, conv.clientId)}</span>}
                        </span>
                      ) : <span className="muted">Chat deleted</span>}
                    </td>
                    <td data-label="Found" className="ai-nowrap muted" title={dateTime(q.at)}>{ago(q.at)}</td>
                    <td data-label="Status" className="ai-qa-action">
                      {q.resolved ? (
                        <span className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <Chip tone="ok" icon="check">Resolved</Chip>
                          {canResolve && q.severity !== 'info' && <Button size="sm" variant="ghost" onClick={() => setResolved(q, false, '')}>Reopen</Button>}
                        </span>
                      ) : canResolve ? (
                        <Button size="sm" variant="secondary" icon="check" onClick={() => setResolving(q)}>Resolve</Button>
                      ) : <Chip tone="warn">Open</Chip>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <ReasonDialog
        open={!!resolving}
        onClose={() => setResolving(null)}
        title="Resolve this finding?"
        confirmLabel="Mark as resolved"
        requireReason={false}
        reasonLabel="What did you do about it? (optional, saved in the audit log)"
        placeholder='e.g. Corrected the client in the chat; "permanent" is already a banned phrase.'
        body={resolving ? <>“{resolving.rule}”. Resolved findings stop counting against the channel's autopilot gate.</> : null}
        onConfirm={r => resolving && setResolved(resolving, true, r)}
      />
    </section>
  )
}
