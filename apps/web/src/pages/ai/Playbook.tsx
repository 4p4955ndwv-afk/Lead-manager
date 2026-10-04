import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore, userName } from '../../lib/store'
import { ago, dateTime, iso, shortDate } from '../../lib/time'
import type { PlaybookSection, PlaybookVersion } from '../../lib/types'
import { Button, Card, Chip, EmptyState, Field, IconButton, ReasonDialog, Segmented, Toggle, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { STATUS_LABEL, STATUS_TONE, diffSections, evaluateDraft, previousApproved, sortVersions, type SectionDiff } from './compute'
import { createDraft, newDraftIds, pushAudit } from './playbookOps'
import { Scorecard } from './Scorecard'

type DialogKind = 'approve' | 'signoff' | 'publish' | 'rollback' | 'sendback' | 'delete' | 'submit'

export function AuthorMark({ author, size = 22 }: { author: string; size?: number }) {
  if (author === 'claude') return <span className="ai-claude-mark" style={{ width: size, height: size }} title="Claude"><Icon name="sparkles" size={Math.round(size * 0.6)} /></span>
  return <UserAvatar userId={author} size={size} />
}

export function PlaybookTab({ focusId }: { focusId?: string }) {
  const { state, can, actions } = useStore()
  const list = sortVersions(state.playbooks)
  const live = state.playbooks.find(p => p.status === 'live')
  const pending = state.playbooks.find(p => p.status === 'pending')
  const [sel, setSel] = useState<string | undefined>(focusId)
  useEffect(() => { if (focusId) setSel(focusId) }, [focusId])
  const selected = state.playbooks.find(p => p.id === sel) ?? pending ?? live ?? list[0]
  const canPropose = can('playbook.propose') || can('playbook.approve')
  const [editing, setEditing] = useState<string | null>(null)

  const newDraft = (base: PlaybookVersion | undefined) => {
    const ids = newDraftIds(state.playbooks)
    actions.update(d => {
      const b = base ? d.playbooks.find(p => p.id === base.id) : undefined
      const v = createDraft(d, ids, b, d.currentUserId)
      pushAudit(d, 'playbook.draft', { id: v.id, label: `Playbook ${v.version}` }, `Draft created from ${b?.version ?? 'a blank page'}`)
    })
    setSel(ids.id)
    setEditing(ids.id)
    actions.toast(`Draft ${ids.version} created${base ? ` from ${base.version}` : ''}. Edit it, run the evaluation, then submit it for approval.`, 'success')
  }

  if (!selected) {
    return (
      <Card>
        <EmptyState icon="file" title="No playbook yet" body="The playbook tells the AI how to reply: tone, prices, when to ask for a number and what it must never say. Start a draft to write the first one."
          action={canPropose ? <Button variant="primary" icon="plus" onClick={() => newDraft(undefined)}>Start a draft</Button> : undefined} />
      </Card>
    )
  }

  return (
    <div className="ai-pb">
      <nav className="card ai-versions" aria-label="Playbook versions">
        <div className="ai-versions-head">
          <h2 className="card-title">Versions</h2>
          {canPropose && <Button size="sm" variant="secondary" icon="plus" onClick={() => newDraft(live)}>New draft</Button>}
        </div>
        <ul className="ai-version-list">
          {list.map(v => (
            <li key={v.id}>
              <button type="button" className={`ai-version ${v.id === selected.id ? 'is-active' : ''}`} aria-current={v.id === selected.id ? 'true' : undefined} onClick={() => { setSel(v.id); if (editing && editing !== v.id) setEditing(null) }}>
                <span className="row between">
                  <span className="ai-version-name">{v.version}</span>
                  <Chip tone={STATUS_TONE[v.status]}>{STATUS_LABEL[v.status]}</Chip>
                </span>
                <span className="row" style={{ gap: 6 }}>
                  <AuthorMark author={v.author} size={18} />
                  <span className="small truncate">{v.author === 'claude' ? 'Claude' : userName(state, v.author)}</span>
                  <span className="tiny faint ai-nowrap">· {shortDate(v.createdAt)}</span>
                </span>
                <span className="tiny muted">
                  Eval {v.evalScore ? <b className="num">{v.evalScore}%</b> : 'not run'} · <span className={v.violations ? 'ai-bad' : ''}>{v.violations} {v.violations === 1 ? 'violation' : 'violations'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!canPropose && <p className="tiny muted ai-versions-foot"><Icon name="lock" size={12} /> Drafting needs the “Propose playbook changes” permission.</p>}
      </nav>

      <div className="stack lg">
        <VersionDetail key={selected.id} v={selected} live={live} editing={editing === selected.id} setEditing={on => setEditing(on ? selected.id : null)}
          onNewDraft={newDraft} onSelect={setSel} />
        <Scorecard version={selected} compareTo={selected.status !== 'live' ? live : undefined} reference={live} />
      </div>
    </div>
  )
}

function VersionDetail({ v, live, editing, setEditing, onNewDraft, onSelect }: {
  v: PlaybookVersion; live?: PlaybookVersion; editing: boolean; setEditing: (on: boolean) => void
  onNewDraft: (base: PlaybookVersion | undefined) => void; onSelect: (id: string | undefined) => void
}) {
  const { state, me, can, actions } = useStore()
  const [dialog, setDialog] = useState<DialogKind | null>(null)
  const [view, setView] = useState<'compare' | 'single'>(v.status === 'pending' || v.status === 'draft' ? 'compare' : 'single')
  const [onlyChanges, setOnlyChanges] = useState(() => {
    if (!live || live.id === v.id) return false
    const d = diffSections(live.sections, v.sections)
    return d.filter(x => x.kind === 'same').length > d.filter(x => x.kind !== 'same').length
  })
  const [running, setRunning] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const canPropose = can('playbook.propose') || can('playbook.approve')
  const canApprove = can('playbook.approve')
  const canSignoff = can('playbook.clinical_signoff')
  const pendingOther = state.playbooks.find(p => p.status === 'pending' && p.id !== v.id)
  const prev = v.status === 'live' ? previousApproved(state.playbooks, v) : undefined
  const bothApproved = !!(v.approvals.manager && v.approvals.clinician)
  const selfAuthored = v.author === me.id
  const label = `Playbook ${v.version}`
  const comparable = !!live && live.id !== v.id && (v.status === 'pending' || v.status === 'draft')
  const diffs = comparable ? diffSections(live!.sections, v.sections) : []
  const counts = { changed: diffs.filter(d => d.kind === 'changed').length, added: diffs.filter(d => d.kind === 'added').length, removed: diffs.filter(d => d.kind === 'removed').length, same: diffs.filter(d => d.kind === 'same').length }

  const runEval = () => {
    const res = evaluateDraft(state, v, live)
    setRunning(true)
    timer.current = window.setTimeout(() => {
      setRunning(false)
      actions.update(d => {
        const x = d.playbooks.find(p => p.id === v.id)
        if (!x) return
        x.evalScore = res.score
        x.violations = res.violations
        pushAudit(d, 'playbook.eval', { id: v.id, label }, `Golden set: ${res.score}%, ${res.violations} guardrail ${res.violations === 1 ? 'violation' : 'violations'}`)
      })
      actions.toast(res.violations ? `${v.version} scored ${res.score}% with ${res.violations} guardrail ${res.violations === 1 ? 'violation' : 'violations'}. ${res.notes[0] ?? ''}` : `${v.version} scored ${res.score}% on the golden set with no violations.${res.notes.length ? ' ' + res.notes[0] : ''}`, res.violations ? 'warn' : 'success')
    }, 1400)
  }

  const confirm = (kind: DialogKind, reason: string) => {
    const at = iso(Date.now())
    switch (kind) {
      case 'approve':
        actions.update(d => {
          const x = d.playbooks.find(p => p.id === v.id)
          if (!x) return
          x.approvals.manager = { by: d.currentUserId, at }
          pushAudit(d, 'playbook.approve', { id: v.id, label }, 'Manager approval given', reason)
        })
        actions.toast(v.approvals.clinician ? `Approved. ${v.version} has both approvals and can be published.` : `Approved. ${v.version} now needs clinical sign-off.`, 'success')
        break
      case 'signoff':
        actions.update(d => {
          const x = d.playbooks.find(p => p.id === v.id)
          if (!x) return
          x.approvals.clinician = { by: d.currentUserId, at }
          pushAudit(d, 'playbook.clinical_signoff', { id: v.id, label }, 'Clinical sign-off given', reason)
        })
        actions.toast(v.approvals.manager ? `Signed off. ${v.version} has both approvals and can be published.` : `Signed off. ${v.version} now needs a manager's approval.`, 'success')
        break
      case 'publish': {
        const old = live
        actions.update(d => {
          const x = d.playbooks.find(p => p.id === v.id)
          if (!x) return
          d.playbooks.forEach(p => { if (p.status === 'live') p.status = 'retired' })
          x.status = 'live'
          pushAudit(d, 'playbook.publish', { id: v.id, label }, `${v.version} is live${old ? `; ${old.version} retired` : ''}`, reason)
        })
        actions.notify({ roles: ['owner', 'manager', 'coordinator'] }, { kind: 'ai', title: `Playbook ${v.version} is live`, body: `The AI now replies using ${v.version}${old ? ` instead of ${old.version}` : ''}. ${v.summary}`, link: { page: 'ai', id: v.id } })
        actions.toast(`${v.version} is live. The AI uses it for every new reply.`, 'success')
        break
      }
      case 'rollback':
        if (!prev) return
        actions.update(d => {
          const x = d.playbooks.find(p => p.id === v.id)
          const y = d.playbooks.find(p => p.id === prev.id)
          if (!x || !y) return
          x.status = 'retired'
          y.status = 'live'
          pushAudit(d, 'playbook.rollback', { id: prev.id, label: `Playbook ${prev.version}` }, `Rolled back from ${v.version} to ${prev.version}`, reason)
        })
        actions.notify({ roles: ['owner', 'manager', 'coordinator'] }, { kind: 'ai', title: `Playbook rolled back to ${prev.version}`, body: `${userName(state, me.id)}: ${reason}`, link: { page: 'ai', id: prev.id } })
        onSelect(prev.id)
        actions.toast(`Rolled back. ${prev.version} is live again; ${v.version} is retired.`, 'warn')
        break
      case 'sendback':
        actions.update(d => {
          const x = d.playbooks.find(p => p.id === v.id)
          if (!x) return
          x.status = 'draft'
          x.approvals = {}
          pushAudit(d, 'playbook.sent_back', { id: v.id, label }, 'Sent back to draft; approvals cleared', reason)
        })
        if (v.author !== 'claude') actions.notify({ userIds: [v.author] }, { kind: 'ai', title: `${label} was sent back to draft`, body: `${userName(state, me.id)}: ${reason}`, link: { page: 'ai', id: v.id } })
        actions.toast(`${v.version} is back in draft. Its approvals were cleared.`, 'info')
        break
      case 'delete':
        actions.update(d => {
          d.playbooks = d.playbooks.filter(p => p.id !== v.id)
          pushAudit(d, 'playbook.draft_deleted', { id: v.id, label }, 'Draft deleted', reason)
        })
        onSelect(undefined)
        actions.toast(`Draft ${v.version} deleted.`, 'info')
        break
      case 'submit':
        actions.update(d => {
          const x = d.playbooks.find(p => p.id === v.id)
          if (!x) return
          x.status = 'pending'
          x.approvals = {}
          pushAudit(d, 'playbook.submitted', { id: v.id, label }, `Submitted for approval (eval ${v.evalScore}%)`, reason)
        })
        actions.notify({ roles: ['manager', 'clinician'] }, { kind: 'ai', title: `${label} is waiting for approval`, body: `${userName(state, me.id)} submitted it. Golden-set score ${v.evalScore}%. Needs a manager's approval and clinical sign-off.`, link: { page: 'ai', id: v.id } })
        actions.toast(`${v.version} submitted. Managers and clinicians have been asked to review it.`, 'success')
        break
    }
  }

  const DIALOG: Record<DialogKind, { title: string; body: ReactNode; confirm: string; requireReason: boolean; tone?: 'danger'; reasonLabel?: string; placeholder?: string }> = {
    approve: { title: `Approve ${v.version} as manager?`, confirm: 'Approve', requireReason: false, reasonLabel: 'Note (optional, saved in the audit log)', body: <>You confirm the wording, tone and sales guidance in {v.version} are right for {state.settings.orgName}. It still needs clinical sign-off before it can go live.</> },
    signoff: { title: `Give clinical sign-off for ${v.version}?`, confirm: 'Give clinical sign-off', requireReason: false, reasonLabel: 'Note (optional, saved in the audit log)', body: <>You confirm {v.version} gives no medical advice, routes clinical questions to a clinician and makes no promises about results.</> },
    publish: { title: `Publish ${v.version}?`, confirm: `Publish ${v.version}`, requireReason: false, reasonLabel: 'Note (optional, saved in the audit log)', body: <>The AI starts using {v.version} for every new reply and draft{live ? <>, and {live.version} is retired. You can roll back to {live.version} at any time</> : ''}.</> },
    rollback: { title: `Roll back to ${prev?.version ?? 'the previous version'}?`, confirm: `Roll back to ${prev?.version ?? 'previous'}`, requireReason: true, tone: 'danger', placeholder: 'e.g. v1 is asking for numbers too early in Arabic chats.', body: <>{prev?.version} goes live again straight away and {v.version} is retired. Owners, managers and coordinators are notified.</> },
    sendback: { title: `Send ${v.version} back to draft?`, confirm: 'Send back to draft', requireReason: true, tone: 'danger', placeholder: 'e.g. Removes the price guidance; please keep the approved ranges.', body: <>Any approvals already given are cleared, and the author is told why.</> },
    delete: { title: `Delete draft ${v.version}?`, confirm: 'Delete draft', requireReason: true, tone: 'danger', placeholder: 'e.g. Superseded by v1.2.', body: <>The draft and its edits are removed. This can't be undone.</> },
    submit: { title: `Submit ${v.version} for approval?`, confirm: 'Submit for approval', requireReason: false, reasonLabel: 'What changed and why (optional, saved in the audit log)', body: <>Managers and clinicians are notified. {v.version} goes live only after a manager's approval and clinical sign-off.</> },
  }
  const dlg = dialog ? DIALOG[dialog] : null

  const author = v.author === 'claude' ? 'Claude' : userName(state, v.author)
  const submitBlock = v.evalScore === 0 ? 'Run the evaluation first.' : v.violations ? 'Fix the guardrail violations first.' : pendingOther ? `${pendingOther.version} is already waiting for approval. Publish it or send it back first.` : v.sections.length === 0 ? 'Add at least one section.' : null

  return (
    <Card className="ai-detail" padded>
      <div className="ai-detail-head">
        <div className="stack" style={{ gap: 4 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <h2 className="ai-detail-version">Playbook {v.version}</h2>
            <Chip tone={STATUS_TONE[v.status]}>{STATUS_LABEL[v.status]}</Chip>
          </div>
          <span className="row small muted" style={{ gap: 6 }}>
            <AuthorMark author={v.author} size={20} />
            <span>{v.author === 'claude' ? 'Drafted by Claude' : `Written by ${author}`} · <span title={dateTime(v.createdAt)}>{ago(v.createdAt)}</span></span>
          </span>
        </div>
        <div className="ai-detail-scores">
          <div><span className="ai-big num">{v.evalScore ? `${v.evalScore}%` : '—'}</span><span className="tiny muted">Golden-set score</span></div>
          <div><span className={`ai-big num ${v.violations ? 'ai-bad' : ''}`}>{v.evalScore || v.status !== 'draft' ? v.violations : '—'}</span><span className="tiny muted">Violations</span></div>
        </div>
      </div>
      <p className="ai-detail-summary">{v.summary}</p>

      {/* actions by status */}
      <div className="ai-detail-actions">
        {v.status === 'live' && (
          <>
            {canApprove && <Button size="sm" variant="secondary" icon="history" disabled={!prev} onClick={() => setDialog('rollback')} title={prev ? undefined : 'No earlier approved version to go back to'}>Roll back to {prev ? prev.version : 'previous'}</Button>}
            {canPropose && <Button size="sm" variant="ghost" icon="plus" onClick={() => onNewDraft(v)}>New draft from {v.version}</Button>}
            {canApprove && !prev && <span className="tiny muted">No earlier approved version to roll back to.</span>}
          </>
        )}
        {v.status === 'pending' && canApprove && <Button size="sm" variant="ghost" icon="refresh" onClick={() => setDialog('sendback')}>Send back to draft</Button>}
        {v.status === 'draft' && canPropose && !editing && (
          <>
            <Button size="sm" variant="secondary" icon="edit" onClick={() => setEditing(true)} disabled={running}>Edit</Button>
            <Button size="sm" variant="secondary" icon="chart" loading={running} onClick={runEval}>{running ? 'Running 240 test chats…' : v.evalScore ? 'Run evaluation again' : 'Run evaluation'}</Button>
            <Button size="sm" variant="primary" icon="send" disabled={!!submitBlock || running} onClick={() => setDialog('submit')}>Submit for approval</Button>
            <IconButton icon="trash" label={`Delete draft ${v.version}`} tone="danger" onClick={() => setDialog('delete')} />
            {submitBlock && <span className="tiny muted">{submitBlock}</span>}
          </>
        )}
        {v.status === 'retired' && canPropose && v.sections.length > 0 && <Button size="sm" variant="ghost" icon="copy" onClick={() => onNewDraft(v)}>Restore as a new draft</Button>}
      </div>

      {v.status === 'pending' && <Approvals v={v} canApprove={canApprove} canSignoff={canSignoff} selfAuthored={selfAuthored} bothApproved={bothApproved} onAsk={setDialog} />}
      {v.status === 'live' && (
        <p className="small muted ai-approved-line">
          <Icon name="shield" size={14} />
          {v.approvals.manager ? <>Approved by {userName(state, v.approvals.manager.by)} {ago(v.approvals.manager.at)}</> : 'No manager approval recorded'}
          {' · '}
          {v.approvals.clinician ? <>clinical sign-off by {userName(state, v.approvals.clinician.by)} {ago(v.approvals.clinician.at)}</> : 'no clinical sign-off recorded'}
        </p>
      )}

      {editing ? (
        <DraftEditor v={v} onDone={() => setEditing(false)} />
      ) : (
        <div className="stack">
          {comparable && (
            <div className="row between wrap ai-view-bar">
              <Segmented label="How to show this version" value={view} onChange={setView} options={[{ id: 'compare', label: `Compare with live ${live!.version}` }, { id: 'single', label: `${v.version} only` }]} />
              {view === 'compare' && (
                <span className="row wrap" style={{ gap: 12 }}>
                  <span className="tiny muted">{[counts.changed && `${counts.changed} changed`, counts.added && `${counts.added} new`, counts.removed && `${counts.removed} removed`, counts.same && `${counts.same} unchanged`].filter(Boolean).join(' · ')}</span>
                  <Toggle checked={onlyChanges} onChange={setOnlyChanges} label="Only changes" />
                </span>
              )}
            </div>
          )}
          {comparable && view === 'compare'
            ? <Compare rows={diffs.filter(d => !onlyChanges || d.kind !== 'same')} base={live!} next={v} />
            : <Sections v={v} />}
        </div>
      )}

      {dlg && (
        <ReasonDialog open={!!dialog} onClose={() => setDialog(null)} title={dlg.title} body={dlg.body} confirmLabel={dlg.confirm} requireReason={dlg.requireReason}
          tone={dlg.tone ?? 'primary'} reasonLabel={dlg.reasonLabel} placeholder={dlg.placeholder} onConfirm={r => dialog && confirm(dialog, r)} />
      )}
    </Card>
  )
}

function Approvals({ v, canApprove, canSignoff, selfAuthored, bothApproved, onAsk }: {
  v: PlaybookVersion; canApprove: boolean; canSignoff: boolean; selfAuthored: boolean; bothApproved: boolean; onAsk: (k: DialogKind) => void
}) {
  const { state } = useStore()
  const slot = (title: string, given: { by: string; at: string } | undefined, allowed: boolean, cta: string, kind: DialogKind, who: string, permName: string) => (
    <li className={`ai-approval ${given ? 'is-given' : ''}`}>
      <span className="ai-approval-icon" aria-hidden="true"><Icon name={given ? 'check' : 'clock'} size={15} strokeWidth={2} /></span>
      <span className="stack grow" style={{ gap: 0 }}>
        <span className="strong small">{title}</span>
        <span className="tiny muted">{given ? <>{userName(state, given.by)} · <span title={dateTime(given.at)}>{ago(given.at)}</span></> : `Waiting for ${who}`}</span>
      </span>
      {!given && (allowed
        ? (kind === 'approve' && selfAuthored
          ? <span className="tiny muted ai-approval-note">You wrote this version, so another manager must approve it.</span>
          : <Button size="sm" variant="secondary" icon="check" onClick={() => onAsk(kind)}>{cta}</Button>)
        : <span className="tiny muted ai-approval-note"><Icon name="lock" size={12} /> Needs “{permName}”</span>)}
    </li>
  )
  return (
    <div className="ai-approvals" aria-label="Approvals">
      <ul>
        {slot('Manager approval', v.approvals.manager, canApprove, 'Approve as manager', 'approve', 'a manager', 'Approve playbook versions')}
        {slot('Clinical sign-off', v.approvals.clinician, canSignoff, 'Give clinical sign-off', 'signoff', 'a clinician', 'Clinical sign-off')}
      </ul>
      <div className="ai-approvals-foot">
        <span className="tiny muted">{bothApproved ? 'Both approvals are in. Publishing makes this version live for every new reply.' : 'Publishing needs a manager’s approval and clinical sign-off.'}</span>
        {canApprove && <Button size="sm" variant="primary" icon="arrowUpRight" disabled={!bothApproved} onClick={() => onAsk('publish')}>Publish {v.version}</Button>}
      </div>
    </div>
  )
}

const KIND_CHIP: Record<SectionDiff['kind'], { label: string; tone: 'warn' | 'ok' | 'danger' | 'neutral' }> = {
  changed: { label: 'Changed', tone: 'warn' }, added: { label: 'New', tone: 'ok' }, removed: { label: 'Removed', tone: 'danger' }, same: { label: 'Unchanged', tone: 'neutral' },
}

function Compare({ rows, base, next }: { rows: SectionDiff[]; base: PlaybookVersion; next: PlaybookVersion }) {
  if (!rows.length) return <p className="small muted">No changes from {base.version}.</p>
  return (
    <div className="ai-cmp">
      <div className="ai-cmp-cols" aria-hidden="true">
        <span>Live · {base.version}</span>
        <span>{next.version} · {STATUS_LABEL[next.status]}</span>
      </div>
      {rows.map(r => (
        <article key={r.key} className={`ai-cmp-row is-${r.kind}`}>
          <div className="ai-cmp-title">
            <h4>{r.title}</h4>
            <Chip tone={KIND_CHIP[r.kind].tone}>{KIND_CHIP[r.kind].label}</Chip>
          </div>
          <div className="ai-cmp-cells">
            <div className="ai-cmp-cell is-before">
              <span className="ai-cmp-label">Live {base.version}</span>
              {r.before != null ? <p>{r.before}</p> : <p className="faint">Not in {base.version}</p>}
            </div>
            <div className="ai-cmp-cell is-after">
              <span className="ai-cmp-label">{next.version}</span>
              {r.after != null ? <p>{r.after}</p> : <p className="faint">Removed in {next.version}</p>}
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function Sections({ v }: { v: PlaybookVersion }) {
  if (!v.sections.length) return <EmptyState icon="file" title="No sections" body={v.status === 'retired' ? 'This early version was retired before its sections were kept.' : 'Edit the draft to add sections such as Tone, Prices and Asking for the number.'} />
  return (
    <ol className="ai-sections">
      {v.sections.map((s, i) => (
        <li key={i}>
          <h4>{s.title}</h4>
          <p>{s.body}</p>
        </li>
      ))}
    </ol>
  )
}

function DraftEditor({ v, onDone }: { v: PlaybookVersion; onDone: () => void }) {
  const { actions } = useStore()
  const [summary, setSummary] = useState(v.summary)
  const [secs, setSecs] = useState<PlaybookSection[]>(() => structuredClone(v.sections))
  const [tried, setTried] = useState(false)
  const invalid = secs.some(s => !s.title.trim() || !s.body.trim())
  const set = (i: number, patch: Partial<PlaybookSection>) => setSecs(xs => xs.map((s, k) => (k === i ? { ...s, ...patch } : s)))
  const move = (i: number, dir: -1 | 1) => setSecs(xs => {
    const j = i + dir
    if (j < 0 || j >= xs.length) return xs
    const out = [...xs]
    ;[out[i], out[j]] = [out[j], out[i]]
    return out
  })
  const save = () => {
    setTried(true)
    if (invalid) return
    const clean = secs.map(s => ({ title: s.title.trim(), body: s.body.trim() }))
    const changed = diffSections(v.sections, clean).filter(d => d.kind !== 'same').length
    actions.update(d => {
      const x = d.playbooks.find(p => p.id === v.id)
      if (!x) return
      x.sections = clean
      x.summary = summary.trim() || x.summary
      x.evalScore = 0
      x.violations = 0
      pushAudit(d, 'playbook.edit', { id: v.id, label: `Playbook ${v.version}` }, `Edited ${changed} ${changed === 1 ? 'section' : 'sections'}`)
    })
    actions.toast(`Saved ${v.version}. Run the evaluation again before submitting it.`, 'success')
    onDone()
  }
  return (
    <div className="stack lg ai-editor">
      <Field label="Summary" hint="One or two sentences approvers read first.">
        {id => <textarea id={id} className="input" rows={2} value={summary} onChange={e => setSummary(e.target.value)} />}
      </Field>
      <ol className="ai-editor-list">
        {secs.map((s, i) => (
          <li key={i} className="ai-editor-item">
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <div className="grow">
                <Field label={`Section ${i + 1} title`} error={tried && !s.title.trim() ? 'Give the section a title.' : undefined}>
                  {id => <input id={id} className="input" value={s.title} onChange={e => set(i, { title: e.target.value })} />}
                </Field>
              </div>
              <IconButton icon="chevronDown" label={`Move section ${i + 1} down`} disabled={i === secs.length - 1} onClick={() => move(i, 1)} />
              <IconButton icon="chevronDown" label={`Move section ${i + 1} up`} className="ai-flip" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon="trash" tone="danger" label={`Remove section ${i + 1}`} onClick={() => setSecs(xs => xs.filter((_, k) => k !== i))} />
            </div>
            <Field label="Guidance for the AI" error={tried && !s.body.trim() ? 'Write what the AI should do.' : undefined}>
              {id => <textarea id={id} className="input" rows={3} value={s.body} onChange={e => set(i, { body: e.target.value })} />}
            </Field>
          </li>
        ))}
      </ol>
      <div className="row between wrap">
        <Button size="sm" variant="ghost" icon="plus" onClick={() => setSecs(xs => [...xs, { title: '', body: '' }])}>Add section</Button>
        <span className="row" style={{ gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
          <Button size="sm" variant="primary" icon="check" onClick={save}>Save draft</Button>
        </span>
      </div>
    </div>
  )
}
