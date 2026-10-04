// Activity log tab (needs audit.view): every audit entry about this person and their records.
import { useStore, userName } from '../../lib/store'
import type { AuditEntry, Client } from '../../lib/types'
import { ago, dateTime, useNow } from '../../lib/time'
import { EmptyState, Locked, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { auditFor } from './helpers'

const ACTION_LABEL: Record<string, string> = {
  'stage.move': 'Moved stage', 'stage.override': 'Stage override', 'client.view_phone': 'Viewed phone number', 'lead.handoff': 'Handed to a coordinator',
  'call.logged': 'Logged a call', 'appointment.booked': 'Booked an appointment', 'appointment.status': 'Changed an appointment', 'client.edit': 'Edited details',
  'client.merge': 'Merged a duplicate', 'client.export': 'Exported data', 'client.created': 'Added manually', 'client.id_verified': 'Verified ID',
  'plan.proposed': 'Proposed a plan', 'plan.accepted': 'Plan accepted', 'plan.declined': 'Plan declined', 'plan.revised': 'Reopened plan', 'plan.created': 'Started a plan',
  'plan.item_added': 'Added a procedure', 'plan.session_done': 'Session done', 'plan.session_skipped': 'Session skipped', 'plan.consent_signed': 'Consent signed', 'plan.payment_plan': 'Changed payment plan',
  'payment.link_sent': 'Sent a payment link', 'payment.link_resent': 'Resent a payment link', 'payment.received': 'Payment received', 'payment.refund': 'Refund issued',
  'draft.approved': 'Sent an AI draft', 'draft.edited_and_sent': 'Edited and sent an AI draft', 'conversation.handling': 'Changed who answers', 'conversation.new': 'New conversation',
  'task.done': 'Closed a task', 'task.reassigned': 'Reassigned a task', 'sla.escalated': 'Call SLA escalated', 'episode.start': 'Started a new episode',
  'client.dnc_cleared': 'Cleared do not contact', 'stage.override_requested': 'Asked for a stage override', 'lead.created': 'Lead created',
  'appointment.double_booked': 'Double-booked a slot', 'appointment.note': 'Noted an appointment', 'appointment.reminder': 'Sent a reminder',
  'conversation.assigned': 'Assigned the chat', 'conversation.resolved': 'Resolved the chat', 'message.template_sent': 'Sent a template message',
  'payment.deposit_paid': 'Deposit paid', 'payment.recorded': 'Payment recorded', 'payment.reminder': 'Sent a payment reminder',
  'task.created': 'Created a task', 'task.bulk_reassign': 'Reassigned tasks', 'privacy.request_logged': 'Logged a privacy request',
  'document.added': 'Added a document', 'document.signed': 'Document signed', 'document.sent': 'Sent a document', 'document.view': 'Opened clinical photos',
}

const sensitive = (a: AuditEntry) => /view_phone|export|erase|override|refund|document\.view|merge/.test(a.action)

export function ActivityTab({ client }: { client: Client }) {
  const { state, can } = useStore()
  const now = useNow(60_000)
  if (!can('audit.view')) return <Locked>The activity log is visible to owners and managers</Locked>
  const entries = auditFor(state, client.id)
  if (!entries.length) return <div className="card"><EmptyState icon="shield" title="No activity logged yet" body="Phone reveals, stage moves, overrides, edits, payments and exports about this person are recorded here with who did it and why." /></div>

  return (
    <section className="card cr-audit" aria-label="Activity log">
      <p className="small muted cr-pad">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'} about {client.name} and their records, newest first. Sensitive actions are marked.</p>
      <ol className="cr-audit-list">
        {entries.map(a => (
          <li key={a.id} className={`cr-audit-row ${sensitive(a) ? 'is-sensitive' : ''}`}>
            {a.actor === 'system' ? <span className="cr-audit-sys" aria-hidden="true"><Icon name="settings" size={14} /></span> : a.actor === 'claude' ? <UserAvatar userId="ai" size={26} /> : <UserAvatar userId={a.actor} size={26} />}
            <div className="stack grow" style={{ gap: 2 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <span className="small strong">{userName(state, a.actor)}</span>
                <span className="small">{ACTION_LABEL[a.action] ?? a.action}</span>
                {sensitive(a) && <span className="cr-sens" title="Sensitive action"><Icon name="eye" size={13} /><span className="sr-only">Sensitive action</span></span>}
                <code className="tiny faint mono">{a.action}</code>
              </div>
              <span className="small muted">{a.detail}</span>
              {a.reason && <span className="small cr-audit-reason">Reason: “{a.reason}”</span>}
            </div>
            <time className="tiny muted num cr-audit-time" dateTime={a.at} title={dateTime(a.at)}>{ago(a.at, now)}</time>
          </li>
        ))}
      </ol>
    </section>
  )
}
