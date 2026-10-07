import { useState } from 'react'
import { Button, Card, ChannelBadge, Chip, Dot, EmptyState, Locked, Progress, StageBadge, UserAvatar } from '../../components/ui'
import { useStore } from '../../lib/store'
import { money } from '../../lib/time'
import { fmtInt, fmtPct, plural } from './format'
import type { ChannelFilter } from './data'
import { leaderboard, returningClients, topSources } from './data'

export function SourcesTable({ range, channel, now }: { range: number; channel: ChannelFilter; now: number }) {
  const { state } = useStore()
  const [all, setAll] = useState(false)
  const rows = topSources(state, range, channel, now)
  const shown = all ? rows : rows.slice(0, 6)
  const best = rows.filter(r => r.leads >= 3).sort((a, b) => b.bookRate - a.bookRate)[0]
  return (
    <Card title="Top sources" subtitle={`New leads in the last ${range} days, grouped by the post or video that started the chat.`} padded={false} className="an-table-card"
      actions={rows.length > 6 ? <Button size="sm" variant="ghost" onClick={() => setAll(v => !v)}>{all ? 'Show top 6' : `Show all ${rows.length}`}</Button> : undefined}>
      {rows.length === 0 ? (
        <EmptyState icon="chart" title="No new leads in this range" body="Each new DM is tagged with the reel, video or story it came from. Sources appear here as leads arrive." />
      ) : (
        <div className="an-scroll">
          <table className="table an-table">
            <thead>
              <tr><th>Source</th><th className="an-r">Leads</th><th>Contact rate</th><th className="an-r">Booked</th><th className="an-r">Treatments</th></tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.detail}>
                  <td>
                    <div className="an-source">
                      <ChannelBadge channel={r.channel} label={false} size="sm" />
                      <span className="an-source-name">{r.detail}</span>
                      {best && best.detail === r.detail && <span className="an-source-chip"><Chip tone="accent" icon="star">Best booking rate</Chip></span>}
                    </div>
                  </td>
                  <td className="an-r num">{fmtInt(r.leads)}</td>
                  <td>
                    <div className="an-rate">
                      <span className="num">{fmtPct(r.contactRate)}</span>
                      <Progress value={r.contactRate * 100} label={`Contact rate ${fmtPct(r.contactRate)}`} />
                    </div>
                  </td>
                  <td className="an-r num">{fmtInt(r.booked)} <span className="muted tiny">({fmtPct(r.bookRate)})</span></td>
                  <td className="an-r num">{fmtInt(r.treatments)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export function LeaderboardTable({ range, channel, now }: { range: number; channel: ChannelFilter; now: number }) {
  const { state } = useStore()
  const rows = leaderboard(state, range, channel, now)
  return (
    <Card title="Coordinator leaderboard" subtitle="Calls logged counts call attempts and leads moved to Call & confirm. Call SLA met is first call within 15 minutes of a number arriving." padded={false} className="an-table-card">
      {rows.length === 0 ? (
        <EmptyState icon="users" title="No coordinators yet" body="Invite a lead coordinator from Team & access. Their calls and bookings appear here." />
      ) : (
        <div className="an-scroll">
          <table className="table an-table">
            <thead>
              <tr><th>Coordinator</th><th className="an-r">Leads owned</th><th className="an-r">Calls logged</th><th className="an-r">Booked</th><th className="an-r">Booked per call</th><th>Call SLA met</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rate = r.slaTotal ? r.slaMet / r.slaTotal : NaN
                return (
                  <tr key={r.userId}>
                    <td>
                      <div className="row">
                        <span className="an-rank num" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
                        <UserAvatar userId={r.userId} size={26} />
                        <span className="stack" style={{ gap: 0 }}>
                          <span className="strong an-nowrap">{r.name}</span>
                          <span className="tiny muted row" style={{ gap: 5 }}><Dot tone={r.onShift ? 'ok' : 'neutral'} />{r.onShift ? 'On shift' : 'Off shift'}</span>
                        </span>
                      </div>
                    </td>
                    <td className="an-r num">{fmtInt(r.owned)}</td>
                    <td className="an-r num">{fmtInt(r.calls)}</td>
                    <td className="an-r num strong">{fmtInt(r.booked)}</td>
                    <td className="an-r num">{r.calls ? fmtPct(r.bookRate) : '—'}</td>
                    <td>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {r.slaTotal ? (
                          <Chip tone={rate >= 0.9 ? 'ok' : rate >= 0.7 ? 'warn' : 'danger'} icon={rate >= 0.9 ? 'check' : 'alert'}>
                            {r.slaMet} of {r.slaTotal} · {fmtPct(rate)}
                          </Chip>
                        ) : <span className="muted small an-nowrap">No timed calls</span>}
                        {r.slaPending > 0 && <Chip tone="info" icon="clock">{plural(r.slaPending, 'call')} due now</Chip>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

export function ReturningTable({ channel, showRevenue }: { channel: ChannelFilter; showRevenue: boolean }) {
  const { state, actions } = useStore()
  const r = returningClients(state, channel)
  const cur = state.settings.currency
  return (
    <Card title="Returning clients" subtitle="People who came back for a new treatment journey (more than one episode). All time." padded={false} className="an-table-card">
      <div className="an-returning-summary">
        <div className="an-mini-stat"><span className="an-mini-value">{fmtInt(r.rows.length)}</span><span className="tiny muted">returning {r.rows.length === 1 ? 'client' : 'clients'}</span></div>
        <div className="an-mini-stat"><span className="an-mini-value">{fmtPct(r.clientShare, 1)}</span><span className="tiny muted">of {fmtInt(r.clients)} clients</span></div>
        <div className="an-mini-stat">
          {showRevenue ? <><span className="an-mini-value">{fmtPct(r.valueShare, 1)}</span><span className="tiny muted">of client value ({money(r.returningValue, cur)})</span></> : <Locked>Value share needs revenue access</Locked>}
        </div>
      </div>
      {r.rows.length === 0 ? (
        <EmptyState icon="refresh" title="No returning clients yet" body="When an alumni client messages again, a new episode starts on their record and they appear here." />
      ) : (
        <div className="an-scroll">
          <table className="table an-table">
            <thead>
              <tr><th>Client</th><th className="an-r">Episodes</th><th>Current journey</th>{showRevenue && <th className="an-r">Value</th>}</tr>
            </thead>
            <tbody>
              {r.rows.map(x => (
                <tr key={x.clientId} className="is-clickable" onClick={() => actions.go('client', x.clientId)}>
                  <td>
                    <button type="button" className="an-link" onClick={e => { e.stopPropagation(); actions.go('client', x.clientId) }}>
                      <ChannelBadge channel={x.channel} label={false} size="sm" /> {x.name}
                    </button>
                  </td>
                  <td className="an-r num">{x.episodes}</td>
                  <td><StageBadge stage={x.latest.stage} exit={x.latest.exit} /></td>
                  {showRevenue && <td className="an-r num">{money(x.value, cur)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
