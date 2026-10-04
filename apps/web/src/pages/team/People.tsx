import { useMemo, useState } from 'react'
import { Avatar, Button, Chip, EmptyState, Segmented, Toggle } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore } from '../../lib/store'
import type { User } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { ago, iso, uid } from '../../lib/time'
import { realOverrides } from './roles'
import { RowMenu } from './RowMenu'
import { PermissionsDrawer } from './PermissionsDrawer'
import { RoleModal, StatusDialog, blockedReason, type StatusMode } from './PersonDialogs'
import { editExt, getExt } from '../settings/ext'

type Filter = 'all' | 'active' | 'invited' | 'suspended'

export function SecurityChip({ u }: { u: User }) {
  if (u.twoFactor === 'passkey') return <Chip tone="ok" icon="key">Passkey</Chip>
  if (u.twoFactor === 'totp') return <Chip tone="ok" icon="smartphone">2FA app</Chip>
  return <Chip tone="warn" icon="alert" title="Signs in with email and password only">No 2FA</Chip>
}

export function StatusChip({ u }: { u: User }) {
  if (u.status === 'active') return <Chip tone="ok">Active</Chip>
  if (u.status === 'invited') return <Chip tone="info" icon="mail">Invited</Chip>
  return <Chip tone="danger" icon="lock">Suspended</Chip>
}

export function People({ onInvite }: { onInvite: () => void }) {
  const { state, me, can, actions } = useStore()
  const canManage = can('team.manage')
  const ext = getExt(state)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [roleFor, setRoleFor] = useState<string | null>(null)
  const [permFor, setPermFor] = useState<string | null>(null)
  const [status, setStatus] = useState<{ id: string; mode: StatusMode } | null>(null)

  const branchName = (id: string) => state.branches.find(b => b.id === id)?.name ?? id
  const rows = useMemo(() => {
    const order = { active: 0, invited: 1, suspended: 2 }
    const roleOrder = ['owner', 'manager', 'coordinator', 'frontdesk', 'clinician', 'finance', 'marketing']
    const needle = q.trim().toLowerCase()
    return state.users
      .filter(u => filter === 'all' || u.status === filter)
      .filter(u => !needle || [u.name, u.email, ROLE_LABEL[u.role]].some(x => x.toLowerCase().includes(needle)))
      .sort((a, b) => order[a.status] - order[b.status] || roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) || a.name.localeCompare(b.name))
  }, [state.users, q, filter])

  const counts = {
    all: state.users.length,
    active: state.users.filter(u => u.status === 'active').length,
    invited: state.users.filter(u => u.status === 'invited').length,
    suspended: state.users.filter(u => u.status === 'suspended').length,
  }

  const setShift = (u: User, on: boolean) => {
    const why = blockedReason(state, me, canManage, u, 'shift')
    if (why) return actions.toast(why, 'warn')
    actions.update(d => {
      const x = d.users.find(y => y.id === u.id)
      if (!x) return
      x.onShift = on
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.shift', target: { type: 'user', id: u.id, label: u.name }, detail: on ? 'Went on shift' : 'Went off shift' })
    })
    actions.toast(on ? `${u.name} is on shift and can receive new leads` : `${u.name} is off shift. New leads go to whoever is on shift.`, 'success')
  }

  const resend = (u: User) => {
    actions.update(d => {
      editExt(d, e => { e.invites[u.id] = iso(Date.now()) })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.invite_resent', target: { type: 'user', id: u.id, label: u.name }, detail: `Invite re-sent to ${u.email}` })
    })
    actions.toast(`New invite sent to ${u.email}. The old link no longer works.`, 'success')
  }

  const menu = (u: User) => {
    const first = u.name.split(' ')[0]
    const roleBlock = blockedReason(state, me, canManage, u, 'role')
    const susBlock = blockedReason(state, me, canManage, u, 'suspend')
    const remBlock = blockedReason(state, me, canManage, u, 'remove')
    return (
      <RowMenu label={`Actions for ${u.name}`} items={[
        { label: canManage ? 'Edit permissions' : 'View permissions', icon: 'shield', onSelect: () => setPermFor(u.id) },
        { label: 'Change role', icon: 'users', onSelect: () => setRoleFor(u.id), disabled: !!roleBlock, hint: roleBlock ?? undefined },
        u.status === 'invited' && { label: 'Resend invite', icon: 'mail', onSelect: () => resend(u), disabled: !canManage, hint: canManage ? undefined : 'You can view the team but not change it.' },
        u.status === 'active' && { label: `Suspend ${first}`, icon: 'lock', onSelect: () => setStatus({ id: u.id, mode: 'suspend' }), disabled: !!susBlock, hint: susBlock ?? undefined },
        u.status === 'suspended' && { label: `Reactivate ${first}`, icon: 'refresh', onSelect: () => setStatus({ id: u.id, mode: 'reactivate' }), disabled: !!susBlock, hint: susBlock ?? undefined },
        { label: u.status === 'invited' ? 'Cancel invite' : `Remove ${first}`, icon: 'trash', danger: true, onSelect: () => setStatus({ id: u.id, mode: 'remove' }), disabled: !!remBlock, hint: remBlock ?? undefined },
      ]} />
    )
  }

  const lastSeen = (u: User) => u.status === 'invited'
    ? <span className="muted">Invite sent {ago(ext.invites[u.id] ?? u.lastActiveAt)}</span>
    : <span title={new Date(u.lastActiveAt).toLocaleString()}>{ago(u.lastActiveAt)}</span>

  const overridesChip = (u: User) => {
    const n = realOverrides(u).length
    return n ? <button type="button" className="tm-chip-btn" onClick={() => setPermFor(u.id)} title="See personal overrides">{n} override{n > 1 ? 's' : ''}</button> : null
  }

  const shiftToggle = (u: User) => {
    const why = blockedReason(state, me, canManage, u, 'shift')
    return <Toggle checked={u.onShift && u.status === 'active'} onChange={v => setShift(u, v)} label={`${u.name} on shift`} hideLabel disabled={!!why} />
  }

  return (
    <div className="stack lg">
      <div className="tm-toolbar">
        <div className="search-wrap tm-search">
          <Icon name="search" size={16} />
          <input className="input input-search" type="search" placeholder="Search name, email or role" aria-label="Search people" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <Segmented<Filter> label="Filter by status" value={filter} onChange={setFilter} options={[
          { id: 'all', label: `All ${counts.all}` },
          { id: 'active', label: `Active ${counts.active}` },
          { id: 'invited', label: `Invited ${counts.invited}` },
          { id: 'suspended', label: `Suspended ${counts.suspended}` },
        ]} />
      </div>

      {!canManage && <p className="small tm-callout"><Icon name="lock" size={14} /> You can see the team but not change it. Owners and managers can invite people and change access.</p>}

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="users" title={q ? `No one matches “${q}”` : `No ${filter} people`}
            body={filter === 'invited' ? 'People you invite appear here until they accept and set up their sign-in.' : filter === 'suspended' ? 'Suspended people keep their history but cannot sign in. Suspend someone from the actions menu on their row.' : 'Try a different search.'}
            action={canManage && filter !== 'suspended' ? <Button variant="secondary" icon="userPlus" onClick={onInvite}>Invite a person</Button> : undefined} />
        </div>
      ) : (
        <>
          <div className="table-wrap tm-people-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Branches</th>
                  <th>Sign-in</th>
                  <th>Status</th>
                  <th>On shift</th>
                  <th>Last active</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id} className={u.status === 'suspended' ? 'tm-row-muted' : ''}>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <Avatar name={u.name} color={u.color} size={32} />
                        <div className="stack" style={{ gap: 0, minWidth: 0 }}>
                          <span className="strong truncate">{u.name}{u.id === me.id && <span className="muted"> (you)</span>}</span>
                          <span className="tiny muted truncate">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td><div className="stack" style={{ gap: 3, justifyItems: 'start' }}><span>{ROLE_LABEL[u.role]}</span>{overridesChip(u)}</div></td>
                    <td className="small">{u.branchIds.map(branchName).join(', ')}</td>
                    <td><SecurityChip u={u} /></td>
                    <td><StatusChip u={u} /></td>
                    <td>{shiftToggle(u)}</td>
                    <td className="small tm-nowrap">{lastSeen(u)}</td>
                    <td className="tm-cell-actions">{menu(u)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="tm-people-cards" aria-label="People">
            {rows.map(u => (
              <li key={u.id} className={`card tm-person ${u.status === 'suspended' ? 'tm-row-muted' : ''}`}>
                <div className="tm-person-top">
                  <Avatar name={u.name} color={u.color} size={36} />
                  <div className="stack grow" style={{ gap: 0 }}>
                    <span className="strong truncate">{u.name}{u.id === me.id && <span className="muted"> (you)</span>}</span>
                    <span className="small muted truncate">{ROLE_LABEL[u.role]} · {u.branchIds.map(branchName).join(', ')}</span>
                  </div>
                  {menu(u)}
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <StatusChip u={u} />
                  <SecurityChip u={u} />
                  {overridesChip(u)}
                </div>
                <div className="tm-person-foot">
                  <span className="small muted">{lastSeen(u)}</span>
                  <span className="row small" style={{ gap: 8 }}>On shift {shiftToggle(u)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <RoleModal user={state.users.find(u => u.id === roleFor) ?? null} onClose={() => setRoleFor(null)} />
      <PermissionsDrawer user={state.users.find(u => u.id === permFor) ?? null} onClose={() => setPermFor(null)} />
      <StatusDialog user={state.users.find(u => u.id === status?.id) ?? null} mode={status?.mode ?? 'suspend'} onClose={() => setStatus(null)} />
    </div>
  )
}
