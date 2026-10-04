// Treatment-plan operations shared by the Treatment plan and Appointments tabs. Each one updates the store,
// writes an audit entry and moves the journey on when the clinic workflow says so.
import type { Actions } from '../../lib/store'
import type { Appointment, DemoState, PlanItem, Session, TreatmentPlan } from '../../lib/types'
import { STAGES } from '../../lib/types'
import { DAY, iso, ms, uid } from '../../lib/time'
import { procName } from './helpers'

/** The appointment behind a session: linked by id, or matched by episode, procedure and session number. */
export function sessionAppt(s: DemoState, plan: TreatmentPlan, item: PlanItem, session: Session): Appointment | undefined {
  if (session.appointmentId) {
    const a = s.appointments.find(x => x.id === session.appointmentId)
    if (a) return a
  }
  return s.appointments.find(a => a.episodeId === plan.episodeId && a.type === 'session' && a.procedureId === item.procedureId && a.sessionNo === session.no && a.status !== 'cancelled')
}

/** Rough date the next session falls due: last done or booked session plus the procedure interval. */
export function estimateDue(s: DemoState, plan: TreatmentPlan, item: PlanItem, session: Session): number | undefined {
  const proc = s.procedures.find(p => p.id === item.procedureId)
  const prev = [...item.sessions].filter(x => x.no < session.no).reverse().find(x => x.date || sessionAppt(s, plan, item, x))
  if (!prev) return undefined
  const base = ms(prev.date ?? sessionAppt(s, plan, item, prev)?.start)
  if (Number.isNaN(base)) return undefined
  return base + Math.max(1, proc?.intervalWeeks ?? 4) * 7 * DAY
}

export function markSessionDone(actions: Actions, s: DemoState, planId: string, itemId: string, no: number) {
  const plan = s.plans.find(p => p.id === planId)
  const item = plan?.items.find(i => i.id === itemId)
  const session = item?.sessions.find(x => x.no === no)
  if (!plan || !item || !session || session.status === 'done') return
  const appt = sessionAppt(s, plan, item, session)
  const client = s.clients.find(c => c.id === plan.clientId)
  const ep = s.episodes.find(e => e.id === plan.episodeId)
  const allDoneAfter = plan.items.every(i => i.sessions.every(x => x.status === 'done' || x.status === 'skipped' || (i.id === itemId && x.no === no)))

  actions.update(d => {
    const p = d.plans.find(x => x.id === planId)!
    const it = p.items.find(x => x.id === itemId)!
    const se = it.sessions.find(x => x.no === no)!
    se.status = 'done'
    se.date = iso(Date.now())
    if (appt) se.appointmentId = appt.id
    if (allDoneAfter) p.status = 'completed'
    d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: d.currentUserId, action: 'plan.session_done', target: { type: 'plan', id: p.id, label: client?.name }, detail: `${procName(d, it.procedureId)}: session ${no} of ${it.sessionsTotal} done` })
  })
  if (appt && appt.status !== 'completed') actions.setAppointmentStatus(appt.id, 'completed')
  if (ep && !ep.exit) {
    if (allDoneAfter && STAGES.indexOf(ep.stage) < STAGES.indexOf('aftercare')) actions.moveStage(ep.id, 'aftercare', { reason: 'All planned sessions complete' })
    else if (STAGES.indexOf(ep.stage) < STAGES.indexOf('treatment')) actions.moveStage(ep.id, 'treatment', { reason: 'First session done' })
  }
  actions.toast(allDoneAfter
    ? `Session ${no} done. That completes ${client?.name.split(' ')[0] ?? 'the client'}'s plan; the journey moved to Aftercare.`
    : `${procName(s, item.procedureId)}: session ${no} of ${item.sessionsTotal} marked done.`, 'success')
}

export function linkSessionBooking(actions: Actions, planId: string, itemId: string, no: number, apptId: string, start: string) {
  actions.update(d => {
    const se = d.plans.find(p => p.id === planId)?.items.find(i => i.id === itemId)?.sessions.find(x => x.no === no)
    if (!se) return
    se.status = 'booked'
    se.appointmentId = apptId
    se.date = start
  })
}
