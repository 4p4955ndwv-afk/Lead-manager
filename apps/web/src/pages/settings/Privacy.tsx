import { useEffect, useState } from 'react'
import { Button, Card, Chip, EmptyState, Field, Locked, Modal, ReasonDialog, Segmented, Toggle } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore, userName } from '../../lib/store'
import type { DemoState } from '../../lib/types'
import { DAY, ago, iso, ms, shortDate, until, uid } from '../../lib/time'
import { editExt, getExt, type DataRequest, type SettingsExt } from './ext'

const RETENTION: Array<{ key: 'chats' | 'clinical' | 'exports'; label: string; hint: string; min: number; max: number }> = [
  { key: 'chats', label: 'Chats with people who never booked', hint: 'DMs, AI drafts and call notes are deleted after this. Clients keep their chats while they have an open plan.', min: 3, max: 120 },
  { key: 'clinical', label: 'Clinical records', hint: 'Notes, photos and consent forms. Agree this with your clinical lead before shortening it.', min: 96, max: 300 },
  { key: 'exports', label: 'Export files', hint: 'CSV and data-request exports are deleted from storage after this.', min: 1, max: 12 },
]

const CONSENT: Array<{ key: keyof SettingsExt['consentDefaults']; label: string; hint: string }> = [
  { key: 'whatsappReminders', label: 'Ask for WhatsApp reminders on the booking call', hint: 'The coordinator’s call script includes the question, and the answer is saved on the client.' },
  { key: 'smsReminders', label: 'Use SMS when WhatsApp is declined', hint: 'Only for appointment reminders and deposit links.' },
  { key: 'callRecordingNotice', label: 'Say “this call may be recorded” at the start of calls', hint: 'Recording stays off for anyone who objects.' },
  { key: 'askMarketingOnCall', label: 'Ask for marketing consent on the call', hint: 'Never pre-ticked. Without a yes, the client only gets messages about their own treatment.' },
]

function eraseClient(d: DemoState, clientId: string) {
  const c = d.clients.find(x => x.id === clientId)
  if (!c) return
  const now = iso(Date.now())
  c.name = 'Erased client'
  c.handles = {}
  c.phone = undefined
  c.email = undefined
  c.dateOfBirth = undefined
  c.tags = []
  c.doNotContact = true
  c.consent = { whatsapp: false, sms: false, marketing: false, callRecording: false, updatedAt: now }
  c.source = { ...c.source, detail: 'Erased on request' }
  d.notes = d.notes.filter(n => n.clientId !== clientId)
  d.documents = d.documents.filter(x => x.clientId !== clientId)
  d.conversations.forEach(cv => {
    if (cv.clientId !== clientId) return
    cv.messages = cv.messages.map(m => ({ ...m, text: 'Message erased at the person’s request.', flags: undefined }))
    cv.draft = undefined
    cv.needsHuman = false
    cv.needsHumanReason = undefined
    cv.handling = 'paused'
  })
  d.tasks.forEach(t => { if (t.clientId === clientId && t.status === 'open') t.status = 'cancelled' })
  d.appointments.forEach(a => { if (a.clientId === clientId && ms(a.start) > Date.now() && a.status !== 'completed') a.status = 'cancelled' })
}

export function Privacy({ onOpenAudit }: { onOpenAudit?: () => void }) {
  const { state, can, actions } = useStore()
  const ext = getExt(state)
  const ret = state.settings.retentionMonths
  const [months, setMonths] = useState(ret)
  useEffect(() => setMonths(ret), [ret.chats, ret.clinical, ret.exports]) // eslint-disable-line react-hooks/exhaustive-deps
  const [addOpen, setAddOpen] = useState(false)
  const [eraseFor, setEraseFor] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)

  const retErrors = RETENTION.filter(r => !Number.isInteger(months[r.key]) || months[r.key] < r.min || months[r.key] > r.max).map(r => r.key)
  const retDirty = months.chats !== ret.chats || months.clinical !== ret.clinical || months.exports !== ret.exports

  const saveRetention = () => {
    if (retErrors.length) return
    const parts = RETENTION.filter(r => months[r.key] !== ret[r.key]).map(r => `${r.key} ${ret[r.key]} → ${months[r.key]} months`)
    actions.update(d => {
      d.settings.retentionMonths = { ...months }
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.retention', target: { type: 'settings', id: 'retention', label: 'Data retention' }, detail: parts.join('; ') })
    })
    actions.toast('Retention periods saved. The nightly clean-up uses them from tonight.', 'success')
  }

  const setConsent = (key: keyof SettingsExt['consentDefaults'], v: boolean, label: string) => {
    actions.update(d => {
      editExt(d, e => { e.consentDefaults[key] = v })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.consent', target: { type: 'settings', id: 'consent', label: 'Consent defaults' }, detail: `${label}: ${v ? 'on' : 'off'}` })
    })
    actions.toast(`${label}: ${v ? 'on' : 'off'}`, 'success')
  }

  const open = ext.dataRequests.filter(r => r.status === 'open').sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
  const done = ext.dataRequests.filter(r => r.status === 'done').sort((a, b) => ms(b.doneAt ?? b.receivedAt) - ms(a.doneAt ?? a.receivedAt))
  const canErase = can('clients.erase')

  const markDone = (r: DataRequest, detail: string, reason?: string, erase?: boolean) => {
    actions.update(d => {
      if (erase && r.clientId) eraseClient(d, r.clientId)
      editExt(d, e => {
        const x = e.dataRequests.find(y => y.id === r.id)
        if (x) { x.status = 'done'; x.doneAt = iso(Date.now()); x.doneBy = d.currentUserId }
      })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: erase ? 'client.erased' : r.kind === 'export' ? 'client.exported' : 'privacy.request_done', target: { type: r.clientId && !erase ? 'client' : 'settings', id: r.clientId ?? r.id, label: erase ? 'Erased client' : r.personName }, detail, reason })
    })
  }

  const exportFor = (r: DataRequest) => {
    const c = state.clients.find(x => x.id === r.clientId)
    const bundle = c ? {
      client: c,
      conversations: state.conversations.filter(x => x.clientId === c.id),
      appointments: state.appointments.filter(x => x.clientId === c.id),
      plans: state.plans.filter(x => x.clientId === c.id),
      payments: state.payments.filter(x => x.clientId === c.id),
      documents: state.documents.filter(x => x.clientId === c.id).map(x => ({ title: x.title, kind: x.kind, at: x.at })),
    } : { person: r.personName, note: 'No matching record in Lead Manager' }
    const json = JSON.stringify(bundle, null, 2)
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `data-export-${r.personName.toLowerCase().replace(/[^a-z]+/g, '-')}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } catch {
      /* downloads may be blocked in previews */
    }
    markDone(r, `Export prepared (${Math.max(1, Math.round(json.length / 1024))} KB: profile, chats, appointments, plans, payments)`)
    actions.toast(`Export prepared for ${r.personName}. Send it through the secure link; it is deleted after ${ret.exports} month${ret.exports === 1 ? '' : 's'}.`, 'success')
  }

  const eraseReq = ext.dataRequests.find(r => r.id === eraseFor)

  return (
    <div className="stack lg">
      <Card title="Data requests" subtitle="Requests to see or delete personal data. You have one calendar month to respond."
        actions={<>
          {done.length > 0 && <Button size="sm" variant="ghost" onClick={() => setShowDone(s => !s)}>{showDone ? 'Hide completed' : `Show ${done.length} completed`}</Button>}
          <Button size="sm" variant="secondary" icon="plus" onClick={() => setAddOpen(true)}>Log a request</Button>
        </>}>
        {open.length === 0 && !showDone ? (
          <EmptyState icon="shield" title="No open requests" body="When someone asks for a copy of their data or asks you to delete it (in a DM, by email or on the phone), log it here so the deadline is tracked." />
        ) : (
          <ul className="st-list">
            {[...open, ...(showDone ? done : [])].map(r => {
              const left = ms(r.dueAt) - Date.now()
              const exists = !!r.clientId && state.clients.some(c => c.id === r.clientId && c.name !== 'Erased client')
              return (
                <li key={r.id} className={`st-list-row ${r.status === 'done' ? 'st-row-off' : ''}`}>
                  <span className={`st-list-icon ${r.kind === 'erase' ? 'st-icon-danger' : ''}`}><Icon name={r.kind === 'erase' ? 'trash' : 'download'} size={16} /></span>
                  <div className="stack grow" style={{ gap: 3 }}>
                    <span className="row wrap" style={{ gap: 6 }}>
                      {exists ? <button type="button" className="st-link strong" onClick={() => actions.go('client', r.clientId)}>{r.personName}</button> : <span className="strong">{r.personName}</span>}
                      <Chip tone={r.kind === 'erase' ? 'danger' : 'info'}>{r.kind === 'erase' ? 'Erase' : 'Copy of data'}</Chip>
                      {r.status === 'done' ? <Chip tone="ok" icon="check">Done</Chip>
                        : <Chip tone={left < 0 ? 'danger' : left < 7 * DAY ? 'warn' : 'neutral'} icon="clock">{left < 0 ? `Overdue ${ago(r.dueAt)}` : `Due ${until(r.dueAt)}`}</Chip>}
                    </span>
                    <span className="tiny muted">Received {shortDate(r.receivedAt)} via {r.via}{r.status === 'done' && r.doneAt ? ` · completed ${shortDate(r.doneAt)} by ${userName(state, r.doneBy)}` : ''}</span>
                    {r.note && <span className="small">{r.note}</span>}
                  </div>
                  {r.status === 'open' && (
                    <div className="st-list-actions">
                      {r.kind === 'export' ? (
                        <Button size="sm" variant="secondary" icon="download" onClick={() => exportFor(r)}>Prepare export</Button>
                      ) : canErase ? (
                        exists
                          ? <Button size="sm" variant="danger" icon="trash" onClick={() => setEraseFor(r.id)}>Erase data</Button>
                          : <Button size="sm" variant="secondary" icon="check" onClick={() => { markDone(r, 'Marked done: no record held'); actions.toast(`${r.personName}: marked done`, 'success') }}>Mark done</Button>
                      ) : <Locked>Needs erase permission</Locked>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <div className="grid-2">
        <Card title="How long we keep data" subtitle="Applied every night. Anything past its date is deleted, not archived.">
          <div className="stack lg">
            {RETENTION.map(r => (
              <Field key={r.key} label={`${r.label} (months)`} hint={r.hint} error={retErrors.includes(r.key) ? `Between ${r.min} and ${r.max} months` : undefined}>
                {id => (
                  <div className="st-months">
                    <input id={id} className="input st-num-input num" type="number" min={r.min} max={r.max} value={Number.isNaN(months[r.key]) ? '' : months[r.key]}
                      onChange={e => setMonths(m => ({ ...m, [r.key]: e.target.value === '' ? NaN : Number(e.target.value) }))} />
                    <span className="small muted">{Number.isFinite(months[r.key]) && months[r.key] >= 12 ? `about ${Math.round((months[r.key] / 12) * 10) / 10} years` : ''}</span>
                  </div>
                )}
              </Field>
            ))}
            <div className="st-save-row">
              <Button variant="ghost" disabled={!retDirty} onClick={() => setMonths(ret)}>Discard</Button>
              <Button variant="primary" disabled={!retDirty || retErrors.length > 0} onClick={saveRetention}>Save retention</Button>
            </div>
          </div>
        </Card>

        <div className="stack lg">
          <Card title="Consent defaults" subtitle="What staff ask for, and what the AI assumes, when a lead becomes a client.">
            <ul className="st-toggles">
              {CONSENT.map(c => (
                <li key={c.key} className="st-toggle-row">
                  <div className="stack grow" style={{ gap: 2 }}>
                    <span className="strong small">{c.label}</span>
                    <span className="tiny muted">{c.hint}</span>
                  </div>
                  <Toggle checked={ext.consentDefaults[c.key]} onChange={v => setConsent(c.key, v, c.label)} label={c.label} hideLabel />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Audit log" subtitle="Every view of a phone number, override, export and erase is recorded with who and why.">
            {can('audit.view')
              ? <Button variant="secondary" icon="history" iconRight="arrowRight" onClick={onOpenAudit}>Open the activity log</Button>
              : <Locked>Only people with audit access can open the log</Locked>}
          </Card>
        </div>
      </div>

      <AddRequestModal open={addOpen} onClose={() => setAddOpen(false)} />
      <ReasonDialog open={!!eraseReq} title={`Erase ${eraseReq?.personName ?? ''}’s personal data?`} tone="danger" confirmLabel="Erase permanently"
        body={<div className="stack">
          <p>Name, handles, phone, email, chats, notes, photos and documents are deleted. Open tasks and future appointments are cancelled. This can’t be undone.</p>
          <p>Payments and invoices are kept for tax records with the name removed. The audit log keeps a record that the erase happened.</p>
        </div>}
        placeholder="e.g. Erase request received by DM on 2 October; identity confirmed on the phone"
        onClose={() => setEraseFor(null)}
        onConfirm={reason => {
          if (!eraseReq) return
          markDone(eraseReq, 'Personal data erased (chats, notes, documents, contact details); payments kept anonymised', reason, true)
          actions.toast(`${eraseReq.personName}’s personal data was erased`, 'success')
        }} />
    </div>
  )
}

function AddRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, actions } = useStore()
  const [clientId, setClientId] = useState('')
  const [other, setOther] = useState('')
  const [kind, setKind] = useState<'export' | 'erase'>('export')
  const [via, setVia] = useState('Instagram DM')
  const [received, setReceived] = useState(() => new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  useEffect(() => {
    if (open) { setClientId(''); setOther(''); setKind('export'); setVia('Instagram DM'); setReceived(new Date().toISOString().slice(0, 10)); setNote('') }
  }, [open])
  const clients = state.clients.filter(c => c.name !== 'Erased client').sort((a, b) => a.name.localeCompare(b.name))
  const person = clientId === '__other' ? other.trim() : clients.find(c => c.id === clientId)?.name ?? ''
  const receivedAt = new Date(received + 'T09:00:00').getTime()
  const ok = person.length >= 2 && Number.isFinite(receivedAt) && receivedAt <= Date.now() + DAY

  const save = () => {
    if (!ok) return
    const id = uid('dr')
    const due = new Date(receivedAt)
    due.setMonth(due.getMonth() + 1)
    actions.update(d => {
      editExt(d, e => {
        e.dataRequests.unshift({ id, clientId: clientId && clientId !== '__other' ? clientId : undefined, personName: person, kind, via, receivedAt: iso(receivedAt), dueAt: iso(due.getTime()), status: 'open', note: note.trim() || undefined })
      })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'privacy.request_logged', target: { type: 'settings', id, label: person }, detail: `${kind === 'erase' ? 'Erase' : 'Copy of data'} request received via ${via}` })
    })
    actions.toast(`Request logged. Due ${due.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`, 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Log a data request" description="Confirm who they are before you send data or erase anything."
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!ok} onClick={save}>Log request</Button></>}>
      <div className="stack lg">
        <Field label="Who is asking?">
          {id => (
            <select id={id} className="input" value={clientId} onChange={e => setClientId(e.target.value)}>
              <option value="" disabled>Pick a client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.handles.instagram ? ` · ${c.handles.instagram}` : c.handles.tiktok ? ` · ${c.handles.tiktok}` : ''}</option>)}
              <option value="__other">Someone not in Lead Manager…</option>
            </select>
          )}
        </Field>
        {clientId === '__other' && (
          <Field label="Their name">
            {id => <input id={id} className="input" value={other} onChange={e => setOther(e.target.value)} />}
          </Field>
        )}
        <div className="stack" style={{ gap: 5 }}>
          <span className="field-label">They want</span>
          <Segmented<'export' | 'erase'> label="Request type" value={kind} onChange={setKind} options={[{ id: 'export', label: 'A copy of their data' }, { id: 'erase', label: 'Their data erased' }]} />
        </div>
        <div className="st-form-2">
          <Field label="Received via">
            {id => (
              <select id={id} className="input" value={via} onChange={e => setVia(e.target.value)}>
                {['Instagram DM', 'TikTok DM', 'Email', 'Phone', 'In person', 'Letter'].map(v => <option key={v}>{v}</option>)}
              </select>
            )}
          </Field>
          <Field label="Received on">
            {id => <input id={id} className="input" type="date" value={received} max={new Date().toISOString().slice(0, 10)} onChange={e => setReceived(e.target.value)} />}
          </Field>
        </div>
        <Field label="Note (optional)">
          {id => <textarea id={id} className="input" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Wants records for their insurer" />}
        </Field>
      </div>
    </Modal>
  )
}
