import type { PlaybookVersion } from '../../lib/types'
import { Card, Chip, EmptyState } from '../../components/ui'
import { EVAL_CATEGORIES, EVAL_TARGET, GOLDEN_SET_SIZE, evalBreakdown, pct } from './compute'

/** Golden-set pass rate by category for one version, optionally against the live version. */
export function Scorecard({ version, compareTo, reference }: { version: PlaybookVersion; compareTo?: PlaybookVersion; reference?: PlaybookVersion }) {
  const rows = evalBreakdown(version, reference ?? compareTo)
  const base = compareTo && compareTo.id !== version.id ? evalBreakdown(compareTo) : null
  const below = rows?.filter(r => r.rate * 100 < EVAL_TARGET).length ?? 0
  return (
    <Card title="Evaluation scorecard" subtitle={`Golden set of ${GOLDEN_SET_SIZE} test conversations across ${EVAL_CATEGORIES.length} categories. Target: ${EVAL_TARGET}% in every category.`}
      actions={rows ? <Chip tone={below ? 'warn' : 'ok'} icon={below ? 'alert' : 'check'}>{below ? `${below} below target` : 'All categories on target'}</Chip> : undefined}>
      {!rows ? (
        <EmptyState icon="chart" title={`${version.version} hasn't been evaluated yet`} body="Run the evaluation on the draft to replay the golden set and score each category." />
      ) : (
        <div className="stack">
          <div className="ai-eval-legend" aria-hidden={!base}>
            <span><i className="ai-swatch is-primary" />{version.version}</span>
            {base && compareTo && <span><i className="ai-swatch is-base" />{compareTo.version} (live)</span>}
            <span><i className="ai-swatch is-target" />Target {EVAL_TARGET}%</span>
          </div>
          <ul className="ai-eval">
            {rows.map((r, i) => {
              const b = base?.[i]
              const delta = b ? Math.round((r.rate - b.rate) * 100) : 0
              const low = r.rate * 100 < EVAL_TARGET
              return (
                <li key={r.id} className="ai-eval-row">
                  <span className="ai-eval-label">
                    <span className="small strong">{r.label}</span>
                    <span className="tiny faint num">{r.passed} of {r.cases} passed</span>
                  </span>
                  <span className="ai-eval-bars">
                    <span className="ai-eval-track" title={`${version.version}: ${r.passed} of ${r.cases} passed (${pct(r.rate)})`}>
                      <span className="ai-eval-bar is-primary" style={{ width: `${r.rate * 100}%` }} />
                      <span className="ai-eval-target" style={{ left: `${EVAL_TARGET}%` }} />
                    </span>
                    {b && compareTo && (
                      <span className="ai-eval-track is-thin" title={`${compareTo.version}: ${b.passed} of ${b.cases} passed (${pct(b.rate)})`}>
                        <span className="ai-eval-bar is-base" style={{ width: `${b.rate * 100}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="ai-eval-value">
                    <span className="num strong">{pct(r.rate)}</span>
                    {b && <span className="tiny muted num">{delta > 0 ? `+${delta}` : delta === 0 ? '±0' : `−${Math.abs(delta)}`} vs live</span>}
                    {low && <span className="tiny ai-eval-low">Below target</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}
