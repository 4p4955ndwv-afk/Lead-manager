import { Fragment } from 'react'
import { Icon } from '../../components/icons'
import { useStore } from '../../lib/store'
import { ROLE_LABEL } from '../../lib/types'
import { PERMISSIONS, ROLE_TEMPLATES } from '../../lib/permissions'
import { ROLES, ROLE_INFO, SENSITIVE, groupedPermissions, realOverrides } from './roles'

export function RolesMatrix() {
  const { state } = useStore()
  const people = (r: string) => state.users.filter(u => u.role === r && u.status !== 'suspended').length
  const withOverrides = state.users.filter(u => realOverrides(u).length > 0)

  return (
    <div className="stack lg">
      <div className="tm-callout tm-callout-row">
        <Icon name="info" size={16} />
        <p className="small">
          Role templates are starting points. Access is set per person: open someone’s permissions from People to grant or remove a single permission,
          with a reason saved in the audit log.{' '}
          {withOverrides.length > 0
            ? <>Right now {withOverrides.map(u => u.name).join(', ')} {withOverrides.length > 1 ? 'have' : 'has'} personal overrides.</>
            : <>No one has personal overrides right now.</>}
        </p>
      </div>

      <div className="tm-matrix-wrap" tabIndex={0} role="region" aria-label="Permissions by role (scrolls sideways)">
        <table className="tm-matrix">
          <thead>
            <tr>
              <th scope="col" className="tm-matrix-corner">Permission</th>
              {ROLES.map(r => (
                <th key={r} scope="col" title={ROLE_INFO[r].summary}>
                  <span className="tm-matrix-role">{ROLE_LABEL[r]}</span>
                  <span className="tm-matrix-sub num">{ROLE_TEMPLATES[r].length}/{PERMISSIONS.length} · {people(r)} {people(r) === 1 ? 'person' : 'people'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupedPermissions().map(g => (
              <Fragment key={g.group}>
                <tr className="tm-matrix-group">
                  <th scope="rowgroup" className="tm-matrix-first">{g.group}</th>
                  <td colSpan={ROLES.length} />
                </tr>
                {g.items.map(p => (
                  <tr key={p.id}>
                    <th scope="row" className="tm-matrix-first">
                      <span className="tm-matrix-perm">{p.label}</span>
                      {SENSITIVE.includes(p.id) && <span className="tm-matrix-sens" role="img" aria-label="Sensitive" title="Sensitive"><Icon name="shield" size={13} /></span>}
                    </th>
                    {ROLES.map(r => {
                      const on = ROLE_TEMPLATES[r].includes(p.id)
                      return (
                        <td key={r} className={on ? 'is-on' : ''}>
                          {on ? <span role="img" aria-label="Allowed"><Icon name="check" size={16} /></span> : <span className="tm-matrix-no" aria-label="Not allowed" role="img">–</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tm-role-cards">
        {ROLES.map(r => (
          <div key={r} className="card card-padded tm-role-card">
            <div className="row between">
              <h3>{ROLE_LABEL[r]}</h3>
              <span className="tiny muted num">{people(r)} {people(r) === 1 ? 'person' : 'people'}</span>
            </div>
            <p className="small muted">{ROLE_INFO[r].summary}</p>
            <p className="small"><b>Can:</b> {ROLE_INFO[r].can}</p>
            <p className="small"><b>Cannot:</b> {ROLE_INFO[r].cannot}</p>
          </div>
        ))}
      </div>
      <p className="tiny muted row" style={{ gap: 6 }}><Icon name="shield" size={13} /> Sensitive permissions expose personal, clinical or financial data, or change who can do what. Every use is recorded.</p>
    </div>
  )
}
