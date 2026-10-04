import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, IconButton } from '../../components/ui'
import { Icon } from '../../components/icons'
import { useStore } from '../../lib/store'
import type { Procedure } from '../../lib/types'
import { iso, money, uid } from '../../lib/time'

type NumKey = 'sessions' | 'intervalWeeks' | 'durationMin' | 'price' | 'priceFrom' | 'priceTo' | 'depositPct' | 'minAge'
const NUM_COLS: Array<{ key: NumKey; label: string; short: string; min: number; max: number; step?: number }> = [
  { key: 'sessions', label: 'Sessions', short: 'Sessions', min: 1, max: 24 },
  { key: 'intervalWeeks', label: 'Every (weeks)', short: 'Every (wk)', min: 0, max: 52 },
  { key: 'durationMin', label: 'Duration (min)', short: 'Min', min: 5, max: 720, step: 5 },
  { key: 'price', label: 'Course price', short: 'Price', min: 0, max: 100000, step: 10 },
  { key: 'priceFrom', label: 'Quote from', short: 'From', min: 0, max: 100000, step: 10 },
  { key: 'priceTo', label: 'Quote to', short: 'To', min: 0, max: 100000, step: 10 },
  { key: 'depositPct', label: 'Deposit %', short: 'Deposit %', min: 0, max: 100 },
  { key: 'minAge', label: 'Minimum age', short: 'Min age', min: 18, max: 99 },
]

function problems(p: Procedure): string[] {
  const out: string[] = []
  if (!p.name.trim()) out.push('Add a name')
  if (!p.category.trim()) out.push('Add a category')
  if (p.sessions < 1) out.push('At least 1 session')
  if (p.sessions > 1 && p.intervalWeeks < 1) out.push('Set weeks between sessions')
  if ((p.priceFrom ?? 0) > (p.priceTo ?? 0)) out.push('“From” is higher than “To”')
  if (!p.priceFrom || !p.priceTo) out.push('The AI needs a from–to range')
  if (p.minAge < 18) out.push('Minimum age is 18 or over')
  if (p.depositPct < 0 || p.depositPct > 100) out.push('Deposit must be 0–100%')
  return out
}

export function PriceList() {
  const { state, actions } = useStore()
  const cur = state.settings.currency
  const savedKey = JSON.stringify(state.procedures)
  const [rows, setRows] = useState<Procedure[]>(() => structuredClone(state.procedures))
  useEffect(() => { setRows(JSON.parse(savedKey) as Procedure[]) }, [savedKey])

  const dirty = JSON.stringify(rows) !== savedKey
  const issues = useMemo(() => new Map(rows.map(r => [r.id, problems(r)])), [rows])
  const blocking = rows.filter(r => (issues.get(r.id) ?? []).length > 0).length
  const used = (id: string) => state.plans.some(p => p.items.some(i => i.procedureId === id)) || state.appointments.some(a => a.procedureId === id) || state.episodes.some(e => e.interests.includes(id))
  const isNew = (id: string) => !state.procedures.some(p => p.id === id)

  const patch = (id: string, fn: (p: Procedure) => void) => setRows(rs => rs.map(r => (r.id === id ? (() => { const c = { ...r }; fn(c); return c })() : r)))

  const save = () => {
    if (blocking) return
    const before = new Map(state.procedures.map(p => [p.id, JSON.stringify(p)]))
    const changed = rows.filter(r => before.get(r.id) !== JSON.stringify(r))
    const removed = state.procedures.filter(p => !rows.some(r => r.id === p.id))
    const parts = [
      changed.length && `Changed ${changed.map(c => c.name).join(', ')}`,
      removed.length && `Removed ${removed.map(c => c.name).join(', ')}`,
    ].filter(Boolean).join('; ')
    actions.update(d => {
      d.procedures = rows.map(r => ({ ...r, name: r.name.trim(), category: r.category.trim() }))
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'settings.price_list', target: { type: 'settings', id: 'procedures', label: 'Price list' }, detail: parts || 'Price list saved' })
    })
    actions.toast('Price list saved. The AI quotes the new ranges from its next reply.', 'success')
  }

  const add = () => {
    const id = uid('p')
    setRows(rs => [...rs, { id, name: '', category: '', sessions: 1, intervalWeeks: 0, durationMin: 30, price: 0, priceFrom: 0, priceTo: 0, depositPct: 20, minAge: 18, needsConsent: true }])
    window.setTimeout(() => document.getElementById(`st-pn-${id}`)?.focus(), 30)
  }

  return (
    <div className="stack lg">
      <div className="st-callout st-callout-accent">
        <Icon name="sparkles" size={16} />
        <div className="stack" style={{ gap: 2 }}>
          <p className="small strong">The AI only quotes these ranges</p>
          <p className="small">When someone asks about price in a DM, Claude gives the “from–to” range for that treatment, says the exact price is confirmed at a free consultation, and offers a call. It never quotes the course price, a discount or a treatment that is not on this list. People under the minimum age are not booked and the chat goes to a manager.</p>
        </div>
      </div>
      <Card padded={false}>
        <div className="table-wrap st-price-wrap">
          <table className="table st-price">
            <thead>
              <tr>
                <th>Treatment</th>
                <th>Category</th>
                {NUM_COLS.map(c => <th key={c.key} title={c.label}>{c.short}</th>)}
                <th><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const iss = issues.get(r.id) ?? []
                const outside = r.priceFrom != null && r.priceTo != null && r.priceFrom <= r.priceTo && (r.price < r.priceFrom || r.price > r.priceTo)
                const lock = used(r.id) && !isNew(r.id)
                return (
                  <tr key={r.id} className={iss.length ? 'st-row-bad' : ''}>
                    <td data-label="Treatment" className="st-price-name">
                      <input id={`st-pn-${r.id}`} className="input" aria-label="Treatment name" value={r.name} placeholder="e.g. Microneedling course" onChange={e => patch(r.id, x => { x.name = e.target.value })} />
                      {iss.length > 0 ? <span className="field-error">{iss.join(' · ')}</span>
                        : <span className="tiny muted">AI quotes {money(r.priceFrom ?? 0, cur)}–{money(r.priceTo ?? 0, cur)}{r.depositPct ? ` · ${money(Math.round(r.price * r.depositPct / 100), cur)} deposit` : ' · no deposit'}</span>}
                      {outside && iss.length === 0 && <Chip tone="warn" icon="alert">Course price is outside the quoted range</Chip>}
                    </td>
                    <td data-label="Category">
                      <input className="input" aria-label={`Category for ${r.name || 'new treatment'}`} value={r.category} list="st-categories" onChange={e => patch(r.id, x => { x.category = e.target.value })} />
                    </td>
                    {NUM_COLS.map(c => (
                      <td key={c.key} data-label={c.label}>
                        <input className="input st-num-input num" type="number" inputMode="numeric" min={c.min} max={c.max} step={c.step ?? 1}
                          aria-label={`${c.label} for ${r.name || 'new treatment'}`} value={r[c.key] ?? 0}
                          onChange={e => patch(r.id, x => { x[c.key] = e.target.value === '' ? 0 : Number(e.target.value) })} />
                      </td>
                    ))}
                    <td className="st-price-remove">
                      <IconButton icon="trash" size="sm" tone="danger" label={lock ? `${r.name} is used in plans or bookings, so it can’t be removed` : `Remove ${r.name || 'new treatment'}`} disabled={lock}
                        onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <datalist id="st-categories">{Array.from(new Set(state.procedures.map(p => p.category))).map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="st-card-foot">
          <Button variant="ghost" size="sm" icon="plus" onClick={add}>Add treatment</Button>
          <span className="grow" />
          {dirty && <span className="small muted">{blocking ? `Fix ${blocking} row${blocking > 1 ? 's' : ''} before saving` : 'Unsaved changes'}</span>}
          <Button variant="ghost" disabled={!dirty} onClick={() => setRows(structuredClone(state.procedures))}>Discard</Button>
          <Button variant="primary" disabled={!dirty || blocking > 0} onClick={save}>Save price list</Button>
        </div>
      </Card>
      <p className="tiny muted">Prices in {cur}. Change the currency in Organisation. Treatments used in a plan, booking or lead can be edited but not removed, so past records stay accurate.</p>
    </div>
  )
}
