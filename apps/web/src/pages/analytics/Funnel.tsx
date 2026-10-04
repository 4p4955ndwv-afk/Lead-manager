import { Icon } from '../../components/icons'
import { BarList, FUNNEL_RAMP } from './charts'
import type { Funnel } from './data'
import { FUNNEL_STEPS } from './data'
import { fmtInt, fmtPct } from './format'

/** Horizontal funnel: one bar per step on a shared scale, ordinal colour ramp, step conversion between rows. */
export function FunnelBars({ funnel, compact = false }: { funnel: Funnel; compact?: boolean }) {
  return (
    <BarList
      ariaLabel="Lead funnel"
      compact={compact}
      barHeight={compact ? 10 : 14}
      max={funnel.dms || 1}
      between={i => {
        const prevKey = FUNNEL_STEPS[i - 1].key
        const curKey = FUNNEL_STEPS[i].key
        const rate = funnel[prevKey] ? funnel[curKey] / funnel[prevKey] : NaN
        return <span className="an-step"><Icon name="chevronDown" size={12} /> <b className="num">{fmtPct(rate)}</b> {FUNNEL_STEPS[i].rate}</span>
      }}
      rows={FUNNEL_STEPS.map((s, i) => ({
        id: s.key,
        label: s.label,
        value: funnel[s.key],
        color: FUNNEL_RAMP[i],
        tip: [
          { color: FUNNEL_RAMP[i], label: 'people', value: fmtInt(funnel[s.key]) },
          { color: 'transparent', label: 'of all DMs', value: fmtPct(funnel.dms ? funnel[s.key] / funnel.dms : NaN, 1) },
        ],
      }))}
    />
  )
}
