// Documents tab: consent forms, quotes, invoices, ID checks and clinical photos (locked unless clinical.view).
import { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import type { Client, Document, Episode } from '../../lib/types'
import { dateTime, iso, shortDate, uid } from '../../lib/time'
import { Button, Chip, EmptyState, Field, Locked, Modal } from '../../components/ui'
import { Icon } from '../../components/icons'
import { DOC_KIND_ICON, DOC_KIND_LABEL } from './helpers'
import { first } from './dialogs'

export function DocumentsTab({ client }: { client: Client; episode?: Episode }) {
  const { state, can, actions } = useStore()
  const [addOpen, setAddOpen] = useState(false)
  const docs = state.documents.filter(d => d.clientId === client.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const clinical = can('clinical.view')
  const canEdit = can('clients.edit') || can('clinical.edit')
  const channel = client.consent.whatsapp ? 'WhatsApp' : client.consent.sms ? 'SMS' : client.email ? 'email' : undefined
  const audit = (d: Document, action: string, detail: string) => ({ id: uid('au'), at: iso(Date.now()), actor: state.currentUserId, action, target: { type: 'client' as const, id: client.id, label: client.name }, detail: `${detail}: ${d.title}` })

  const markSigned = (d: Document) => {
    actions.update(s => {
      const x = s.documents.find(y => y.id === d.id)
      if (x) x.signed = true
      if (d.kind === 'id_check') { const c = s.clients.find(y => y.id === client.id); if (c) c.ageVerified = true }
      s.audit.unshift(audit(d, d.kind === 'id_check' ? 'client.id_verified' : 'document.signed', d.kind === 'id_check' ? 'ID checked and age verified' : 'Marked signed'))
    })
    actions.toast(d.kind === 'id_check' ? `ID checked. ${first(client.name)} is verified as 18 or over.` : `${d.title} marked as signed.`, 'success')
  }
  const send = (d: Document) => {
    actions.update(s => { s.audit.unshift(audit(d, 'document.sent', `Sent by ${channel ?? 'email'}`)) })
    actions.toast(`${d.title} sent to ${first(client.name)} by ${channel ?? 'email'}.`, 'success')
  }
  const view = (d: Document) => {
    actions.update(s => { s.audit.unshift(audit(d, 'document.view', 'Opened restricted clinical photos')) })
    actions.toast('Photos opened in the secure viewer. Access is logged.', 'info')
  }

  const unsigned = docs.filter(d => d.kind === 'consent_form' && !d.signed).length

  return (
    <div className="stack lg">
      <div className="row between wrap">
        <span className="small muted">{docs.length} document{docs.length === 1 ? '' : 's'}{unsigned ? ` · ${unsigned} waiting for signature` : ''}{!clinical && docs.some(d => d.restricted) ? ' · clinical photos are restricted' : ''}</span>
        {canEdit && <Button size="sm" variant="primary" icon="plus" onClick={() => setAddOpen(true)}>Add document</Button>}
      </div>
      {docs.length === 0 ? (
        <div className="card">
          <EmptyState icon="file" title="No documents yet" body="Consent forms, quotes and ID checks appear here when a plan is proposed or a consultation is booked. Clinical photos are added by the clinician."
            action={canEdit ? <Button size="sm" icon="plus" onClick={() => setAddOpen(true)}>Add document</Button> : undefined} />
        </div>
      ) : (
        <ul className="cr-docs">
          {docs.map(d => {
            const hidden = d.restricted && !clinical
            return (
              <li key={d.id} className={`cr-doc ${hidden ? 'is-locked' : ''}`}>
                {d.kind === 'photo' ? (
                  <div className="cr-doc-thumb" aria-hidden="true">
                    {hidden ? <Icon name="lock" size={22} /> : <div className="cr-doc-grid">{[0, 1, 2, 3].map(i => <span key={i}><Icon name="image" size={16} /></span>)}</div>}
                  </div>
                ) : (
                  <span className={`cr-doc-icon kind-${d.kind}`} aria-hidden="true"><Icon name={DOC_KIND_ICON[d.kind]} size={18} /></span>
                )}
                <div className="stack grow" style={{ gap: 3 }}>
                  <span className="strong small">{hidden ? DOC_KIND_LABEL[d.kind] : d.title}</span>
                  <span className="tiny muted" title={dateTime(d.at)}>{DOC_KIND_LABEL[d.kind]} · {shortDate(d.at)}</span>
                  <span className="row wrap" style={{ gap: 6 }}>
                    {d.kind === 'consent_form' && <Chip tone={d.signed ? 'ok' : 'warn'} icon={d.signed ? 'check' : 'clock'}>{d.signed ? 'Signed' : 'Waiting for signature'}</Chip>}
                    {d.kind === 'id_check' && <Chip tone={d.signed || client.ageVerified ? 'ok' : 'warn'} icon={d.signed || client.ageVerified ? 'check' : 'clock'}>{d.signed || client.ageVerified ? 'Verified' : 'To check at the visit'}</Chip>}
                    {d.restricted && <Chip tone="team" icon="lock">Clinical</Chip>}
                  </span>
                  {hidden && <Locked />}
                </div>
                <div className="row wrap cr-doc-actions">
                  {d.kind === 'photo' && clinical && <Button size="sm" icon="eye" onClick={() => view(d)}>Open</Button>}
                  {d.kind === 'consent_form' && !d.signed && canEdit && <>
                    <Button size="sm" variant="ghost" icon="send" disabled={client.doNotContact} onClick={() => send(d)}>Send to sign</Button>
                    <Button size="sm" icon="check" onClick={() => markSigned(d)}>Mark signed</Button>
                  </>}
                  {d.kind === 'id_check' && !d.signed && !client.ageVerified && can('clients.edit') && <Button size="sm" icon="check" onClick={() => markSigned(d)}>Mark ID checked</Button>}
                  {(d.kind === 'quote' || d.kind === 'invoice') && can('payments.view') && <Button size="sm" variant="ghost" icon="send" disabled={client.doNotContact} onClick={() => send(d)}>Send again</Button>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <AddDocModal open={addOpen} onClose={() => setAddOpen(false)} client={client} />
    </div>
  )
}

function AddDocModal({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const { can, actions } = useStore()
  const kinds = (Object.keys(DOC_KIND_LABEL) as Document['kind'][]).filter(k => k !== 'photo' || can('clinical.edit'))
  const [kind, setKind] = useState<Document['kind']>('consent_form')
  const [title, setTitle] = useState('')
  const [file, setFile] = useState('')
  const [signed, setSigned] = useState(false)
  useEffect(() => { if (open) { setKind('consent_form'); setTitle(''); setFile(''); setSigned(false) } }, [open])
  const restricted = kind === 'photo'
  const finalTitle = title.trim() || file.replace(/\.[^.]+$/, '')

  const save = () => {
    if (!finalTitle) return
    const id = uid('dc')
    actions.update(d => {
      d.documents.unshift({ id, clientId: client.id, kind, title: finalTitle, at: iso(Date.now()), restricted, signed: kind === 'consent_form' || kind === 'id_check' ? signed : undefined })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'document.added', target: { type: 'client', id: client.id, label: client.name }, detail: `${DOC_KIND_LABEL[kind]} added: ${restricted ? '(restricted)' : finalTitle}` })
    })
    actions.toast(`${DOC_KIND_LABEL[kind]} added to ${first(client.name)}'s record${restricted ? ' (clinical staff only)' : ''}.`, 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={480} title="Add a document"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="plus" disabled={!finalTitle} onClick={save}>Add document</Button>
      </>}>
      <div className="stack lg">
        <Field label="Type">
          {id => <select id={id} className="input" value={kind} onChange={e => setKind(e.target.value as Document['kind'])}>{kinds.map(k => <option key={k} value={k}>{DOC_KIND_LABEL[k]}</option>)}</select>}
        </Field>
        <Field label="File" hint="PDF or image. Stored with the client record.">
          {id => <input id={id} className="input" type="file" accept=".pdf,image/*" onChange={e => setFile(e.target.files?.[0]?.name ?? '')} />}
        </Field>
        <Field label="Title" hint={file && !title ? `Will use “${finalTitle}”` : undefined}>
          {id => <input id={id} className="input" value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'consent_form' ? 'Consent: Chemical peel course v2' : kind === 'photo' ? 'Forehead, baseline (3 photos)' : kind === 'quote' ? 'Quote Q-1050: laser, full legs' : 'Passport seen at reception'} />}
        </Field>
        {(kind === 'consent_form' || kind === 'id_check') && (
          <label className="checkbox"><input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />{kind === 'consent_form' ? 'Already signed' : 'ID already checked'}</label>
        )}
        {restricted && <p className="tiny muted"><Icon name="lock" size={12} /> Clinical photos are visible to clinical staff only. Everyone else sees a locked placeholder.</p>}
      </div>
    </Modal>
  )
}
