// Detail-pane panels: AI brief, client snapshot, history, non-call helpers and the "How lead calls work" card.
import { useEffect, useState, type ReactNode } from 'react'
import type { Client, Conversation, Episode, Task } from '../../lib/types'
import { userName, useStore } from '../../lib/store'
import { canOpen, maskPhone } from '../../lib/permissions'
import { callBrief } from '../../lib/ai'
import { ago, dateTime, money, ms, replyWindow, shortDate } from '../../lib/time'
import { Button, Card, ChannelBadge, Chip, Field, KeyValue, Locked, StageBadge, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import {
  OUTCOME_META, TYPE_META, briefLines, copyText, firstName, isCallType, languageName, maskPhonesInText, paymentReminderText, reviewRequestText,
} from './helpers'

const openClaude = (prompt: string) => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt } }))

// ---- AI brief ------------------------------------------------------------------------------------

export function BriefCard({ task, client }: { task: Task; client: Client }) {
  const { state, actions } = useStore()
  const call = isCallType(task.type)
  const brief = task.brief ?? (call ? callBrief(state, client.id) : '')
  const { lines, goal } = briefLines(brief)
  const clinical = task.type === 'clinical_review'
  const lang = languageName(client.language)

  const refresh = () => {
    const b = callBrief(state, client.id)
    actions.update(d => {
      const t = d.tasks.find(x => x.id === task.id)
      if (t) t.brief = b
    })
    actions.toast('Brief rewritten from the latest messages.', 'success')
  }
  const prompt = clinical
    ? `Summarise ${client.name}'s clinical question and the chat so far, and list what a clinician should check before calling them back. Do not draft medical advice for the client.`
    : call
      ? `Prepare me for my call with ${client.name}: summarise what they want from the chat, suggest an opening line${client.language !== 'en' ? ` (they speak ${lang})` : ''}, and list the questions to ask so we book a consultation and agree the deposit.`
      : `What should I know about ${client.name} before I handle this task: "${task.title}"?`

  if (!brief) return null
  return (
    <section className="tk-brief" aria-label={clinical ? 'Clinical question' : 'AI call brief'}>
      <div className="tk-brief-head">
        <span className="tk-brief-mark" aria-hidden="true"><Icon name={clinical ? 'message' : 'sparkles'} size={16} /></span>
        <span className="stack" style={{ gap: 0 }}>
          <span className="tk-brief-title">{clinical ? 'Clinical question' : 'AI call brief'}</span>
          <span className="tiny muted">{clinical ? 'From the DM. The AI gave no advice and routed it to a clinician.' : 'Written by the AI from the chat. Read it before you dial.'}</span>
        </span>
      </div>
      {clinical ? (
        <blockquote className="tk-brief-quote" dir="auto">{brief}</blockquote>
      ) : (
        <ul className="tk-brief-list">
          {lines.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      {goal && (
        <p className="tk-brief-goal"><Icon name="flag" size={15} /><span><strong>Goal:</strong> {goal}</span></p>
      )}
      <div className="tk-brief-actions">
        <Button size="sm" variant="ghost" icon="sparkles" onClick={() => openClaude(prompt)}>Ask Claude to prep me</Button>
        {call && <Button size="sm" variant="ghost" icon="refresh" onClick={refresh}>Rewrite from latest chat</Button>}
      </div>
    </section>
  )
}

// ---- client snapshot -----------------------------------------------------------------------------

export function ClientSnapshot({ task, client, episode, conversation, phoneShown, onReveal }: {
  task: Task; client: Client; episode?: Episode; conversation?: Conversation; phoneShown: boolean; onReveal: (why: 'call' | 'view') => void
}) {
  const { state, me, can, actions } = useStore()
  const canPhone = can('clients.view_phone')
  const interests = (episode?.interests ?? []).map(id => state.procedures.find(p => p.id === id)?.name).filter((x): x is string => !!x)
  const canChats = can('chats.view_all') || (can('chats.view_assigned') && (task.assignedTo === me.id || conversation?.assignedTo === me.id || client.ownerId === me.id))
  const msgs = conversation ? conversation.messages.filter(m => m.author === 'client').slice(-3) : []
  const handle = client.handles.instagram ?? client.handles.tiktok
  const first = firstName(client.name)

  const phoneCell: ReactNode = !client.phone ? <span className="muted">Not shared yet</span>
    : !canPhone ? <Locked>Hidden for your role</Locked>
      : (
        <span className="row wrap" style={{ gap: 6 }}>
          <span className="mono num">{maskPhone(client.phone, phoneShown)}</span>
          {!phoneShown && <Button size="sm" variant="ghost" icon="eye" onClick={() => onReveal('view')} aria-label={`Show ${first}'s full number (logged)`}>Show</Button>}
        </span>
      )

  return (
    <Card title="Client" subtitle={handle ? `${handle} · since ${shortDate(client.createdAt)}` : `Since ${shortDate(client.createdAt)}`}
      actions={<Button size="sm" variant="ghost" iconRight="arrowRight" onClick={() => actions.go('client', client.id)}>Open record</Button>}>
      <div className="stack lg">
        <KeyValue items={[
          ['Phone', phoneCell],
          ['Language', client.language === 'en' ? 'English' : <Chip tone="info" icon="globe">{languageName(client.language)}</Chip>],
          ['Interested in', interests.length ? <span className="row wrap" style={{ gap: 4 }}>{interests.map(n => <Chip key={n} tone="accent">{n}</Chip>)}</span> : <span className="muted">Not known yet</span>],
          ['Source', <span className="stack" style={{ gap: 2 }}><ChannelBadge channel={client.source.channel} size="sm" /><span className="small muted">{client.source.detail}</span></span>],
          ['Stage', episode ? <span className="row wrap" style={{ gap: 4 }}><StageBadge stage={episode.stage} exit={episode.exit} />{episode.number > 1 && <Chip tone="team">Returning · visit {episode.number}</Chip>}</span> : '—'],
          ['Consent', <span className="row wrap" style={{ gap: 4 }}>
            <Chip tone={client.consent.whatsapp ? 'ok' : 'neutral'} icon={client.consent.whatsapp ? 'check' : 'x'}>WhatsApp</Chip>
            <Chip tone={client.consent.sms ? 'ok' : 'neutral'} icon={client.consent.sms ? 'check' : 'x'}>SMS</Chip>
          </span>],
          ['Owner', client.ownerId ? <span className="row" style={{ gap: 6 }}><UserAvatar userId={client.ownerId} size={20} />{userName(state, client.ownerId)}</span> : <span className="muted">Unassigned</span>],
        ]} />

        <div className="stack">
          <div className="row between wrap">
            <h3 className="tk-h3">Latest from {first}</h3>
            {conversation && canChats && canOpen(me, 'inbox') && (
              <Button size="sm" variant="ghost" icon="message" onClick={() => actions.go('inbox', conversation.id)}>Open chat</Button>
            )}
          </div>
          {!conversation ? (
            <p className="small muted">No DM thread for {first}. Messages appear here once they write to us on Instagram, TikTok or WhatsApp.</p>
          ) : !canChats ? (
            <Locked>Chats are hidden for your role</Locked>
          ) : msgs.length === 0 ? (
            <p className="small muted">{first} hasn't written anything yet.</p>
          ) : (
            <ol className="tk-msgs">
              {msgs.map(m => (
                <li key={m.id} className="tk-msg">
                  <p dir="auto">{maskPhonesInText(m.text, canPhone && phoneShown)}</p>
                  <span className="tiny faint">{ago(m.at)} · <ChannelBadge channel={conversation.channel} label={false} size="sm" /></span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </Card>
  )
}

// ---- history -------------------------------------------------------------------------------------

export function History({ task }: { task: Task }) {
  const { state } = useStore()
  type Item = { at: string; key: string; icon: Parameters<typeof Icon>[0]['name']; tone: string; title: ReactNode; by?: string; note?: string }
  const items: Item[] = [
    ...task.attempts.map((a, i) => ({
      at: a.at, key: 'a' + i, icon: OUTCOME_META[a.outcome].icon, tone: OUTCOME_META[a.outcome].tone,
      title: <>Try {i + 1}: <Chip tone={OUTCOME_META[a.outcome].tone}>{OUTCOME_META[a.outcome].label}</Chip></>, by: a.by, note: a.note,
    })),
    ...state.audit.filter(e => e.target.type === 'task' && e.target.id === task.id && (e.action === 'sla.escalated' || e.action === 'task.reassigned' || e.action === 'task.done')).map(e => ({
      at: e.at, key: e.id, icon: (e.action === 'sla.escalated' ? 'alert' : e.action === 'task.done' ? 'check' : 'users') as Item['icon'],
      tone: e.action === 'sla.escalated' ? 'danger' : e.action === 'task.done' ? 'ok' : 'neutral',
      title: e.action === 'sla.escalated' ? e.detail : e.action === 'task.done' ? 'Marked done' : `Reassigned: ${e.detail}`,
      by: e.actor === 'system' || e.actor === 'ai' || e.actor === 'claude' ? undefined : e.actor, note: e.action === 'task.done' && e.detail !== 'Marked done' ? e.detail : undefined,
    })),
    { at: task.createdAt, key: 'created', icon: 'plus', tone: 'neutral', title: task.slaMinutes || task.type === 'call' ? 'Lead handed over by the AI' : 'Task created' },
  ].sort((a, b) => ms(b.at) - ms(a.at))
  const tries = task.attempts.length
  return (
    <Card title="History" subtitle={tries ? `${tries} call attempt${tries === 1 ? '' : 's'}` : 'No call attempts yet'}>
      <ol className="tk-history">
        {items.map(it => (
          <li key={it.key} className="tk-hist">
            <span className={`tk-hist-ic tk-ic-${it.tone}`} aria-hidden="true"><Icon name={it.icon} size={13} /></span>
            <div className="tk-hist-body">
              <div className="tk-hist-title">{it.title}</div>
              <div className="tiny muted">{dateTime(it.at)} · {ago(it.at)}{it.by ? ` · ${userName(state, it.by)}` : ''}</div>
              {it.note && <p className="small tk-hist-note">{it.note}</p>}
            </div>
          </li>
        ))}
      </ol>
      {tries === 0 && <p className="tiny muted tk-hist-empty">Each call you log appears here with its outcome, so whoever calls next can see what happened.</p>}
    </Card>
  )
}

// ---- finishing non-call tasks -------------------------------------------------------------------

export function FinishTask({ task, client, conversation, canAct, blockedReason }: { task: Task; client: Client; conversation?: Conversation; canAct: boolean; blockedReason?: string }) {
  const { state, me, can, actions } = useStore()
  const [note, setNote] = useState('')
  const [clinicalNote, setClinicalNote] = useState(true)
  useEffect(() => { setNote(''); setClinicalNote(true) }, [task.id])
  const first = firstName(client.name)
  const org = state.settings.orgName
  const canClinicalNote = task.type === 'clinical_review' && can('clinical.edit')

  const copy = async (text: string, what: string) => {
    const ok = await copyText(text)
    actions.toast(ok ? `${what} copied. Paste it into WhatsApp or the DM.` : `Couldn't copy automatically. Select the text and copy it.`, ok ? 'success' : 'warn')
  }

  const done = () => {
    const text = note.trim()
    if (canClinicalNote && clinicalNote && text) actions.addNote(client.id, text, true)
    actions.completeTask(task.id, text || 'Marked done')
    actions.toast(`Done: ${task.title}.${canClinicalNote && clinicalNote && text ? ' Clinical note saved.' : ''}`, 'success', { label: 'Open record', page: 'client', id: client.id })
  }

  let helper: ReactNode = null
  if (task.type === 'clinical_review') {
    helper = (
      <div className="stack">
        <p className="small">Call or reply to {first} with a clinician's answer, then record what you advised.</p>
        <div className="row wrap">
          {conversation && canOpen(me, 'inbox') && <Button size="sm" variant="secondary" icon="message" onClick={() => actions.go('inbox', conversation.id)}>Open chat</Button>}
          <Button size="sm" variant="ghost" icon="user" onClick={() => actions.go('client', client.id)}>Open record</Button>
        </div>
      </div>
    )
  } else if (task.type === 'payment') {
    const pays = state.payments.filter(p => p.clientId === client.id && (p.status === 'due' || p.status === 'overdue')).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))
    const first_ = pays[0]
    helper = (
      <div className="stack">
        {!can('payments.view') ? <Locked>Payment amounts are hidden for your role</Locked> : pays.length === 0 ? (
          <p className="small muted">Nothing outstanding for {first} right now. It may have been paid; check the record, then mark this done.</p>
        ) : (
          <ul className="tk-pays">
            {pays.map(p => (
              <li key={p.id} className="tk-pay-row">
                <span className="grow">
                  <span className="strong small">{p.kind === 'deposit' ? 'Deposit' : p.kind === 'instalment' ? 'Instalment' : p.kind === 'balance' ? 'Balance' : 'Refund'}</span>
                  <span className="tiny muted"> · due {shortDate(p.dueAt)}</span>
                </span>
                <Chip tone={p.status === 'overdue' ? 'danger' : 'warn'}>{p.status === 'overdue' ? 'Overdue' : 'Due'}</Chip>
                <span className="num strong">{money(p.amount, state.settings.currency)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="row wrap">
          <Button size="sm" variant="secondary" icon="card" onClick={() => { actions.go('client', client.id); actions.toast(`${first}'s record is open. Payments are in the Payments tab.`, 'info') }}>Open payments</Button>
          {first_ && can('payments.view') && (
            <Button size="sm" variant="ghost" icon="copy" onClick={() => copy(paymentReminderText(client, money(first_.amount, state.settings.currency), shortDate(first_.dueAt), org), 'Payment reminder')}>Copy reminder</Button>
          )}
        </div>
      </div>
    )
  } else if (task.type === 'review') {
    const text = reviewRequestText(client, org)
    const win = conversation ? replyWindow(conversation) : undefined
    const canSend = !!conversation && can('chats.reply') && !!win?.open
    helper = (
      <div className="stack">
        <blockquote className="tk-template">{text}</blockquote>
        <div className="row wrap">
          <Button size="sm" variant="secondary" icon="copy" onClick={() => copy(text, 'Review request')}>Copy review request</Button>
          {canSend && conversation && (
            <Button size="sm" variant="ghost" icon="send" onClick={() => { actions.sendMessage(conversation.id, { author: 'human', text }); actions.toast(`Review request sent to ${first} in the chat.`, 'success', { label: 'Open chat', page: 'inbox', id: conversation.id }); setNote(n => n || 'Review request sent in the chat') }}>Send in chat</Button>
          )}
        </div>
      </div>
    )
  } else if (task.type === 'follow_up') {
    helper = <p className="small muted">Sorted without a call, for example they replied by DM or paid online? Mark it done with a short note.</p>
  }

  return (
    <Card title={task.type === 'follow_up' ? 'Close without a call' : `Finish this ${TYPE_META[task.type].label.toLowerCase()}`}>
      <div className="stack lg">
        {helper}
        <Field label={task.type === 'clinical_review' ? 'What did you advise?' : 'Outcome note (optional)'} hint={task.type === 'clinical_review' ? 'Required, so the next person to speak to them knows what was said.' : undefined}>
          {id => <textarea id={id} className="input" rows={2} value={note} disabled={!canAct}
            placeholder={task.type === 'clinical_review' ? 'e.g. Advised to wait until after pregnancy; offered a consultation in March' : task.type === 'payment' ? 'e.g. Paid by card link at 14:10' : 'e.g. Replied by DM and confirmed'}
            onChange={e => setNote(e.target.value)} />}
        </Field>
        {canClinicalNote && (
          <label className="checkbox tk-check">
            <input type="checkbox" checked={clinicalNote} disabled={!canAct} onChange={e => setClinicalNote(e.target.checked)} />
            <span>Also save it as a clinical note (visible to clinical staff only)</span>
          </label>
        )}
        <div className="row between wrap">
          {!canAct && blockedReason ? <span className="tiny muted">{blockedReason}</span> : <span />}
          <Button variant="primary" icon="check" disabled={!canAct || (task.type === 'clinical_review' && !note.trim())} onClick={done}>Mark done</Button>
        </div>
      </div>
    </Card>
  )
}

// ---- explainer -----------------------------------------------------------------------------------

export function HowItWorks() {
  const { state } = useStore()
  const rule = state.settings.slaRules.find(r => r.id === 'sla_1')
  const [m1, m2] = rule?.escalateAfterMin ?? [15, 60]
  return (
    <Card className="tk-how" title="How lead calls work" subtitle="The same rules run for everyone, day and night.">
      <ol className="tk-how-line" aria-label="Call deadline and escalation">
        <li><span className="tk-how-t num">0 min</span><span className="tk-how-d">A number arrives in a DM. The coordinator on shift gets a call task with a {m1}-minute countdown.</span></li>
        <li className="is-warn"><span className="tk-how-t num">{m1} min</span><span className="tk-how-d">Not called yet: the manager is alerted.</span></li>
        <li className="is-danger"><span className="tk-how-t num">{m2} min</span><span className="tk-how-d">Still not called: the owner is alerted.</span></li>
      </ol>
      <h3 className="tk-h3 tk-how-sub">If nobody answers</h3>
      <ol className="tk-how-retry">
        <li><span className="tk-how-n">1</span>Retry in 2 hours</li>
        <li><span className="tk-how-n">2</span>Retry tomorrow</li>
        <li><span className="tk-how-n">3</span>WhatsApp template, then Nurture</li>
      </ol>
    </Card>
  )
}
