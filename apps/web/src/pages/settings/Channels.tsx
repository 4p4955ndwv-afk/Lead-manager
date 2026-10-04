import { useState, type ReactNode } from 'react'
import { Button, Card, Chip, KeyValue, type Tone } from '../../components/ui'
import { Icon, type IconName } from '../../components/icons'
import { useStore } from '../../lib/store'
import type { ChannelConnection } from '../../lib/types'
import { DAY, iso, ms, until, uid, useNow } from '../../lib/time'

const NAME: Record<ChannelConnection['channel'], string> = { instagram: 'Instagram', tiktok: 'TikTok', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' }
const ICON: Record<ChannelConnection['channel'], IconName> = { instagram: 'instagram', tiktok: 'tiktok', whatsapp: 'whatsapp', sms: 'sms', email: 'mail' }
const STATUS: Record<ChannelConnection['status'], { tone: Tone; label: string }> = {
  connected: { tone: 'ok', label: 'Connected' },
  pending: { tone: 'warn', label: 'Waiting for approval' },
  error: { tone: 'danger', label: 'Needs attention' },
  not_connected: { tone: 'neutral', label: 'Not connected' },
  manual: { tone: 'info', label: 'Manual' },
}

const ALLOWS: Record<ChannelConnection['channel'], { lines: string[]; limits: string }> = {
  instagram: {
    lines: [
      'Official Instagram Messaging API: DMs, story replies and comment-to-DM arrive in the Inbox within seconds.',
      'The AI can reply automatically for 24 hours after the client’s last message.',
      'After 24 hours only staff can reply, using the Human Agent tag, for up to 7 days. The AI never uses it.',
    ],
    limits: 'No cold messages: we can only answer people who wrote to us first.',
  },
  tiktok: {
    lines: [
      'TikTok Business Messaging API (application pending). Once approved, DMs arrive in the Inbox like Instagram.',
      'Replies are allowed for 48 hours after the client’s last message, and at most 10 messages per client message.',
      'Until approval: co-pilot drafts are prepared here and staff paste them into TikTok, or we use an approved messaging partner.',
    ],
    limits: 'The 10-message counter resets each time the client writes again.',
  },
  whatsapp: {
    lines: [
      'WhatsApp Cloud API, used for appointment reminders, deposit links and aftercare check-ins.',
      'Outside a 24-hour customer window, only pre-approved templates can be sent.',
      'Only sent to clients who agreed to WhatsApp on the call or at booking.',
    ],
    limits: 'Not used for lead chats: new conversations start on Instagram or TikTok.',
  },
  sms: {
    lines: [
      'Two-way UK number for reminders when someone has not agreed to WhatsApp.',
      'Replies of STOP are honoured automatically and mark the client as do-not-contact for SMS.',
    ],
    limits: 'Plain text only, no links to photos or forms.',
  },
  email: {
    lines: [
      'Sends invites, quotes, consent forms, receipts and data exports from the clinic’s own domain.',
      'SPF, DKIM and DMARC are set, so messages do not land in spam.',
    ],
    limits: 'Marketing emails are only sent to people with marketing consent.',
  },
}

function TokenLine({ c }: { c: ChannelConnection }) {
  const now = useNow(30_000)
  if (!c.tokenExpiresAt) return <span className="muted">Does not expire</span>
  const left = ms(c.tokenExpiresAt) - now
  const tone: Tone = left < 0 ? 'danger' : left < 14 * DAY ? 'warn' : 'ok'
  return (
    <Chip tone={tone} icon="clock" title={new Date(c.tokenExpiresAt).toLocaleString()}>
      {left < 0 ? `Expired ${until(c.tokenExpiresAt, now)}` : `Expires ${until(c.tokenExpiresAt, now)}`}
    </Chip>
  )
}

export function Channels() {
  const { state, actions } = useStore()
  const [busy, setBusy] = useState<string | null>(null)
  const aiMode = (ch: ChannelConnection['channel']) =>
    ch === 'instagram' || ch === 'tiktok' || ch === 'whatsapp' ? state.ai.mode[ch] : undefined

  const reconnect = (c: ChannelConnection) => {
    if (c.status === 'pending') {
      actions.toast('TikTok is still reviewing the Business Messaging application. We’ll notify you here when it is approved.', 'info')
      return
    }
    setBusy('re:' + c.channel)
    window.setTimeout(() => {
      actions.update(d => {
        const x = d.settings.channels.find(y => y.channel === c.channel)
        if (!x) return
        x.status = 'connected'
        if (x.tokenExpiresAt || x.channel === 'instagram') x.tokenExpiresAt = iso(Date.now() + 60 * DAY)
        d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.channel_reconnected', target: { type: 'settings', id: 'channel_' + c.channel, label: NAME[c.channel] }, detail: x.tokenExpiresAt ? `Reconnected; new token valid for 60 days` : 'Connection re-verified' })
      })
      setBusy(null)
      actions.toast(c.tokenExpiresAt || c.channel === 'instagram' ? `${NAME[c.channel]} reconnected. New token valid for 60 days.` : `${NAME[c.channel]} connection re-verified`, 'success')
    }, 700)
  }

  const test = (c: ChannelConnection) => {
    if (c.status === 'pending') {
      actions.toast('Tests are available once TikTok approves the application. Until then, drafts are copied into TikTok by staff.', 'warn')
      return
    }
    setBusy('t:' + c.channel)
    window.setTimeout(() => {
      setBusy(null)
      const msg: Record<ChannelConnection['channel'], string> = {
        instagram: 'Test DM sent to the clinic’s test account and received back in 0.9 s.',
        tiktok: '',
        whatsapp: 'Template “appointment_reminder” delivered to your phone.',
        sms: 'Test SMS delivered to your phone in 2.1 s.',
        email: `Test email sent from ${c.account}. Check your inbox.`,
      }
      actions.toast(msg[c.channel], 'success')
    }, 600)
  }

  return (
    <div className="stack lg">
      <p className="small muted">Each connection uses the platform’s official API with the clinic’s own business account. Lead Manager never logs in as a person.</p>
      <div className="st-channels">
        {state.settings.channels.map(c => {
          const st = STATUS[c.status]
          const mode = aiMode(c.channel)
          return (
            <Card key={c.channel} className="st-channel">
              <div className="st-channel-head">
                <span className={`st-channel-icon st-ch-${c.channel}`}><Icon name={ICON[c.channel]} size={18} /></span>
                <div className="stack grow" style={{ gap: 0 }}>
                  <h3>{NAME[c.channel]}</h3>
                  <span className="small muted truncate">{c.account}</span>
                </div>
                <Chip tone={st.tone}>{st.label}</Chip>
              </div>
              <KeyValue items={[
                ['Connection', c.detail],
                ['Access token', <TokenLine c={c} />],
                ...(mode ? [['AI replies', <button type="button" className="st-link" onClick={() => actions.go('ai')}>{mode === 'autopilot' ? 'Autopilot' : mode === 'copilot' ? 'Co-pilot' : 'Shadow'} · change in AI & playbook</button>] as [string, ReactNode]] : []),
              ]} />
              <details className="st-allows">
                <summary>What this connection allows</summary>
                <ul>{ALLOWS[c.channel].lines.map(l => <li key={l}>{l}</li>)}</ul>
                <p className="small muted">{ALLOWS[c.channel].limits}</p>
              </details>
              <div className="row wrap st-channel-actions">
                <Button size="sm" variant="secondary" icon="refresh" loading={busy === 're:' + c.channel} onClick={() => reconnect(c)}>{c.status === 'pending' ? 'Check approval status' : 'Reconnect'}</Button>
                <Button size="sm" variant="ghost" icon="send" loading={busy === 't:' + c.channel} onClick={() => test(c)}>Send a test</Button>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
