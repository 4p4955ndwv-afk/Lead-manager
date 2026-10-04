// Client record header: identity, contact details (phone masked until revealed), consent, score and the main actions.
import { useState } from 'react'
import { useStore } from '../../lib/store'
import type { Client, Conversation, Episode } from '../../lib/types'
import { CHANNEL_LABEL } from '../../lib/types'
import { canOpen, formatPhone, maskPhone } from '../../lib/permissions'
import { ms, shortDate } from '../../lib/time'
import { Avatar, Button, ChannelBadge, Chip, IconButton, StageBadge } from '../../components/ui'
import { Icon } from '../../components/icons'
import { Menu, type MenuItem } from './Menu'
import { EditClientModal, EraseFlow, LogCallModal, MergeModal, MoveStageFlow, first } from './dialogs'
import { auditFor, bookingBlock, channelPhrase, dayYear, handleUrl, handlesOf, langLabel, scoreTone, slug } from './helpers'
import { saveFile } from '../../lib/download'

export function Header({ client, episode, latest }: { client: Client; episode?: Episode; latest?: Episode }) {
  const { state, me, can, actions } = useStore()
  const [revealed, setRevealed] = useState(false)
  const [dialog, setDialog] = useState<'call' | 'edit' | 'merge' | 'erase' | 'move' | null>(null)
  const close = () => setDialog(null)

  const showPhone = can('clients.view_phone')
  const conv: Conversation | undefined = state.conversations.filter(c => c.clientId === client.id).sort((a, b) => ms(b.lastMessageAt) - ms(a.lastMessageAt))[0]
  const owner = state.users.find(u => u.id === client.ownerId)
  const branch = state.branches.find(b => b.id === client.branchId)
  const hs = handlesOf(client)
  // a returning client's first contact is the start of their first episode, even if the profile was created later
  const firstContact = state.episodes.filter(e => e.clientId === client.id).reduce((t, e) => (ms(e.startedAt) < ms(t) ? e.startedAt : t), client.createdAt)

  const logView = (how: string) => {
    if (revealed) return
    setRevealed(true)
    actions.audit({ action: 'client.view_phone', target: { type: 'client', id: client.id, label: client.name }, detail: how })
  }

  const exportData = () => {
    const pick = <T extends { clientId: string }>(arr: T[]) => arr.filter(x => x.clientId === client.id)
    const data = {
      exportedAt: new Date().toISOString(), exportedBy: me.name, organisation: state.settings.orgName,
      client, episodes: pick(state.episodes), conversations: pick(state.conversations), tasks: pick(state.tasks), appointments: pick(state.appointments),
      plans: pick(state.plans), payments: pick(state.payments), notes: pick(state.notes), documents: pick(state.documents), auditTrail: auditFor(state, client.id),
    }
    const file = `northlight-export-${slug(client.name)}.json`
    void saveFile(file, JSON.stringify(data, null, 2), 'application/json')
    actions.audit({ action: 'client.export', target: { type: 'client', id: client.id, label: client.name }, detail: `Personal data export prepared (${file})` })
    actions.toast(`Export prepared: ${file}. Logged in the audit trail.`, 'success')
  }

  const askClaude = () => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: `Summarise ${client.name}'s journey so far and tell me the next best action.` } }))

  const more: MenuItem[] = [
    ...(can('clients.merge') ? [{ id: 'merge', label: 'Merge duplicate', icon: 'merge' as const, onSelect: () => setDialog('merge') }] : []),
    ...(can('clients.erase') ? [
      { id: 'export', label: 'Export data', icon: 'download' as const, onSelect: exportData, hint: 'Downloads everything we hold as JSON' },
      { id: 'erase', label: 'Erase person', icon: 'trash' as const, danger: true, onSelect: () => setDialog('erase') },
    ] : []),
    { id: 'claude', label: `Ask Claude about ${first(client.name)}`, icon: 'sparkles', onSelect: askClaude },
  ]

  const consent: Array<[string, boolean]> = [
    ['WhatsApp', client.consent.whatsapp], ['SMS', client.consent.sms], ['Marketing', client.consent.marketing], ['Call recording', client.consent.callRecording],
  ]
  const canCall = !!client.phone && showPhone && !client.doNotContact
  const tone = scoreTone(client.score)

  return (
    <section className="card cr-head" aria-label="Client details">
      <div className="cr-head-top">
        <Avatar name={client.name} size={56} />
        <div className="cr-head-id">
          <div className="row wrap" style={{ gap: 8 }}>
            <h1 className="cr-name">{client.name}</h1>
            {client.doNotContact && <Chip tone="danger" icon="shield">Do not contact</Chip>}
            {latest && <StageBadge stage={latest.stage} exit={latest.exit} />}
          </div>
          <div className="row wrap cr-head-handles">
            {hs.map(h => (
              <a key={h.channel} className={`cr-handle-chip chip chip-${h.channel === 'instagram' ? 'ig' : 'tt'}`} href={handleUrl(h.channel, h.handle)} target="_blank" rel="noreferrer" title={`Open ${h.handle} on ${h.channel === 'instagram' ? 'Instagram' : 'TikTok'}`}>
                <Icon name={h.channel} size={13} />{h.handle}
              </a>
            ))}
            {!hs.length && <Chip icon={client.source.channel === 'whatsapp' ? 'whatsapp' : client.source.channel === 'phone' ? 'phone' : 'user'}>No social handle · came in via {channelPhrase(client.source.channel)}</Chip>}
            {client.mergedFrom?.length ? <Chip tone="team" icon="merge" title={client.mergedFrom.join(', ')}>Merged from {client.mergedFrom.length} record{client.mergedFrom.length > 1 ? 's' : ''}</Chip> : null}
          </div>
        </div>
        <div className={`cr-score-box cr-score-${tone}`} title="Lead score from the AI, based on intent, timing and engagement">
          <span className="cr-score-num num">{client.score}</span>
          <span className="tiny muted">Lead score</span>
          <span className="cr-score-bar" aria-hidden="true"><span style={{ width: `${client.score}%` }} /></span>
        </div>
      </div>

      <dl className="cr-facts">
        <div className="cr-fact cr-fact-phone">
          <dt>Phone</dt>
          <dd>
            {!client.phone ? <span className="faint">Not shared yet</span> : showPhone ? (
              revealed ? (
                <span className="row wrap" style={{ gap: 6 }}>
                  <a className="num strong" href={`tel:${client.phone}`}>{formatPhone(client.phone)}</a>
                  <IconButton size="sm" icon="copy" label="Copy number" onClick={() => { navigator.clipboard?.writeText(client.phone ?? '').catch(() => undefined); actions.toast('Number copied.', 'success') }} />
                  <span className="tiny faint">View logged</span>
                </span>
              ) : (
                <span className="row wrap" style={{ gap: 6 }}>
                  <span className="num">{maskPhone(client.phone, false)}</span>
                  <Button size="sm" variant="ghost" icon="eye" onClick={() => logView('Viewed phone number')} aria-label={`Reveal ${first(client.name)}'s phone number (logged)`}>Reveal</Button>
                </span>
              )
            ) : (
              <span className="row" style={{ gap: 6 }} title="Your role cannot see phone numbers">
                <span className="num">{maskPhone(client.phone, false)}</span><Icon name="lock" size={13} />
              </span>
            )}
          </dd>
        </div>
        <div className="cr-fact cr-fact-wide"><dt>Email</dt><dd>{client.email ? <a href={`mailto:${client.email}`} className="cr-fact-link" title={client.email}>{client.email}</a> : <span className="faint">Not given</span>}</dd></div>
        <div className="cr-fact"><dt>Language</dt><dd>{langLabel(client.language)}</dd></div>
        <div className="cr-fact"><dt>Owner</dt><dd>{owner ? <span className="row" style={{ gap: 6 }}><Avatar name={owner.name} color={owner.color} size={20} /><span className="truncate">{owner.name}{owner.id === me.id ? ' (you)' : ''}</span></span> : <span className="faint">Unassigned</span>}</dd></div>
        <div className="cr-fact"><dt>Branch</dt><dd>{branch ? `${branch.name}, ${branch.city}` : '—'}</dd></div>
        <div className="cr-fact cr-fact-wide"><dt>Came in via</dt><dd><span className="row" style={{ gap: 6 }}><ChannelBadge channel={client.source.channel} size="sm" label={false} /><span className="cr-fact-link" title={client.source.detail}>{client.source.detail}</span></span></dd></div>
        <div className="cr-fact"><dt>First contact</dt><dd title={new Date(firstContact).toLocaleString()}>{dayYear(firstContact)}</dd></div>
        <div className="cr-fact"><dt>Age check</dt><dd>{client.ageVerified ? <span className="cr-ok row" style={{ gap: 4 }}><Icon name="check" size={14} />ID verified</span> : <span className="muted">At consultation</span>}{client.dateOfBirth && showPhone ? <span className="tiny muted"> · born {dayYear(client.dateOfBirth)}</span> : null}</dd></div>
      </dl>

      <div className="row wrap cr-head-chips">
        <span className="tiny muted cr-chips-label">Consent</span>
        {consent.map(([label, on]) => (
          <Chip key={label} tone={on ? 'ok' : 'neutral'} icon={on ? 'check' : 'x'} className={on ? '' : 'cr-chip-off'} title={`${label}: ${on ? 'agreed' : 'not agreed'} · updated ${shortDate(client.consent.updatedAt)}`}>{label}</Chip>
        ))}
        <span className="tiny faint">updated {shortDate(client.consent.updatedAt)}</span>
        {client.tags.length > 0 && <span className="tiny muted cr-chips-label">Tags</span>}
        {client.tags.map(t => <Chip key={t} tone={t === 'VIP' ? 'accent' : 'neutral'}>{t}</Chip>)}
      </div>

      <div className="cr-head-actions">
        {/* no number yet: nothing to call or log, so the chat (where they can share it) leads instead */}
        {!client.phone ? null : canCall ? (
          <a className="btn btn-primary btn-md" href={`tel:${client.phone}`} onClick={() => logView('Called from the client record')}>
            <Icon name="phone" size={17} /><span>Call</span>
          </a>
        ) : (
          <Button variant="primary" icon="phone" disabled title={client.doNotContact ? 'Do not contact is on' : 'Your role cannot see phone numbers'}>
            {client.doNotContact ? 'Do not contact' : 'Call'}
          </Button>
        )}
        {can('pipeline.move') && client.phone && <Button icon="edit" onClick={() => setDialog('call')}>Log a call</Button>}
        {canOpen(me, 'inbox') && (
          <Button variant={!client.phone && conv && !bookingBlock(client, latest) ? 'primary' : 'secondary'} icon="message" disabled={!conv} onClick={() => conv && actions.go('inbox', conv.id)} title={conv ? `Open the ${CHANNEL_LABEL[conv.channel]} chat` : 'No DM thread yet'}>
            {conv ? 'Message' : 'No DM thread'}
          </Button>
        )}
        {latest && can('pipeline.move') && <Button icon="arrowRight" onClick={() => setDialog('move')}>Move stage</Button>}
        {can('clients.edit') && <Button icon="settings" onClick={() => setDialog('edit')}>Edit details</Button>}
        <Menu label="More actions" items={more} />
      </div>

      <LogCallModal open={dialog === 'call'} onClose={close} client={client} episode={latest} />
      <EditClientModal open={dialog === 'edit'} onClose={close} client={client} />
      <MergeModal open={dialog === 'merge'} onClose={close} client={client} />
      <EraseFlow open={dialog === 'erase'} onClose={close} client={client} />
      {/* only the latest episode moves; earlier ones are history (the pipeline shows the latest too) */}
      {latest && <MoveStageFlow open={dialog === 'move'} onClose={close} client={client} episode={latest} />}
    </section>
  )
}

