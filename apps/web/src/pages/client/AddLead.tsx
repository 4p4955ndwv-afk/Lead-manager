// "Add lead manually": for people who phoned, walked in, were referred or used WhatsApp and never DM'd.
// Creates the client, an episode at "Contact captured", an urgent call task with the 15-minute SLA, and an audit entry.
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import type { Client, Episode, Task } from '../../lib/types'
import { CHANNEL_LABEL } from '../../lib/types'
import { canOpen, maskPhone } from '../../lib/permissions'
import { MIN, iso, uid } from '../../lib/time'
import { Button, Field, Modal } from '../../components/ui'
import { Icon } from '../../components/icons'
import { LANG_LABEL, MANUAL_CHANNELS, toE164 } from './helpers'

const PLACEHOLDER: Record<string, string> = {
  phone: 'Called the main line after seeing the PRP reel',
  walkin: 'Came in to reception and asked about laser prices',
  referral: 'Referred by Noah Bennett',
  whatsapp: 'Messaged the clinic WhatsApp about chemical peels',
}

export function AddLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, me, actions } = useStore()
  const staff = useMemo(() => state.users.filter(u => u.status === 'active' && ['coordinator', 'frontdesk', 'manager', 'owner'].includes(u.role)), [state.users])
  const defaultOwner = () => {
    if (me.role === 'coordinator' || me.role === 'frontdesk') return me.id
    return state.users.find(u => u.role === 'coordinator' && u.onShift && u.status === 'active')?.id ?? staff[0]?.id ?? me.id
  }

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<(typeof MANUAL_CHANNELS)[number]['id']>('phone')
  const [detail, setDetail] = useState('')
  const [interest, setInterest] = useState('')
  const [ownerId, setOwnerId] = useState(defaultOwner)
  const [branchId, setBranchId] = useState(state.branches[0]?.id ?? 'b1')
  const [language, setLanguage] = useState('en')
  const [wa, setWa] = useState(false)
  const [sms, setSms] = useState(true)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(''); setPhone(''); setChannel('phone'); setDetail(''); setInterest(''); setOwnerId(defaultOwner())
    setBranchId(me.branchIds[0] ?? state.branches[0]?.id ?? 'b1'); setLanguage('en'); setWa(false); setSms(true); setNote(''); setTried(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => { if (channel === 'whatsapp') setWa(true) }, [channel])

  const e164 = toE164(phone)
  const nameErr = name.trim().length < 2 ? 'Enter their full name.' : undefined
  const phoneErr = !phone.trim() ? 'A number is needed so the coordinator can call.' : !e164 ? 'That does not look like a phone number. UK mobiles start 07 or +44 7.' : undefined
  const dup = e164 ? state.clients.find(c => c.phone === e164) : undefined
  const ownerName = state.users.find(u => u.id === ownerId)?.name ?? 'The coordinator'
  const channelLabel = MANUAL_CHANNELS.find(c => c.id === channel)!.label

  const submit = () => {
    setTried(true)
    if (nameErr || phoneErr || !e164) return
    const t = Date.now()
    const at = iso(t)
    const id = uid('cl')
    const epId = uid('ep')
    const tkId = uid('tk')
    const proc = state.procedures.find(p => p.id === interest)
    const cleanName = name.trim().replace(/\s+/g, ' ')
    const brief = `${channelLabel}${detail.trim() ? `: ${detail.trim()}` : ''}. ${proc ? `Interested in ${proc.name}.` : 'Treatment not decided yet.'}${language !== 'en' ? ` Prefers ${LANG_LABEL[language] ?? language}.` : ''} Goal: agree a consultation date and when the deposit is due.`
    const client: Client = {
      id, name: cleanName, handles: {}, phone: e164, language, ageVerified: false, tags: channel === 'referral' ? ['Referral'] : [],
      consent: { whatsapp: wa, sms, marketing: false, callRecording: false, updatedAt: at }, doNotContact: false, ownerId, branchId,
      source: { channel, detail: detail.trim() || `${channelLabel}, added by ${me.name}` }, createdAt: at, score: 60,
    }
    const episode: Episode = {
      id: epId, clientId: id, number: 1, startedAt: at, stage: 'contact', interests: proc ? [proc.id] : [], value: proc?.price ?? 0,
      history: [{ at, to: 'contact', by: me.id, reason: `Added manually · ${channelLabel}` }],
    }
    const task: Task = {
      id: tkId, type: 'call', title: `Call ${cleanName} to book a consultation`, clientId: id, episodeId: epId, assignedTo: ownerId, createdAt: at,
      dueAt: iso(t + 15 * MIN), slaMinutes: 15, escalationLevel: 0, status: 'open', attempts: [], priority: 'urgent', brief,
    }
    actions.update(d => {
      d.clients.unshift(client)
      d.episodes.unshift(episode)
      d.tasks.unshift(task)
      if (note.trim()) d.notes.unshift({ id: uid('no'), clientId: id, authorId: d.currentUserId, at, text: note.trim(), clinical: false })
      d.audit.unshift({ id: uid('au'), at, actor: d.currentUserId, action: 'client.created', target: { type: 'client', id, label: cleanName }, detail: `Added manually (${channelLabel}); call task for ${ownerName} with a 15-minute SLA` })
      if (ownerId !== d.currentUserId) {
        d.notifications.unshift({ id: uid('nt'), at, userId: ownerId, kind: 'lead', title: `New lead · ${cleanName} (${channelLabel.toLowerCase()})`, body: brief, link: { page: 'tasks', id: tkId }, read: false, deadline: task.dueAt })
      }
    })
    actions.toast(`${cleanName} added. ${ownerId === me.id ? 'You have' : `${ownerName} has`} 15 minutes to call.`, 'success', canOpen(me, 'tasks') ? { label: 'Open task', page: 'tasks', id: tkId } : undefined)
    onClose()
    actions.go('client', id)
  }

  return (
    <Modal open={open} onClose={onClose} width={600} title="Add lead manually"
      description="For people who phoned, walked in, were referred or messaged on WhatsApp. DM leads are added automatically."
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="userPlus" onClick={submit} disabled={tried && (!!nameErr || !!phoneErr)}>{dup ? 'Add anyway' : 'Add lead and start 15-min call timer'}</Button>
      </>}>
      <form className="stack lg" onSubmit={e => { e.preventDefault(); submit() }}>
        <div className="cr-form-2">
          <Field label="Full name" error={tried ? nameErr : undefined}>
            {id => <input id={id} className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="off" placeholder="e.g. Layla Haddad" />}
          </Field>
          <Field label="Phone number" error={tried ? phoneErr : undefined} hint={e164 ? `Saved as ${maskPhone(e164, true)}` : 'UK or international format'}>
            {id => <input id={id} className="input num" type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="off" placeholder="07700 900123" />}
          </Field>
        </div>

        {dup && (
          <div className="cr-callout cr-callout-warn" role="status">
            <Icon name="alert" size={16} />
            <div className="grow small">
              <strong>{dup.name}</strong> already has this number. Open their record instead of creating a duplicate, or add anyway and merge later.
            </div>
            <Button size="sm" onClick={() => { onClose(); actions.go('client', dup.id) }}>Open {dup.name.split(' ')[0]}</Button>
          </div>
        )}

        <fieldset className="cr-fieldset">
          <legend className="field-label">How did they come in?</legend>
          <div className="cr-pills" role="radiogroup" aria-label="How did they come in?">
            {MANUAL_CHANNELS.map(c => (
              <button key={c.id} type="button" role="radio" aria-checked={channel === c.id} className={`cr-pill ${channel === c.id ? 'is-active' : ''}`} onClick={() => setChannel(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <Field label={channel === 'referral' ? 'Who referred them?' : 'What did they ask about?'} hint="Shown to the coordinator in the call brief.">
          {id => <input id={id} className="input" value={detail} onChange={e => setDetail(e.target.value)} placeholder={PLACEHOLDER[channel]} />}
        </Field>

        <div className="cr-form-2">
          <Field label="Interested in">
            {id => (
              <select id={id} className="input" value={interest} onChange={e => setInterest(e.target.value)}>
                <option value="">Not sure yet</option>
                {state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </Field>
          <Field label="Owner (makes the first call)">
            {id => (
              <select id={id} className="input" value={ownerId} onChange={e => setOwnerId(e.target.value)}>
                {staff.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === me.id ? ' (you)' : ''}{u.onShift ? '' : ' · off shift'}</option>)}
              </select>
            )}
          </Field>
          <Field label="Branch">
            {id => (
              <select id={id} className="input" value={branchId} onChange={e => setBranchId(e.target.value)}>
                {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}, {b.city}</option>)}
              </select>
            )}
          </Field>
          <Field label="Preferred language">
            {id => (
              <select id={id} className="input" value={language} onChange={e => setLanguage(e.target.value)}>
                {Object.entries(LANG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            )}
          </Field>
        </div>

        <fieldset className="cr-fieldset">
          <legend className="field-label">What they agreed to</legend>
          <div className="row wrap" style={{ gap: 16 }}>
            <label className="checkbox"><input type="checkbox" checked={wa} onChange={e => setWa(e.target.checked)} />WhatsApp messages</label>
            <label className="checkbox"><input type="checkbox" checked={sms} onChange={e => setSms(e.target.checked)} />SMS reminders</label>
          </div>
        </fieldset>

        <Field label="Note for the team (optional)">
          {id => <textarea id={id} className="input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Anything the caller should know before ringing back" />}
        </Field>

        <p className="tiny muted">
          Creates the client at <strong>Contact captured</strong> via {CHANNEL_LABEL[channel]}, and an urgent call task for {ownerName}. If nobody calls within 15 minutes it escalates to the manager, then the owner.
        </p>
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
