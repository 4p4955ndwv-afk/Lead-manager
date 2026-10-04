// Payments tab (needs payments.view): schedule, balance due, payment links and refunds.
import { useEffect, useState } from 'react'
import { useStore } from '../../lib/store'
import type { Client, Episode, Payment } from '../../lib/types'
import { maskPhone } from '../../lib/permissions'
import { DAY, ago, dateTime, iso, money, ms, shortDate, uid, until, useNow } from '../../lib/time'
import { Button, Chip, EmptyState, Field, Locked, Modal, ReasonDialog, Stat } from '../../components/ui'
import { Icon } from '../../components/icons'
import { PAY_KIND_LABEL, PAY_METHOD_LABEL, PAY_STATUS_LABEL, PAY_STATUS_TONE, dateInput, planTotal } from './helpers'
import { first } from './dialogs'

export function PaymentsTab({ client, episode, episodes }: { client: Client; episode?: Episode; episodes: Episode[] }) {
  const { state, can, actions } = useStore()
  const now = useNow(60_000)
  const [linkOpen, setLinkOpen] = useState(false)
  const [paying, setPaying] = useState<Payment | null>(null)
  const [refund, setRefund] = useState<Payment | null>(null)
  if (!can('payments.view')) return <Locked>Payments are visible to finance, coordinators and front desk</Locked>

  const cur = state.settings.currency
  const pays = state.payments.filter(p => p.clientId === client.id).sort((a, b) => ms(b.dueAt) - ms(a.dueAt))
  const epPays = episode ? pays.filter(p => p.episodeId === episode.id) : []
  const plans = episode ? state.plans.filter(p => p.episodeId === episode.id && (p.status === 'accepted' || p.status === 'completed')) : []
  const planValue = plans.reduce((t, p) => t + planTotal(p), 0)
  const paid = epPays.filter(p => p.status === 'paid').reduce((t, p) => t + p.amount, 0)
  const scheduled = epPays.filter(p => p.status === 'due' || p.status === 'overdue').reduce((t, p) => t + p.amount, 0)
  const overdue = epPays.filter(p => p.status === 'overdue').reduce((t, p) => t + p.amount, 0)
  const balance = Math.max(0, planValue - paid)
  const unscheduled = Math.max(0, planValue - paid - scheduled)
  const multi = episodes.length > 1
  const channel = client.consent.whatsapp ? 'WhatsApp' : client.consent.sms ? 'SMS' : client.email ? 'email' : undefined

  const resend = (p: Payment) => {
    actions.audit({ action: 'payment.link_resent', target: { type: 'payment', id: p.id, label: client.name }, detail: `Payment link for ${money(p.amount, cur)} resent by ${channel ?? 'email'}` })
    actions.toast(`Link for ${money(p.amount, cur)} sent again to ${first(client.name)} by ${channel ?? 'email'}.`, 'success')
  }

  const doRefund = (reason: string) => {
    if (!refund) return
    actions.update(d => {
      const p = d.payments.find(x => x.id === refund.id)
      if (p) p.status = 'refunded'
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'payment.refund', target: { type: 'payment', id: refund.id, label: client.name }, detail: `Refunded ${money(refund.amount, cur)} (${PAY_KIND_LABEL[refund.kind].toLowerCase()}) to the original ${refund.method ? PAY_METHOD_LABEL[refund.method].toLowerCase() : 'payment method'}`, reason })
    })
    actions.toast(`Refund of ${money(refund.amount, cur)} issued. It reaches ${first(client.name)} in 3–5 working days.`, 'success')
  }

  return (
    <div className="stack lg">
      <div className="cr-stats">
        <Stat label={`Plan value${multi && episode ? ` · episode ${episode.number}` : ''}`} value={planValue ? money(planValue, cur) : '—'} hint={plans.length ? `${plans.length} accepted plan${plans.length > 1 ? 's' : ''}` : 'No accepted plan yet'} icon="layers" />
        <Stat label="Paid" value={money(paid, cur)} hint={epPays.filter(p => p.status === 'paid').length ? `${epPays.filter(p => p.status === 'paid').length} payment${epPays.filter(p => p.status === 'paid').length > 1 ? 's' : ''}` : 'Nothing yet'} tone={paid ? 'ok' : undefined} icon="check" />
        <Stat label="Balance due" value={money(balance, cur)} hint={unscheduled > 0 ? `${money(unscheduled, cur)} not scheduled yet` : balance ? 'All scheduled' : 'Fully paid'} tone={balance ? 'accent' : undefined} icon="card" />
        <Stat label="Overdue" value={money(overdue, cur)} hint={overdue ? 'Finance is chasing it' : 'Nothing overdue'} tone={overdue ? 'danger' : undefined} icon="alert" />
      </div>

      <section className="card cr-pay-card" aria-label="Payment schedule">
        <div className="card-head cr-pad-x">
          <div className="stack" style={{ gap: 2 }}>
            <h3 className="card-title">Payment schedule</h3>
            <span className="small muted">{channel ? `Links go to ${first(client.name)} by ${channel}${channel !== 'email' && client.phone ? ` (${maskPhone(client.phone, false)})` : ''}.` : 'No consented channel for payment links; take payment in clinic.'}</span>
          </div>
          {can('payments.take') && episode && <Button size="sm" variant="primary" icon="send" disabled={client.doNotContact || !channel} title={client.doNotContact ? 'Do not contact is on' : !channel ? 'No consented channel' : undefined} onClick={() => setLinkOpen(true)}>Send payment link</Button>}
        </div>
        {pays.length === 0 ? (
          <EmptyState icon="card" title="No payments yet" body="Deposits, instalments and balances appear here once a consultation is booked or a plan is accepted." />
        ) : (
          <div className="cr-table-scroll">
            <table className="table cr-pay-table">
              <thead>
                <tr><th scope="col">What</th><th scope="col">Amount</th><th scope="col">Due</th><th scope="col">Status</th><th scope="col">Paid</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {pays.map(p => {
                  const ep = state.episodes.find(e => e.id === p.episodeId)
                  return (
                    <tr key={p.id} className={p.status === 'refunded' ? 'is-muted' : ''}>
                      <td><span className="strong">{PAY_KIND_LABEL[p.kind]}</span>{multi && ep && <span className="tiny muted"> · Ep {ep.number}</span>}</td>
                      <td className="num strong">{money(p.amount, cur)}</td>
                      <td className="num"><span title={dateTime(p.dueAt)}>{shortDate(p.dueAt)}</span>{(p.status === 'due' || p.status === 'overdue') && <span className={`tiny ${p.status === 'overdue' ? 'cr-overdue' : 'muted'}`}> · {ms(p.dueAt) < now ? ago(p.dueAt, now) : until(p.dueAt, now)}</span>}</td>
                      <td><Chip tone={PAY_STATUS_TONE[p.status]}>{PAY_STATUS_LABEL[p.status]}</Chip></td>
                      <td className="small muted">{p.paidAt ? `${shortDate(p.paidAt)}${p.method ? ` · ${PAY_METHOD_LABEL[p.method]}` : ''}` : '—'}</td>
                      <td>
                        <div className="row cr-row-actions">
                          {(p.status === 'due' || p.status === 'overdue') && can('payments.take') && <>
                            <Button size="sm" variant="ghost" onClick={() => resend(p)} disabled={client.doNotContact || !channel}>Resend link</Button>
                            <Button size="sm" onClick={() => setPaying(p)}>Mark paid</Button>
                          </>}
                          {p.status === 'paid' && can('payments.refund') && <Button size="sm" variant="ghost" icon="refresh" onClick={() => setRefund(p)}>Refund</Button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {episode && <SendLinkModal open={linkOpen} onClose={() => setLinkOpen(false)} client={client} episode={episode} suggest={unscheduled} allScheduled={planValue > 0 && unscheduled === 0} channel={channel ?? 'email'} />}
      <MarkPaidModal payment={paying} onClose={() => setPaying(null)} client={client} />
      <ReasonDialog open={!!refund} onClose={() => setRefund(null)} tone="danger" confirmLabel={refund ? `Refund ${money(refund.amount, cur)}` : 'Refund'}
        title={refund ? `Refund ${money(refund.amount, cur)} to ${first(client.name)}?` : ''}
        body="The money goes back to the original payment method. This cannot be undone from here." placeholder="e.g. Treatment cancelled for medical reasons; clinician approved"
        onConfirm={doRefund} />
    </div>
  )
}

function SendLinkModal({ open, onClose, client, episode, suggest, channel, allScheduled }: { open: boolean; onClose: () => void; client: Client; episode: Episode; suggest: number; channel: string; allScheduled: boolean }) {
  const { state, actions } = useStore()
  const cur = state.settings.currency
  const [kind, setKind] = useState<Payment['kind']>('instalment')
  const [amount, setAmount] = useState(0)
  const [due, setDue] = useState('')
  useEffect(() => {
    if (!open) return
    const hasPaid = state.payments.some(p => p.episodeId === episode.id && p.status === 'paid')
    setKind(hasPaid ? 'instalment' : 'deposit')
    setAmount(suggest || Math.round((state.procedures.find(p => p.id === episode.interests[0])?.price ?? 500) * 0.2))
    setDue(dateInput(Date.now() + 3 * DAY))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const valid = amount > 0 && !!due

  const send = () => {
    if (!valid) return
    const dueAt = new Date(due + 'T18:00').toISOString()
    const id = uid('py')
    actions.update(d => {
      d.payments.push({ id, clientId: client.id, episodeId: episode.id, kind, amount, status: 'due', dueAt, method: 'card_link' })
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'payment.link_sent', target: { type: 'payment', id, label: client.name }, detail: `${PAY_KIND_LABEL[kind]} link for ${money(amount, cur)} sent by ${channel}, due ${shortDate(dueAt)}` })
    })
    actions.toast(`Payment link for ${money(amount, cur)} sent to ${first(client.name)} by ${channel}. Due ${shortDate(dueAt)}.`, 'success')
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} width={460} title={`Send a payment link to ${first(client.name)}`} description={`Sent by ${channel}. They pay by card on a secure page; it shows here as paid automatically.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="send" disabled={!valid} onClick={send}>Send {amount > 0 ? money(amount, cur) : ''} link</Button>
      </>}>
      <div className="stack lg">
        <Field label="What is it for?">
          {id => (
            <select id={id} className="input" value={kind} onChange={e => setKind(e.target.value as Payment['kind'])}>
              <option value="deposit">Deposit</option>
              <option value="instalment">Instalment</option>
              <option value="balance">Balance</option>
            </select>
          )}
        </Field>
        <div className="cr-form-2">
          <Field label={`Amount (${cur})`} hint={suggest ? `Suggested: ${money(suggest, cur)} not yet scheduled` : undefined}>
            {id => <input id={id} className="input num" type="number" min={1} step={10} value={amount} onChange={e => setAmount(Math.max(0, Number(e.target.value)))} />}
          </Field>
          <Field label="Due by">
            {id => <input id={id} className="input num" type="date" value={due} onChange={e => setDue(e.target.value)} />}
          </Field>
        </div>
        {allScheduled && <div className="cr-callout cr-callout-warn small"><Icon name="info" size={16} /><span>Everything in the plan is already scheduled. To chase a payment that is due, use Resend link in the schedule instead of sending a new one.</span></div>}
        <p className="tiny muted"><Icon name="shield" size={12} /> We never ask for card details in chats. The link opens the card provider's page.</p>
      </div>
    </Modal>
  )
}

function MarkPaidModal({ payment, onClose, client }: { payment: Payment | null; onClose: () => void; client: Client }) {
  const { state, actions } = useStore()
  const cur = state.settings.currency
  const [method, setMethod] = useState<NonNullable<Payment['method']>>('card_in_clinic')
  useEffect(() => { if (payment) setMethod(payment.method ?? 'card_in_clinic') }, [payment])

  const save = () => {
    if (!payment) return
    const stillOverdue = state.payments.some(p => p.clientId === client.id && p.status === 'overdue' && p.id !== payment.id)
    const task = state.tasks.find(t => t.clientId === client.id && t.type === 'payment' && t.status === 'open')
    actions.update(d => {
      const p = d.payments.find(x => x.id === payment.id)
      if (!p) return
      p.status = 'paid'
      p.paidAt = iso(Date.now())
      p.method = method
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'payment.received', target: { type: 'payment', id: p.id, label: client.name }, detail: `${PAY_KIND_LABEL[p.kind]} of ${money(p.amount, cur)} received by ${PAY_METHOD_LABEL[method].toLowerCase()}` })
    })
    if (task && !stillOverdue && payment.status === 'overdue') actions.completeTask(task.id, 'Overdue payment received')
    actions.toast(`${money(payment.amount, cur)} recorded as paid${task && !stillOverdue && payment.status === 'overdue' ? '; the chase task is closed' : ''}.`, 'success')
    onClose()
  }

  return (
    <Modal open={!!payment} onClose={onClose} width={420} title={payment ? `Record ${money(payment.amount, cur)} as paid` : ''}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="check" onClick={save}>Record payment</Button>
      </>}>
      <Field label="How did they pay?">
        {id => (
          <select id={id} className="input" value={method} onChange={e => setMethod(e.target.value as NonNullable<Payment['method']>)}>
            {(Object.keys(PAY_METHOD_LABEL) as Array<NonNullable<Payment['method']>>).map(m => <option key={m} value={m}>{PAY_METHOD_LABEL[m]}</option>)}
          </select>
        )}
      </Field>
    </Modal>
  )
}
