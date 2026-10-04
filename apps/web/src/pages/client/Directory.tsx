// Client directory: every person the clinic knows, searchable and filterable, plus "Add lead manually".
import { useMemo, useState } from 'react'
import { useStore } from '../../lib/store'
import type { Channel, Exit, Stage } from '../../lib/types'
import { CHANNEL_LABEL, EXITS, EXIT_LABEL, STAGES, STAGE_LABEL } from '../../lib/types'
import { maskPhone } from '../../lib/permissions'
import { DAY, ago, dateTime, ms, useNow } from '../../lib/time'
import { Avatar, Button, ChannelBadge, Chip, EmptyState, PageHeader, StageBadge, UserAvatar } from '../../components/ui'
import { Icon } from '../../components/icons'
import { AddLeadModal } from './AddLead'
import { handlesOf, lastActivity, latestEpisode, langLabel, scoreTone } from './helpers'

type Quick = 'all' | 'mine' | 'call' | 'new' | 'treatment' | 'off'
type Sort = 'activity' | 'score' | 'name' | 'newest'

export function Directory() {
  const { state, me, can, actions } = useStore()
  const now = useNow(60_000)
  const [q, setQ] = useState('')
  const [quick, setQuick] = useState<Quick>('all')
  const [stage, setStage] = useState<string>('any')
  const [owner, setOwner] = useState<string>('any')
  const [source, setSource] = useState<string>('any')
  const [sort, setSort] = useState<Sort>('activity')
  const [addOpen, setAddOpen] = useState(false)
  const showPhone = can('clients.view_phone')
  const canAdd = can('clients.edit')

  const rows = useMemo(() => state.clients.map(c => {
    const ep = latestEpisode(state, c.id)
    const epCount = state.episodes.filter(e => e.clientId === c.id).length
    const openCall = state.tasks.filter(t => t.clientId === c.id && t.status === 'open' && (t.type === 'call' || t.type === 'callback')).sort((a, b) => ms(a.dueAt) - ms(b.dueAt))[0]
    return { c, ep, epCount, openCall, last: lastActivity(state, c.id, now) }
  }), [state, now])

  const quickCounts: Record<Quick, number> = useMemo(() => ({
    all: rows.length,
    mine: rows.filter(r => r.c.ownerId === me.id).length,
    call: rows.filter(r => r.openCall).length,
    new: rows.filter(r => now - ms(r.c.createdAt) < 7 * DAY).length,
    treatment: rows.filter(r => r.ep && !r.ep.exit && (r.ep.stage === 'treatment' || r.ep.stage === 'plan')).length,
    off: rows.filter(r => r.ep?.exit).length,
  }), [rows, me.id, now])

  const owners = useMemo(() => {
    const ids = new Set(state.clients.map(c => c.ownerId).filter((x): x is string => !!x))
    return state.users.filter(u => ids.has(u.id))
  }, [state.clients, state.users])

  const sources = useMemo(() => Array.from(new Set(state.clients.map(c => c.source.channel))) as Channel[], [state.clients])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const digits = s.replace(/\D/g, '')
    let list = rows.filter(r => {
      const { c, ep } = r
      if (s) {
        const hay = [c.name, c.email ?? '', c.handles.instagram ?? '', c.handles.tiktok ?? '', c.tags.join(' '), c.source.detail].join(' ').toLowerCase()
        const phoneHit = showPhone && digits.length >= 3 && (c.phone ?? '').replace(/\D/g, '').includes(digits.replace(/^0/, ''))
        if (!hay.includes(s) && !phoneHit) return false
      }
      if (quick === 'mine' && c.ownerId !== me.id) return false
      if (quick === 'call' && !r.openCall) return false
      if (quick === 'new' && now - ms(c.createdAt) >= 7 * DAY) return false
      if (quick === 'treatment' && !(ep && !ep.exit && (ep.stage === 'treatment' || ep.stage === 'plan'))) return false
      if (quick === 'off' && !ep?.exit) return false
      if (stage !== 'any') {
        if (!ep) return false
        if ((EXITS as string[]).includes(stage)) { if (ep.exit !== stage) return false }
        else if (ep.exit || ep.stage !== stage) return false
      }
      if (owner === 'none' && c.ownerId) return false
      if (owner !== 'any' && owner !== 'none' && c.ownerId !== owner) return false
      if (source !== 'any' && c.source.channel !== source) return false
      return true
    })
    list = [...list].sort((a, b) => {
      if (sort === 'score') return b.c.score - a.c.score
      if (sort === 'name') return a.c.name.localeCompare(b.c.name)
      if (sort === 'newest') return ms(b.c.createdAt) - ms(a.c.createdAt)
      return (ms(b.last) || 0) - (ms(a.last) || 0)
    })
    return list
  }, [rows, q, quick, stage, owner, source, sort, me.id, now, showPhone])

  const filtersOn = q || quick !== 'all' || stage !== 'any' || owner !== 'any' || source !== 'any'
  const clearAll = () => { setQ(''); setQuick('all'); setStage('any'); setOwner('any'); setSource('any') }

  const QUICK: { id: Quick; label: string; hide?: boolean }[] = [
    { id: 'all', label: 'Everyone' },
    { id: 'mine', label: 'My clients', hide: quickCounts.mine === 0 },
    { id: 'call', label: 'Waiting for a call' },
    { id: 'new', label: 'New this week' },
    { id: 'treatment', label: 'Plan or treatment' },
    { id: 'off', label: 'Off the path' },
  ]

  return (
    <div className="page cr-dir">
      <PageHeader
        eyebrow="Clients"
        title="Client directory"
        subtitle={`${rows.length} people · ${rows.filter(r => r.ep && !r.ep.exit && r.ep.stage !== 'alumni').length} on an active journey. Leads from DMs appear here automatically.`}
        actions={canAdd
          ? <Button variant="primary" icon="userPlus" onClick={() => setAddOpen(true)}>Add lead manually</Button>
          : <span className="locked"><Icon name="lock" size={14} />Adding leads needs edit access</span>}
      />

      <div className="cr-quick" role="group" aria-label="Quick filters">
        {QUICK.filter(x => !x.hide).map(x => (
          <button key={x.id} type="button" className={`cr-quick-btn ${quick === x.id ? 'is-active' : ''} ${x.id === 'call' && quickCounts.call ? 'is-alert' : ''}`} aria-pressed={quick === x.id} onClick={() => setQuick(x.id)}>
            <span>{x.label}</span>
            <span className="cr-quick-count num">{quickCounts[x.id]}</span>
          </button>
        ))}
      </div>

      <div className="cr-dir-filters">
        <div className="search-wrap cr-dir-search">
          <Icon name="search" size={16} />
          <input className="input input-search" type="search" value={q} onChange={e => setQ(e.target.value)}
            placeholder={showPhone ? 'Name, handle, phone or tag' : 'Name, handle, email or tag'} aria-label="Search clients" />
        </div>
        <select className="input cr-dir-select" value={stage} onChange={e => setStage(e.target.value)} aria-label="Filter by stage">
          <option value="any">Any stage</option>
          <optgroup label="On the path">
            {STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s as Stage]}</option>)}
          </optgroup>
          <optgroup label="Off the path">
            {EXITS.map(x => <option key={x} value={x}>{EXIT_LABEL[x as Exit]}</option>)}
          </optgroup>
        </select>
        <select className="input cr-dir-select" value={owner} onChange={e => setOwner(e.target.value)} aria-label="Filter by owner">
          <option value="any">Any owner</option>
          <option value="none">Unassigned</option>
          {owners.map(u => <option key={u.id} value={u.id}>{u.name}{u.id === me.id ? ' (you)' : ''}</option>)}
        </select>
        <select className="input cr-dir-select" value={source} onChange={e => setSource(e.target.value)} aria-label="Filter by how they came in">
          <option value="any">Any source</option>
          {sources.map(ch => <option key={ch} value={ch}>{CHANNEL_LABEL[ch]}</option>)}
        </select>
        <select className="input cr-dir-select" value={sort} onChange={e => setSort(e.target.value as Sort)} aria-label="Sort clients">
          <option value="activity">Latest activity</option>
          <option value="score">Highest score</option>
          <option value="newest">Newest first</option>
          <option value="name">Name A–Z</option>
        </select>
      </div>

      <div className="row between wrap cr-dir-count">
        <span className="small muted" aria-live="polite">{filtered.length === rows.length ? `Showing all ${rows.length}` : `Showing ${filtered.length} of ${rows.length}`}</span>
        {filtersOn && <Button size="sm" variant="ghost" icon="x" onClick={clearAll}>Clear filters</Button>}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon="search" title="No clients match these filters"
            body={q ? `Nobody matches “${q}”. Check the spelling, search by handle, or clear the filters.` : 'Try another stage, owner or source, or clear the filters to see everyone.'}
            action={<div className="row wrap" style={{ justifyContent: 'center' }}>
              <Button size="sm" onClick={clearAll}>Clear filters</Button>
              {canAdd && <Button size="sm" variant="primary" icon="userPlus" onClick={() => setAddOpen(true)}>Add lead manually</Button>}
            </div>} />
        </div>
      ) : (
        <div className="table-wrap cr-dir-wrap">
          <table className="table cr-dir-table">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Handles</th>
                <th scope="col">Stage</th>
                <th scope="col">Owner</th>
                <th scope="col">Last activity</th>
                <th scope="col" className="cr-th-score">Score</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ c, ep, epCount, openCall, last }) => {
                const hs = handlesOf(c)
                const ownerUser = state.users.find(u => u.id === c.ownerId)
                return (
                  <tr key={c.id} className="is-clickable" onClick={() => actions.go('client', c.id)}>
                    <td className="cr-td-client">
                      <div className="row">
                        <Avatar name={c.name} size={34} />
                        <div className="stack" style={{ gap: 1 }}>
                          <button type="button" className="cr-link strong" onClick={e => { e.stopPropagation(); actions.go('client', c.id) }}>{c.name}</button>
                          <span className="row wrap cr-sub">
                            {hs.length === 0 && <span className="tiny muted">{maskPhone(c.phone, false)} · via {CHANNEL_LABEL[c.source.channel]}</span>}
                            {c.language !== 'en' && <span className="tiny muted">{langLabel(c.language)}</span>}
                            {epCount > 1 && <Chip tone="team">Returning · Ep {ep?.number}</Chip>}
                            {c.doNotContact && <Chip tone="danger" icon="alert">Do not contact</Chip>}
                            {c.tags.map(t => <Chip key={t}>{t}</Chip>)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="cr-td-handles">
                      {hs.length ? (
                        <span className="row wrap" style={{ gap: 6 }}>
                          {hs.map(h => (
                            <span key={h.channel} className="cr-handle" title={`${h.channel === 'instagram' ? 'Instagram' : 'TikTok'} ${h.handle}`}>
                              <ChannelBadge channel={h.channel} label={false} size="sm" />
                              <span className="truncate">{h.handle}</span>
                            </span>
                          ))}
                        </span>
                      ) : <ChannelBadge channel={c.source.channel} size="sm" />}
                    </td>
                    <td className="cr-td-stage">
                      <span className="row wrap" style={{ gap: 6 }}>
                        {ep ? <StageBadge stage={ep.stage} exit={ep.exit} /> : <span className="faint">—</span>}
                        {openCall && (ms(openCall.dueAt) < now ? <Chip tone="danger" icon="phone">Call overdue</Chip> : <Chip tone={openCall.escalationLevel ? 'danger' : 'warn'} icon="phone">Call due</Chip>)}
                      </span>
                    </td>
                    <td className="cr-td-owner">
                      {ownerUser ? (
                        <span className="row" style={{ gap: 6 }}>
                          <UserAvatar userId={ownerUser.id} size={22} />
                          <span className="truncate small">{ownerUser.name}{ownerUser.id === me.id ? ' (you)' : ''}</span>
                        </span>
                      ) : <span className="small faint">Unassigned</span>}
                    </td>
                    <td className="cr-td-activity">
                      <span className="small" title={last ? dateTime(last) : undefined}>{last ? ago(last, now) : '—'}</span>
                    </td>
                    <td className="cr-td-score">
                      <span className={`cr-score cr-score-${scoreTone(c.score)}`} title="Lead score from the AI (0–100)" aria-label={`Lead score ${c.score} out of 100`}>
                        <span className="num strong">{c.score}</span>
                        <span className="cr-score-bar" aria-hidden="true"><span style={{ width: `${c.score}%` }} /></span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <AddLeadModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
