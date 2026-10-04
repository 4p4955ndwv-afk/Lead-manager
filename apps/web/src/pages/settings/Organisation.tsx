import { useEffect, useState } from 'react'
import { Button, Card, Chip, Field, IconButton, Modal } from '../../components/ui'
import { useStore } from '../../lib/store'
import type { DemoState } from '../../lib/types'
import { iso, money, ms, uid } from '../../lib/time'

const CURRENCIES = [
  { id: 'GBP', label: 'GBP · Pound sterling' },
  { id: 'EUR', label: 'EUR · Euro' },
  { id: 'USD', label: 'USD · US dollar' },
  { id: 'AED', label: 'AED · UAE dirham' },
]
const TIMEZONES = ['Europe/London', 'Europe/Dublin', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'America/New_York']

function localTime(tz: string) {
  try {
    return new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', timeZone: tz })
  } catch {
    return ''
  }
}

export function Organisation() {
  const { state, actions } = useStore()
  const s = state.settings
  const [name, setName] = useState(s.orgName)
  const [currency, setCurrency] = useState(s.currency)
  const [tz, setTz] = useState(s.timezone)
  useEffect(() => { setName(s.orgName); setCurrency(s.currency); setTz(s.timezone) }, [s.orgName, s.currency, s.timezone])

  const dirty = name.trim() !== s.orgName || currency !== s.currency || tz !== s.timezone
  const nameError = name.trim().length < 2 ? 'Enter the clinic name people see in messages and invites.' : undefined

  const save = () => {
    if (nameError) return
    const changes: string[] = []
    if (name.trim() !== s.orgName) changes.push(`name “${s.orgName}” → “${name.trim()}”`)
    if (currency !== s.currency) changes.push(`currency ${s.currency} → ${currency}`)
    if (tz !== s.timezone) changes.push(`timezone ${s.timezone} → ${tz}`)
    actions.update(d => {
      d.settings.orgName = name.trim()
      d.settings.currency = currency
      d.settings.timezone = tz
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.organisation', target: { type: 'settings', id: 'organisation', label: 'Clinic details' }, detail: changes.join('; ') })
    })
    actions.toast('Clinic details saved', 'success')
  }

  return (
    <div className="stack lg">
      <Card title="Clinic details" subtitle="Used in AI replies, invites, reminders and exports.">
        <div className="stack lg">
          <div className="st-form-3">
            <Field label="Clinic name" error={nameError}>
              {id => <input id={id} className="input" value={name} onChange={e => setName(e.target.value)} />}
            </Field>
            <Field label="Currency" hint={`Prices show as ${money(1200, currency)}`}>
              {id => (
                <select id={id} className="input" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {CURRENCIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              )}
            </Field>
            <Field label="Timezone" hint={`Local time there now: ${localTime(tz)}. Business hours and reminders use this.`}>
              {id => (
                <select id={id} className="input" value={tz} onChange={e => setTz(e.target.value)}>
                  {TIMEZONES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="st-save-row">
            {dirty && <span className="small muted">Unsaved changes</span>}
            <Button variant="ghost" disabled={!dirty} onClick={() => { setName(s.orgName); setCurrency(s.currency); setTz(s.timezone) }}>Discard</Button>
            <Button variant="primary" disabled={!dirty || !!nameError} onClick={save}>Save clinic details</Button>
          </div>
        </div>
      </Card>
      <Branches />
    </div>
  )
}

// ---- branches & rooms -----------------------------------------------------------------------------

function InlineEdit({ value, label, onSave, onCancel }: { value: string; label: string; onSave: (v: string) => void; onCancel: () => void }) {
  const [v, setV] = useState(value)
  const ok = v.trim().length >= 2
  return (
    <form className="st-inline" onSubmit={e => { e.preventDefault(); if (ok) onSave(v.trim()) }}>
      <input className="input" aria-label={label} value={v} autoFocus onChange={e => setV(e.target.value)} onKeyDown={e => e.key === 'Escape' && onCancel()} />
      <Button type="submit" size="sm" variant="primary" disabled={!ok}>Save</Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </form>
  )
}

function Branches() {
  const { state, actions } = useStore()
  const [editing, setEditing] = useState<string | null>(null) // 'b:<id>' | 'r:<id>' | 'new:<branchId>'
  const [addOpen, setAddOpen] = useState(false)
  const now = Date.now()

  const audit = (d: DemoState, detail: string, label: string) =>
    d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.branches', target: { type: 'settings', id: 'branches', label }, detail })

  const renameBranch = (id: string, v: string) => {
    const old = state.branches.find(b => b.id === id)?.name
    actions.update(d => {
      const b = d.branches.find(x => x.id === id)
      if (!b) return
      b.name = v
      audit(d, `Branch renamed “${old}” → “${v}”`, v)
    })
    setEditing(null)
    actions.toast(`Branch renamed to ${v}`, 'success')
  }
  const renameRoom = (id: string, v: string) => {
    const old = state.rooms.find(r => r.id === id)?.name
    actions.update(d => {
      const r = d.rooms.find(x => x.id === id)
      if (!r) return
      r.name = v
      audit(d, `Room renamed “${old}” → “${v}”`, v)
    })
    setEditing(null)
    actions.toast(`Room renamed to ${v}`, 'success')
  }
  const addRoom = (branchId: string, v: string) => {
    const branch = state.branches.find(b => b.id === branchId)?.name
    actions.update(d => {
      d.rooms.push({ id: uid('r'), name: v, branchId })
      audit(d, `Room “${v}” added to ${branch}`, v)
    })
    setEditing(null)
    actions.toast(`${v} added to ${branch}. It is bookable in Calendar now.`, 'success')
  }

  return (
    <Card title="Branches and rooms" subtitle="Rooms appear in Calendar and on booking links. Rename them to match the signs on the doors."
      actions={<Button size="sm" variant="secondary" icon="plus" onClick={() => setAddOpen(true)}>Add branch</Button>}>
      <div className="st-branches">
        {state.branches.map(b => {
          const rooms = state.rooms.filter(r => r.branchId === b.id)
          const upcoming = state.appointments.filter(a => a.branchId === b.id && ms(a.start) > now && a.status !== 'cancelled').length
          const staff = state.users.filter(u => u.branchIds.includes(b.id) && u.status !== 'suspended').length
          return (
            <section key={b.id} className="st-branch" aria-label={b.name}>
              {editing === 'b:' + b.id ? (
                <InlineEdit value={b.name} label={`Rename ${b.name}`} onSave={v => renameBranch(b.id, v)} onCancel={() => setEditing(null)} />
              ) : (
                <div className="st-branch-head">
                  <div className="stack grow" style={{ gap: 0 }}>
                    <h3>{b.name}</h3>
                    <span className="small muted">{b.city} · {rooms.length} room{rooms.length === 1 ? '' : 's'} · {staff} staff · {upcoming} upcoming appointment{upcoming === 1 ? '' : 's'}</span>
                  </div>
                  <IconButton icon="edit" size="sm" label={`Rename ${b.name}`} onClick={() => setEditing('b:' + b.id)} />
                </div>
              )}
              <ul className="st-rooms">
                {rooms.map(r => {
                  const booked = state.appointments.filter(a => a.roomId === r.id && ms(a.start) > now && a.status !== 'cancelled').length
                  return (
                    <li key={r.id} className="st-room">
                      {editing === 'r:' + r.id ? (
                        <InlineEdit value={r.name} label={`Rename ${r.name}`} onSave={v => renameRoom(r.id, v)} onCancel={() => setEditing(null)} />
                      ) : (
                        <>
                          <span className="grow truncate">{r.name}</span>
                          {booked > 0 && <Chip tone="team">{booked} booked</Chip>}
                          <IconButton icon="edit" size="sm" label={`Rename ${r.name}`} onClick={() => setEditing('r:' + r.id)} />
                        </>
                      )}
                    </li>
                  )
                })}
                <li className="st-room st-room-add">
                  {editing === 'new:' + b.id ? (
                    <InlineEdit value="" label={`New room name for ${b.name}`} onSave={v => addRoom(b.id, v)} onCancel={() => setEditing(null)} />
                  ) : (
                    <Button size="sm" variant="ghost" icon="plus" onClick={() => setEditing('new:' + b.id)}>Add room</Button>
                  )}
                </li>
              </ul>
            </section>
          )
        })}
      </div>
      <AddBranch open={addOpen} onClose={() => setAddOpen(false)} />
    </Card>
  )
}

function AddBranch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = useStore()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [room, setRoom] = useState('Room 1')
  useEffect(() => { if (open) { setName(''); setCity(''); setRoom('Room 1') } }, [open])
  const taken = state.branches.some(b => b.name.toLowerCase() === name.trim().toLowerCase())
  const ok = name.trim().length >= 2 && city.trim().length >= 2 && room.trim().length >= 2 && !taken
  const save = () => {
    if (!ok) return
    const id = uid('b')
    actions.update(d => {
      d.branches.push({ id, name: name.trim(), city: city.trim() })
      d.rooms.push({ id: uid('r'), name: room.trim(), branchId: id })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.branches', target: { type: 'settings', id: 'branches', label: name.trim() }, detail: `Branch “${name.trim()}” (${city.trim()}) added with ${room.trim()}` })
    })
    actions.toast(`${name.trim()} added. Give people access to it from Team & access.`, 'success', { label: 'Open team', page: 'team' })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="Add a branch" description="A branch has its own rooms, staff and calendar."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>Add branch</Button></>}>
      <div className="stack lg">
        <Field label="Branch name" error={taken ? 'There is already a branch with this name.' : undefined}>
          {id => <input id={id} className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Clifton" />}
        </Field>
        <Field label="City">
          {id => <input id={id} className="input" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Bristol" />}
        </Field>
        <Field label="First room" hint="You can add more rooms afterwards.">
          {id => <input id={id} className="input" value={room} onChange={e => setRoom(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  )
}
