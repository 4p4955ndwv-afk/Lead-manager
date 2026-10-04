// Notes tab: team notes and clinical notes. Clinical notes are written with clinical.edit and read with clinical.view.
import { useState } from 'react'
import { userName, useStore } from '../../lib/store'
import type { Client } from '../../lib/types'
import { ago, dateTime, useNow } from '../../lib/time'
import { Button, Chip, EmptyState, Locked, UserAvatar } from '../../components/ui'
import { first } from './dialogs'

export function NotesTab({ client }: { client: Client }) {
  const { state, me, can, actions } = useStore()
  const now = useNow(60_000)
  const [text, setText] = useState('')
  const [clinical, setClinical] = useState(false)
  const [filter, setFilter] = useState<'all' | 'team' | 'clinical'>('all')
  const notes = state.notes.filter(n => n.clientId === client.id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const canClinical = can('clinical.edit')
  const seeClinical = can('clinical.view')
  const shown = notes.filter(n => filter === 'all' || (filter === 'clinical' ? n.clinical : !n.clinical))

  const add = () => {
    const t = text.trim()
    if (t.length < 2) return
    const isClinical = clinical && canClinical
    actions.addNote(client.id, t, isClinical)
    setText('')
    setClinical(false)
    actions.toast(isClinical ? 'Clinical note saved. Only clinical staff can read it.' : 'Note saved for the team.', 'success')
  }

  return (
    <div className="stack lg">
      <form className="card card-padded cr-note-form" onSubmit={e => { e.preventDefault(); add() }}>
        <label htmlFor="cr-note" className="field-label">Add a note about {first(client.name)}</label>
        <textarea id="cr-note" className="input" rows={3} value={text} onChange={e => setText(e.target.value)}
          placeholder={clinical ? 'e.g. Patch test clear, proceed at setting 3' : 'e.g. Prefers calls after 6pm; partner usually answers'}
          onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') add() }} />
        <div className="row between wrap">
          {canClinical ? (
            <label className="checkbox"><input type="checkbox" checked={clinical} onChange={e => setClinical(e.target.checked)} />Clinical note (clinical staff only)</label>
          ) : <span className="tiny muted">Visible to everyone who can open this record.</span>}
          <Button type="submit" size="sm" variant="primary" disabled={text.trim().length < 2}>{clinical && canClinical ? 'Save clinical note' : 'Save note'}</Button>
        </div>
      </form>

      {notes.length > 0 && (
        <div className="cr-filter-row" role="group" aria-label="Filter notes">
          {(['all', 'team', 'clinical'] as const).map(f => (
            <button key={f} type="button" className={`cr-quick-btn is-sm ${filter === f ? 'is-active' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              <span>{f === 'all' ? 'All notes' : f === 'team' ? 'Team' : 'Clinical'}</span>
              <span className="cr-quick-count num">{f === 'all' ? notes.length : notes.filter(n => (f === 'clinical') === n.clinical).length}</span>
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <EmptyState icon="edit" title={notes.length ? 'No notes of this kind' : 'No notes yet'} body="Notes are for things the team should know: preferences, what was promised on a call, anything the AI can't see. Add the first one above." />
      ) : (
        <ul className="cr-notes">
          {shown.map(n => (
            <li key={n.id} className={`cr-note ${n.clinical ? 'is-clinical' : ''}`}>
              <UserAvatar userId={n.authorId} size={28} />
              <div className="stack grow" style={{ gap: 4 }}>
                <div className="row wrap" style={{ gap: 6 }}>
                  <span className="small strong">{userName(state, n.authorId)}{n.authorId === me.id ? ' (you)' : ''}</span>
                  {n.clinical && <Chip tone="team" icon="shield">Clinical</Chip>}
                  <time className="tiny muted" dateTime={n.at} title={dateTime(n.at)}>{ago(n.at, now)}</time>
                </div>
                {n.clinical && !seeClinical ? <Locked>Clinical note · restricted to clinical staff</Locked> : <p className="small cr-note-text">{n.text}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
