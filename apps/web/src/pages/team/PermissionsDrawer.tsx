import { useEffect, useMemo, useState } from 'react'
import { Avatar, Button, Chip, Drawer, ReasonDialog, Toggle } from '../../components/ui'
import { useStore } from '../../lib/store'
import type { Permission, User } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { PERMISSIONS } from '../../lib/permissions'
import { iso, uid } from '../../lib/time'
import { SENSITIVE, firstName, groupedPermissions, permLabel, roleHas } from './roles'
import { blockedReason } from './PersonDialogs'

type Draft = Partial<Record<Permission, boolean>>

function cleanOverrides(u: User): Draft {
  const out: Draft = {}
  for (const [p, v] of Object.entries(u.overrides ?? {})) if (roleHas(u.role, p as Permission) !== !!v) out[p as Permission] = !!v
  return out
}

export function PermissionsDrawer({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { state, me, can, actions } = useStore()
  const [draft, setDraft] = useState<Draft>({})
  const [confirming, setConfirming] = useState(false)
  useEffect(() => { if (user) setDraft(cleanOverrides(user)) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const saved = useMemo(() => (user ? cleanOverrides(user) : {}), [user])
  const changes = useMemo(() => {
    if (!user) return [] as Array<{ p: Permission; to: boolean }>
    return PERMISSIONS.filter(({ id }) => (id in draft ? draft[id] : roleHas(user.role, id)) !== (id in saved ? saved[id] : roleHas(user.role, id)))
      .map(({ id }) => ({ p: id, to: id in draft ? !!draft[id] : roleHas(user.role, id) }))
  }, [draft, saved, user])

  if (!user) return null
  const blocked = blockedReason(state, me, can('team.manage'), user, 'permissions')
  const readOnly = !!blocked
  const effective = (p: Permission) => (p in draft ? !!draft[p] : roleHas(user.role, p))
  const total = PERMISSIONS.filter(x => effective(x.id)).length
  const overrideCount = Object.keys(draft).length

  const set = (p: Permission, v: boolean) => setDraft(d => {
    const n = { ...d }
    if (v === roleHas(user.role, p)) delete n[p]
    else n[p] = v
    return n
  })

  const close = () => {
    if (changes.length && !readOnly) actions.toast('Permission changes discarded. Nothing was saved.', 'info')
    onClose()
  }

  const save = (reason: string) => {
    const granted = changes.filter(c => c.to).map(c => permLabel(c.p))
    const removed = changes.filter(c => !c.to).map(c => permLabel(c.p))
    const detail = [granted.length && `Granted: ${granted.join(', ')}`, removed.length && `Removed: ${removed.join(', ')}`].filter(Boolean).join(' · ')
    actions.update(d => {
      const u = d.users.find(x => x.id === user.id)
      if (!u) return
      u.overrides = Object.keys(draft).length ? { ...draft } : undefined
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.permissions', target: { type: 'user', id: u.id, label: u.name }, detail, reason })
    })
    actions.notify({ userIds: [user.id] }, { kind: 'system', title: 'Your access changed', body: `${me.name}: ${detail}`, link: { page: 'today' } })
    actions.toast(`Saved ${changes.length} permission change${changes.length > 1 ? 's' : ''} for ${user.name}`, 'success')
    onClose()
  }

  return (
    <>
      <Drawer open={!!user && !confirming} onClose={close} width={500}
        title={`${firstName(user.name)}’s permissions`}
        footer={readOnly ? <Button variant="secondary" onClick={onClose}>Close</Button> : <>
          <Button variant="ghost" onClick={() => setDraft(saved)} disabled={!changes.length}>Undo changes</Button>
          <Button variant="primary" disabled={!changes.length} onClick={() => setConfirming(true)}>{changes.length ? `Save ${changes.length} change${changes.length > 1 ? 's' : ''}` : 'No changes'}</Button>
        </>}>
        <div className="stack lg">
          <div className="tm-perm-head">
            <Avatar name={user.name} color={user.color} size={40} />
            <div className="stack grow" style={{ gap: 2 }}>
              <span className="strong">{user.name}</span>
              <span className="small muted">{ROLE_LABEL[user.role]} template · <span className="num">{total}</span> of {PERMISSIONS.length} allowed · <span className="num">{overrideCount}</span> personal override{overrideCount === 1 ? '' : 's'}</span>
            </div>
          </div>
          {blocked ? <p className="small tm-callout">{blocked}</p> : (
            <p className="small muted">Switches show what {firstName(user.name)} can do. Anything that differs from the {ROLE_LABEL[user.role]} template is a personal override and is saved with a reason in the audit log.</p>
          )}
          {groupedPermissions().map(g => (
            <section key={g.group} className="stack" aria-label={g.group}>
              <h3 className="eyebrow">{g.group}</h3>
              <ul className="tm-perm-list">
                {g.items.map(p => {
                  const def = roleHas(user.role, p.id)
                  const on = effective(p.id)
                  const over = p.id in draft
                  const selfLock = user.id === me.id && p.id === 'team.manage' && on
                  return (
                    <li key={p.id} className={`tm-perm-row ${over ? 'is-override' : ''}`}>
                      <div className="stack grow" style={{ gap: 2 }}>
                        <span className="row wrap" style={{ gap: 6 }}>
                          <span className="tm-perm-label">{p.label}</span>
                          {SENSITIVE.includes(p.id) && <Chip tone="neutral" icon="shield" title="Sensitive: exposes personal, clinical or financial data, or changes access">Sensitive</Chip>}
                        </span>
                        <span className="tiny muted">
                          Role default: {def ? 'allowed' : 'not allowed'}
                          {over && <> · <b className={on ? 'tm-text-ok' : 'tm-text-danger'}>{on ? 'Granted to this person' : 'Removed for this person'}</b></>}
                          {selfLock && <> · You can’t remove your own admin access</>}
                        </span>
                      </div>
                      {over && !readOnly && <Button size="sm" variant="ghost" onClick={() => set(p.id, def)} aria-label={`Reset ${p.label} to role default`}>Reset</Button>}
                      <Toggle checked={on} onChange={v => set(p.id, v)} label={`${p.label} for ${user.name}`} hideLabel disabled={readOnly || selfLock} />
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </Drawer>
      <ReasonDialog open={confirming} title={`Save ${changes.length} permission change${changes.length > 1 ? 's' : ''} for ${user.name}?`}
        body={<ul className="tm-change-list">{changes.map(c => <li key={c.p}><Chip tone={c.to ? 'ok' : 'danger'}>{c.to ? 'Grant' : 'Remove'}</Chip> {permLabel(c.p)}</li>)}</ul>}
        confirmLabel="Save changes" placeholder="e.g. Covering refunds while Grace is on leave"
        onConfirm={save} onClose={() => setConfirming(false)} />
    </>
  )
}
