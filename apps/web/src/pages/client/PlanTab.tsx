// Treatment plan tab: procedures with "Session n of m" progress, add a procedure mid-course, mark sessions done,
// schedule the next one, and move the plan through Propose / Accept / Decline.
import { useEffect, useState } from 'react'
import { userName, useStore } from '../../lib/store'
import type { Client, Episode, Payment, PlanItem, Session, TreatmentPlan } from '../../lib/types'
import { STAGE_LABEL } from '../../lib/types'
import { canOpen } from '../../lib/permissions'
import { DAY, dateTime, iso, money, ms, shortDate, uid } from '../../lib/time'
import { Button, Chip, EmptyState, Field, Modal, Progress, ReasonDialog } from '../../components/ui'
import { Icon } from '../../components/icons'
import { ScheduleModal } from './Schedule'
import { estimateDue, linkSessionBooking, markSessionDone, sessionAppt } from './planOps'
import { PLAN_STATUS_LABEL, PLAN_STATUS_TONE, planSubtotal, planTotal, procName, stageIndex } from './helpers'
import { first } from './dialogs'

export function PlanTab({ client, episode }: { client: Client; episode: Episode }) {
  const { state, can } = useStore()
  const plans = state.plans.filter(p => p.episodeId === episode.id).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
  const [addFor, setAddFor] = useState<string | null>(null)

  return (
    <div className="stack lg">
      {plans.length === 0 ? (
        <div className="card">
          <EmptyState icon="layers" title="No treatment plan yet"
            body={stageIndex(episode.stage) < stageIndex('consultation')
              ? `A clinician writes the plan after the consultation. ${first(client.name)} is at ${STAGE_LABEL[episode.stage]}.`
              : can('clinical.edit') ? 'Add the first procedure to start a draft plan, then propose it to the client.' : 'A clinician writes the plan after the consultation; it appears here once drafted.'}
            action={can('clinical.edit') ? <Button size="sm" variant="primary" icon="plus" onClick={() => setAddFor('new')}>Start a treatment plan</Button> : undefined} />
        </div>
      ) : plans.map(p => <PlanCard key={p.id} plan={p} client={client} episode={episode} onAdd={() => setAddFor(p.id)} />)}
      <AddProcedureModal open={!!addFor} planId={addFor} onClose={() => setAddFor(null)} client={client} episode={episode} />
    </div>
  )
}

function PlanCard({ plan, client, episode, onAdd }: { plan: TreatmentPlan; client: Client; episode: Episode; onAdd: () => void }) {
  const { state, can, actions } = useStore()
  const [declineOpen, setDeclineOpen] = useState(false)
  const [schedule, setSchedule] = useState<{ item: PlanItem; session: Session } | null>(null)
  const [skip, setSkip] = useState<{ item: PlanItem; session: Session } | null>(null)
  const cur = state.settings.currency
  const showPrices = can('payments.view') || can('clinical.edit') || can('analytics.revenue')
  const total = planTotal(plan)
  const all = plan.items.flatMap(i => i.sessions)
  const doneN = all.filter(s => s.status === 'done').length
  const skippedN = all.filter(s => s.status === 'skipped').length
  const canDecide = can('pipeline.move') || can('clinical.edit')
  const names = plan.items.map(i => procName(state, i.procedureId)).join(' + ')
  const ppText = plan.paymentPlan.type === 'full' ? 'Pay in full' : `${plan.paymentPlan.instalments ?? 2} instalments`
  const audit = (action: string, detail: string, reason?: string) => ({ id: uid('au'), at: iso(Date.now()), actor: state.currentUserId, action, target: { type: 'plan' as const, id: plan.id, label: client.name }, detail, reason })
  const movable = !episode.exit

  const propose = () => {
    actions.update(d => {
      const p = d.plans.find(x => x.id === plan.id)!
      p.status = 'proposed'
      d.documents.unshift({ id: uid('dc'), clientId: client.id, kind: 'quote', title: `Quote Q-${1040 + d.documents.filter(x => x.kind === 'quote').length + 3}: ${names}`, at: iso(Date.now()), restricted: false })
      d.audit.unshift(audit('plan.proposed', `Proposed ${names} (${money(planTotal(p), cur)})`))
    })
    if (movable && stageIndex(episode.stage) < stageIndex('plan')) actions.moveStage(episode.id, 'plan', { reason: 'Treatment plan proposed' })
    actions.toast(`Plan proposed to ${first(client.name)}. A quote was added to Documents.`, 'success')
  }

  const accept = () => {
    const existing = state.payments.filter(p => p.episodeId === episode.id && p.status !== 'refunded').reduce((t, p) => t + p.amount, 0)
    const remaining = Math.max(0, total - existing)
    const n = plan.paymentPlan.type === 'instalments' ? Math.max(2, plan.paymentPlan.instalments ?? 2) : 1
    const each = Math.round(remaining / n)
    actions.update(d => {
      const p = d.plans.find(x => x.id === plan.id)!
      p.status = 'accepted'
      if (remaining > 0) {
        for (let i = 0; i < n; i++) {
          const pay: Payment = { id: uid('py'), clientId: client.id, episodeId: episode.id, kind: n === 1 ? 'balance' : 'instalment', amount: i === n - 1 ? remaining - each * (n - 1) : each, status: 'due', dueAt: iso(Date.now() + 2 * DAY + i * 30 * DAY) }
          d.payments.push(pay)
        }
      }
      const ep = d.episodes.find(e => e.id === episode.id)
      if (ep) ep.value = Math.max(ep.value, total)
      d.audit.unshift(audit('plan.accepted', `Accepted ${names} · ${money(total, cur)} · ${ppText}${remaining > 0 ? ` · ${n} payment${n > 1 ? 's' : ''} scheduled` : ''}`))
    })
    if (movable && stageIndex(episode.stage) < stageIndex('plan')) actions.moveStage(episode.id, 'plan', { reason: 'Treatment plan accepted' })
    actions.toast(remaining > 0
      ? `Plan accepted. ${n === 1 ? `${money(remaining, cur)} balance` : `${n} instalments of about ${money(each, cur)}`} scheduled; book session 1 next.`
      : 'Plan accepted. Book session 1 next.', 'success')
  }

  const decline = (reason: string) => {
    actions.update(d => {
      d.plans.find(x => x.id === plan.id)!.status = 'declined'
      d.audit.unshift(audit('plan.declined', `Client declined ${names}`, reason))
    })
    actions.toast('Plan marked as declined. If they are not coming back, move the journey to Nurture or Lost.', 'info')
  }

  const revise = () => {
    actions.update(d => {
      d.plans.find(x => x.id === plan.id)!.status = 'draft'
      d.audit.unshift(audit('plan.revised', 'Plan reopened as a draft'))
    })
    actions.toast('Plan reopened as a draft. Change it, then propose it again.', 'info')
  }

  const setPaymentPlan = (v: string) => {
    const pp: TreatmentPlan['paymentPlan'] = v === 'full' ? { type: 'full' } : { type: 'instalments', instalments: Number(v) }
    actions.update(d => {
      d.plans.find(x => x.id === plan.id)!.paymentPlan = pp
      d.audit.unshift(audit('plan.payment_plan', `Payment plan set to ${v === 'full' ? 'pay in full' : `${v} instalments`}`))
    })
    actions.toast(`Payment plan: ${v === 'full' ? 'pay in full' : `${v} instalments of ${money(Math.round(total / Number(v)), cur)}`}.`, 'success')
  }

  const signConsent = () => {
    actions.update(d => {
      d.plans.find(x => x.id === plan.id)!.consentSigned = true
      d.documents.unshift({ id: uid('dc'), clientId: client.id, kind: 'consent_form', title: `Consent: ${names}`, at: iso(Date.now()), restricted: false, signed: true })
      d.audit.unshift(audit('plan.consent_signed', `Consent recorded as signed for ${names}`))
    })
    actions.toast('Consent recorded as signed and filed in Documents.', 'success')
  }

  const doSkip = (reason: string) => {
    if (!skip) return
    const { item, session } = skip
    actions.update(d => {
      const se = d.plans.find(x => x.id === plan.id)?.items.find(i => i.id === item.id)?.sessions.find(s => s.no === session.no)
      if (se) { se.status = 'skipped'; se.note = reason }
      d.audit.unshift(audit('plan.session_skipped', `${procName(d, item.procedureId)}: session ${session.no} skipped`, reason))
    })
    actions.toast(`Session ${session.no} marked as skipped.`, 'info')
  }

  return (
    <section className="card cr-plan" aria-label="Treatment plan">
      <div className="cr-plan-head">
        <div className="stack" style={{ gap: 4 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <h2 className="card-title">Treatment plan</h2>
            <Chip tone={PLAN_STATUS_TONE[plan.status]}>{PLAN_STATUS_LABEL[plan.status]}</Chip>
          </div>
          <span className="tiny muted">Written by {userName(state, plan.createdBy)} · {shortDate(plan.createdAt)} · {plan.items.length} procedure{plan.items.length === 1 ? '' : 's'}</span>
        </div>
        <div className="row wrap">
          {plan.status === 'draft' && can('clinical.edit') && <Button size="sm" variant="primary" icon="send" disabled={!plan.items.length} onClick={propose}>Propose to {first(client.name)}</Button>}
          {plan.status === 'proposed' && canDecide && <>
            <Button size="sm" variant="primary" icon="check" onClick={accept}>{first(client.name)} accepted</Button>
            <Button size="sm" icon="x" onClick={() => setDeclineOpen(true)}>Declined</Button>
          </>}
          {plan.status === 'declined' && can('clinical.edit') && <Button size="sm" icon="edit" onClick={revise}>Revise plan</Button>}
        </div>
      </div>

      <div className="cr-plan-sum">
        <div className="cr-plan-fact">
          <span className="tiny muted">Total</span>
          {showPrices ? (
            <span className="strong num">{money(total, cur)}{plan.discount > 0 && <span className="tiny muted"> · {money(planSubtotal(plan), cur)} less {money(plan.discount, cur)}</span>}</span>
          ) : <span className="small faint"><Icon name="lock" size={12} /> Hidden for your role</span>}
        </div>
        <div className="cr-plan-fact">
          <span className="tiny muted">Payment plan</span>
          {can('payments.take') && (plan.status === 'draft' || plan.status === 'proposed') ? (
            <select className="input cr-inline-select" aria-label="Payment plan" value={plan.paymentPlan.type === 'full' ? 'full' : String(plan.paymentPlan.instalments ?? 2)} onChange={e => setPaymentPlan(e.target.value)}>
              <option value="full">Pay in full</option>
              {[2, 3, 4, 6].map(n => <option key={n} value={n}>{n} instalments</option>)}
            </select>
          ) : <span className="strong">{ppText}{showPrices && plan.paymentPlan.type === 'instalments' && (plan.status === 'draft' || plan.status === 'proposed') ? <span className="tiny muted num"> · {money(Math.round(total / (plan.paymentPlan.instalments ?? 2)), cur)} each</span> : null}</span>}
        </div>
        <div className="cr-plan-fact">
          <span className="tiny muted">Consent</span>
          <span className="row wrap" style={{ gap: 6 }}>
            <Chip tone={plan.consentSigned ? 'ok' : 'warn'} icon={plan.consentSigned ? 'check' : 'alert'}>{plan.consentSigned ? 'Signed' : 'Not signed'}</Chip>
            {!plan.consentSigned && plan.status !== 'declined' && (can('clinical.edit') || can('clients.edit')) && <Button size="sm" variant="ghost" onClick={signConsent}>Mark signed</Button>}
          </span>
        </div>
        <div className="cr-plan-fact">
          <span className="tiny muted">Progress</span>
          <span className="stack" style={{ gap: 4 }}>
            <span className="small strong num">{doneN} of {all.length - skippedN} sessions done</span>
            <Progress value={doneN} max={Math.max(1, all.length - skippedN)} tone={plan.status === 'completed' ? 'ok' : 'accent'} label="Sessions done" />
          </span>
        </div>
      </div>

      {plan.items.length === 0 ? (
        <p className="small muted cr-plan-empty">No procedures yet. {can('clinical.edit') ? 'Add one below.' : 'A clinician adds them.'}</p>
      ) : (
        <ul className="cr-items">
          {plan.items.map(item => (
            <PlanItemRow key={item.id} plan={plan} item={item} showPrices={showPrices}
              onSchedule={session => setSchedule({ item, session })} onSkip={session => setSkip({ item, session })} onSign={signConsent} />
          ))}
        </ul>
      )}

      {can('clinical.edit') && plan.status !== 'completed' && plan.status !== 'declined' && (
        <div className="cr-plan-foot">
          <Button size="sm" variant="subtle" icon="plus" onClick={onAdd}>{plan.status === 'accepted' ? 'Add a procedure mid-course' : 'Add a procedure'}</Button>
          {plan.status === 'accepted' && <span className="tiny muted">For example adding FUE after a PRP review. It is dated today and shown as added mid-course.</span>}
        </div>
      )}
      {plan.status === 'proposed' && !canDecide && <p className="tiny muted cr-plan-foot">Waiting for {first(client.name)} to decide. A coordinator records the answer.</p>}

      <ReasonDialog open={declineOpen} onClose={() => setDeclineOpen(false)} title={`${first(client.name)} declined the plan`} confirmLabel="Mark as declined" tone="danger"
        body="The plan stays on file. You can revise and propose it again later." placeholder="e.g. Wants to wait until after the wedding in June" onConfirm={decline} />
      <ReasonDialog open={!!skip} onClose={() => setSkip(null)} title={skip ? `Skip session ${skip.session.no} of ${procName(state, skip.item.procedureId)}?` : ''}
        body="Skipped sessions no longer count towards progress. This is logged." confirmLabel="Skip session" placeholder="e.g. Clinician advised the result is already reached" onConfirm={doSkip} />
      {schedule && (
        <ScheduleModal open onClose={() => setSchedule(null)} client={client} episode={episode}
          preset={{ type: 'session', procedureId: schedule.item.procedureId, sessionNo: schedule.session.no, sessionsTotal: schedule.item.sessionsTotal, start: estimateDue(state, plan, schedule.item, schedule.session), lockType: true }}
          onBooked={(apptId, start) => linkSessionBooking(actions, plan.id, schedule.item.id, schedule.session.no, apptId, start)} />
      )}
    </section>
  )
}

function PlanItemRow({ plan, item, showPrices, onSchedule, onSkip, onSign }: {
  plan: TreatmentPlan; item: PlanItem; showPrices: boolean; onSchedule: (s: Session) => void; onSkip: (s: Session) => void; onSign: () => void
}) {
  const { state, me, can, actions } = useStore()
  const [open, setOpen] = useState(false)
  const proc = state.procedures.find(p => p.id === item.procedureId)
  const cur = state.settings.currency
  const done = item.sessions.filter(s => s.status === 'done')
  const counted = item.sessions.filter(s => s.status !== 'skipped').length
  const next = item.sessions.find(s => s.status === 'booked' || s.status === 'due')
  const nextAppt = next ? sessionAppt(state, plan, item, next) : undefined
  const due = next && next.status === 'due' ? estimateDue(state, plan, item, next) : undefined
  const midCourse = ms(item.addedAt) - ms(plan.createdAt) > DAY
  const live = plan.status === 'accepted'
  const consentBlock = !plan.consentSigned && !!proc?.needsConsent
  const canDone = can('clinical.edit') || can('appointments.manage')
  const lastDone = done[done.length - 1]

  const dotLabel = (s: Session) => {
    const a = sessionAppt(state, plan, item, s)
    if (s.status === 'done') return `Session ${s.no}: done${s.date ? ` ${shortDate(s.date)}` : ''}`
    if (s.status === 'booked') return `Session ${s.no}: booked${a ? ` ${dateTime(a.start)}` : s.date ? ` ${dateTime(s.date)}` : ''}`
    if (s.status === 'skipped') return `Session ${s.no}: skipped`
    return `Session ${s.no}: not booked yet`
  }

  return (
    <li className="cr-item">
      <div className="cr-item-head">
        <div className="stack" style={{ gap: 2 }}>
          <span className="row wrap" style={{ gap: 6 }}>
            <span className="strong">{proc?.name ?? 'Procedure'}</span>
            {proc && <Chip>{proc.category}</Chip>}
            {midCourse && <Chip tone="info" icon="plus" title={`Added ${dateTime(item.addedAt)}`}>Added mid-course · {shortDate(item.addedAt)}</Chip>}
          </span>
          <span className="tiny muted">{item.sessionsTotal} session{item.sessionsTotal === 1 ? '' : 's'}{proc && proc.intervalWeeks ? `, every ${proc.intervalWeeks} weeks` : ''}{proc ? ` · ${proc.durationMin < 60 ? `${proc.durationMin} min` : `${proc.durationMin / 60} h`} each` : ''}</span>
        </div>
        {showPrices && <span className="strong num">{money(item.price, cur)}</span>}
      </div>

      <div className="cr-item-progress">
        <ol className="cr-dots" aria-label={`${done.length} of ${counted} sessions done`}>
          {item.sessions.map(s => (
            <li key={s.no} className={`cr-dot is-${s.status}`} title={dotLabel(s)}>
              <span className="sr-only">{dotLabel(s)}</span>
            </li>
          ))}
        </ol>
        <span className="small">
          {next ? (
            <><strong>Session {next.no} of {item.sessionsTotal}</strong>{' · '}
              {next.status === 'booked'
                ? <span className="cr-booked">Booked {nextAppt ? `${dateTime(nextAppt.start)} · ${userName(state, nextAppt.practitionerId)}` : next.date ? dateTime(next.date) : ''}</span>
                : <span className="muted">{due ? `Due around ${shortDate(new Date(due).toISOString())}` : live ? 'Ready to book' : 'Bookable once the plan is accepted'}</span>}
            </>
          ) : (
            <strong className="cr-ok">All {counted} session{counted === 1 ? '' : 's'} done{lastDone?.date ? ` · last ${shortDate(lastDone.date)}` : ''}</strong>
          )}
        </span>
      </div>

      {next && live && (
        <div className="row wrap cr-item-actions">
          {next.status === 'due' && can('appointments.manage') && <Button size="sm" variant="primary" icon="calendar" onClick={() => onSchedule(next)}>Schedule session {next.no}</Button>}
          {canDone && <Button size="sm" variant={next.status === 'booked' ? 'primary' : 'secondary'} icon="check" disabled={consentBlock} title={consentBlock ? 'Consent must be signed first' : undefined} onClick={() => markSessionDone(actions, state, plan.id, item.id, next.no)}>Mark session {next.no} done</Button>}
          {next.status === 'booked' && nextAppt && canOpen(me, 'calendar') && <Button size="sm" variant="ghost" icon="arrowUpRight" onClick={() => actions.go('calendar', nextAppt.id)}>Open in calendar</Button>}
          {next.status === 'due' && can('clinical.edit') && <Button size="sm" variant="ghost" onClick={() => onSkip(next)}>Skip</Button>}
          {consentBlock && (can('clinical.edit') || can('clients.edit')) && <Button size="sm" variant="ghost" icon="shield" onClick={onSign}>Record consent</Button>}
        </div>
      )}

      <button type="button" className="cr-disclose" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />{open ? 'Hide sessions' : 'Show all sessions'}
      </button>
      {open && (
        <ul className="cr-sessions">
          {item.sessions.map(s => {
            const a = sessionAppt(state, plan, item, s)
            return (
              <li key={s.no} className="cr-session">
                <span className={`cr-dot is-${s.status}`} aria-hidden="true" />
                <span className="small strong num">Session {s.no}</span>
                <Chip tone={s.status === 'done' ? 'ok' : s.status === 'booked' ? 'team' : s.status === 'skipped' ? 'neutral' : 'warn'}>{s.status === 'due' ? 'To book' : s.status[0].toUpperCase() + s.status.slice(1)}</Chip>
                <span className="small muted grow">
                  {s.status === 'done' && s.date ? shortDate(s.date) : a ? `${dateTime(a.start)} · ${userName(state, a.practitionerId)}` : s.date ? dateTime(s.date) : s.status === 'due' ? (() => { const t = estimateDue(state, plan, item, s); return t ? `Due around ${shortDate(new Date(t).toISOString())}` : '' })() : ''}
                  {s.note ? ` · ${s.note}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function AddProcedureModal({ open, planId, onClose, client, episode }: { open: boolean; planId: string | null; onClose: () => void; client: Client; episode: Episode }) {
  const { state, actions } = useStore()
  const plan = state.plans.find(p => p.id === planId)
  const cur = state.settings.currency
  const [procedureId, setProcedureId] = useState('')
  const [sessions, setSessions] = useState(1)
  const [price, setPrice] = useState(0)
  useEffect(() => {
    if (!open) return
    const pick = state.procedures.find(p => !plan?.items.some(i => i.procedureId === p.id) && episode.interests.includes(p.id)) ?? state.procedures.find(p => !plan?.items.some(i => i.procedureId === p.id)) ?? state.procedures[0]
    setProcedureId(pick?.id ?? '')
    setSessions(pick?.sessions ?? 1)
    setPrice(pick?.price ?? 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const proc = state.procedures.find(p => p.id === procedureId)
  const mid = plan?.status === 'accepted'
  const valid = !!proc && sessions >= 1 && sessions <= 24 && price >= 0

  const save = () => {
    if (!proc || !valid) return
    const now = iso(Date.now())
    const item: PlanItem = { id: uid('pi'), procedureId: proc.id, sessionsTotal: sessions, price, addedAt: now, sessions: Array.from({ length: sessions }, (_, k) => ({ no: k + 1, status: 'due' as const })) }
    actions.update(d => {
      let p = d.plans.find(x => x.id === planId)
      if (!p) {
        p = { id: uid('pl'), episodeId: episode.id, clientId: client.id, status: 'draft', items: [], discount: 0, paymentPlan: { type: 'full' }, consentSigned: false, createdBy: d.currentUserId, createdAt: now }
        d.plans.push(p)
      }
      p.items.push(item)
      if (proc.needsConsent && p.status === 'accepted') p.consentSigned = false
      const ep = d.episodes.find(e => e.id === episode.id)
      if (ep) {
        if (!ep.interests.includes(proc.id)) ep.interests.push(proc.id)
        ep.value = d.plans.filter(x => x.episodeId === episode.id && x.status !== 'declined').reduce((t, x) => t + planTotal(x), 0)
      }
      d.audit.unshift({ id: uid('au'), at: now, actor: d.currentUserId, action: planId ? 'plan.item_added' : 'plan.created', target: { type: 'plan', id: p.id, label: client.name }, detail: `${planId ? 'Added' : 'Plan started with'} ${proc.name}: ${sessions} session${sessions > 1 ? 's' : ''}, ${money(price, cur)}${mid ? ' (mid-course)' : ''}` })
    })
    actions.toast(mid
      ? `${proc.name} added mid-course.${proc.needsConsent ? ' New consent needed before the next session.' : ''} Send a payment link for ${money(price, cur)} from Payments.`
      : `${proc.name} added to the ${planId ? 'plan' : 'new draft plan'}.`, 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={500} title={mid ? 'Add a procedure mid-course' : planId ? 'Add a procedure' : 'Start a treatment plan'}
      description={mid ? `It is dated today and shows as added mid-course on ${first(client.name)}'s plan.` : 'The plan stays a draft until you propose it.'}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="plus" disabled={!valid} onClick={save}>Add {proc?.name ?? 'procedure'}</Button>
      </>}>
      <div className="stack lg">
        <Field label="Procedure">
          {id => (
            <select id={id} className="input" value={procedureId} onChange={e => { const p = state.procedures.find(x => x.id === e.target.value); setProcedureId(e.target.value); setSessions(p?.sessions ?? 1); setPrice(p?.price ?? 0) }}>
              {state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}{plan?.items.some(i => i.procedureId === p.id) ? ' (already in plan)' : ''}</option>)}
            </select>
          )}
        </Field>
        <div className="cr-form-2">
          <Field label="Sessions" hint={proc ? `Usual course: ${proc.sessions}` : undefined}>
            {id => <input id={id} className="input num" type="number" min={1} max={24} value={sessions} onChange={e => setSessions(Math.max(0, Math.round(Number(e.target.value))))} />}
          </Field>
          <Field label={`Price for the course (${cur})`} hint={proc?.priceFrom ? `Price list: ${money(proc.priceFrom, cur)}–${money(proc.priceTo ?? proc.price, cur)}` : undefined}>
            {id => <input id={id} className="input num" type="number" min={0} step={50} value={price} onChange={e => setPrice(Math.max(0, Number(e.target.value)))} />}
          </Field>
        </div>
        {proc?.needsConsent && <p className="tiny muted"><Icon name="shield" size={12} /> {proc.name} needs a signed consent form before the first session.{proc.minAge > 18 ? ` Minimum age ${proc.minAge}.` : ''}</p>}
        {mid && <p className="tiny muted">The payment schedule does not change by itself. Send a payment link for the extra amount from the Payments tab.</p>}
      </div>
    </Modal>
  )
}
