import { useEffect, useRef, useState } from 'react'
import { Button, PageHeader, Stat, Tabs } from '../components/ui'
import { useStore } from '../lib/store'
import { People } from './team/People'
import { RolesMatrix } from './team/RolesMatrix'
import { ActivityLog } from './team/ActivityLog'
import { Security } from './team/Security'
import { InviteModal } from './team/PersonDialogs'
import { realOverrides } from './team/roles'
import { getExt } from './settings/ext'
import './team.css'

type Tab = 'people' | 'roles' | 'activity' | 'security'

export default function Team() {
  const { state, can, route, actions } = useStore()
  const [inviteOpen, setInviteOpen] = useState(false)
  const tabsRef = useRef<HTMLDivElement>(null)
  // keep the active tab visible when the tab strip scrolls sideways on phones
  useEffect(() => {
    const strip = tabsRef.current?.querySelector<HTMLElement>('.tabs')
    const active = strip?.querySelector<HTMLElement>('.tab.is-active')
    if (!strip || !active) return
    const a = active.getBoundingClientRect(), b = strip.getBoundingClientRect()
    if (a.left < b.left || a.right > b.right) strip.scrollLeft += a.left - b.left - 16
  }, [route.id])
  const canManage = can('team.manage')
  const canAudit = can('audit.view')

  const tabs: { id: Tab; label: string; count?: number; icon: 'users' | 'shield' | 'history' | 'lock' }[] = [
    { id: 'people', label: 'People', count: state.users.length, icon: 'users' },
    { id: 'roles', label: 'Roles & permissions', icon: 'shield' },
    ...(canAudit ? [{ id: 'activity' as Tab, label: 'Activity log', icon: 'history' as const }] : []),
    { id: 'security', label: 'Security', icon: 'lock', count: state.users.filter(u => u.twoFactor === 'none' && u.status !== 'suspended').length || undefined },
  ]
  // #team~roles, #team~activity, #team~security open a tab
  const requested = tabs.find(t => t.id === route.id)?.id
  const tab: Tab = requested ?? 'people'
  const setTab = (t: Tab) => actions.go('team', t === 'people' ? undefined : t)

  const active = state.users.filter(u => u.status === 'active')
  const onShift = active.filter(u => u.onShift).length
  const invited = state.users.filter(u => u.status === 'invited').length
  const no2fa = state.users.filter(u => u.twoFactor === 'none' && u.status !== 'suspended').length
  const overrides = state.users.filter(u => realOverrides(u).length > 0).length
  const ext = getExt(state)

  return (
    <div className="page tm-page">
      <PageHeader
        eyebrow="Admin"
        title="Team & access"
        subtitle="Who can sign in, what each person can see and do, and a record of every change."
        actions={canManage ? <Button variant="primary" icon="userPlus" onClick={() => setInviteOpen(true)}>Invite person</Button> : undefined}
      />

      <div className="tm-stats">
        <Stat label="Active people" icon="users" value={active.length} hint={`${onShift} on shift now`} />
        <Stat label="Invites waiting" icon="mail" value={invited} hint={invited ? 'Not accepted yet' : 'None outstanding'} tone={invited ? 'accent' : undefined} />
        <Stat label="Without 2FA" icon="alert" value={no2fa} hint={ext.security.requireStrongSignIn ? 'Required at next sign-in' : 'Two-step sign-in optional'} tone={no2fa ? 'warn' : 'ok'} />
        <Stat label="Personal overrides" icon="shield" value={overrides} hint={overrides ? `${overrides === 1 ? 'Person' : 'People'} with custom access` : 'Everyone on their role template'} />
      </div>

      <div ref={tabsRef}><Tabs<Tab> value={tab} onChange={setTab} tabs={tabs} /></div>

      <div role="tabpanel" aria-label={tabs.find(t => t.id === tab)?.label}>
        {tab === 'people' && <People onInvite={() => setInviteOpen(true)} />}
        {tab === 'roles' && <RolesMatrix />}
        {tab === 'activity' && canAudit && <ActivityLog />}
        {tab === 'security' && <Security />}
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  )
}
