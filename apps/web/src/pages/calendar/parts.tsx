// Small shared pieces for the calendar views: status chips, reminder and deposit markers, the legend.
import type { Appointment, AppointmentStatus } from '../../lib/types'
import { Chip } from '../../components/ui'
import { Icon } from '../../components/icons'
import { STATUS_ICON, STATUS_LABEL, STATUS_TONE, TYPE_SHORT } from './helpers'

export function StatusChip({ status }: { status: AppointmentStatus }) {
  return <Chip tone={STATUS_TONE[status]} icon={STATUS_ICON[status]} className={`ca-status-chip ca-sc-${status}`}>{STATUS_LABEL[status]}</Chip>
}

/** Deposit-due badge and reminder markers, shown on blocks, week items and agenda rows. */
export function ApptMarks({ a, symbol }: { a: Appointment; symbol: string }) {
  const sent = [a.reminders.d2 && 'D-2', a.reminders.d1 && 'D-1'].filter(Boolean) as string[]
  return (
    <span className="ca-marks">
      {a.deposit === 'due' && a.status !== 'cancelled' && (
        <span className="ca-dep" title="Deposit due">
          <span aria-hidden="true">{symbol}</span>
          <span className="sr-only">Deposit due</span>
        </span>
      )}
      {sent.length > 0 && (
        <span className="ca-mark" title={`${sent.join(' and ')} reminder sent`}>
          <Icon name="bell" size={12} />
          <span className="sr-only">{sent.join(' and ')} reminder sent</span>
        </span>
      )}
      {a.reminders.confirmedVia === 'whatsapp' && (
        <span className="ca-mark ca-mark-wa" title="Confirmed via WhatsApp">
          <Icon name="whatsapp" size={12} />
          <span className="sr-only">Confirmed via WhatsApp</span>
        </span>
      )}
    </span>
  )
}

export function Legend({ symbol }: { symbol: string }) {
  return (
    <div className="ca-legend" aria-label="Calendar legend">
      <span className="ca-legend-group">
        {(['consultation', 'session', 'follow_up'] as const).map(t => (
          <span key={t} className="ca-legend-item"><span className={`ca-swatch ca-t-${t}`} aria-hidden="true" />{TYPE_SHORT[t]}</span>
        ))}
      </span>
      <span className="ca-legend-group">
        <span className="ca-legend-item"><span className="ca-swatch ca-swatch-dashed" aria-hidden="true" />Unconfirmed</span>
        <span className="ca-legend-item"><span className="ca-swatch ca-swatch-solid" aria-hidden="true" />Confirmed</span>
        <span className="ca-legend-item"><span className="ca-swatch ca-swatch-ring" aria-hidden="true" />In clinic</span>
        <span className="ca-legend-item"><span className="ca-swatch ca-swatch-muted" aria-hidden="true" />Completed</span>
        <span className="ca-legend-item"><span className="ca-legend-struck">Name</span>No-show</span>
      </span>
      <span className="ca-legend-group">
        <span className="ca-legend-item"><span className="ca-dep" aria-hidden="true">{symbol}</span>Deposit due</span>
        <span className="ca-legend-item"><Icon name="bell" size={12} />Reminder sent</span>
        <span className="ca-legend-item"><span className="ca-mark-wa"><Icon name="whatsapp" size={12} /></span>Confirmed on WhatsApp</span>
      </span>
    </div>
  )
}
