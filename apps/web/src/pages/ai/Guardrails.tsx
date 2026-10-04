import { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import { Button, Card, Field, Locked, ReasonDialog } from '../../components/ui'
import { Icon } from '../../components/icons'
import { WEEK_ORDER, dayShort, hoursLabel } from './compute'

const HARD_RULES = [
  'Never gives medical advice or judges whether someone is suitable.',
  'Never promises results or names prescription-only medicines.',
  'Never books anyone under 18; possible minors go to a manager.',
  'Never pretends to be a named member of staff.',
  'Never asks for card details in a DM.',
  'Stops messaging straight away when someone opts out.',
  'Hands clinical questions, complaints and low-confidence chats to a person.',
]

const mentionsAi = (t: string) => /\b(ai|a\.i\.|artificial intelligence|bot|assistant automático|ia)\b/i.test(t)

export function Guardrails() {
  const { state, can } = useStore()
  const editable = can('settings.manage') || can('ai.mode')
  const ai = state.ai
  return (
    <div className="stack lg">
      {!editable && <Locked>You can read the guardrails. Changing them needs the “Change settings and channels” or “Change AI mode per channel” permission.</Locked>}
      <div className="ai-guard-grid">
        <Wording editable={editable} />
        <BannedPhrases editable={editable} />
        <Handoff editable={editable} key={`${ai.confidenceThreshold}-${ai.businessHours.start}-${ai.businessHours.end}-${ai.businessHours.days.join('')}`} />
        <Card title="Hard rules" subtitle="Built into the reply engine. No playbook or setting can turn these off.">
          <ul className="ai-rules">
            {HARD_RULES.map(r => <li key={r}><Icon name="shield" size={15} /><span>{r}</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}

function Wording({ editable }: { editable: boolean }) {
  const { state, actions } = useStore()
  const ai = state.ai
  const [disclosure, setDisclosure] = useState(ai.disclosure)
  const [escalation, setEscalation] = useState(ai.escalationText)
  const [tried, setTried] = useState(false)
  useEffect(() => { setDisclosure(ai.disclosure); setEscalation(ai.escalationText) }, [ai.disclosure, ai.escalationText])
  const dirty = disclosure.trim() !== ai.disclosure || escalation.trim() !== ai.escalationText
  const discErr = !disclosure.trim() ? 'The disclosure can’t be empty.' : !mentionsAi(disclosure) ? 'Say clearly that the assistant is an AI.' : undefined
  const escErr = !escalation.trim() ? 'Tell people how to reach a person.' : undefined

  const save = () => {
    setTried(true)
    if (discErr || escErr) return
    const d1 = disclosure.trim(), e1 = escalation.trim()
    const changes: string[] = []
    if (d1 !== ai.disclosure) {
      changes.push('disclosure')
      actions.audit({ action: 'ai.disclosure', target: { type: 'settings', id: 'ai', label: 'AI disclosure' }, detail: `“${ai.disclosure}” → “${d1}”` })
    }
    if (e1 !== ai.escalationText) {
      changes.push('escalation text')
      actions.audit({ action: 'ai.escalation_text', target: { type: 'settings', id: 'ai', label: 'Escalation text' }, detail: `“${ai.escalationText}” → “${e1}”` })
    }
    actions.update(d => { d.ai.disclosure = d1; d.ai.escalationText = e1 })
    actions.toast(`Saved the ${changes.join(' and ')}. New AI replies use it straight away.`, 'success')
    setTried(false)
  }

  return (
    <Card title="What the AI says about itself" subtitle="Shown to clients in the chat, in their language.">
      <div className="stack lg">
        <Field label="AI disclosure" hint="Starts every conversation the AI joins. Required by Instagram, TikTok and UK advertising rules." error={tried || disclosure !== ai.disclosure ? discErr : undefined}>
          {id => <textarea id={id} className="input" rows={3} value={disclosure} readOnly={!editable} onChange={e => setDisclosure(e.target.value)} />}
        </Field>
        <Field label="How to reach a person" hint="Added when someone seems stuck or asks for a human." error={tried ? escErr : undefined}>
          {id => <textarea id={id} className="input" rows={2} value={escalation} readOnly={!editable} onChange={e => setEscalation(e.target.value)} />}
        </Field>
        {editable && (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => { setDisclosure(ai.disclosure); setEscalation(ai.escalationText); setTried(false) }}>Discard changes</Button>
            <Button size="sm" variant="primary" icon="check" disabled={!dirty} onClick={save}>Save wording</Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function BannedPhrases({ editable }: { editable: boolean }) {
  const { state, actions } = useStore()
  const list = state.ai.bannedPhrases
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | undefined>()
  const [removing, setRemoving] = useState<string | null>(null)

  const add = () => {
    const p = text.trim().replace(/^["“]|["”]$/g, '')
    if (!p) { setErr('Type a word or phrase first.'); return }
    if (list.some(x => x.toLowerCase() === p.toLowerCase())) { setErr(`“${p}” is already banned.`); return }
    actions.update(d => { d.ai.bannedPhrases.push(p) })
    actions.audit({ action: 'ai.banned_phrase_added', target: { type: 'settings', id: 'ai', label: 'Banned phrases' }, detail: `Added “${p}”` })
    actions.toast(`“${p}” added. The AI won’t use it, and nightly QA will flag it.`, 'success')
    setText('')
    setErr(undefined)
  }

  return (
    <Card title="Banned phrases" subtitle="The AI never uses these, and nightly QA flags any reply that does.">
      <div className="stack lg">
        {list.length ? (
          <ul className="ai-phrases" aria-label="Banned phrases">
            {list.map(p => (
              <li key={p} className="ai-phrase">
                <span>{p}</span>
                {editable && (
                  <button type="button" className="ai-phrase-x" aria-label={`Remove “${p}” from banned phrases`} onClick={() => setRemoving(p)}>
                    <Icon name="x" size={13} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="small muted">No banned phrases. Add words the AI must never use, such as “guaranteed”.</p>}
        {editable && (
          <form className="ai-phrase-add" onSubmit={e => { e.preventDefault(); add() }}>
            <Field label="Add a phrase" error={err} hint="Matching ignores capitals.">
              {id => <input id={id} className="input" value={text} placeholder="e.g. instant results" onChange={e => { setText(e.target.value); setErr(undefined) }} />}
            </Field>
            <Button type="submit" variant="secondary" icon="plus">Add</Button>
          </form>
        )}
      </div>
      <ReasonDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        tone="danger"
        title={`Allow “${removing ?? ''}” again?`}
        confirmLabel="Remove from banned list"
        placeholder="e.g. Clinician confirmed the phrase is accurate for this treatment."
        body={<>The AI may start using “{removing}” in replies, and nightly QA stops flagging it.</>}
        onConfirm={reason => {
          if (!removing) return
          const p = removing
          actions.update(d => { d.ai.bannedPhrases = d.ai.bannedPhrases.filter(x => x !== p) })
          actions.audit({ action: 'ai.banned_phrase_removed', target: { type: 'settings', id: 'ai', label: 'Banned phrases' }, detail: `Removed “${p}”`, reason })
          actions.toast(`“${p}” is no longer banned.`, 'warn')
        }}
      />
    </Card>
  )
}

function Handoff({ editable }: { editable: boolean }) {
  const { state, actions } = useStore()
  const ai = state.ai
  const [threshold, setThreshold] = useState(Math.round(ai.confidenceThreshold * 100))
  const [start, setStart] = useState(ai.businessHours.start)
  const [end, setEnd] = useState(ai.businessHours.end)
  const [days, setDays] = useState<number[]>(ai.businessHours.days)
  const [confirmLower, setConfirmLower] = useState(false)
  const orig = Math.round(ai.confidenceThreshold * 100)
  const dirty = threshold !== orig || start !== ai.businessHours.start || end !== ai.businessHours.end || [...days].sort().join() !== [...ai.businessHours.days].sort().join()
  const hoursErr = start >= end ? 'Closing time must be after opening time.' : !days.length ? 'Pick at least one day.' : undefined

  const commit = (reason?: string) => {
    const next = { start, end, days: WEEK_ORDER.filter(d => days.includes(d)) }
    const parts: string[] = []
    if (threshold !== orig) parts.push(`confidence threshold ${orig}% → ${threshold}%`)
    const before = hoursLabel(ai.businessHours), after = hoursLabel(next)
    if (before !== after) parts.push(`business hours ${before} → ${after}`)
    actions.update(d => { d.ai.confidenceThreshold = threshold / 100; d.ai.businessHours = next })
    actions.audit({ action: 'ai.settings', target: { type: 'settings', id: 'ai', label: 'Handoff and hours' }, detail: parts.join('; ') || 'No change', reason })
    actions.toast('Saved. The reply engine uses the new threshold and hours for the next DM.', 'success')
  }
  const save = () => {
    if (hoursErr) return
    if (threshold < orig) setConfirmLower(true)
    else commit()
  }

  return (
    <Card title="Handoff and hours" subtitle="When the AI stops and a person takes over.">
      <div className="stack lg">
        <div className="field">
          <label htmlFor="ai-threshold" className="field-label">Confidence threshold <b className="num ai-threshold-val">{threshold}%</b></label>
          <input id="ai-threshold" type="range" min={50} max={95} step={5} value={threshold} disabled={!editable} className="ai-range"
            aria-valuetext={`${threshold} percent`} onChange={e => setThreshold(Number(e.target.value))} />
          <div className="row between tiny faint"><span>50% · AI sends more on its own</span><span>95% · more chats go to staff</span></div>
          <span className="field-hint">When the AI is less than {threshold}% sure of a reply, it drafts it for a person instead of sending.</span>
        </div>
        <fieldset className="ai-hours" disabled={!editable}>
          <legend className="field-label">Business hours</legend>
          <div className="row wrap" style={{ gap: 12 }}>
            <Field label="Opens">{id => <input id={id} type="time" className="input ai-time" value={start} onChange={e => setStart(e.target.value)} />}</Field>
            <Field label="Closes">{id => <input id={id} type="time" className="input ai-time" value={end} onChange={e => setEnd(e.target.value)} />}</Field>
          </div>
          <div className="ai-days" role="group" aria-label="Open days">
            {WEEK_ORDER.map(d => (
              <button key={d} type="button" className={`ai-day ${days.includes(d) ? 'is-on' : ''}`} aria-pressed={days.includes(d)}
                onClick={() => setDays(xs => (xs.includes(d) ? xs.filter(x => x !== d) : [...xs, d]))}>{dayShort(d)}</button>
            ))}
          </div>
          {hoursErr ? <span className="field-error">{hoursErr}</span> : <span className="field-hint">Outside these hours the AI still replies, and call tasks are due when the clinic opens.</span>}
        </fieldset>
        {editable && (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
            <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => { setThreshold(orig); setStart(ai.businessHours.start); setEnd(ai.businessHours.end); setDays(ai.businessHours.days) }}>Discard changes</Button>
            <Button size="sm" variant="primary" icon="check" disabled={!dirty || !!hoursErr} onClick={save}>Save changes</Button>
          </div>
        )}
      </div>
      <ReasonDialog
        open={confirmLower}
        onClose={() => setConfirmLower(false)}
        tone="danger"
        title={`Lower the threshold to ${threshold}%?`}
        confirmLabel={`Lower to ${threshold}%`}
        placeholder="e.g. Co-pilot data shows 96% of 70–75% drafts were sent unedited."
        body={<>The AI will send replies it is only {threshold}% sure of without a person checking them (on autopilot channels).</>}
        onConfirm={r => commit(r)}
      />
    </Card>
  )
}
