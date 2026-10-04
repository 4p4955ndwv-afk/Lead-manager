import { useState } from 'react'
import { useStore, userName } from '../../lib/store'
import { canOpen } from '../../lib/permissions'
import { ago, dateTime, useNow } from '../../lib/time'
import type { AiMode, AiSettings } from '../../lib/types'
import { CHANNEL_LABEL } from '../../lib/types'
import { Button, Card, ChannelBadge, Chip, EmptyState, IconButton, KeyValue, ReasonDialog, Segmented, Stat } from '../../components/ui'
import { Icon } from '../../components/icons'
import {
  AI_CHANNELS, FLAG_LABEL, FLAG_TONE, MODE_EXPLAIN, MODE_LABEL, MODE_TONE, activityToday, canSeeConversation, clientName, duration, gateFor, gateStats,
  hoursLabel, maskDigits, modelLabel, pct, recentAiMessages, type AiChannel,
} from './compute'

const MODE_OPTIONS: { id: AiMode; label: string }[] = [
  { id: 'shadow', label: 'Shadow' },
  { id: 'copilot', label: 'Co-pilot' },
  { id: 'autopilot', label: 'Autopilot' },
]
const RANK: Record<AiMode, number> = { shadow: 0, copilot: 1, autopilot: 2 }

export function Overview({ onTab }: { onTab: (t: 'playbook' | 'guardrails') => void }) {
  const { state } = useStore()
  const now = useNow(30_000)
  const act = activityToday(state, now)
  const paused = state.ai.killSwitch
  return (
    <div className="stack xl">
      <section aria-labelledby="ai-today-title" className="stack">
        <h2 id="ai-today-title" className="ai-section-title">Today's AI activity</h2>
        <div className="ai-stats">
          <Stat icon="send" label="AI replies sent" value={act.replies.toLocaleString()} tone={paused ? 'danger' : 'accent'} hint={paused ? 'Paused now: staff are replying' : 'Sent on their own or approved by staff'} />
          <Stat icon="check" label="Drafts approved / edited" value={<>{act.approved}<span className="ai-stat-sep"> / </span>{act.edited}</>} hint="Co-pilot drafts sent as written / changed first" />
          <Stat icon="hand" label="Handoffs to a person" value={act.handoffs} hint="Numbers shared and chats the AI passed on" />
          <Stat icon="clock" label="Median first reply" value={duration(act.medianFirstReplySec)} tone={act.medianFirstReplySec <= 60 ? 'ok' : 'warn'} hint="Target: under 1 minute" />
        </div>
      </section>

      <section aria-labelledby="ai-modes-title" className="stack">
        <div className="row between wrap">
          <h2 id="ai-modes-title" className="ai-section-title">Reply mode by channel</h2>
          <span className="small muted">Each step up needs its gate met over the last 14 days.</span>
        </div>
        <div className="ai-channels">
          {AI_CHANNELS.map(ch => <ChannelMode key={ch} ch={ch} now={now} />)}
        </div>
      </section>

      <div className="ai-two">
        <ModelCard onTab={onTab} />
        <RecentAi />
      </div>
    </div>
  )
}

function ChannelMode({ ch, now }: { ch: AiChannel; now: number }) {
  const { state, can, actions } = useStore()
  const [pending, setPending] = useState<AiMode | null>(null)
  const mode = state.ai.mode[ch]
  const g = gateStats(state, ch, now)
  const gate = gateFor(mode, g)
  const conn = state.settings.channels.find(c => c.channel === ch)
  const apiReady = conn?.status === 'connected'
  const allowed = can('ai.mode')
  const metCount = gate.checks.filter(c => c.met).length
  const allMet = metCount === gate.checks.length

  const choose = (m: AiMode) => {
    if (m === mode) return
    if (m === 'autopilot' && !apiReady) {
      actions.toast(`Autopilot needs the ${CHANNEL_LABEL[ch]} messaging API, which is ${conn?.status === 'pending' ? 'still under review' : 'not connected'}.`, 'warn')
      return
    }
    setPending(m)
  }

  const up = pending ? RANK[pending] > RANK[mode] : false
  const pendingGate = pending ? gateFor(mode, g) : null

  return (
    <Card className="ai-channel" padded>
      <div className="ai-channel-head">
        <ChannelBadge channel={ch} />
        <Chip tone={state.ai.killSwitch ? 'danger' : MODE_TONE[mode]}>{state.ai.killSwitch ? 'Paused' : MODE_LABEL[mode]}</Chip>
      </div>
      {allowed ? (
        <Segmented label={`${CHANNEL_LABEL[ch]} AI mode`} options={MODE_OPTIONS} value={mode} onChange={choose} />
      ) : (
        <span className="ai-locked-line"><Icon name="lock" size={13} />Changing modes needs the “Change AI mode” permission</span>
      )}
      <p className="small ai-channel-explain">{MODE_EXPLAIN[mode]}</p>
      {ch === 'tiktok' && !apiReady && (
        <p className="ai-note small"><Icon name="info" size={15} /><span>TikTok's messaging API is still under review, so co-pilot drafts are copied into TikTok by staff. Autopilot unlocks once the API is approved.</span></p>
      )}
      {ch === 'whatsapp' && (
        <p className="ai-note small"><Icon name="info" size={15} /><span>Used for reminders and replies to them. Free-form replies are only allowed within 24 hours of the client's last message.</span></p>
      )}

      <dl className="ai-metrics">
        <div><dt>Sent unedited</dt><dd className="num">{pct(g.uneditedRate)}</dd></div>
        <div><dt>Edit rate</dt><dd className="num">{pct(g.editRate)}</dd></div>
        <div><dt>Guardrail issues</dt><dd className={`num ${g.openIssues ? 'is-bad' : ''}`}>{g.openIssues}</dd></div>
        <div><dt>Handoff rate</dt><dd className="num">{pct(g.handoffRate)}</dd></div>
      </dl>
      <p className="tiny faint">{g.reviewed.toLocaleString()} drafts reviewed and {g.conversations} chats in the last 14 days{g.liveReviewed ? `, ${g.liveReviewed} from today's session` : ''}.</p>

      <div className="ai-gate">
        <div className="row between wrap">
          <span className="strong small">{gate.title}</span>
          <Chip tone={allMet ? 'ok' : mode === 'autopilot' ? 'warn' : 'neutral'} icon={allMet ? 'check' : undefined}>{mode === 'autopilot' ? (allMet ? 'Healthy' : 'Needs attention') : gate.summary}</Chip>
        </div>
        <ul className="ai-checks">
          {gate.checks.map(c => (
            <li key={c.label} className={c.met ? 'is-met' : 'is-unmet'}>
              <span className="ai-check-icon" aria-hidden="true"><Icon name={c.met ? 'check' : 'x'} size={13} strokeWidth={2.2} /></span>
              <span className="grow">{c.label}<span className="sr-only">{c.met ? ': met' : ': not met'}</span></span>
              <span className="num strong">{c.value}</span>
              <span className="tiny muted ai-check-target">{c.target}</span>
            </li>
          ))}
        </ul>
        {mode === 'autopilot' && !allMet && <p className="tiny muted">Resolve the open QA findings or move this channel back to co-pilot until they are fixed.</p>}
      </div>

      <ReasonDialog
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? `Switch ${CHANNEL_LABEL[ch]} to ${MODE_LABEL[pending].toLowerCase()}?` : ''}
        confirmLabel={pending ? `Switch to ${MODE_LABEL[pending].toLowerCase()}` : 'Switch'}
        tone={up && pendingGate && !pendingGate.checks.every(c => c.met) ? 'danger' : 'primary'}
        placeholder={up ? 'e.g. Gate met: 92% of drafts sent unedited over 14 days, no QA issues.' : 'e.g. Two replies this week needed correcting; reviewing every draft until fixed.'}
        body={pending ? (
          <div className="stack">
            <span>{CHANNEL_LABEL[ch]} moves from <b>{MODE_LABEL[mode]}</b> to <b>{MODE_LABEL[pending]}</b>. {MODE_EXPLAIN[pending]}</span>
            {up && pendingGate && (pendingGate.checks.every(c => c.met)
              ? <span className="ai-dialog-ok"><Icon name="check" size={14} /> {pendingGate.title} is met ({pendingGate.summary}).</span>
              : <span className="ai-dialog-warn"><Icon name="alert" size={14} /> {pendingGate.title} is not met yet ({pendingGate.summary}). You can still switch; your reason is saved with the change.</span>)}
            {RANK[pending] > RANK[mode] + 1 && <span className="ai-dialog-warn"><Icon name="alert" size={14} /> This skips co-pilot entirely.</span>}
          </div>
        ) : null}
        onConfirm={reason => {
          if (!pending) return
          actions.setAiMode(ch, pending, reason)
          actions.toast(`${CHANNEL_LABEL[ch]} is now on ${MODE_LABEL[pending].toLowerCase()}.`, 'success')
        }}
      />
    </Card>
  )
}

const EFFORT_OPTIONS: { id: AiSettings['effort']; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]
const EFFORT_HINT: Record<AiSettings['effort'], string> = {
  low: 'Fastest replies, usually under 10 seconds. Right for DMs.',
  medium: 'More careful wording; replies take a little longer.',
  high: 'Most thorough; slowest. Best for nightly QA, not live DMs.',
}

function ModelCard({ onTab }: { onTab: (t: 'playbook' | 'guardrails') => void }) {
  const { state, can, actions } = useStore()
  const ai = state.ai
  const editable = can('settings.manage') || can('ai.mode')
  const live = state.playbooks.find(p => p.status === 'live')
  const setEffort = (e: AiSettings['effort']) => {
    if (e === ai.effort) return
    const from = ai.effort
    actions.update(d => { d.ai.effort = e })
    actions.audit({ action: 'ai.effort', target: { type: 'settings', id: 'ai', label: 'AI effort' }, detail: `${from} → ${e}` })
    actions.toast(`Effort set to ${e}. New drafts use it straight away.`, 'success')
  }
  return (
    <Card title="Model" subtitle="What writes the replies, and when it hands over.">
      <KeyValue items={[
        ['Claude model', <span className="stack" style={{ gap: 0 }}><span className="strong">{modelLabel(ai.model)}</span><span className="tiny faint mono">{ai.model}</span></span>],
        ['Effort', editable
          ? <span className="stack" style={{ gap: 4 }}><Segmented label="Effort" options={EFFORT_OPTIONS} value={ai.effort} onChange={setEffort} /><span className="tiny muted">{EFFORT_HINT[ai.effort]}</span></span>
          : <span className="stack" style={{ gap: 0 }}><span className="strong">{ai.effort[0].toUpperCase() + ai.effort.slice(1)}</span><span className="tiny muted">{EFFORT_HINT[ai.effort]}</span></span>],
        ['Confidence threshold', <span className="stack" style={{ gap: 0 }}><span className="strong num">{Math.round(ai.confidenceThreshold * 100)}%</span><span className="tiny muted">Below this, the AI drafts instead of sending and a person reviews the chat.</span></span>],
        ['Business hours', <span className="stack" style={{ gap: 0 }}><span className="strong">{hoursLabel(ai.businessHours)}</span><span className="tiny muted">Outside these hours the AI still replies and books calls for the next morning.</span></span>],
        ['Playbook', live
          ? <button type="button" className="ai-link" onClick={() => onTab('playbook')}>{live.version} is live · eval {live.evalScore}%</button>
          : <span className="muted">No live playbook</span>],
      ]} />
      {editable && (
        <div className="ai-card-foot">
          <span className="tiny muted">Threshold, hours, disclosure and banned phrases live in Guardrails.</span>
          <Button size="sm" variant="secondary" icon="shield" onClick={() => onTab('guardrails')}>Edit guardrails</Button>
        </div>
      )}
    </Card>
  )
}

function RecentAi() {
  const { state, me, can, actions } = useStore()
  useNow(30_000)
  const canAll = can('chats.view_all')
  const canAssigned = can('chats.view_assigned')
  const rows = recentAiMessages(state, c => canSeeConversation(c, me, canAll, canAssigned), 6)
  const inbox = canOpen(me, 'inbox')
  const phones = can('clients.view_phone')
  return (
    <Card title="Recent AI messages" subtitle={canAll ? 'Newest first, across every channel.' : 'Only chats assigned to you.'} padded>
      {rows.length === 0 ? (
        <EmptyState icon="sparkles" title="No AI messages to show" body={canAll ? 'Replies and drafts the AI writes appear here as DMs arrive. Use Demo → Simulate a DM to see one.' : 'AI messages in chats assigned to you appear here.'} />
      ) : (
        <ul className="ai-recent">
          {rows.map(r => {
            const name = clientName(state, r.conv.clientId)
            const flags = r.replyTo?.flags ?? []
            return (
              <li key={r.msg.id} className="ai-recent-item">
                <div className="row between">
                  <span className="row wrap grow" style={{ gap: 6 }}>
                    <button type="button" className="ai-link strong" onClick={() => actions.go('client', r.conv.clientId)}>{name}</button>
                    <ChannelBadge channel={r.conv.channel} label={false} size="sm" />
                    {r.kind === 'shadow' ? <Chip>Shadow draft · not sent</Chip> : r.kind === 'approved' ? <Chip tone="team">Approved by {userName(state, r.msg.userId).split(' ')[0]}</Chip> : <Chip tone="accent">Sent automatically</Chip>}
                  </span>
                  <span className="tiny faint ai-nowrap" title={dateTime(r.msg.at)}>{ago(r.msg.at)}</span>
                  {inbox && <IconButton icon="arrowRight" size="sm" label={`Open chat with ${name}`} onClick={() => actions.go('inbox', r.conv.id)} />}
                </div>
                {r.replyTo && (
                  <p className="tiny muted ai-recent-reply">
                    {flags.map(f => <Chip key={f} tone={FLAG_TONE[f]}>{FLAG_LABEL[f]}</Chip>)}
                    <span className="truncate">Replying to “{maskDigits(r.replyTo.text, phones)}”</span>
                  </p>
                )}
                <p className="small ai-recent-text">{maskDigits(r.msg.text, phones)}</p>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
