import { useEffect, useMemo, useState } from 'react'
import { Button, Chip, Field, Modal, ReasonDialog } from '../../components/ui'
import { useStore, userName } from '../../lib/store'
import type { DemoState, Role, User } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { ROLE_TEMPLATES } from '../../lib/permissions'
import { iso, ms, uid } from '../../lib/time'
import { AVATAR_COLOURS, ROLES, ROLE_INFO, firstName, realOverrides } from './roles'
import { editExt, getExt } from '../settings/ext'

// ---- guards -------------------------------------------------------------------------------------

export type PersonAction = 'role' | 'permissions' | 'suspend' | 'remove' | 'shift'

/** Why the current viewer cannot do something to this person, or null if they can. */
export function blockedReason(s: DemoState, me: User, canManage: boolean, target: User, action: PersonAction): string | null {
  if (action === 'shift' && target.id === me.id && target.status === 'active') return null
  if (!canManage) return 'You can view the team but not change it. Ask an owner or manager.'
  if (target.role === 'owner' && me.role !== 'owner') return 'Only an owner can change an owner’s access.'
  if ((action === 'suspend' || action === 'remove') && target.id === me.id) return 'You can’t suspend or remove yourself.'
  const activeOwners = s.users.filter(u => u.role === 'owner' && u.status === 'active')
  if ((action === 'suspend' || action === 'remove') && target.role === 'owner' && target.status === 'active' && activeOwners.length <= 1)
    return 'The clinic needs at least one active owner.'
  if (action === 'shift' && target.status !== 'active') return 'Only active people can go on shift.'
  return null
}

// ---- invite -------------------------------------------------------------------------------------

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, actions } = useStore()
  const ext = getExt(state)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState<Role>('coordinator')
  const [branches, setBranches] = useState<string[]>([])
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (open) {
      setName(''); setEmail(''); setPhone(''); setRole('coordinator'); setBranches(state.branches.slice(0, 1).map(b => b.id)); setTried(false)
    }
  }, [open, state.branches])

  const emailTaken = state.users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())
  const errors = {
    name: name.trim().length < 2 ? 'Enter their full name.' : undefined,
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Enter a work email address.' : emailTaken ? 'Someone on the team already uses this email.' : undefined,
    phone: phone.trim() && phone.replace(/\D/g, '').length < 10 ? 'Enter a full mobile number, or leave it blank.' : undefined,
    branches: branches.length === 0 ? 'Pick at least one branch.' : undefined,
  }
  const valid = !Object.values(errors).some(Boolean)
  const ownerBlocked = role === 'owner' && me.role !== 'owner'

  const submit = () => {
    setTried(true)
    if (!valid || ownerBlocked) return
    const id = uid('u')
    const n = name.trim()
    const digits = phone.replace(/[^\d+]/g, '')
    const e164 = !digits ? '' : digits.startsWith('+') ? digits : digits.startsWith('0') ? '+44' + digits.slice(1) : '+' + digits
    actions.update(d => {
      const user: User = {
        id, name: n, role, branchIds: branches, email: email.trim(), phone: e164,
        color: AVATAR_COLOURS[d.users.length % AVATAR_COLOURS.length], onShift: false, twoFactor: 'none', status: 'invited', lastActiveAt: iso(Date.now()),
      }
      d.users.push(user)
      editExt(d, e => { e.invites[id] = iso(Date.now()) })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.invited', target: { type: 'user', id, label: n }, detail: `Invited as ${ROLE_LABEL[role]} · ${branches.map(b => d.branches.find(x => x.id === b)?.name).join(', ')}` })
    })
    actions.toast(`Invite sent to ${email.trim()}. The link works for 7 days.`, 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite a person" width={560}
      description="They get an email link to set up their own login. Nothing is shared until they accept."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="send" onClick={submit} disabled={ownerBlocked}>Send invite</Button>
      </>}>
      <div className="stack lg">
        <div className="tm-form-2">
          <Field label="Full name" error={tried ? errors.name : undefined}>
            {id => <input id={id} className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ruth Adeyemi" autoComplete="off" />}
          </Field>
          <Field label="Work email" error={tried ? errors.email : undefined}>
            {id => <input id={id} className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ruth@northlight.example" autoComplete="off" />}
          </Field>
        </div>
        <Field label="Mobile number (optional)" hint="Used for escalation alerts by WhatsApp or SMS when they are on shift." error={tried ? errors.phone : undefined}>
          {id => <input id={id} className="input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="07700 900000" autoComplete="off" />}
        </Field>
        <Field label="Role" hint={`${ROLE_INFO[role].can} Cannot: ${ROLE_INFO[role].cannot.toLowerCase()}`} error={ownerBlocked ? 'Only an owner can invite another owner.' : undefined}>
          {id => (
            <select id={id} className="input" value={role} onChange={e => setRole(e.target.value as Role)}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABEL[r]} · {ROLE_TEMPLATES[r].length} permissions</option>)}
            </select>
          )}
        </Field>
        <fieldset className="tm-fieldset">
          <legend className="field-label">Branches they work at</legend>
          <div className="row wrap" style={{ gap: 16 }}>
            {state.branches.map(b => (
              <label key={b.id} className="checkbox">
                <input type="checkbox" checked={branches.includes(b.id)} onChange={e => setBranches(x => e.target.checked ? [...x, b.id] : x.filter(y => y !== b.id))} />
                {b.name} <span className="muted small">{b.city}</span>
              </label>
            ))}
          </div>
          {tried && errors.branches && <span className="field-error">{errors.branches}</span>}
        </fieldset>
        <p className="small muted tm-callout">
          {ext.security.requireStrongSignIn
            ? 'Your sign-in policy requires a passkey or 2FA app, so they will set one up before they can see any client data.'
            : 'They will be asked to add a passkey or 2FA app. You can make this required in Security.'}
          {' '}You can fine-tune their access per permission after inviting.
        </p>
      </div>
    </Modal>
  )
}

// ---- change role --------------------------------------------------------------------------------

export function RoleModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { state, me, actions } = useStore()
  const [role, setRole] = useState<Role>('coordinator')
  const [keep, setKeep] = useState(false)
  const [reason, setReason] = useState('')
  useEffect(() => {
    if (user) { setRole(user.role); setKeep(false); setReason('') }
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!user) return null
  const overrides = realOverrides(user)
  const activeOwners = state.users.filter(u => u.role === 'owner' && u.status === 'active').length
  const lastOwner = user.role === 'owner' && user.status === 'active' && activeOwners <= 1 && role !== 'owner'
  const changed = role !== user.role
  const ok = changed && reason.trim().length >= 3 && !lastOwner

  const save = () => {
    if (!ok) return
    const from = user.role
    actions.update(d => {
      const u = d.users.find(x => x.id === user.id)
      if (!u) return
      u.role = role
      if (!keep) u.overrides = undefined
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.role_changed', target: { type: 'user', id: u.id, label: u.name }, detail: `${ROLE_LABEL[from]} → ${ROLE_LABEL[role]}${overrides.length ? (keep ? ` · kept ${overrides.length} personal override${overrides.length > 1 ? 's' : ''}` : ` · cleared ${overrides.length} personal override${overrides.length > 1 ? 's' : ''}`) : ''}`, reason: reason.trim() })
    })
    actions.notify({ userIds: [user.id] }, { kind: 'system', title: `Your role is now ${ROLE_LABEL[role]}`, body: `${me.name} changed your access. ${ROLE_INFO[role].can}`, link: { page: 'today' } })
    actions.toast(`${user.name} is now ${ROLE_LABEL[role]}`, 'success')
    onClose()
  }

  return (
    <Modal open={!!user} onClose={onClose} title={`Change ${user.name}’s role`} width={620}
      description="A role is a starting set of permissions. You can still adjust single permissions for this person afterwards."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" disabled={!ok} onClick={save}>{changed ? `Make ${firstName(user.name)} ${ROLE_LABEL[role]}` : 'Pick a new role'}</Button>
      </>}>
      <div className="stack lg">
        <div className="tm-roles-pick" role="radiogroup" aria-label="Role">
          {ROLES.map(r => {
            const disabled = r === 'owner' && me.role !== 'owner'
            return (
              <label key={r} className={`tm-role-opt ${role === r ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`} title={disabled ? 'Only an owner can make someone an owner' : undefined}>
                <input type="radio" name="tm-role" value={r} checked={role === r} disabled={disabled} onChange={() => setRole(r)} />
                <span className="stack" style={{ gap: 2 }}>
                  <span className="row wrap" style={{ gap: 6 }}>
                    <span className="strong">{ROLE_LABEL[r]}</span>
                    <span className="tiny muted num">{ROLE_TEMPLATES[r].length} of 25</span>
                    {r === user.role && <Chip tone="accent">Current</Chip>}
                  </span>
                  <span className="small muted">{ROLE_INFO[r].summary}</span>
                  {role === r && <span className="small"><b>Can:</b> {ROLE_INFO[r].can} <b>Cannot:</b> {ROLE_INFO[r].cannot}</span>}
                </span>
              </label>
            )
          })}
        </div>
        {lastOwner && <p className="field-error">The clinic needs at least one active owner. Make someone else an owner first.</p>}
        {overrides.length > 0 && (
          <label className="checkbox">
            <input type="checkbox" checked={keep} onChange={e => setKeep(e.target.checked)} />
            Keep {firstName(user.name)}’s {overrides.length} personal override{overrides.length > 1 ? 's' : ''} on top of the new role
          </label>
        )}
        <Field label="Reason (saved in the audit log)" hint="Required. Everyone with audit access can see it.">
          {id => <textarea id={id} className="input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Promoted to lead coordinator for the Manchester branch" />}
        </Field>
      </div>
    </Modal>
  )
}

// ---- suspend / reactivate / remove --------------------------------------------------------------

function openWork(s: DemoState, userId: string) {
  const now = Date.now()
  return {
    tasks: s.tasks.filter(t => t.status === 'open' && t.assignedTo === userId).length,
    chats: s.conversations.filter(c => c.assignedTo === userId).length,
    clients: s.clients.filter(c => c.ownerId === userId).length,
    appts: s.appointments.filter(a => a.practitionerId === userId && ms(a.start) > now && !['cancelled', 'completed', 'no_show'].includes(a.status)).length,
  }
}

function handOver(d: DemoState, from: string, to: string) {
  const now = Date.now()
  const target = d.users.find(u => u.id === to)
  d.tasks.forEach(t => { if (t.status === 'open' && t.assignedTo === from) t.assignedTo = to })
  d.conversations.forEach(c => { if (c.assignedTo === from) c.assignedTo = to })
  d.clients.forEach(c => { if (c.ownerId === from) c.ownerId = to })
  if (target?.role === 'clinician') d.appointments.forEach(a => { if (a.practitionerId === from && ms(a.start) > now && !['cancelled', 'completed', 'no_show'].includes(a.status)) a.practitionerId = to })
}

export type StatusMode = 'suspend' | 'reactivate' | 'remove'

export function StatusDialog({ user, mode, onClose }: { user: User | null; mode: StatusMode; onClose: () => void }) {
  const { state, actions } = useStore()
  const work = useMemo(() => (user ? openWork(state, user.id) : { tasks: 0, chats: 0, clients: 0, appts: 0 }), [state, user])
  const hasWork = work.tasks + work.chats + work.clients + work.appts > 0
  const candidates = state.users.filter(u => user && u.id !== user.id && u.status === 'active')
  const suggested = user ? (candidates.find(u => u.role === user.role && u.onShift) ?? candidates.find(u => u.role === user.role) ?? candidates.find(u => u.role === 'manager') ?? candidates[0]) : undefined
  const [to, setTo] = useState('')
  useEffect(() => { setTo(suggested?.id ?? '') }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!user) return null
  const first = firstName(user.name)
  const invited = user.status === 'invited'
  const toUser = state.users.find(u => u.id === to)
  const apptNote = work.appts > 0 && toUser && toUser.role !== 'clinician' ? ` Their ${work.appts} upcoming appointment${work.appts > 1 ? 's stay' : ' stays'} with them; move ${work.appts > 1 ? 'them' : 'it'} in Calendar.` : ''

  const handover = hasWork && mode !== 'reactivate' && (
    <div className="stack tm-handover">
      <p className="small">
        {first} has {[work.tasks && `${work.tasks} open task${work.tasks > 1 ? 's' : ''}`, work.chats && `${work.chats} assigned chat${work.chats > 1 ? 's' : ''}`, work.clients && `${work.clients} client${work.clients > 1 ? 's' : ''} they look after`, work.appts && `${work.appts} upcoming appointment${work.appts > 1 ? 's' : ''}`].filter(Boolean).join(', ')}.
      </p>
      <Field label="Hand their work to" hint={`Tasks, chats and clients move to this person now.${apptNote}`}>
        {id => (
          <select id={id} className="input" value={to} onChange={e => setTo(e.target.value)}>
            {candidates.map(u => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABEL[u.role]}{u.onShift ? ' · on shift' : ''}</option>)}
          </select>
        )}
      </Field>
    </div>
  )

  const conf = {
    suspend: {
      title: `Suspend ${user.name}?`, label: `Suspend ${first}`, tone: 'danger' as const,
      body: <div className="stack"><p>{first} is signed out of every device straight away and can’t sign in until someone reactivates them. Their history stays.</p>{handover}</div>,
      placeholder: 'e.g. On extended leave until March',
    },
    reactivate: {
      title: `Reactivate ${user.name}?`, label: `Reactivate ${first}`, tone: 'primary' as const,
      body: <p>{first} can sign in again with their existing passkey or 2FA app and gets the same role and permissions as before.</p>,
      placeholder: 'e.g. Back from leave',
    },
    remove: {
      title: invited ? `Cancel ${user.name}’s invite?` : `Remove ${user.name} from the team?`, label: invited ? 'Cancel invite' : `Remove ${first}`, tone: 'danger' as const,
      body: <div className="stack"><p>{invited ? `The invite link stops working. You can invite ${first} again later.` : `${first} loses access for good. Their past actions stay in the audit log under their name. To pause access instead, suspend them.`}</p>{handover}</div>,
      placeholder: invited ? 'e.g. Sent to the wrong email' : 'e.g. Left the clinic on 30 September',
    },
  }[mode]

  const confirm = (reason: string) => {
    const handTo = hasWork && mode !== 'reactivate' ? to : ''
    const handName = handTo ? userName(state, handTo) : ''
    actions.update(d => {
      const u = d.users.find(x => x.id === user.id)
      if (!u) return
      if (handTo) handOver(d, u.id, handTo)
      const suffix = handTo ? ` · work handed to ${handName}` : ''
      if (mode === 'suspend') {
        u.status = 'suspended'
        u.onShift = false
        d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.suspended', target: { type: 'user', id: u.id, label: u.name }, detail: `Access suspended and devices signed out${suffix}`, reason })
      } else if (mode === 'reactivate') {
        u.status = 'active'
        d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.reactivated', target: { type: 'user', id: u.id, label: u.name }, detail: 'Access restored', reason })
      } else {
        d.users = d.users.filter(x => x.id !== u.id)
        editExt(d, e => {
          e.removedUsers.push({ id: u.id, name: u.name, role: u.role, removedAt: iso(Date.now()) })
          delete e.invites[u.id]
        })
        d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.removed', target: { type: 'user', id: u.id, label: u.name }, detail: `${invited ? 'Invite cancelled' : `Removed (${ROLE_LABEL[u.role]})`}${suffix}`, reason })
      }
    })
    actions.toast(
      mode === 'suspend' ? `${user.name} is suspended${handTo ? `; work moved to ${handName}` : ''}` : mode === 'reactivate' ? `${user.name} can sign in again` : invited ? `Invite for ${user.name} cancelled` : `${user.name} removed${handTo ? `; work moved to ${handName}` : ''}`,
      mode === 'reactivate' ? 'success' : 'info',
    )
  }

  return (
    <ReasonDialog open={!!user} title={conf.title} body={conf.body} confirmLabel={conf.label} tone={conf.tone} placeholder={conf.placeholder} onConfirm={confirm} onClose={onClose} />
  )
}
