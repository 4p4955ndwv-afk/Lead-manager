// State changes for playbook versions and proposals. Each runs inside actions.update(d => ...).
// Ids and version names are worked out before the update (reducers may run twice in development).
import type { DemoState, Notification, PlaybookVersion, Proposal, Role } from '../../lib/types'
import type { Actions } from '../../lib/store'
import { canOpen } from '../../lib/permissions'
import { iso, uid } from '../../lib/time'
import { nextVersionName } from './compute'

/** Notifies active people in these roles. Anyone who can't open the AI page (e.g. coordinators) gets a link to the inbox instead of a dead link. */
export function notifyRoles(actions: Actions, s: DemoState, roles: Role[], n: Omit<Notification, 'id' | 'at' | 'userId' | 'read'>) {
  const people = s.users.filter(u => roles.includes(u.role) && u.status === 'active')
  const can = people.filter(u => canOpen(u, 'ai')).map(u => u.id)
  const cannot = people.filter(u => !canOpen(u, 'ai')).map(u => u.id)
  if (can.length) actions.notify({ userIds: can }, n)
  if (cannot.length) actions.notify({ userIds: cannot }, { ...n, link: { page: 'inbox' } })
}

export function pushAudit(d: DemoState, action: string, target: { id: string; label: string }, detail: string, reason?: string) {
  d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action, target: { type: 'playbook', ...target }, detail, reason: reason || undefined })
}

export interface NewDraftIds { id: string; version: string }

/** Id and name for the next draft. Call outside actions.update. */
export function newDraftIds(list: PlaybookVersion[]): NewDraftIds {
  return { id: uid('pb'), version: nextVersionName(list) }
}

/** A new draft copied from `base`, added to the top of the list. */
export function createDraft(d: DemoState, ids: NewDraftIds, base: PlaybookVersion | undefined, author: string, summary?: string): PlaybookVersion {
  const v: PlaybookVersion = {
    id: ids.id,
    version: ids.version,
    status: 'draft',
    createdAt: iso(Date.now()),
    author,
    summary: summary ?? (base ? `Draft based on ${base.version}.` : 'New draft.'),
    sections: structuredClone(base?.sections ?? []),
    approvals: {},
    evalScore: 0,
    violations: 0,
  }
  d.playbooks.unshift(v)
  return v
}

/** The draft an accepted proposal will land in: Claude's open draft, or a new one. */
export function proposalTarget(list: PlaybookVersion[]): { existing?: PlaybookVersion; ids: NewDraftIds } {
  return { existing: list.find(v => v.status === 'draft' && v.author === 'claude'), ids: newDraftIds(list) }
}

/**
 * Accepting a proposal puts its change into Claude's working draft (created from the pending version, or the live
 * one, if there is none), so it goes through evaluation and approval like any other change.
 */
export function applyProposal(d: DemoState, p: Proposal, ids: NewDraftIds) {
  let draft = d.playbooks.find(v => v.status === 'draft' && v.author === 'claude')
  if (!draft) {
    const base = d.playbooks.find(v => v.status === 'pending') ?? d.playbooks.find(v => v.status === 'live')
    draft = createDraft(d, ids, base, 'claude', `Claude's draft with accepted proposals, based on ${base?.version ?? 'a blank playbook'}.`)
  }
  const quoted = p.change.match(/"([^"]+)"/)?.[1]
  const target = quoted ? draft.sections.find(s => s.title.toLowerCase() === quoted.toLowerCase()) : undefined
  const text = target && p.change.includes(':') ? p.change.slice(p.change.indexOf(':') + 1).trim() : p.change
  if (target) target.body = `${target.body.trim()} ${text.charAt(0).toUpperCase()}${text.slice(1)}`
  else draft.sections.push({ title: p.title, body: p.change })
  draft.evalScore = 0
  draft.violations = 0
  if (!draft.summary.includes(p.title)) {
    const trimmed = draft.summary.replace(/\.$/, '')
    draft.summary = trimmed.includes(' Adds: ') ? `${trimmed}; ${p.title}.` : `${trimmed}. Adds: ${p.title}.`
  }
}
