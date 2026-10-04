// Overview: one merged timeline of everything that happened with this person, newest first.
import { useMemo, useState, type ReactNode } from 'react'
import { userName, useStore } from '../../lib/store'
import type { Client, Episode, Exit, Stage } from '../../lib/types'
import { CHANNEL_LABEL, EXITS, EXIT_LABEL, STAGE_LABEL } from '../../lib/types'
import { ago, dateTime, money, ms, startOfDay, useNow } from '../../lib/time'
import { Button, Chip, EmptyState, Locked, UserAvatar, type Tone } from '../../components/ui'
import { Icon, type IconName } from '../../components/icons'
import { APPT_STATUS_LABEL, CALL_OUTCOME_LABEL, DOC_KIND_ICON, DOC_KIND_LABEL, PAY_KIND_LABEL, apptTitle } from './helpers'

type Kind = 'message' | 'journey' | 'call' | 'visit' | 'money' | 'note'

interface Item {
  id: string
  at: string
  kind: Kind
  icon: IconName
  tone: Tone
  title: ReactNode
  body?: ReactNode
  who?: string
  chips?: ReactNode
}

const label = (x: Stage | Exit) => (EXITS as string[]).includes(x) ? EXIT_LABEL[x as Exit] : STAGE_LABEL[x as Stage]

export function Overview({ client, episodes }: { client: Client; episodes: Episode[] }) {
  const { state, can } = useStore()
  const now = useNow(60_000)
  const [filter, setFilter] = useState<'all' | Kind>('all')
  const [limit, setLimit] = useState(25)
  const clinical = can('clinical.view')
  const money_ = can('payments.view')
  const multi = episodes.length > 1
  const cur = state.settings.currency

  const items = useMemo(() => {
    const out: Item[] = []
    const first = client.name.split(' ')[0]

    // messages, summarised per conversation per day
    state.conversations.filter(c => c.clientId === client.id).forEach(c => {
      const groups = new Map<number, typeof c.messages>()
      c.messages.filter(m => m.author !== 'system').forEach(m => {
        const k = startOfDay(ms(m.at))
        groups.set(k, [...(groups.get(k) ?? []), m])
      })
      groups.forEach((msgs, day) => {
        const last = msgs[msgs.length - 1]
        const fromClient = msgs.filter(m => m.author === 'client').length
        const ai = msgs.filter(m => m.author === 'ai' && m.status !== 'shadow').length
        const staff = msgs.filter(m => m.author === 'human').length
        const shadow = msgs.filter(m => m.status === 'shadow').length
        const who = last.author === 'client' ? first : last.author === 'ai' ? 'AI' : last.userId ? userName(state, last.userId).split(' ')[0] : 'Staff'
        const flags = Array.from(new Set(msgs.flatMap(m => m.flags ?? [])))
        out.push({
          id: `m_${c.id}_${day}`, at: last.at, kind: 'message', icon: c.channel === 'instagram' ? 'instagram' : c.channel === 'tiktok' ? 'tiktok' : c.channel === 'whatsapp' ? 'whatsapp' : 'message',
          tone: c.channel === 'instagram' ? 'ig' : c.channel === 'tiktok' ? 'tt' : 'info',
          title: `${msgs.length} message${msgs.length > 1 ? 's' : ''} on ${CHANNEL_LABEL[c.channel]}`,
          body: <span className="cr-quote">{who}: “{last.text.length > 160 ? last.text.slice(0, 157) + '…' : last.text}”</span>,
          chips: <>
            {fromClient > 0 && <Chip>{fromClient} from {first}</Chip>}
            {ai > 0 && <Chip tone="accent" icon="sparkles">{ai} AI</Chip>}
            {staff > 0 && <Chip tone="team">{staff} staff</Chip>}
            {shadow > 0 && <Chip tone="neutral">{shadow} shadow draft{shadow > 1 ? 's' : ''}</Chip>}
            {flags.includes('phone_detected') && <Chip tone="warn" icon="phone">Shared a number</Chip>}
            {flags.includes('clinical') && <Chip tone="team" icon="shield">Clinical question</Chip>}
            {flags.includes('price') && <Chip>Asked about price</Chip>}
          </>,
        })
      })
    })

    // journey moves
    episodes.forEach(ep => ep.history.forEach((h, i) => {
      const isExit = (EXITS as string[]).includes(h.to)
      out.push({
        id: `j_${ep.id}_${i}`, at: h.at, kind: 'journey', icon: isExit ? 'flag' : i === 0 ? 'play' : 'arrowRight', tone: h.override ? 'warn' : isExit ? 'danger' : 'accent',
        title: i === 0 ? `${multi ? `Episode ${ep.number} started` : 'Journey started'} at ${label(h.to)}` : isExit ? `Left the path: ${label(h.to)}` : h.from && (EXITS as string[]).includes(h.from) ? `Back on the path at ${label(h.to)}` : `Moved to ${label(h.to)}`,
        body: h.reason ? <span className="cr-quote">“{h.reason}”</span> : undefined,
        who: h.by,
        chips: <>{multi && <Chip tone="team">Episode {ep.number}</Chip>}{h.override && <Chip tone="warn" icon="flag">Override</Chip>}</>,
      })
    }))

    // calls
    state.tasks.filter(t => t.clientId === client.id).forEach(t => t.attempts.forEach((a, i) => out.push({
      id: `c_${t.id}_${i}`, at: a.at, kind: 'call', icon: 'phone', tone: a.outcome === 'booked' ? 'ok' : a.outcome === 'no_answer' ? 'warn' : a.outcome === 'not_interested' || a.outcome === 'wrong_number' ? 'danger' : 'info',
      title: `Call: ${CALL_OUTCOME_LABEL[a.outcome].toLowerCase()}`, body: a.note ? <span className="cr-quote">“{a.note}”</span> : undefined, who: a.by,
    })))

    // visits that have happened (upcoming ones live in Next up)
    state.appointments.filter(a => a.clientId === client.id && ms(a.start) <= now).forEach(a => out.push({
      id: `a_${a.id}`, at: a.start, kind: 'visit', icon: 'calendar', tone: a.status === 'completed' ? 'ok' : a.status === 'no_show' ? 'danger' : a.status === 'cancelled' ? 'neutral' : 'team',
      title: apptTitle(state, a), body: `${APPT_STATUS_LABEL[a.status]} · ${userName(state, a.practitionerId)} · ${state.rooms.find(r => r.id === a.roomId)?.name ?? ''}`,
    }))

    // money
    if (money_) state.payments.filter(p => p.clientId === client.id).forEach(p => {
      if (p.status === 'paid' && p.paidAt) out.push({ id: `p_${p.id}`, at: p.paidAt, kind: 'money', icon: 'card', tone: 'ok', title: <>Payment received · <span className="num">{money(p.amount, cur)}</span></>, body: `${PAY_KIND_LABEL[p.kind]}${p.method ? ` · ${p.method.replace(/_/g, ' ')}` : ''}` })
      else if (p.status === 'overdue') out.push({ id: `p_${p.id}`, at: p.dueAt, kind: 'money', icon: 'alert', tone: 'danger', title: <>{PAY_KIND_LABEL[p.kind]} overdue · <span className="num">{money(p.amount, cur)}</span></>, body: 'Finance has a task to chase it.' })
      else if (p.status === 'refunded') out.push({ id: `p_${p.id}`, at: p.paidAt ?? p.dueAt, kind: 'money', icon: 'refresh', tone: 'neutral', title: <>{PAY_KIND_LABEL[p.kind]} refunded · <span className="num">{money(p.amount, cur)}</span></> })
    })

    // notes and documents
    state.notes.filter(n => n.clientId === client.id).forEach(n => out.push({
      id: `n_${n.id}`, at: n.at, kind: 'note', icon: n.clinical ? 'shield' : 'edit', tone: n.clinical ? 'team' : 'neutral', title: n.clinical ? 'Clinical note' : 'Note', who: n.authorId,
      body: n.clinical && !clinical ? <Locked>Clinical note · restricted to clinical staff</Locked> : n.text,
    }))
    state.documents.filter(d => d.clientId === client.id).forEach(d => out.push({
      id: `d_${d.id}`, at: d.at, kind: 'note', icon: DOC_KIND_ICON[d.kind], tone: d.restricted ? 'team' : 'neutral',
      title: d.restricted && !clinical ? DOC_KIND_LABEL[d.kind] : `${DOC_KIND_LABEL[d.kind]}: ${d.title}`,
      body: d.restricted && !clinical ? <Locked /> : d.kind === 'consent_form' ? (d.signed ? 'Signed' : 'Waiting for signature') : undefined,
    }))

    return out.sort((a, b) => ms(b.at) - ms(a.at))
  }, [state, client, episodes, now, clinical, money_, multi, cur])

  const FILTERS: { id: 'all' | Kind; label: string; hide?: boolean }[] = [
    { id: 'all', label: 'Everything' }, { id: 'message', label: 'Messages' }, { id: 'journey', label: 'Journey' }, { id: 'call', label: 'Calls' },
    { id: 'visit', label: 'Visits' }, { id: 'money', label: 'Payments', hide: !money_ }, { id: 'note', label: 'Notes & documents' },
  ]
  const shown = items.filter(i => filter === 'all' || i.kind === filter)

  return (
    <div className="stack lg">
      <div className="cr-filter-row" role="group" aria-label="Filter the timeline">
        {FILTERS.filter(f => !f.hide).map(f => {
          const n = f.id === 'all' ? items.length : items.filter(i => i.kind === f.id).length
          return (
            <button key={f.id} type="button" className={`cr-quick-btn is-sm ${filter === f.id ? 'is-active' : ''}`} aria-pressed={filter === f.id} onClick={() => { setFilter(f.id); setLimit(25) }} disabled={n === 0 && f.id !== 'all'}>
              <span>{f.label}</span><span className="cr-quick-count num">{n}</span>
            </button>
          )
        })}
      </div>
      {shown.length === 0 ? (
        <EmptyState icon="history" title="Nothing here yet" body="Messages, calls, stage moves, visits, payments and notes appear here as they happen." />
      ) : (
        <ol className="cr-timeline">
          {shown.slice(0, limit).map(it => (
            <li key={it.id} className="cr-tl-item">
              <span className={`cr-tl-icon tone-${it.tone}`} aria-hidden="true"><Icon name={it.icon} size={14} /></span>
              <div className="cr-tl-body">
                <div className="cr-tl-head">
                  <span className="strong small">{it.title}</span>
                  <time className="tiny muted num" dateTime={it.at} title={dateTime(it.at)}>{ago(it.at, now)}</time>
                </div>
                {it.body && <div className="small cr-tl-text">{it.body}</div>}
                {(it.chips || it.who) && (
                  <div className="row wrap cr-tl-meta">
                    {it.who && (
                      <span className="row tiny muted" style={{ gap: 5 }}>
                        {it.who === 'system' ? <Icon name="settings" size={13} /> : <UserAvatar userId={it.who} size={16} />}
                        {userName(state, it.who)}
                      </span>
                    )}
                    {it.chips}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
      {shown.length > limit && (
        <Button variant="ghost" icon="chevronDown" onClick={() => setLimit(l => l + 25)}>Show {Math.min(25, shown.length - limit)} older</Button>
      )}
    </div>
  )
}
