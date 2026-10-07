import { useState } from 'react'
import { Avatar, Button, Card, Chip, EmptyState, Field, ReasonDialog, Toggle } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore } from '../../lib/store'
import { ROLE_LABEL } from '../../lib/types'
import { ago, iso, uid } from '../../lib/time'
import { editExt, getExt } from '../settings/ext'

const TIMEOUTS = [
  { min: 15, label: '15 minutes' },
  { min: 30, label: '30 minutes' },
  { min: 60, label: '1 hour' },
  { min: 240, label: '4 hours' },
  { min: 480, label: '8 hours (a shift)' },
  { min: 720, label: '12 hours' },
]

export function Security() {
  const { state, me, can, actions } = useStore()
  const canManage = can('team.manage')
  const ext = getExt(state)
  const sec = ext.security
  const [confirmOff, setConfirmOff] = useState(false)
  const [signOutAll, setSignOutAll] = useState(false)

  const live = state.users.filter(u => u.status !== 'suspended')
  const passkey = live.filter(u => u.twoFactor === 'passkey').length
  const totp = live.filter(u => u.twoFactor === 'totp').length
  const none = live.filter(u => u.twoFactor === 'none')
  // people who are signed in somewhere: invited people have no session yet and suspended people are already out
  const others = state.users.filter(u => u.status === 'active' && u.id !== me.id)

  const setPolicy = (on: boolean, reason?: string) => {
    actions.update(d => {
      editExt(d, e => { e.security.requireStrongSignIn = on })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'security.policy', target: { type: 'settings', id: 'security', label: 'Sign-in policy' }, detail: on ? 'Passkey or 2FA app now required for everyone' : 'Passkey or 2FA no longer required', reason })
    })
    if (on && none.length) actions.notify({ userIds: none.map(u => u.id) }, { kind: 'system', title: 'Set up a passkey or 2FA app', body: `${me.name} turned on required two-step sign-in. You will be asked to set it up next time you sign in.`, link: { page: 'today' } })
    actions.toast(on ? `Two-step sign-in is now required.${none.length ? ` ${none.length} ${none.length === 1 ? 'person' : 'people'} will set it up at their next sign-in.` : ''}` : 'Two-step sign-in is now optional', on ? 'success' : 'warn')
  }

  const setTimeoutMin = (min: number) => {
    const from = TIMEOUTS.find(t => t.min === sec.sessionTimeoutMin)?.label ?? `${sec.sessionTimeoutMin} min`
    const to = TIMEOUTS.find(t => t.min === min)?.label ?? `${min} min`
    actions.update(d => {
      editExt(d, e => { e.security.sessionTimeoutMin = min })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'security.session_timeout', target: { type: 'settings', id: 'security', label: 'Session timeout' }, detail: `${from} → ${to}` })
    })
    actions.toast(`People are signed out after ${to.replace(' (a shift)', '')} without activity`, 'success')
  }

  const doSignOutAll = (reason: string) => {
    actions.update(d => {
      editExt(d, e => { e.security.lastSignOutAllAt = iso(Date.now()) })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'security.sign_out_all', target: { type: 'settings', id: 'security', label: 'All devices' }, detail: `Signed out ${others.length} other ${others.length === 1 ? 'person' : 'people'} on every device`, reason })
    })
    actions.notify({ userIds: others.map(u => u.id) }, { kind: 'system', title: 'You were signed out on all devices', body: `${me.name}: ${reason}. Sign in again with your passkey or 2FA app.`, link: { page: 'today' } })
    actions.toast('Everyone else has been signed out on every device. They sign in again with their passkey or 2FA app.', 'success')
  }

  const remind = (id: string) => {
    const u = state.users.find(x => x.id === id)
    if (!u) return
    if (u.status === 'invited') {
      // they can't sign in yet, so a 2FA reminder would never reach them: send the invite again instead
      actions.update(d => {
        editExt(d, e => { e.invites[u.id] = iso(Date.now()) })
        d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'user.invite_resent', target: { type: 'user', id: u.id, label: u.name }, detail: `Invite re-sent to ${u.email}` })
      })
      actions.toast(`New invite sent to ${u.email}. They set up a passkey or 2FA app when they accept.`, 'success')
      return
    }
    actions.notify({ userIds: [u.id] }, { kind: 'system', title: 'Please add a passkey or 2FA app', body: 'It takes a minute: open your profile, choose Sign-in security and follow the steps.', link: { page: 'today' } })
    actions.audit({ action: 'user.2fa_reminder', target: { type: 'user', id: u.id, label: u.name }, detail: `Reminder sent to ${u.email}` })
    actions.toast(`Reminder sent to ${u.name}`, 'success')
  }

  return (
    <div className="stack lg">
      {!canManage && <p className="small tm-callout"><Icon name="lock" size={14} /> Only people who can manage the team can change these settings.</p>}

      <div className="tm-sec-stats">
        <div className="stat"><span className="stat-label"><Icon name="key" size={14} />Passkey</span><span className="stat-value num">{passkey}</span><span className="stat-hint">Phishing-resistant</span></div>
        <div className="stat"><span className="stat-label"><Icon name="smartphone" size={14} />2FA app</span><span className="stat-value num">{totp}</span><span className="stat-hint">Code from an authenticator</span></div>
        <div className={`stat ${none.length ? 'stat-warn' : 'stat-ok'}`}><span className="stat-label"><Icon name="alert" size={14} />No two-step sign-in</span><span className="stat-value num">{none.length}</span><span className="stat-hint">{none.length ? 'Password only' : 'Everyone is covered'}</span></div>
      </div>

      <div className="grid-2">
        <Card title="Sign-in rules" subtitle={`Apply to everyone at ${state.settings.orgName}, including owners.`}>
          <div className="stack lg">
            <div className="tm-setting">
              <div className="stack grow" style={{ gap: 2 }}>
                <span className="strong">Require a passkey or 2FA app for everyone</span>
                <span className="small muted">
                  {sec.requireStrongSignIn
                    ? 'On. People without one must set it up before they can see any client data.'
                    : 'Off. Recommended: client chats and phone numbers are personal data.'}
                </span>
              </div>
              <Toggle checked={sec.requireStrongSignIn} disabled={!canManage} label="Require a passkey or 2FA app for everyone" hideLabel
                onChange={v => (v ? setPolicy(true) : setConfirmOff(true))} />
            </div>
            <Field label="Sign people out after no activity for" hint="Shared reception tablets should use a short timeout.">
              {id => (
                <select id={id} className="input" value={sec.sessionTimeoutMin} disabled={!canManage} onChange={e => setTimeoutMin(Number(e.target.value))}>
                  {TIMEOUTS.map(t => <option key={t.min} value={t.min}>{t.label}</option>)}
                </select>
              )}
            </Field>
          </div>
        </Card>

        <Card title="Sign out all devices" subtitle="Use this if a phone is lost or you think an account was used by someone else.">
          <div className="stack lg">
            <p className="small muted">Everyone except you is signed out on every phone, tablet and computer straight away. Connected Claude clients keep working; revoke them in Settings if needed.</p>
            <div className="row wrap between">
              <span className="small muted">{sec.lastSignOutAllAt ? `Last done ${ago(sec.lastSignOutAllAt)}` : 'Never done'}</span>
              <Button variant="danger" icon="logout" disabled={!canManage} onClick={() => setSignOutAll(true)}>Sign out all devices</Button>
            </div>
          </div>
        </Card>
      </div>

      <Card title="People without two-step sign-in" subtitle={none.length ? `${none.length} ${none.length === 1 ? 'person signs' : 'people sign'} in with a password only.` : undefined}>
        {none.length === 0 ? (
          <EmptyState icon="shield" title="Everyone uses a passkey or 2FA app" body="New people appear here until they set one up after accepting their invite." />
        ) : (
          <ul className="tm-plain-list">
            {none.map(u => (
              <li key={u.id} className="tm-plain-row">
                <Avatar name={u.name} color={u.color} size={32} />
                <div className="stack grow" style={{ gap: 0 }}>
                  <span className="strong truncate">{u.name}</span>
                  <span className="small muted truncate">{ROLE_LABEL[u.role]} · {u.status === 'invited' ? 'Has not accepted the invite yet' : `Last active ${ago(u.lastActiveAt)}`}</span>
                </div>
                {u.status === 'invited' ? <Chip tone="info">Sets up on accept</Chip> : <Chip tone="warn">Password only</Chip>}
                <Button size="sm" variant="secondary" icon={u.status === 'invited' ? 'mail' : 'bell'} disabled={!canManage} onClick={() => remind(u.id)}>{u.status === 'invited' ? 'Resend invite' : 'Send reminder'}</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReasonDialog open={confirmOff} title="Make two-step sign-in optional?" tone="danger" confirmLabel="Make it optional"
        body="People could sign in with a password alone. Client chats, phone numbers and clinical notes become easier to reach with a stolen password."
        placeholder="e.g. Temporary while the new reception tablet is set up"
        onConfirm={r => setPolicy(false, r)} onClose={() => setConfirmOff(false)} />
      <ReasonDialog open={signOutAll} title="Sign everyone out on every device?" tone="danger" confirmLabel="Sign everyone out"
        body={`${others.length} ${others.length === 1 ? 'person' : 'people'} will need to sign in again. Anyone mid-call keeps the call, but loses unsaved notes.`}
        placeholder="e.g. Reception phone lost on Saturday"
        onConfirm={doSignOutAll} onClose={() => setSignOutAll(false)} />
    </div>
  )
}
