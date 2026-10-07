import { useMemo, useState } from 'react'
import { Button, Card, EmptyState, Locked, PageHeader, Segmented } from '../components/ui'
import { Icon } from '../components/icons'
import { useStore } from '../lib/store'
import { money, useNow } from '../lib/time'
import { saveFile } from '../lib/download'
import { BarList, ChartCard, COLOR, LegendItem, LineChart, StackedColumns } from './analytics/charts'
import type { ChannelFilter, RangeDays } from './analytics/data'
import { FUNNEL_STEPS, funnelOf, replyTimes, revenueByProcedure, toCsv, toDays, total, windowOf } from './analytics/data'
import { dayLabel, fmtCompact, fmtDuration, fmtInt, fmtMoneyCompact, fmtPct, median } from './analytics/format'
import { KpiTile, LockedTile, pctDelta, ptsDelta } from './analytics/Kpi'
import { LeaderboardTable, ReturningTable, SourcesTable } from './analytics/Tables'
import { FunnelBars } from './analytics/Funnel'
import './analytics.css'

function usePref<T extends string | number>(key: string, initial: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [v, setV] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      const parsed = (typeof initial === 'number' ? Number(raw) : raw) as T
      return raw != null && allowed.includes(parsed) ? parsed : initial
    } catch {
      return initial
    }
  })
  const set = (next: T) => {
    setV(next)
    try { localStorage.setItem(key, String(next)) } catch { /* per-viewer convenience only */ }
  }
  return [v, set]
}

const RANGES = [7, 30, 60] as const
const CHANNELS = ['all', 'instagram', 'tiktok'] as const
const CHANNEL_NAME: Record<ChannelFilter, string> = { all: 'all channels', instagram: 'Instagram', tiktok: 'TikTok' }

export default function Analytics() {
  const { state, can, actions } = useStore()
  const now = useNow(60_000)
  const [range, setRange] = usePref<RangeDays>('an-range', 30, RANGES)
  const [channel, setChannel] = usePref<ChannelFilter>('an-channel', 'all', CHANNELS)
  const showRevenue = can('analytics.revenue')
  const currency = state.settings.currency

  const all = useMemo(() => toDays(state.metrics, channel), [state.metrics, channel])
  const cur = useMemo(() => windowOf(all, range) ?? all, [all, range])
  const prev = useMemo(() => windowOf(all, range, range), [all, range])

  if (!can('analytics.view')) {
    return (
      <div className="page">
        <PageHeader title="Analytics" />
        <Card><EmptyState icon="lock" title="Analytics is not part of your role" body="Ask an owner or manager to add “See analytics” to your access in Team & access." /></Card>
      </div>
    )
  }
  if (!cur.length) {
    return (
      <div className="page">
        <PageHeader title="Analytics" />
        <Card><EmptyState icon="chart" title="No daily numbers yet" body="Once DMs start arriving, each day's DMs, shared numbers, bookings and reply times are added here overnight." /></Card>
      </div>
    )
  }

  const compare = `vs previous ${range} days`
  const labels = cur.map(d => dayLabel(d.date))
  const tipLabels = cur.map(d => dayLabel(d.date, true))
  const f = funnelOf(cur)
  const pf = prev ? funnelOf(prev) : null
  const rt = replyTimes(cur, all)
  const prt = prev ? replyTimes(prev, all) : null
  const replyNow = rt.aiDays ? rt.ai : rt.overall
  const replyPrev = prt ? (prt.aiDays ? prt.ai : prt.overall) : null
  const sla = median(cur.map(d => d.callSlaMetPct)) / 100
  const slaPrev = prev ? median(prev.map(d => d.callSlaMetPct)) / 100 : null
  const revenue = total(cur, 'revenue')
  const aiStartInWindow = cur.findIndex(d => d.aiEra)
  const annotationIndex = aiStartInWindow > 0 ? aiStartInWindow : -1
  const aiStartDate = all.find(d => d.aiEra)?.date
  const contactRate = f.dms ? f.contacts / f.dms : 0
  const before = cur.filter(d => !d.aiEra)
  const after = cur.filter(d => d.aiEra)
  const rateOf = (rows: typeof cur) => {
    const dms = total(rows, 'dms')
    return dms ? total(rows, 'contacts') / dms : NaN
  }
  const split = { ig: cur.reduce((a, d) => a + d.instagram, 0), tt: cur.reduce((a, d) => a + d.tiktok, 0) }
  const splitTotal = split.ig + split.tt || 1
  const rev = revenueByProcedure(state, channel)
  const faster = rt.before / rt.ai

  const lineSubtitle = annotationIndex > 0
    ? `Contact rate ${fmtPct(rateOf(before))} before Instagram autopilot, ${fmtPct(rateOf(after))} since.`
    : aiStartDate && cur[0]?.aiEra
      ? `Instagram autopilot started on ${dayLabel(aiStartDate)}, before this range. Contact rate ${fmtPct(contactRate)}.`
      : `Contact rate ${fmtPct(contactRate)} over the range.`

  const downloadCsv = async () => {
    const file = `northlight-metrics-${range}d-${channel}.csv`
    // saveFile asks the viewer through the preview's downloads capability when there is one, else downloads directly.
    const outcome = await saveFile(file, toCsv(cur, showRevenue), 'text/csv')
    if (outcome === 'saved') {
      actions.audit({ action: 'analytics.export', target: { type: 'settings', id: 'analytics', label: 'Analytics export' }, detail: `Downloaded ${range} days of daily metrics (${CHANNEL_NAME[channel]})${showRevenue ? ', including revenue' : ''}` })
      actions.toast(`Downloaded ${range} days of daily metrics as CSV`, 'success')
    } else if (outcome === 'declined') {
      actions.toast('Download cancelled. Nothing was saved.', 'info')
    } else {
      actions.toast('This browser blocked the download. Try again from a normal browser tab.', 'warn')
    }
  }

  const askClaude = () => window.dispatchEvent(new CustomEvent('lm:open-claude', {
    detail: { prompt: `Look at our analytics for the last ${range} days (${CHANNEL_NAME[channel]}). What moved compared with the previous period, what is driving it, and which one change should we make this week?` },
  }))

  return (
    <div className="page an-page">
      <PageHeader
        title="Analytics"
        subtitle={`${state.settings.orgName} · last ${range} days · ${CHANNEL_NAME[channel]}`}
        actions={<>
          <Button variant="ghost" icon="download" onClick={() => void downloadCsv()}>Download CSV</Button>
          <Button variant="subtle" icon="sparkles" onClick={askClaude}>Ask Claude about these numbers</Button>
        </>}
      />

      <div className="an-filters" role="group" aria-label="Filters for every chart and table on this page">
        <Segmented<string> label="Date range" value={String(range)} onChange={v => setRange(Number(v) as RangeDays)} options={RANGES.map(r => ({ id: String(r), label: `${r} days` }))} />
        <Segmented<ChannelFilter> label="Channel" value={channel} onChange={setChannel} options={[
          { id: 'all', label: 'All channels' }, { id: 'instagram', label: 'Instagram', icon: 'instagram' }, { id: 'tiktok', label: 'TikTok', icon: 'tiktok' },
        ]} />
        {channel !== 'all' && <span className="tiny muted an-filter-note"><Icon name="info" size={13} /> Steps after the DM, replies and revenue are split by each day's {CHANNEL_NAME[channel]} share of DMs. Reply time and call SLA are clinic-wide.</span>}
      </div>

      <section className="an-kpis" aria-label="Key numbers">
        <KpiTile label="DMs received" value={fmtInt(f.dms)} delta={pctDelta(f.dms, pf?.dms, compare)} spark={cur.map(d => d.dms)} sparkLabel="Daily DMs trend" />
        <KpiTile label="Contact rate" value={fmtPct(contactRate, 1)} hint={`${fmtInt(f.contacts)} numbers shared`} delta={ptsDelta(contactRate, pf && pf.dms ? pf.contacts / pf.dms : null, compare)} spark={cur.map(d => (d.dms ? d.contacts / d.dms : 0))} sparkLabel="Daily contact rate trend" />
        <KpiTile label="Consultations booked" value={fmtInt(f.booked)} hint={`${fmtPct(f.contacts ? f.booked / f.contacts : NaN)} of shared numbers`} delta={pctDelta(f.booked, pf?.booked, compare)} spark={cur.map(d => d.booked)} />
        <KpiTile label="Consultations attended" value={fmtInt(f.attended)} hint={`${fmtPct(f.booked ? f.attended / f.booked : NaN)} of bookings turned up`} delta={pctDelta(f.attended, pf?.attended, compare)} spark={cur.map(d => d.attended)} />
        <KpiTile label="Treatments started" value={fmtInt(f.treatments)} hint={`${fmtPct(f.attended ? f.treatments / f.attended : NaN)} of consultations`} delta={pctDelta(f.treatments, pf?.treatments, compare)} spark={cur.map(d => d.treatments)} />
        {showRevenue
          ? <KpiTile label="Revenue" value={money(revenue, currency)} delta={pctDelta(revenue, prev ? total(prev, 'revenue') : null, compare)} spark={cur.map(d => d.revenue)} />
          : <LockedTile label="Revenue" why="Needs revenue access" />}
        <KpiTile label={rt.aiDays ? 'Median first reply (AI era)' : 'Median first reply'} value={fmtDuration(replyNow)}
          hint={rt.aiDays && Number.isFinite(rt.before) ? <>Before AI replies: <b>{fmtDuration(rt.before)}</b>{Number.isFinite(faster) && faster > 1.5 ? ` · ${fmtCompact(faster)}× faster` : ''}</> : undefined}
          delta={pctDelta(replyNow, replyPrev, compare, false)} />
        <KpiTile label="Call SLA met" value={fmtPct(sla)} hint="First call within 15 minutes, median day" delta={ptsDelta(sla, slaPrev, compare)} spark={cur.map(d => d.callSlaMetPct)} />
      </section>

      <ChartCard
        title="DMs and numbers shared, per day"
        subtitle={lineSubtitle}
        legend={<>
          <LegendItem kind="line" color={COLOR.context} label="DMs received" value={fmtInt(f.dms)} />
          <LegendItem kind="line" color={COLOR.focus} label="Numbers shared" value={fmtInt(f.contacts)} />
        </>}
        table={
          <table className="table an-table">
            <thead><tr><th>Day</th><th className="an-r">DMs</th><th className="an-r">Numbers shared</th><th className="an-r">Contact rate</th><th>AI replying</th></tr></thead>
            <tbody>{[...cur].reverse().map(d => (
              <tr key={d.date}><td className="an-nowrap">{dayLabel(d.date, true)}</td><td className="an-r num">{fmtInt(d.dms)}</td><td className="an-r num">{fmtInt(d.contacts)}</td><td className="an-r num">{fmtPct(d.dms ? d.contacts / d.dms : NaN)}</td><td>{d.aiEra ? 'Autopilot' : 'Staff first'}</td></tr>
            ))}</tbody>
          </table>
        }
      >
        <LineChart
          ariaLabel={`Daily DMs and numbers shared over the last ${range} days`}
          labels={labels}
          tipLabels={tipLabels}
          annotation={annotationIndex > 0 ? { index: annotationIndex, label: 'Instagram autopilot on' } : null}
          series={[
            { id: 'dms', label: 'DMs', color: COLOR.context, values: cur.map(d => d.dms) },
            { id: 'contacts', label: 'Numbers', color: COLOR.focus, values: cur.map(d => d.contacts) },
          ]}
        />
      </ChartCard>

      <div className="an-grid">
        <ChartCard
          title="Lead funnel"
          subtitle={`From DM to treatment, last ${range} days. Each step shows how many moved on from the step before.`}
          table={
            <table className="table an-table">
              <thead><tr><th>Step</th><th className="an-r">People</th><th className="an-r">From previous step</th><th className="an-r">Of all DMs</th>{pf && <th className="an-r">Previous period</th>}</tr></thead>
              <tbody>{FUNNEL_STEPS.map((s, i) => (
                <tr key={s.key}><td>{s.label}</td><td className="an-r num">{fmtInt(f[s.key])}</td><td className="an-r num">{i ? fmtPct(f[FUNNEL_STEPS[i - 1].key] ? f[s.key] / f[FUNNEL_STEPS[i - 1].key] : NaN) : '—'}</td><td className="an-r num">{fmtPct(f.dms ? f[s.key] / f.dms : NaN, 1)}</td>{pf && <td className="an-r num">{fmtInt(pf[s.key])}</td>}</tr>
              ))}</tbody>
            </table>
          }
        >
          <FunnelBars funnel={f} />
        </ChartCard>

        <ChartCard
          title="Instagram and TikTok"
          subtitle={channel === 'all' ? 'DMs per day by channel.' : `Showing ${CHANNEL_NAME[channel]} only. Choose All channels to compare.`}
          legend={<>
            {channel !== 'tiktok' && <LegendItem color={COLOR.instagram} label="Instagram" value={`${fmtInt(split.ig)} · ${fmtPct(split.ig / splitTotal)}`} />}
            {channel !== 'instagram' && <LegendItem color={COLOR.tiktok} label="TikTok" value={`${fmtInt(split.tt)} · ${fmtPct(split.tt / splitTotal)}`} />}
          </>}
          table={
            <table className="table an-table">
              <thead><tr><th>Day</th><th className="an-r">Instagram</th><th className="an-r">TikTok</th><th className="an-r">Instagram share</th></tr></thead>
              <tbody>{[...cur].reverse().map(d => (
                <tr key={d.date}><td className="an-nowrap">{dayLabel(d.date, true)}</td><td className="an-r num">{fmtInt(d.instagram)}</td><td className="an-r num">{fmtInt(d.tiktok)}</td><td className="an-r num">{fmtPct(d.instagram + d.tiktok ? d.instagram / (d.instagram + d.tiktok) : NaN)}</td></tr>
              ))}</tbody>
            </table>
          }
        >
          {channel === 'all' && (
            <div className="an-share" role="img" aria-label={`Instagram ${fmtPct(split.ig / splitTotal)}, TikTok ${fmtPct(split.tt / splitTotal)} of DMs`}>
              <span style={{ flexGrow: split.ig, background: COLOR.instagram }} />
              <span style={{ flexGrow: split.tt, background: COLOR.tiktok }} />
            </div>
          )}
          <StackedColumns
            ariaLabel={`DMs per day by channel, last ${range} days`}
            labels={labels}
            tipLabels={tipLabels}
            height={236}
            totalLabel="All DMs"
            series={[
              ...(channel !== 'tiktok' ? [{ id: 'ig', label: 'Instagram', color: COLOR.instagram, values: cur.map(d => d.instagram) }] : []),
              ...(channel !== 'instagram' ? [{ id: 'tt', label: 'TikTok', color: COLOR.tiktok, values: cur.map(d => d.tiktok) }] : []),
            ]}
          />
        </ChartCard>

        <ChartCard
          title="First reply: AI vs staff"
          subtitle={rt.aiDays && Number.isFinite(rt.before)
            ? `Median time to the first reply. AI answers ${fmtCompact(faster)}× faster than staff did before autopilot.`
            : 'Median time to the first reply.'}
          note={rt.aiDays ? `AI: median of ${rt.aiDays} autopilot days in this range. Staff: median of ${rt.beforeDays} days before autopilot${rt.beforeFromRange ? ' in this range' : ', from before this range'}.` : undefined}
          table={
            <table className="table an-table">
              <thead><tr><th>Who replied first</th><th className="an-r">Median first reply</th><th className="an-r">Days measured</th></tr></thead>
              <tbody>
                <tr><td>AI assistant (autopilot)</td><td className="an-r num">{rt.aiDays ? fmtDuration(rt.ai) : '—'}</td><td className="an-r num">{rt.aiDays}</td></tr>
                <tr><td>Staff (before autopilot)</td><td className="an-r num">{fmtDuration(rt.before)}</td><td className="an-r num">{rt.beforeDays}</td></tr>
              </tbody>
            </table>
          }
        >
          <BarList
            ariaLabel="Median first reply time, AI compared with staff"
            format={fmtDuration}
            barHeight={18}
            rows={[
              ...(rt.aiDays ? [{ id: 'ai', label: 'AI assistant, since autopilot', value: rt.ai, color: COLOR.focus, tip: [{ color: COLOR.focus, label: 'median first reply', value: fmtDuration(rt.ai) }, { color: 'transparent', label: 'days measured', value: String(rt.aiDays) }] }] : []),
              { id: 'staff', label: 'Staff, before autopilot', value: rt.before, color: COLOR.context, tip: [{ color: COLOR.context, label: 'median first reply', value: fmtDuration(rt.before) }, { color: 'transparent', label: 'days measured', value: String(rt.beforeDays) }] },
            ]}
          />
        </ChartCard>

        {showRevenue ? (
          <ChartCard
            title="Revenue by procedure"
            subtitle="Accepted and completed treatment plans, all time. Discounts are spread across each plan's procedures."
            note={rev.proposed > 0 ? `Plus ${money(rev.proposed, currency)} in ${rev.proposedPlans} proposed ${rev.proposedPlans === 1 ? 'plan' : 'plans'} not yet accepted.` : undefined}
            table={rev.rows.length ? (
              <table className="table an-table">
                <thead><tr><th>Procedure</th><th className="an-r">Plan value</th><th className="an-r">Plans</th><th className="an-r">Sessions done</th></tr></thead>
                <tbody>{rev.rows.map(r => (
                  <tr key={r.procedureId}><td>{r.name}</td><td className="an-r num">{money(r.value, currency)}</td><td className="an-r num">{r.plans}</td><td className="an-r num">{r.sessionsDone} of {r.sessionsTotal}</td></tr>
                ))}</tbody>
              </table>
            ) : undefined}
          >
            {rev.rows.length ? (
              <BarList
                ariaLabel="Plan value by procedure"
                format={v => fmtMoneyCompact(v, currency)}
                rows={rev.rows.map(r => ({
                  id: r.procedureId, label: r.name, value: r.value, meta: `${r.plans} ${r.plans === 1 ? 'plan' : 'plans'}`,
                  tip: [
                    { color: COLOR.focus, label: 'plan value', value: money(r.value, currency) },
                    { color: 'transparent', label: 'sessions done', value: `${r.sessionsDone} of ${r.sessionsTotal}` },
                    { color: 'transparent', label: 'share of total', value: fmtPct(rev.total ? r.value / rev.total : NaN) },
                  ],
                }))}
              />
            ) : <EmptyState icon="card" title="No accepted plans yet" body="When a client accepts a treatment plan, its value is added here by procedure." />}
          </ChartCard>
        ) : (
          <Card title="Revenue by procedure">
            <div className="an-locked-card">
              <Locked>Revenue figures need the “See revenue figures” permission</Locked>
              <p className="small muted">Owners, managers and finance can see this chart. Ask an owner if you need it.</p>
            </div>
          </Card>
        )}
      </div>

      <SourcesTable range={range} channel={channel} now={now} />
      <LeaderboardTable range={range} channel={channel} now={now} />
      <ReturningTable channel={channel} showRevenue={showRevenue} />
    </div>
  )
}
