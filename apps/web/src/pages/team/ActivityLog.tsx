import { useMemo, useState } from 'react'
import { Button, Chip, EmptyState, Field, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore } from '../../lib/store'
import { canOpen } from '../../lib/permissions'
import type { AuditEntry } from '../../lib/types'
import { DAY, ago, dateTime, iso, ms, startOfDay, uid } from '../../lib/time'
import { localDay } from '../settings/ext'
import { AUDIT_KINDS, actionLabel, actorName, auditCsv, kindsOf, targetLink, type AuditKind } from './audit'

type Range = 'any' | 'today' | 'yesterday' | '7d' | '30d' | 'day'
const PAGE = 40

export function ActivityLog() {
  const { state, me, actions } = useStore()
  const [q, setQ] = useState('')
  const [actor, setActor] = useState('all')
  const [kind, setKind] = useState<AuditKind>('all')
  const [range, setRange] = useState<Range>('any')
  const [day, setDay] = useState(() => localDay())
  const [limit, setLimit] = useState(PAGE)

  const actors = useMemo(() => {
    const ids = Array.from(new Set(state.audit.map(e => e.actor)))
    return ids.map(id => ({ id, name: actorName(state, id) })).sort((a, b) => a.name.localeCompare(b.name))
  }, [state])

  const rows = useMemo(() => {
    const t0 = startOfDay(Date.now())
    const needle = q.trim().toLowerCase()
    const inRange = (e: AuditEntry) => {
      const t = ms(e.at)
      switch (range) {
        case 'today': return t >= t0
        case 'yesterday': return t >= t0 - DAY && t < t0
        case '7d': return t >= t0 - 6 * DAY
        case '30d': return t >= t0 - 29 * DAY
        case 'day': {
          const d = new Date(day + 'T00:00:00').getTime()
          return t >= d && t < d + DAY
        }
        default: return true
      }
    }
    return [...state.audit]
      .sort((a, b) => ms(b.at) - ms(a.at))
      .filter(e => actor === 'all' || e.actor === actor)
      .filter(e => kind === 'all' || kindsOf(e).includes(kind))
      .filter(inRange)
      .filter(e => !needle || [actorName(state, e.actor), e.action, actionLabel(e.action), e.target.label ?? '', e.detail, e.reason ?? ''].some(x => x.toLowerCase().includes(needle)))
  }, [state, q, actor, kind, range, day])

  const filtered = q || actor !== 'all' || kind !== 'all' || range !== 'any'
  const clear = () => { setQ(''); setActor('all'); setKind('all'); setRange('any'); setLimit(PAGE) }

  const exportCsv = () => {
    const csv = auditCsv(state, rows)
    let downloaded = false
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${state.settings.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'clinic'}-audit-${localDay()}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      downloaded = true
    } catch {
      /* downloads can be blocked inside previews; the CSV is still prepared */
    }
    actions.update(d => {
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'audit.exported', target: { type: 'settings', id: 'audit', label: 'Audit log' }, detail: `Exported ${rows.length} entr${rows.length === 1 ? 'y' : 'ies'} as CSV${filtered ? ' (filtered)' : ''}` })
    })
    actions.toast(`Export prepared: ${rows.length} row${rows.length === 1 ? '' : 's'}, ${Math.max(1, Math.round(csv.length / 1024))} KB${downloaded ? '' : '. Downloads are blocked here.'}`, 'success')
  }

  const overrides = state.audit.filter(e => kindsOf(e).includes('override') && ms(e.at) > Date.now() - 7 * DAY).length
  const aiCount = state.audit.filter(e => kindsOf(e).includes('ai') && ms(e.at) > Date.now() - 7 * DAY).length

  return (
    <div className="stack lg">
      <div className="tm-log-summary small muted">
        <span><b className="num">{state.audit.length}</b> entries kept</span>
        <span><b className="num">{overrides}</b> overrides with reasons in the last 7 days</span>
        <span><b className="num">{aiCount}</b> AI and Claude actions in the last 7 days</span>
      </div>

      <div className="card card-padded tm-log-filters">
        <div className="search-wrap tm-log-search">
          <Icon name="search" size={16} />
          <input className="input input-search" type="search" placeholder="Search who, what, client or reason" aria-label="Search the activity log" value={q} onChange={e => { setQ(e.target.value); setLimit(PAGE) }} />
        </div>
        <Field label="Who">
          {id => (
            <select id={id} className="input" value={actor} onChange={e => { setActor(e.target.value); setLimit(PAGE) }}>
              <option value="all">Everyone</option>
              {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Type">
          {id => (
            <select id={id} className="input" value={kind} onChange={e => { setKind(e.target.value as AuditKind); setLimit(PAGE) }}>
              {AUDIT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          )}
        </Field>
        <Field label="When">
          {id => (
            <select id={id} className="input" value={range} onChange={e => { setRange(e.target.value as Range); setLimit(PAGE) }}>
              <option value="any">Any time</option>
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="day">A specific day…</option>
            </select>
          )}
        </Field>
        {range === 'day' && (
          <Field label="Day">
            {id => <input id={id} type="date" className="input" value={day} max={localDay()} onChange={e => setDay(e.target.value)} />}
          </Field>
        )}
        <div className="tm-log-actions">
          {filtered && <Button variant="ghost" size="sm" onClick={clear}>Clear filters</Button>}
          <Button variant="secondary" size="sm" icon="download" onClick={exportCsv} disabled={!rows.length}>Export CSV</Button>
        </div>
      </div>

      <div className="card" aria-live="polite">
        <div className="tm-log-head small muted">
          <span>{rows.length === state.audit.length ? `All ${rows.length} entries` : `${rows.length} of ${state.audit.length} entries`}, newest first</span>
        </div>
        {rows.length === 0 ? (
          <EmptyState icon="history" title="Nothing matches these filters"
            body="Every stage move, override, AI action, sign-in change and settings change is recorded here with who did it and why. Try a wider date range."
            action={<Button variant="secondary" size="sm" onClick={clear}>Clear filters</Button>} />
        ) : (
          <ol className="tm-log">
            {rows.slice(0, limit).map(e => {
              const to = targetLink(state, e)
              const link = to && canOpen(me, to.page) ? to : null
              const kinds = kindsOf(e)
              return (
                <li key={e.id} className="tm-log-row">
                  <span className="tm-log-avatar">
                    {e.actor === 'system' ? <span className="tm-sys-avatar" title="System"><Icon name="settings" size={15} /></span>
                      : e.actor === 'claude' ? <span className="avatar avatar-ai" style={{ width: 30, height: 30 }} title="Claude"><Icon name="sparkles" size={16} /></span>
                        : <UserAvatar userId={e.actor} size={30} />}
                  </span>
                  <div className="stack tm-log-body" style={{ gap: 3 }}>
                    <p className="tm-log-line">
                      <b>{actorName(state, e.actor)}</b> {actionLabel(e.action)}
                      {e.target.label && <>
                        {' · '}
                        {link ? <button type="button" className="tm-link" onClick={() => actions.go(link.page, link.id)}>{e.target.label}</button> : <span className="strong">{e.target.label}</span>}
                      </>}
                    </p>
                    {e.detail && <p className="small muted tm-log-detail">{e.detail}</p>}
                    {e.reason && <p className="small tm-log-reason"><span className="tiny muted">Reason</span> {e.reason}</p>}
                    <span className="row wrap" style={{ gap: 6 }}>
                      <code className="tiny mono faint">{e.action}</code>
                      {kinds.includes('override') && <Chip tone="warn">Override</Chip>}
                      {kinds.includes('money') && <Chip tone="info">Money</Chip>}
                    </span>
                  </div>
                  <time className="tiny muted tm-log-time" dateTime={e.at} title={dateTime(e.at)}>{ago(e.at)}</time>
                </li>
              )
            })}
          </ol>
        )}
        {rows.length > limit && (
          <div className="tm-log-more">
            <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + PAGE)}>Show {Math.min(PAGE, rows.length - limit)} more</Button>
          </div>
        )}
      </div>
    </div>
  )
}
