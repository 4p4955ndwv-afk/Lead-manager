// Search and filters for the pipeline. On phones the filters fold behind a button to keep the board in view.
import { useId, useState } from 'react'
import type { Channel } from '../../lib/types'
import { CHANNEL_LABEL } from '../../lib/types'
import { useStore } from '../../lib/store'
import { Button, Toggle } from '../../components/ui'
import { Icon } from '../../components/icons'
import { activeFilterCount, type Filters } from './model'

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
  ownerIds: string[]
  channels: Channel[]
  shown: number
  total: number
}

export function FilterBar({ filters, onChange, ownerIds, channels, shown, total }: Props) {
  const { state, me, can } = useStore()
  const [open, setOpen] = useState(false)
  const id = useId()
  const n = activeFilterCount(filters)
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v })
  const nonSearch = n - (filters.q.trim() ? 1 : 0)

  return (
    <div className="pl-toolbar" role="search" aria-label="Filter the pipeline">
      <div className="pl-toolbar-main">
        <div className="search-wrap pl-search">
          <Icon name="search" size={16} />
          <label htmlFor={id + 'q'} className="sr-only">Search clients</label>
          <input id={id + 'q'} className="input input-search" type="search" value={filters.q}
            placeholder={can('clients.view_phone') ? 'Name, handle or phone' : 'Name or handle'}
            onChange={e => set('q', e.target.value)} />
        </div>
        <Button className="pl-filter-toggle" variant="secondary" icon="filter" aria-expanded={open} aria-controls={id + 'panel'} onClick={() => setOpen(o => !o)}>
          Filters{nonSearch ? ` (${nonSearch})` : ''}
        </Button>
      </div>

      <div id={id + 'panel'} className={`pl-filters ${open ? 'is-open' : ''}`}>
        <div className="pl-filter">
          <label htmlFor={id + 'owner'} className="sr-only">Owner</label>
          <select id={id + 'owner'} className="input pl-select" value={filters.owner} onChange={e => set('owner', e.target.value)}>
            <option value="all">All owners</option>
            <option value="me">My clients</option>
            <option value="none">No owner yet</option>
            <optgroup label="Team">
              {ownerIds.filter(u => u !== me.id).map(u => <option key={u} value={u}>{state.users.find(x => x.id === u)?.name ?? u}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="pl-filter">
          <label htmlFor={id + 'ch'} className="sr-only">Channel</label>
          <select id={id + 'ch'} className="input pl-select" value={filters.channel} onChange={e => set('channel', e.target.value as Filters['channel'])}>
            <option value="all">All channels</option>
            {channels.map(c => <option key={c} value={c}>{CHANNEL_LABEL[c]}</option>)}
          </select>
        </div>
        <div className="pl-filter">
          <label htmlFor={id + 'br'} className="sr-only">Branch</label>
          <select id={id + 'br'} className="input pl-select" value={filters.branch} onChange={e => set('branch', e.target.value)}>
            <option value="all">All branches</option>
            {state.branches.map(b => <option key={b.id} value={b.id}>{b.name}, {b.city}</option>)}
          </select>
        </div>
        <div className="pl-filter">
          <label htmlFor={id + 'pr'} className="sr-only">Procedure interest</label>
          <select id={id + 'pr'} className="input pl-select" value={filters.proc} onChange={e => set('proc', e.target.value)}>
            <option value="all">All procedures</option>
            {state.procedures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="pl-filter pl-filter-toggle-wrap">
          <Toggle checked={filters.overdue} onChange={v => set('overdue', v)} label="Has overdue call" />
        </div>
        <div className="pl-filter-status">
          <span className="small muted num" aria-live="polite">{n ? `${shown} of ${total} shown` : `${total} clients`}</span>
          {n > 0 && <Button size="sm" variant="ghost" icon="x" onClick={() => onChange({ q: '', owner: 'all', channel: 'all', branch: 'all', proc: 'all', overdue: false })}>Clear filters</Button>}
        </div>
      </div>
    </div>
  )
}
