import type { PageId, Permission, Role, User } from './types'

export const PERMISSIONS: { id: Permission; label: string; group: string }[] = [
  { id: 'chats.view_all', label: 'See all chats', group: 'Chats' },
  { id: 'chats.view_assigned', label: 'See assigned chats', group: 'Chats' },
  { id: 'chats.reply', label: 'Reply and take over chats', group: 'Chats' },
  { id: 'clients.view_phone', label: 'See phone numbers', group: 'Clients' },
  { id: 'clients.edit', label: 'Edit client details', group: 'Clients' },
  { id: 'clients.merge', label: 'Merge duplicates', group: 'Clients' },
  { id: 'clients.erase', label: 'Export or erase a person', group: 'Clients' },
  { id: 'pipeline.move', label: 'Move along the journey', group: 'Pipeline' },
  { id: 'pipeline.override', label: 'Override stages and SLAs', group: 'Pipeline' },
  { id: 'appointments.manage', label: 'Book and move appointments', group: 'Clinic' },
  { id: 'clinical.view', label: 'See clinical notes and photos', group: 'Clinic' },
  { id: 'clinical.edit', label: 'Write clinical notes and plans', group: 'Clinic' },
  { id: 'payments.view', label: 'See payments', group: 'Money' },
  { id: 'payments.take', label: 'Send links and take payments', group: 'Money' },
  { id: 'payments.refund', label: 'Issue refunds', group: 'Money' },
  { id: 'ai.mode', label: 'Change AI mode per channel', group: 'AI' },
  { id: 'ai.killswitch', label: 'Pause all AI replies', group: 'AI' },
  { id: 'playbook.propose', label: 'Propose playbook changes', group: 'AI' },
  { id: 'playbook.approve', label: 'Approve playbook versions', group: 'AI' },
  { id: 'playbook.clinical_signoff', label: 'Clinical sign-off', group: 'AI' },
  { id: 'analytics.view', label: 'See analytics', group: 'Insight' },
  { id: 'analytics.revenue', label: 'See revenue figures', group: 'Insight' },
  { id: 'team.manage', label: 'Invite and manage users', group: 'Admin' },
  { id: 'settings.manage', label: 'Change settings and channels', group: 'Admin' },
  { id: 'audit.view', label: 'See the audit log', group: 'Admin' },
]

const ALL = PERMISSIONS.map(p => p.id)

export const ROLE_TEMPLATES: Record<Role, Permission[]> = {
  owner: ALL,
  manager: ALL.filter(p => !['clinical.edit', 'payments.refund', 'playbook.clinical_signoff'].includes(p)),
  coordinator: ['chats.view_assigned', 'chats.view_all', 'chats.reply', 'clients.view_phone', 'clients.edit', 'pipeline.move', 'appointments.manage', 'payments.view', 'payments.take', 'analytics.view'],
  frontdesk: ['chats.view_assigned', 'chats.reply', 'clients.view_phone', 'clients.edit', 'pipeline.move', 'appointments.manage', 'payments.view', 'payments.take'],
  clinician: ['chats.view_assigned', 'clients.view_phone', 'appointments.manage', 'clinical.view', 'clinical.edit', 'playbook.clinical_signoff'],
  finance: ['clients.view_phone', 'payments.view', 'payments.take', 'payments.refund', 'analytics.view', 'analytics.revenue'],
  marketing: ['chats.view_all', 'analytics.view', 'playbook.propose'],
}

export function can(user: User | undefined, perm: Permission): boolean {
  if (!user) return false
  if (user.overrides && perm in user.overrides) return !!user.overrides[perm]
  return ROLE_TEMPLATES[user.role].includes(perm)
}

/** Which pages a person can open. Pages they cannot open are hidden from navigation. */
export function canOpen(user: User | undefined, page: PageId): boolean {
  if (!user) return false
  switch (page) {
    case 'today':
      return true
    case 'inbox':
      return can(user, 'chats.view_all') || can(user, 'chats.view_assigned')
    case 'pipeline':
      return can(user, 'pipeline.move') || can(user, 'analytics.view')
    case 'client':
      return true
    case 'tasks':
      return user.role !== 'marketing'
    case 'calendar':
      return can(user, 'appointments.manage') || can(user, 'clinical.view')
    case 'ai':
      return can(user, 'ai.mode') || can(user, 'playbook.propose') || can(user, 'playbook.approve') || can(user, 'playbook.clinical_signoff')
    case 'analytics':
      return can(user, 'analytics.view')
    case 'team':
      return can(user, 'team.manage') || can(user, 'audit.view')
    case 'settings':
      return can(user, 'settings.manage')
  }
}

/** Masks a phone number unless the viewer may see it, e.g. +44 7700 900123 -> +44 •••• ••0123 */
export function maskPhone(phone: string | undefined, visible: boolean): string {
  if (!phone) return '—'
  if (visible) return formatPhone(phone)
  return phone.slice(0, 3) + ' •••• ••' + phone.slice(-4)
}

export function formatPhone(e164: string): string {
  const d = e164.replace(/[^\d+]/g, '')
  if (d.startsWith('+44')) return `+44 ${d.slice(3, 7)} ${d.slice(7)}`
  if (d.startsWith('+1')) return `+1 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
  if (d.startsWith('+971')) return `+971 ${d.slice(4, 6)} ${d.slice(6, 9)} ${d.slice(9)}`
  return d.replace(/(\+\d{2})(\d{3})(\d{3})(\d+)/, '$1 $2 $3 $4')
}
