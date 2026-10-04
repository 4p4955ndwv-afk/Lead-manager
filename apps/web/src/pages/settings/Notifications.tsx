import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Toggle } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore } from '../../lib/store'
import type { Role, SlaRule } from '../../lib/types'
import { ROLE_LABEL } from '../../lib/types'
import { iso, uid } from '../../lib/time'

const ROLES: Role[] = ['owner', 'manager', 'coordinator', 'frontdesk', 'clinician', 'finance', 'marketing']
const SHORT: Record<Role, string> = { owner: 'Owner', manager: 'Manager', coordinator: 'Coordinator', frontdesk: 'Front desk', clinician: 'Clinician', finance: 'Finance', marketing: 'Marketing' }
const CHANNELS: Array<{ id: SlaRule['channels'][number]; label: string }> = [
  { id: 'push', label: 'Push' }, { id: 'whatsapp', label: 'WhatsApp' }, { id: 'sms', label: 'SMS' }, { id: 'email', label: 'Email' },
]

type Row = SlaRule & { minutesText: string }
const toRows = (r: SlaRule[]): Row[] => r.map(x => ({ ...structuredClone(x), minutesText: x.escalateAfterMin.join(', ') }))
const parseMinutes = (t: string): number[] | null => {
  const parts = t.split(/[,\s]+/).filter(Boolean)
  if (!parts.length) return []
  const n = parts.map(Number)
  if (n.some(x => !Number.isFinite(x) || x <= 0 || x > 10080 || !Number.isInteger(x))) return null
  if (n.length > 2) return null
  for (let i = 1; i < n.length; i++) if (n[i] <= n[i - 1]) return null
  return n
}

export function escalationText(mins: number[]): string {
  const fmt = (m: number) => (m >= 1440 && m % 1440 === 0 ? `${m / 1440} day${m === 1440 ? '' : 's'}` : m >= 60 && m % 60 === 0 ? `${m / 60} h` : `${m} min`)
  if (!mins.length) return 'No escalation'
  if (mins.length === 1) return `Manager after ${fmt(mins[0])}`
  return `Manager after ${fmt(mins[0])}, owner after ${fmt(mins[1])}`
}

export function Notifications() {
  const { state, actions } = useStore()
  const saved = state.settings.slaRules
  const [rows, setRows] = useState<Row[]>(() => toRows(saved))
  const savedKey = JSON.stringify(saved)
  useEffect(() => { setRows(toRows(JSON.parse(savedKey) as SlaRule[])) }, [savedKey])

  const parsed = useMemo(() => rows.map(r => ({ r, mins: parseMinutes(r.minutesText) })), [rows])
  const errors = parsed.filter(p => p.mins === null || !p.r.event.trim() || p.r.notify.length === 0 || p.r.channels.length === 0).map(p => p.r.id)
  const next: SlaRule[] = parsed.map(({ r, mins }) => ({ id: r.id, event: r.event.trim(), notify: r.notify, channels: r.channels, escalateAfterMin: mins ?? r.escalateAfterMin, enabled: r.enabled }))
  const dirty = JSON.stringify(next) !== savedKey

  const patch = (id: string, fn: (r: Row) => void) => setRows(rs => rs.map(r => {
    if (r.id !== id) return r
    const c = structuredClone(r)
    fn(c)
    return c
  }))
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const save = () => {
    if (errors.length) return
    const before = new Map(saved.map(r => [r.id, r]))
    const changed = next.filter(r => JSON.stringify(r) !== JSON.stringify(before.get(r.id)))
    actions.update(d => {
      d.settings.slaRules = next
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.sla', target: { type: 'settings', id: 'sla', label: 'Notifications & SLAs' }, detail: `Updated ${changed.length} rule${changed.length === 1 ? '' : 's'}: ${changed.map(r => `${r.event}${r.enabled ? '' : ' (off)'}`).join('; ')}` })
    })
    actions.toast(`Saved ${changed.length} alert rule${changed.length === 1 ? '' : 's'}`, 'success')
  }

  const addRule = () => {
    const id = uid('sla')
    setRows(rs => [...rs, { id, event: '', notify: ['manager'], channels: ['push'], escalateAfterMin: [30], enabled: true, minutesText: '30' }])
    window.setTimeout(() => document.getElementById(`st-ev-${id}`)?.focus(), 30)
  }

  return (
    <div className="stack lg">
      <div className="st-callout">
        <Icon name="bell" size={16} />
        <p className="small">The 15-minute call rule is the one that matters most: when a number appears in a DM, the coordinator on shift gets a push and a WhatsApp, the manager is alerted at 15 minutes and the owner at 60. Alerts only go to people who are on shift.</p>
      </div>
      <Card padded={false}>
        <div className="table-wrap st-sla-wrap">
          <table className="table st-sla">
            <thead>
              <tr>
                <th>When this happens</th>
                <th>Who is told</th>
                <th>How</th>
                <th>Escalate after (min)</th>
                <th>On</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const mins = parseMinutes(r.minutesText)
                const bad = errors.includes(r.id)
                return (
                  <tr key={r.id} className={`${r.enabled ? '' : 'st-row-off'} ${bad ? 'st-row-bad' : ''}`}>
                    <td data-label="When this happens">
                      <textarea id={`st-ev-${r.id}`} className="input" rows={2} aria-label="Event" value={r.event} placeholder="e.g. Review left with 3 stars or fewer" onChange={e => patch(r.id, x => { x.event = e.target.value.replace(/\n/g, ' ') })} />
                    </td>
                    <td data-label="Who is told">
                      <div className="st-pills" role="group" aria-label={`Who is told: ${r.event || 'new rule'}`}>
                        {ROLES.map(role => (
                          <button key={role} type="button" className={`st-pill ${r.notify.includes(role) ? 'is-on' : ''}`} aria-pressed={r.notify.includes(role)} title={ROLE_LABEL[role]}
                            onClick={() => patch(r.id, x => { x.notify = toggleIn(x.notify, role) })}>{SHORT[role]}</button>
                        ))}
                      </div>
                      {r.notify.length === 0 && <span className="field-error">Pick at least one role</span>}
                    </td>
                    <td data-label="How">
                      <div className="st-pills" role="group" aria-label={`How: ${r.event || 'new rule'}`}>
                        {CHANNELS.map(c => (
                          <button key={c.id} type="button" className={`st-pill ${r.channels.includes(c.id) ? 'is-on' : ''}`} aria-pressed={r.channels.includes(c.id)}
                            onClick={() => patch(r.id, x => { x.channels = toggleIn(x.channels, c.id) })}>{c.label}</button>
                        ))}
                      </div>
                      {r.channels.length === 0 && <span className="field-error">Pick at least one channel</span>}
                    </td>
                    <td data-label="Escalate after (min)">
                      <input className="input st-num-input" aria-label="Escalate after minutes, comma separated" inputMode="numeric" value={r.minutesText} onChange={e => patch(r.id, x => { x.minutesText = e.target.value })} />
                      <span className={mins === null ? 'field-error' : 'tiny muted'}>{mins === null ? 'Up to two rising numbers, e.g. 15, 60' : escalationText(mins)}</span>
                    </td>
                    <td data-label="On">
                      <Toggle checked={r.enabled} onChange={v => patch(r.id, x => { x.enabled = v })} label={`${r.event || 'New rule'} enabled`} hideLabel />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="st-card-foot">
          <Button variant="ghost" size="sm" icon="plus" onClick={addRule}>Add alert rule</Button>
          <span className="grow" />
          {dirty && <span className="small muted">{errors.length ? `Fix ${errors.length} rule${errors.length > 1 ? 's' : ''} before saving` : 'Unsaved changes'}</span>}
          <Button variant="ghost" disabled={!dirty} onClick={() => setRows(toRows(saved))}>Discard</Button>
          <Button variant="primary" disabled={!dirty || errors.length > 0} onClick={save}>Save alert rules</Button>
        </div>
      </Card>
    </div>
  )
}
