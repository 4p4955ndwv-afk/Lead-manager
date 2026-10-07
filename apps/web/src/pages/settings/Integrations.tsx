import { useEffect, useRef, useState } from 'react'
import { Button, Card, Chip, EmptyState, Field, Modal, ReasonDialog, Toggle, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore, userName } from '../../lib/store'
import { DAY, ago, iso, ms, shortDate, until, uid } from '../../lib/time'
import { TOKEN_SCOPES, WEBHOOK_EVENTS, copyText, editExt, getExt, randomChars, type WebhookEvent } from './ext'

export const MCP_URL = 'https://mcp.northlight.example/mcp'

/**
 * A show-once secret replaces the create form, so the second click of a double-click lands on its "done" button or,
 * as the dialog shrinks, on the backdrop, and the secret is gone before anyone sees it. Closing is ignored for a moment.
 */
function useSettledClick(ms = 700) {
  const at = useRef(0)
  return { shown: () => { at.current = Date.now() }, guard: (fn: () => void) => () => { if (Date.now() - at.current >= ms) fn() } }
}

function CopyField({ value, label }: { value: string; label: string }) {
  const { actions } = useStore()
  const copy = async () => {
    const ok = await copyText(value)
    actions.toast(ok ? `${label} copied` : 'Copy is blocked here. Select the text and copy it manually.', ok ? 'success' : 'warn')
  }
  return (
    <div className="st-copy">
      <input className="input mono" readOnly value={value} aria-label={label} onFocus={e => e.currentTarget.select()} />
      <Button variant="secondary" icon="copy" onClick={copy}>Copy</Button>
    </div>
  )
}

export function Integrations() {
  const { state, actions } = useStore()
  const ext = getExt(state)
  const [revokeClient, setRevokeClient] = useState<string | null>(null)
  const [revokeToken, setRevokeToken] = useState<string | null>(null)
  const [removeHook, setRemoveHook] = useState<string | null>(null)
  const [tokenOpen, setTokenOpen] = useState(false)
  const [hookOpen, setHookOpen] = useState(false)

  const client = state.settings.mcpClients.find(c => c.id === revokeClient)
  const token = ext.apiTokens.find(t => t.id === revokeToken)
  const hook = ext.webhooks.find(h => h.id === removeHook)

  const ask = () => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: 'Which leads shared a number today and have not been called yet? Who owns each one?' } }))

  const testHook = (id: string) => {
    const h = ext.webhooks.find(x => x.id === id)
    if (!h) return
    actions.update(d => editExt(d, e => {
      const x = e.webhooks.find(y => y.id === id)
      if (x) { x.lastDeliveryAt = iso(Date.now()); x.lastStatus = 'ok' }
    }))
    actions.toast(`Test ${h.events[0]} event delivered to ${new URL(h.url).host} (200 OK, 184 ms)`, 'success')
  }

  return (
    <div className="stack lg">
      <div className="grid-2">
        <Card title="MCP server" subtitle="Lets each person ask Claude questions about leads, tasks and numbers from claude.ai or the Claude app."
          actions={<Button size="sm" variant="subtle" icon="sparkles" onClick={ask}>Try a question</Button>}>
          <div className="stack lg">
            <CopyField value={MCP_URL} label="MCP server URL" />
            <ol className="st-steps small">
              <li>In Claude, open <b>Settings → Connectors</b> and choose <b>Add custom connector</b>.</li>
              <li>Paste the URL above and name it “{state.settings.orgName}”.</li>
              <li>Sign in with your own Lead Manager account when asked.</li>
            </ol>
            <p className="small muted">Claude only sees what the signed-in person can see: someone without phone access gets masked numbers, and clinical notes stay locked for non-clinical roles. Every question Claude answers is recorded in the audit log.</p>
          </div>
        </Card>

        <Card title="Connected Claude clients" subtitle="People who have connected Claude to Lead Manager.">
          {state.settings.mcpClients.length === 0 ? (
            <EmptyState icon="sparkles" title="No one has connected Claude yet" body="When someone adds the MCP server in Claude and signs in, they appear here with what Claude may read or change." />
          ) : (
            <ul className="st-list">
              {state.settings.mcpClients.map(c => (
                <li key={c.id} className="st-list-row">
                  <UserAvatar userId={c.userId} size={32} />
                  <div className="stack grow" style={{ gap: 3 }}>
                    <span className="strong">{userName(state, c.userId)} <span className="muted small">· {c.name}</span></span>
                    <span className="tiny muted">Connected {shortDate(c.connectedAt)} · last used {ago(c.lastUsedAt)}</span>
                    <span className="row wrap" style={{ gap: 4 }}>{c.scopes.map(s => <Chip key={s} tone={s.startsWith('write') ? 'warn' : 'neutral'}>{s}</Chip>)}</span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setRevokeClient(c.id)}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="API tokens" subtitle="For your website form, booking tools or a data warehouse. Each token is shown once, when you create it."
        actions={<Button size="sm" variant="secondary" icon="key" onClick={() => setTokenOpen(true)}>Create API token</Button>}>
        {ext.apiTokens.length === 0 ? (
          <EmptyState icon="key" title="No API tokens" body="Create one when another system needs to send leads in or read numbers out. Tokens expire automatically." />
        ) : (
          <ul className="st-list">
            {ext.apiTokens.map(t => {
              const expired = ms(t.expiresAt) < Date.now()
              const soon = !expired && ms(t.expiresAt) - Date.now() < 14 * DAY
              return (
                <li key={t.id} className="st-list-row">
                  <span className="st-list-icon"><Icon name="key" size={16} /></span>
                  <div className="stack grow" style={{ gap: 3 }}>
                    <span className="strong">{t.name}</span>
                    <span className="tiny muted"><code className="mono">{t.prefix}••••{t.last4}</code> · created by {userName(state, t.createdBy)} {ago(t.createdAt)} · {t.lastUsedAt ? `last used ${ago(t.lastUsedAt)}` : 'never used'}</span>
                    <span className="row wrap" style={{ gap: 4 }}>
                      {t.scopes.map(s => <Chip key={s} tone={s.startsWith('write') ? 'warn' : 'neutral'}>{s}</Chip>)}
                      <Chip tone={expired ? 'danger' : soon ? 'warn' : 'ok'} icon="clock">{expired ? `Expired ${ago(t.expiresAt)}` : `Expires ${until(t.expiresAt)}`}</Chip>
                    </span>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setRevokeToken(t.id)}>Revoke</Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Webhooks" subtitle="Lead Manager posts a signed JSON event to these addresses as things happen."
        actions={<Button size="sm" variant="secondary" icon="plus" onClick={() => setHookOpen(true)}>Add webhook</Button>}>
        {ext.webhooks.length === 0 ? (
          <EmptyState icon="link" title="No webhooks" body="Add one to send new leads, bookings or payments to another system the moment they happen." />
        ) : (
          <ul className="st-list">
            {ext.webhooks.map(h => (
              <li key={h.id} className={`st-list-row ${h.enabled ? '' : 'st-row-off'}`}>
                <span className="st-list-icon"><Icon name="link" size={16} /></span>
                <div className="stack grow" style={{ gap: 3 }}>
                  <span className="strong mono st-break">{h.url}</span>
                  <span className="row wrap" style={{ gap: 4 }}>{h.events.map(e => <Chip key={e} tone="team">{e}</Chip>)}</span>
                  <span className="tiny muted">
                    Signing secret ••••{h.secretLast4} · {h.lastDeliveryAt ? <>last delivery {ago(h.lastDeliveryAt)} <b className={h.lastStatus === 'ok' ? 'st-ok' : 'st-bad'}>{h.lastStatus === 'ok' ? '200 OK' : 'failed'}</b></> : 'no deliveries yet'}
                  </span>
                </div>
                <div className="st-list-actions">
                  <Toggle checked={h.enabled} label={`Send events to ${h.url}`} hideLabel onChange={v => {
                    actions.update(d => {
                      editExt(d, e => { const x = e.webhooks.find(y => y.id === h.id); if (x) x.enabled = v })
                      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: v ? 'webhook.enabled' : 'webhook.paused', target: { type: 'settings', id: h.id, label: 'Webhook' }, detail: h.url })
                    })
                    actions.toast(v ? 'Webhook resumed' : 'Webhook paused. Events are not queued while paused.', v ? 'success' : 'info')
                  }} />
                  <Button size="sm" variant="ghost" icon="send" disabled={!h.enabled} onClick={() => testHook(h.id)}>Test</Button>
                  <Button size="sm" variant="ghost" icon="trash" onClick={() => setRemoveHook(h.id)} aria-label={`Remove webhook ${h.url}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ReasonDialog open={!!client} title={`Revoke Claude for ${client ? userName(state, client.userId) : ''}?`} tone="danger" confirmLabel="Revoke access"
        body="Claude stops being able to read or change anything straight away. They can reconnect later by signing in again."
        placeholder="e.g. Left the clinic" onClose={() => setRevokeClient(null)}
        onConfirm={reason => {
          if (!client) return
          actions.update(d => {
            d.settings.mcpClients = d.settings.mcpClients.filter(c => c.id !== client.id)
            d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'mcp.revoked', target: { type: 'settings', id: client.id, label: `${client.name} · ${userName(d, client.userId)}` }, detail: `Revoked scopes ${client.scopes.join(', ')}`, reason })
          })
          actions.toast(`Claude access revoked for ${userName(state, client.userId)}`, 'success')
        }} />
      <ReasonDialog open={!!token} title={`Revoke “${token?.name ?? ''}”?`} tone="danger" confirmLabel="Revoke token"
        body="Anything using this token stops working immediately. This can’t be undone; create a new token if you need one."
        placeholder="e.g. Replaced by a new website form" onClose={() => setRevokeToken(null)}
        onConfirm={reason => {
          if (!token) return
          actions.update(d => {
            editExt(d, e => { e.apiTokens = e.apiTokens.filter(t => t.id !== token.id) })
            d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'api.token_revoked', target: { type: 'settings', id: token.id, label: token.name }, detail: `${token.prefix}••••${token.last4}`, reason })
          })
          actions.toast(`Token “${token.name}” revoked`, 'success')
        }} />
      <ReasonDialog open={!!hook} title="Remove this webhook?" tone="danger" confirmLabel="Remove webhook"
        body={<>Events stop going to <span className="mono">{hook?.url}</span>. Anything that relies on them will stop updating.</>}
        placeholder="e.g. Moved to the new CRM" onClose={() => setRemoveHook(null)}
        onConfirm={reason => {
          if (!hook) return
          actions.update(d => {
            editExt(d, e => { e.webhooks = e.webhooks.filter(x => x.id !== hook.id) })
            d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'webhook.removed', target: { type: 'settings', id: hook.id, label: 'Webhook' }, detail: hook.url, reason })
          })
          actions.toast('Webhook removed', 'success')
        }} />
      <CreateTokenModal open={tokenOpen} onClose={() => setTokenOpen(false)} />
      <AddWebhookModal open={hookOpen} onClose={() => setHookOpen(false)} />
    </div>
  )
}

function CreateTokenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useStore()
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['read:leads'])
  const [days, setDays] = useState(90)
  const [created, setCreated] = useState<string | null>(null)
  const settled = useSettledClick()
  useEffect(() => { if (open) { setName(''); setScopes(['read:leads']); setDays(90); setCreated(null) } }, [open])
  const ok = name.trim().length >= 3 && scopes.length > 0

  const create = () => {
    if (!ok) return
    const secret = 'lm_live_' + randomChars(32)
    const id = uid('tk_api')
    actions.update(d => {
      editExt(d, e => {
        e.apiTokens.unshift({ id, name: name.trim(), prefix: 'lm_live_', last4: secret.slice(-4), scopes, createdAt: iso(Date.now()), createdBy: d.currentUserId, expiresAt: iso(Date.now() + days * DAY) })
      })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'api.token_created', target: { type: 'settings', id, label: name.trim() }, detail: `Scopes ${scopes.join(', ')} · expires in ${days} days` })
    })
    settled.shown()
    setCreated(secret)
  }

  return (
    <Modal open={open} onClose={created ? settled.guard(onClose) : onClose} title={created ? 'Copy your new token' : 'Create an API token'} width={560}
      description={created ? 'This is the only time the full token is shown. Store it in your password manager or the other system’s settings.' : 'Give it the least access it needs. You can revoke it at any time.'}
      footer={created ? <Button variant="primary" onClick={settled.guard(onClose)}>I’ve stored it safely</Button> : <>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="key" disabled={!ok} onClick={create}>Create token</Button>
      </>}>
      {created ? (
        <div className="stack lg">
          <CopyField value={created} label="API token" />
          <p className="small st-warn-text"><Icon name="alert" size={14} /> After you close this window, only the last four characters ({created.slice(-4)}) are kept.</p>
        </div>
      ) : (
        <div className="stack lg">
          <Field label="What is it for?">
            {id => <input id={id} className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website consultation form" />}
          </Field>
          <fieldset className="st-fieldset">
            <legend className="field-label">What it may do</legend>
            {TOKEN_SCOPES.map(s => (
              <label key={s.id} className="checkbox">
                <input type="checkbox" checked={scopes.includes(s.id)} onChange={e => setScopes(x => e.target.checked ? [...x, s.id] : x.filter(y => y !== s.id))} />
                <span><code className="mono small">{s.id}</code> <span className="muted small">{s.label}</span></span>
              </label>
            ))}
          </fieldset>
          <Field label="Expires after">
            {id => (
              <select id={id} className="input" value={days} onChange={e => setDays(Number(e.target.value))}>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
            )}
          </Field>
        </div>
      )}
    </Modal>
  )
}

function AddWebhookModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useStore()
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEvent[]>(['lead.created'])
  const [tried, setTried] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const settled = useSettledClick()
  useEffect(() => { if (open) { setUrl(''); setEvents(['lead.created']); setTried(false); setSecret(null) } }, [open])
  let urlError: string | undefined
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') urlError = 'Use an https:// address so events are encrypted in transit.'
  } catch {
    urlError = 'Enter the full address, starting with https://'
  }
  const ok = !urlError && events.length > 0

  const add = () => {
    setTried(true)
    if (!ok) return
    const s = 'whsec_' + randomChars(24)
    const id = uid('wh')
    actions.update(d => {
      editExt(d, e => { e.webhooks.push({ id, url: url.trim(), events, secretLast4: s.slice(-4), enabled: true, createdAt: iso(Date.now()), createdBy: d.currentUserId }) })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'webhook.added', target: { type: 'settings', id, label: 'Webhook' }, detail: `${url.trim()} · ${events.join(', ')}` })
    })
    settled.shown()
    setSecret(s)
    actions.toast('Webhook added. Send a test to check it receives events.', 'success')
  }

  return (
    <Modal open={open} onClose={secret ? settled.guard(onClose) : onClose} title={secret ? 'Copy the signing secret' : 'Add a webhook'} width={560}
      description={secret ? 'Use it to check that events really come from Lead Manager (HMAC-SHA256 in the Lead-Signature header). It is shown once.' : 'We send a POST with a JSON body for each event you pick.'}
      footer={secret ? <Button variant="primary" onClick={settled.guard(onClose)}>Done</Button> : <><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={add}>Add webhook</Button></>}>
      {secret ? <CopyField value={secret} label="Signing secret" /> : (
        <div className="stack lg">
          <Field label="Endpoint URL" error={tried ? urlError : undefined}>
            {id => <input id={id} className="input mono" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com/webhooks/lead-manager" />}
          </Field>
          <fieldset className="st-fieldset">
            <legend className="field-label">Events to send</legend>
            {WEBHOOK_EVENTS.map(ev => (
              <label key={ev.id} className="checkbox">
                <input type="checkbox" checked={events.includes(ev.id)} onChange={e => setEvents(x => e.target.checked ? [...x, ev.id] : x.filter(y => y !== ev.id))} />
                <span><code className="mono small">{ev.label}</code> <span className="muted small">{ev.hint}</span></span>
              </label>
            ))}
            {tried && events.length === 0 && <span className="field-error">Pick at least one event.</span>}
          </fieldset>
        </div>
      )}
    </Modal>
  )
}
