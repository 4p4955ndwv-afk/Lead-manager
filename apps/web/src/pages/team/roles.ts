import type { Permission, Role, User } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { PERMISSIONS, ROLE_TEMPLATES } from '../../lib/permissions'

export const ROLES: Role[] = ['owner', 'manager', 'coordinator', 'frontdesk', 'clinician', 'finance', 'marketing']

/** Plain-language summary of each role template, shown when inviting or changing a role. */
export const ROLE_INFO: Record<Role, { summary: string; can: string; cannot: string }> = {
  owner: {
    summary: 'Runs the clinic. Usually one or two people.',
    can: 'Everything, including refunds, clinical sign-off, team, settings and billing.',
    cannot: 'Nothing is held back.',
  },
  manager: {
    summary: 'Runs the floor day to day and receives escalations.',
    can: 'All chats, phone numbers, overrides, AI modes, playbook approval, team, settings and the audit log. Can read clinical notes.',
    cannot: 'Write clinical notes, give clinical sign-off or issue refunds.',
  },
  coordinator: {
    summary: 'Works the DMs and makes the 15-minute calls.',
    can: 'Read and reply to chats, see numbers, move leads along, book appointments and send payment links.',
    cannot: 'See clinical notes, revenue, settings or the audit log.',
  },
  frontdesk: {
    summary: 'Reception: confirmations, check-ins and payments in clinic.',
    can: 'Assigned chats, see numbers, book and move appointments, take payments.',
    cannot: 'See all chats, clinical notes, analytics or settings.',
  },
  clinician: {
    summary: 'Consults, treats and signs off anything clinical.',
    can: 'Clinical notes, photos and plans, appointments, clinical sign-off on the AI playbook, assigned chats.',
    cannot: 'See payments, analytics or settings, or change AI modes.',
  },
  finance: {
    summary: 'Deposits, instalments, refunds and revenue.',
    can: 'Payments, refunds, revenue figures and analytics. Sees numbers to chase payments.',
    cannot: 'Read chats or clinical notes, or change the pipeline.',
  },
  marketing: {
    summary: 'Content and campaigns that bring DMs in.',
    can: 'Read all chats for insight, see analytics and propose playbook changes.',
    cannot: 'Reply to chats, see phone numbers, revenue or clinical notes.',
  },
}

export const roleLabel = (r: Role) => ROLE_LABEL[r]

/** 'Dr Hannah Clarke' -> 'Hannah', 'Priya Nair' -> 'Priya' (for buttons and titles). */
export const firstName = (name: string) => name.replace(/^Dr\.? /, '').split(/\s+/)[0]

export function groupedPermissions(): { group: string; items: typeof PERMISSIONS }[] {
  const out: { group: string; items: typeof PERMISSIONS }[] = []
  for (const p of PERMISSIONS) {
    let g = out.find(x => x.group === p.group)
    if (!g) out.push((g = { group: p.group, items: [] }))
    g.items.push(p)
  }
  return out
}

export const roleHas = (role: Role, p: Permission) => ROLE_TEMPLATES[role].includes(p)

/** Overrides that actually differ from the role template (stale ones are ignored). */
export function realOverrides(u: User): Array<[Permission, boolean]> {
  return Object.entries(u.overrides ?? {})
    .filter(([p, v]) => roleHas(u.role, p as Permission) !== !!v)
    .map(([p, v]) => [p as Permission, !!v])
}

export const permLabel = (p: Permission) => PERMISSIONS.find(x => x.id === p)?.label ?? p

/** Permissions that expose personal, clinical or financial data, or change who can do what. */
export const SENSITIVE: Permission[] = ['clients.view_phone', 'clients.erase', 'clinical.view', 'clinical.edit', 'payments.refund', 'analytics.revenue', 'team.manage', 'settings.manage', 'ai.killswitch', 'pipeline.override']

/** Hex avatar colours for new people (data, like the seed; not UI chrome). */
export const AVATAR_COLOURS = ['#0b7a71', '#3a5796', '#a35a06', '#7a4fb5', '#b02a6f', '#1d7438', '#5b6b1d', '#8a3b12', '#1f6f9a']
