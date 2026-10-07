import type { AuditEntry, DemoState, PageId } from '../../lib/types'
import { userName } from '../../lib/store'
import { getExt } from '../settings/ext'

export type AuditKind = 'all' | 'override' | 'ai' | 'access' | 'money' | 'settings'

export const AUDIT_KINDS: { id: AuditKind; label: string }[] = [
  { id: 'all', label: 'All activity' },
  { id: 'override', label: 'Overrides and reasons' },
  { id: 'ai', label: 'AI and Claude' },
  { id: 'access', label: 'Sign-ins and views' },
  { id: 'money', label: 'Money' },
  { id: 'settings', label: 'Settings and team' },
]

export function kindsOf(e: AuditEntry): AuditKind[] {
  const a = e.action
  const out: AuditKind[] = []
  if (/override|killswitch/.test(a) || !!e.reason) out.push('override')
  if (e.actor === 'ai' || e.actor === 'claude' || /^(ai|draft|playbook|lead\.handoff|mcp)/.test(a)) out.push('ai')
  if (/view|sign|login|session|invite|security|token|mcp\.revoke/.test(a)) out.push('access')
  if (/payment|refund|deposit|invoice|price|instalment/.test(a)) out.push('money')
  if (e.target.type === 'settings' || e.target.type === 'user' || /^(settings|user|security|team|webhook|api)/.test(a)) out.push('settings')
  return out
}

const LABELS: Record<string, string> = {
  'stage.override': 'overrode a stage',
  'stage.move': 'moved a lead along',
  'lead.handoff': 'handed a lead to a coordinator',
  'sla.escalated': 'escalated a late call',
  'ai.mode': 'changed an AI mode',
  'ai.killswitch_on': 'paused all AI replies',
  'ai.killswitch_off': 'resumed AI replies',
  'client.view_phone': 'viewed a phone number',
  'client.erased': 'erased a person’s data',
  'playbook.clinical_signoff': 'gave clinical sign-off',
  'playbook.proposal': 'proposed a playbook version',
  'conversation.handling': 'changed who answers a chat',
  'conversation.new': 'received a new DM',
  'draft.approved': 'sent an AI draft',
  'draft.edited_and_sent': 'edited and sent an AI draft',
  'call.logged': 'logged a call',
  'task.reassigned': 'reassigned a task',
  'task.done': 'completed a task',
  'appointment.booked': 'booked an appointment',
  'appointment.status': 'changed an appointment',
  'user.invited': 'invited a person',
  'user.invite_resent': 're-sent an invite',
  'user.role_changed': 'changed a role',
  'user.permissions': 'changed personal permissions',
  'user.suspended': 'suspended a person',
  'user.reactivated': 'reactivated a person',
  'user.removed': 'removed a person',
  'user.shift': 'changed who is on shift',
  'user.2fa_reminder': 'sent a 2FA reminder',
  'security.policy': 'changed the sign-in policy',
  'security.session_timeout': 'changed the session timeout',
  'security.sign_out_all': 'signed everyone out',
  'audit.exported': 'exported the audit log',
}

export function actionLabel(action: string): string {
  return LABELS[action] ?? action.replace(/[._]/g, ' ')
}

/** Display name for an actor, including people who have since been removed. */
export function actorName(s: DemoState, actor: AuditEntry['actor']): string {
  const n = userName(s, actor)
  if (n !== 'Unknown') return n
  const gone = getExt(s).removedUsers.find(r => r.id === actor)
  return gone ? `${gone.name} (removed)` : 'Former team member'
}

/** Where a target lives in the app, if anywhere. */
export function targetLink(s: DemoState, e: AuditEntry): { page: PageId; id?: string } | null {
  const t = e.target
  switch (t.type) {
    case 'client': return s.clients.some(c => c.id === t.id) ? { page: 'client', id: t.id } : null
    case 'episode': {
      const ep = s.episodes.find(x => x.id === t.id)
      return ep ? { page: 'client', id: ep.clientId } : null
    }
    case 'conversation': return s.conversations.some(c => c.id === t.id) ? { page: 'inbox', id: t.id } : null
    case 'task': return s.tasks.some(x => x.id === t.id) ? { page: 'tasks', id: t.id } : null
    case 'appointment': return s.appointments.some(x => x.id === t.id) ? { page: 'calendar', id: t.id } : null
    case 'plan': {
      const p = s.plans.find(x => x.id === t.id)
      return p ? { page: 'client', id: p.clientId } : null
    }
    case 'payment': {
      const p = s.payments.find(x => x.id === t.id)
      return p ? { page: 'client', id: p.clientId } : null
    }
    case 'playbook': return { page: 'ai', id: t.id }
    case 'user': return s.users.some(u => u.id === t.id) ? { page: 'team' } : null
    case 'settings': return settingsLink(e)
    default: return null
  }
}

/** The tab a settings change was made on. */
function settingsLink(e: AuditEntry): { page: PageId; id?: string } {
  const a = e.action
  if (e.target.id === 'ai' || a.startsWith('ai.')) return { page: 'ai', id: a === 'ai.mode' || a.startsWith('ai.killswitch') || a === 'ai.effort' ? undefined : 'guardrails' }
  if (a.startsWith('security.')) return { page: 'team', id: 'security' }
  if (a === 'audit.exported') return { page: 'team', id: 'activity' }
  if (a.startsWith('analytics.')) return { page: 'analytics' }
  if (/^(mcp|api|webhook)\./.test(a)) return { page: 'settings', id: 'integrations' }
  if (a.startsWith('settings.channel')) return { page: 'settings', id: 'channels' }
  if (a === 'settings.sla') return { page: 'settings', id: 'notifications' }
  if (a === 'settings.price_list') return { page: 'settings', id: 'prices' }
  if (/^(privacy\.|client\.(erased|exported)|settings\.(retention|consent))/.test(a)) return { page: 'settings', id: 'privacy' }
  return { page: 'settings' }
}

const cell = (v: string | undefined) => {
  const x = (v ?? '').replace(/\r?\n/g, ' ')
  return /[",]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x
}

export function auditCsv(s: DemoState, rows: AuditEntry[]): string {
  const head = ['time', 'actor', 'action', 'target_type', 'target', 'detail', 'reason']
  const lines = rows.map(e => [e.at, actorName(s, e.actor), e.action, e.target.type, e.target.label ?? e.target.id, e.detail, e.reason].map(cell).join(','))
  return [head.join(','), ...lines].join('\n')
}
