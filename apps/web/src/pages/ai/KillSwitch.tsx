import { useState } from 'react'
import { useStore, userName } from '../../lib/store'
import { ago, dateTime } from '../../lib/time'
import { Button, Locked, ReasonDialog } from '../../components/ui'
import { Icon } from '../../components/icons'
import { AI_CHANNELS, MODE_LABEL } from './compute'
import { CHANNEL_LABEL } from '../../lib/types'
import type { AiMode } from '../../lib/types'

/** Groups channels by mode: "Instagram on autopilot · TikTok and WhatsApp on co-pilot". */
function modeLine(mode: Record<'instagram' | 'tiktok' | 'whatsapp', AiMode>): string {
  const groups = new Map<AiMode, string[]>()
  for (const ch of AI_CHANNELS) groups.set(mode[ch], [...(groups.get(mode[ch]) ?? []), CHANNEL_LABEL[ch]])
  return [...groups.entries()].map(([m, chs]) => `${chs.join(chs.length > 2 ? ', ' : ' and ')} on ${MODE_LABEL[m].toLowerCase()}`).join(' · ')
}

export function KillSwitch() {
  const { state, can, actions } = useStore()
  const [open, setOpen] = useState(false)
  const ai = state.ai
  const on = ai.killSwitch
  const allowed = can('ai.killswitch')
  const lastEntry = state.audit.find(a => a.action === 'ai.killswitch_on' || a.action === 'ai.killswitch_off')
  const waiting = state.conversations.filter(c => c.needsHumanReason === 'AI paused (kill switch)').length

  return (
    <section className={`card ai-kill ${on ? 'is-on' : ''}`} aria-labelledby="ai-kill-title">
      <span className="ai-kill-icon" aria-hidden="true"><Icon name={on ? 'pause' : 'zap'} size={20} /></span>
      <div className="ai-kill-text">
        <h2 id="ai-kill-title" className="ai-kill-title">{on ? 'All AI replies are paused' : 'AI is replying to DMs'}</h2>
        {on ? (
          <p className="small">
            Paused by <b>{userName(state, ai.killSwitchBy)}</b> {ai.killSwitchAt ? <span title={dateTime(ai.killSwitchAt)}>{ago(ai.killSwitchAt)}</span> : null}
            {lastEntry?.reason ? <> · “{lastEntry.reason}”</> : null}. Staff answer every DM until it is resumed{waiting ? `; ${waiting} ${waiting === 1 ? 'chat is' : 'chats are'} waiting in the inbox` : ''}.
          </p>
        ) : (
          <p className="small muted">
            {modeLine(ai.mode)}.{' '}
            {ai.killSwitchBy && ai.killSwitchAt ? <>Last resumed by {userName(state, ai.killSwitchBy)} {ago(ai.killSwitchAt)}.</> : 'Pausing stops every AI reply and draft on all channels at once.'}
          </p>
        )}
      </div>
      <div className="ai-kill-action">
        {allowed ? (
          on ? <Button variant="primary" icon="play" onClick={() => setOpen(true)}>Resume AI replies</Button>
            : <Button variant="danger" icon="pause" onClick={() => setOpen(true)}>Pause all AI replies</Button>
        ) : (
          <Locked>Only owners and managers can pause or resume AI replies</Locked>
        )}
      </div>
      <ReasonDialog
        open={open}
        onClose={() => setOpen(false)}
        tone={on ? 'primary' : 'danger'}
        title={on ? 'Resume AI replies?' : 'Pause all AI replies?'}
        confirmLabel={on ? 'Resume AI replies' : 'Pause all AI replies'}
        placeholder={on ? 'e.g. Wording issue fixed in playbook v1; QA checked 20 replies.' : 'e.g. AI quoted an old price in two chats this morning.'}
        body={on
          ? <>The AI goes back to the mode set for each channel ({modeLine(ai.mode)}). Owners, managers and coordinators are notified.</>
          : <>The AI stops replying and drafting on Instagram, TikTok and WhatsApp straight away. Every new DM goes to the inbox for a person to answer. Owners, managers and coordinators are notified.</>}
        onConfirm={reason => {
          actions.setKillSwitch(!on, reason)
          actions.toast(on ? 'AI replies resumed. Each channel is back on its own mode.' : 'All AI replies paused. New DMs go to the inbox for staff.', on ? 'success' : 'warn')
        }}
      />
    </section>
  )
}
