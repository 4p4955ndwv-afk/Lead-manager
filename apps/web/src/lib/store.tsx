import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import type {
  AiMode, Appointment, AuditEntry, CallOutcome, Channel, Conversation, DemoState, Episode, Exit, Message, Notification,
  PageId, Permission, Role, Stage, Task, User,
} from './types'
import { STAGES } from './types'
import { can as canDo } from './permissions'
import { DAY, HOUR, MIN, fromNow, iso, ms, shiftTimestamps, uid } from './time'
import { callBrief, claudeDraft, detectFlags, extractPhone, ruleDraft } from './ai'
import { getClaude, claudeErrorText } from './claude'
import { seed, SEED_VERSION, newLeadScript } from './seed'

const STORAGE_KEY = 'lead-manager-demo'

// ---------------------------------------------------------------------------------------------
// state container

type Action = { type: 'replace'; state: DemoState } | { type: 'update'; fn: (draft: DemoState) => void }

function reducer(state: DemoState, action: Action): DemoState {
  if (action.type === 'replace') return action.state
  const draft = structuredClone(state)
  action.fn(draft)
  return draft
}

function loadInitial(): DemoState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as DemoState
      if (saved.version === SEED_VERSION) {
        const delta = Date.now() - ms(saved.now)
        const shifted = shiftTimestamps(saved, delta)
        shifted.now = iso(Date.now())
        return shifted
      }
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return seed()
}

// ---------------------------------------------------------------------------------------------
// routing (kept in the store so any page can navigate)

export interface Route { page: PageId; id?: string }

function parseHash(): Route {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '')
  const [page, id] = h.split('~')
  const pages: PageId[] = ['today', 'inbox', 'pipeline', 'client', 'tasks', 'calendar', 'ai', 'analytics', 'team', 'settings']
  return pages.includes(page as PageId) ? { page: page as PageId, id: id || undefined } : { page: 'today' }
}

// ---------------------------------------------------------------------------------------------
// public API

export interface Toast { id: string; text: string; tone: 'info' | 'success' | 'warn' | 'danger'; action?: { label: string; page: PageId; id?: string } }

export interface Actions {
  /** Escape hatch: mutate a draft copy of the whole state. Use for page-specific changes. */
  update: (fn: (draft: DemoState) => void) => void
  setUser: (userId: string) => void
  go: (page: PageId, id?: string) => void
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void
  audit: (e: Omit<AuditEntry, 'id' | 'at' | 'actor'> & { actor?: AuditEntry['actor'] }) => void
  notify: (to: { userIds?: string[]; roles?: Role[] }, n: Omit<Notification, 'id' | 'at' | 'userId' | 'read'>) => void
  markRead: (notificationId: string) => void
  markAllRead: () => void
  moveStage: (episodeId: string, to: Stage | Exit, opts?: { reason?: string; override?: boolean; by?: string }) => void
  sendMessage: (conversationId: string, m: { author: 'human' | 'ai'; text: string; humanAgentTag?: boolean }) => void
  setHandling: (conversationId: string, handling: Conversation['handling'], reason?: string) => void
  assignConversation: (conversationId: string, userId: string) => void
  approveDraft: (conversationId: string, editedText?: string) => void
  discardDraft: (conversationId: string) => void
  regenerateDraft: (conversationId: string, useClaude: boolean) => Promise<string | null>
  receiveMessage: (conversationId: string, text: string) => void
  simulateNewLead: (channel?: Channel) => string
  logCall: (taskId: string, outcome: CallOutcome, details?: { note?: string; start?: string; procedureId?: string; practitionerId?: string; depositDueAt?: string; callbackAt?: string }) => void
  assignTask: (taskId: string, userId: string) => void
  completeTask: (taskId: string, note?: string) => void
  bookAppointment: (a: Omit<Appointment, 'id' | 'reminders' | 'status'> & { status?: Appointment['status'] }) => string
  setAppointmentStatus: (appointmentId: string, status: Appointment['status'], reason?: string) => void
  setKillSwitch: (on: boolean, reason: string) => void
  setAiMode: (channel: 'instagram' | 'tiktok' | 'whatsapp', mode: AiMode, reason?: string) => void
  addNote: (clientId: string, text: string, clinical: boolean) => void
  resetDemo: () => void
}

export interface StoreValue {
  state: DemoState
  me: User
  can: (p: Permission) => boolean
  route: Route
  toasts: Toast[]
  dismissToast: (id: string) => void
  actions: Actions
  /** true while a live-Claude request started from the UI is running */
  claudeBusy: boolean
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const v = useContext(StoreContext)
  if (!v) throw new Error('useStore must be used inside <StoreProvider>')
  return v
}

// helpers usable from pages ------------------------------------------------------------------

export const byId = <T extends { id: string }>(list: T[], id: string | undefined): T | undefined => (id ? list.find(x => x.id === id) : undefined)
export const userName = (s: DemoState, id: string | undefined | 'ai' | 'system' | 'claude'): string => {
  if (!id) return '—'
  if (id === 'ai') return 'AI assistant'
  if (id === 'system') return 'System'
  if (id === 'claude') return 'Claude'
  return s.users.find(u => u.id === id)?.name ?? 'Unknown'
}
export const activeEpisode = (s: DemoState, clientId: string): Episode | undefined =>
  s.episodes.filter(e => e.clientId === clientId).sort((a, b) => b.number - a.number)[0]

function onShift(s: DemoState, role: Role): User | undefined {
  const pool = s.users.filter(u => u.role === role && u.status === 'active')
  return pool.find(u => u.onShift) ?? pool[0]
}

// ---------------------------------------------------------------------------------------------
// provider

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitial)
  const stateRef = useRef(state)
  stateRef.current = state
  const [route, setRoute] = useState<Route>(parseHash)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [claudeBusy, setClaudeBusy] = useState(false)
  const timers = useRef<number[]>([])

  // persist (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, now: iso(Date.now()) }))
      } catch {
        /* ignore */
      }
    }, 400)
    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => () => timers.current.forEach(t => clearTimeout(t)), [])

  const update = useCallback((fn: (d: DemoState) => void) => dispatch({ type: 'update', fn }), [])
  const later = useCallback((delay: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, delay))
  }, [])

  const actions = useMemo<Actions>(() => {
    const me = () => stateRef.current.users.find(u => u.id === stateRef.current.currentUserId)!

    const pushAudit = (d: DemoState, e: Omit<AuditEntry, 'id' | 'at' | 'actor'> & { actor?: AuditEntry['actor'] }) => {
      d.audit.unshift({ id: uid('au'), at: iso(Date.now()), actor: e.actor ?? d.currentUserId, action: e.action, target: e.target, detail: e.detail, reason: e.reason })
    }
    const pushNotify = (d: DemoState, to: { userIds?: string[]; roles?: Role[] }, n: Omit<Notification, 'id' | 'at' | 'userId' | 'read'>) => {
      const ids = new Set(to.userIds ?? [])
      for (const r of to.roles ?? []) d.users.filter(u => u.role === r && u.status === 'active').forEach(u => ids.add(u.id))
      for (const userId of ids) d.notifications.unshift({ ...n, id: uid('nt'), at: iso(Date.now()), userId, read: false })
    }
    const doMoveStage = (d: DemoState, episodeId: string, to: Stage | Exit, opts: { reason?: string; override?: boolean; by?: string } = {}) => {
      const ep = d.episodes.find(e => e.id === episodeId)
      if (!ep) return
      const from = ep.exit ?? ep.stage
      if (from === to) return
      if ((STAGES as string[]).includes(to)) {
        ep.stage = to as Stage
        ep.exit = undefined
        ep.exitReason = undefined
        if (to === 'alumni') ep.endedAt = iso(Date.now())
      } else {
        ep.exit = to as Exit
        ep.exitReason = opts.reason
      }
      ep.history.push({ at: iso(Date.now()), from, to, by: (opts.by as string) ?? d.currentUserId, reason: opts.reason, override: opts.override })
      const client = d.clients.find(c => c.id === ep.clientId)
      pushAudit(d, {
        actor: (opts.by as AuditEntry['actor']) ?? d.currentUserId,
        action: opts.override ? 'stage.override' : 'stage.move',
        target: { type: 'episode', id: ep.id, label: client?.name },
        detail: `${from} → ${to}`,
        reason: opts.reason,
      })
    }

    /** Lead handoff: phone shared or they asked for our number. */
    const handoff = (d: DemoState, conv: Conversation, phone: string | undefined) => {
      const client = d.clients.find(c => c.id === conv.clientId)!
      const ep = d.episodes.filter(e => e.clientId === client.id).sort((a, b) => b.number - a.number)[0]
      if (phone) client.phone = phone
      if (ep && STAGES.indexOf(ep.stage) < STAGES.indexOf('contact')) doMoveStage(d, ep.id, 'contact', { by: 'ai', reason: phone ? 'Phone number shared in DM' : 'Asked for the clinic number' })
      const coordinator = (client.ownerId && d.users.find(u => u.id === client.ownerId && u.onShift)) || onShift(d, 'coordinator')!
      client.ownerId = coordinator.id
      const existing = d.tasks.find(t => t.clientId === client.id && t.type === 'call' && t.status === 'open')
      if (existing) return
      const task: Task = {
        id: uid('tk'),
        type: 'call',
        title: phone ? `Call ${client.name} to book a consultation` : `${client.name} may call us; call back if they share a number`,
        clientId: client.id,
        episodeId: ep?.id,
        assignedTo: coordinator.id,
        createdAt: iso(Date.now()),
        dueAt: fromNow(phone ? 15 * MIN : 4 * HOUR),
        slaMinutes: phone ? 15 : undefined,
        escalationLevel: 0,
        status: 'open',
        attempts: [],
        brief: callBrief(d, client.id),
        priority: phone ? 'urgent' : 'normal',
      }
      d.tasks.unshift(task)
      conv.messages.push({ id: uid('ms'), author: 'system', text: phone ? `Lead created. ${coordinator.name} has 15 minutes to call.` : `Asked for our number. ${coordinator.name} will watch for their call.`, at: iso(Date.now()) })
      pushNotify(d, { userIds: [coordinator.id] }, {
        kind: 'lead',
        title: phone ? `New lead · ${client.name} shared a number` : `${client.name} asked for our number`,
        body: task.brief ?? '',
        link: { page: 'tasks', id: task.id },
        deadline: phone ? task.dueAt : undefined,
      })
      pushAudit(d, { actor: 'ai', action: 'lead.handoff', target: { type: 'client', id: client.id, label: client.name }, detail: phone ? 'Phone detected; call task created (15 min SLA)' : 'Asked for clinic number; expect-call task created' })
    }

    /** What the AI does after a client message, depending on mode, flags and kill switch. */
    const aiProcess = (conversationId: string) => {
      update(d => {
        const conv = d.conversations.find(c => c.id === conversationId)
        if (!conv) return
        const last = [...conv.messages].reverse().find(m => m.author === 'client')
        if (!last) return
        const flags = last.flags ?? []
        const client = d.clients.find(c => c.id === conv.clientId)!
        const ep = d.episodes.filter(e => e.clientId === client.id).sort((a, b) => b.number - a.number)[0]

        if (flags.includes('phone_detected')) handoff(d, conv, extractPhone(last.text))
        else if (flags.includes('asked_number')) handoff(d, conv, undefined)

        if (flags.includes('opt_out')) {
          client.doNotContact = true
          if (ep) doMoveStage(d, ep.id, 'dnc', { by: 'ai', reason: 'Asked us to stop messaging' })
        }
        if (flags.includes('minor')) {
          if (ep) doMoveStage(d, ep.id, 'under18', { by: 'ai', reason: 'Said they are under 18' })
          conv.needsHuman = true
          conv.needsHumanReason = 'Possible minor'
          pushNotify(d, { roles: ['manager'] }, { kind: 'escalation', title: `Possible minor in a DM · ${client.name}`, body: 'Booking is blocked. Please review the chat.', link: { page: 'inbox', id: conv.id } })
        }
        if (flags.includes('clinical')) {
          conv.needsHuman = true
          conv.needsHumanReason = 'Clinical question'
          const clin = onShift(d, 'clinician')
          if (clin) {
            d.tasks.unshift({ id: uid('tk'), type: 'clinical_review', title: `Clinical question from ${client.name}`, clientId: client.id, episodeId: ep?.id, assignedTo: clin.id, createdAt: iso(Date.now()), dueAt: fromNow(4 * HOUR), escalationLevel: 0, status: 'open', attempts: [], priority: 'high', brief: last.text })
            pushNotify(d, { userIds: [clin.id] }, { kind: 'clinical', title: `Clinical question · ${client.name}`, body: last.text, link: { page: 'inbox', id: conv.id } })
          }
        }
        if (flags.includes('complaint')) {
          conv.needsHuman = true
          conv.needsHumanReason = 'Complaint'
          pushNotify(d, { roles: ['manager'] }, { kind: 'escalation', title: `Complaint in DM · ${client.name}`, body: last.text, link: { page: 'inbox', id: conv.id } })
        }

        if (d.ai.killSwitch) {
          conv.needsHuman = true
          conv.needsHumanReason = 'AI paused (kill switch)'
          return
        }
        if (conv.handling !== 'ai') return

        const draft = ruleDraft(d, conv)
        const channelMode: AiMode = conv.channel === 'tiktok' ? d.ai.mode.tiktok : conv.channel === 'whatsapp' ? d.ai.mode.whatsapp : d.ai.mode.instagram
        const risky = flags.some(f => f === 'clinical' || f === 'complaint' || f === 'minor')
        if (channelMode === 'shadow') {
          conv.messages.push({ id: uid('ms'), author: 'ai', text: draft.text, at: iso(Date.now()), status: 'shadow' })
          conv.needsHuman = true
          conv.needsHumanReason = conv.needsHumanReason ?? 'Shadow mode: staff reply'
        } else if (channelMode === 'copilot' || risky || draft.confidence < d.ai.confidenceThreshold) {
          conv.draft = draft
          if (risky || draft.confidence < d.ai.confidenceThreshold) {
            conv.needsHuman = true
            conv.needsHumanReason = conv.needsHumanReason ?? 'Low confidence'
          }
        } else {
          conv.messages.push({ id: uid('ms'), author: 'ai', text: draft.text, at: iso(Date.now()), status: 'delivered' })
          conv.lastMessageAt = iso(Date.now())
          conv.outboundSinceInbound += 1
          conv.intent = draft.intent
        }
      })
    }

    const a: Actions = {
      update,
      setUser: userId => {
        update(d => {
          d.currentUserId = userId
        })
      },
      go: (page, id) => {
        const h = '#' + page + (id ? '~' + id : '')
        try {
          if (location.hash !== h) history.pushState(null, '', h)
        } catch {
          /* sandboxed previews may block history; in-app routing still works */
        }
        setRoute({ page, id })
        window.scrollTo({ top: 0 })
      },
      toast: (text, tone = 'info', action) => {
        const id = uid('to')
        setToasts(t => [...t, { id, text, tone, action }])
        later(5000, () => setToasts(t => t.filter(x => x.id !== id)))
      },
      audit: e => update(d => pushAudit(d, e)),
      notify: (to, n) => update(d => pushNotify(d, to, n)),
      markRead: id => update(d => {
        const n = d.notifications.find(x => x.id === id)
        if (n) n.read = true
      }),
      markAllRead: () => update(d => {
        d.notifications.forEach(n => {
          if (n.userId === d.currentUserId) n.read = true
        })
      }),
      moveStage: (episodeId, to, opts) => update(d => doMoveStage(d, episodeId, to, opts)),
      sendMessage: (conversationId, m) => update(d => {
        const conv = d.conversations.find(c => c.id === conversationId)
        if (!conv) return
        conv.messages.push({ id: uid('ms'), author: m.author, userId: m.author === 'human' ? d.currentUserId : undefined, text: m.text, at: iso(Date.now()), status: 'delivered', humanAgentTag: m.humanAgentTag })
        conv.lastMessageAt = iso(Date.now())
        conv.outboundSinceInbound += 1
        conv.unread = 0
        if (m.author === 'human') {
          conv.needsHuman = false
          conv.needsHumanReason = undefined
          conv.draft = undefined
        }
      }),
      setHandling: (conversationId, handling, reason) => update(d => {
        const conv = d.conversations.find(c => c.id === conversationId)
        if (!conv) return
        conv.handling = handling
        if (handling === 'human') {
          conv.assignedTo = d.currentUserId
          conv.draft = undefined
        }
        conv.messages.push({ id: uid('ms'), author: 'system', text: handling === 'ai' ? 'AI resumed replying in this chat.' : handling === 'human' ? `${userName(d, d.currentUserId)} took over this chat. AI is paused here.` : 'AI paused in this chat.', at: iso(Date.now()) })
        pushAudit(d, { action: 'conversation.handling', target: { type: 'conversation', id: conv.id, label: d.clients.find(c => c.id === conv.clientId)?.name }, detail: `Handling set to ${handling}`, reason })
      }),
      assignConversation: (conversationId, userId) => update(d => {
        const conv = d.conversations.find(c => c.id === conversationId)
        if (conv) conv.assignedTo = userId
      }),
      approveDraft: (conversationId, editedText) => {
        const conv = stateRef.current.conversations.find(c => c.id === conversationId)
        if (!conv?.draft) return
        const text = editedText ?? conv.draft.text
        update(d => {
          const c = d.conversations.find(x => x.id === conversationId)!
          c.messages.push({ id: uid('ms'), author: 'ai', userId: d.currentUserId, text, at: iso(Date.now()), status: 'delivered' })
          c.lastMessageAt = iso(Date.now())
          c.outboundSinceInbound += 1
          c.draft = undefined
          c.needsHuman = false
          c.needsHumanReason = undefined
          pushAudit(d, { action: editedText ? 'draft.edited_and_sent' : 'draft.approved', target: { type: 'conversation', id: c.id, label: d.clients.find(x => x.id === c.clientId)?.name }, detail: editedText ? 'AI draft edited before sending' : 'AI draft sent unchanged' })
        })
      },
      discardDraft: conversationId => update(d => {
        const c = d.conversations.find(x => x.id === conversationId)
        if (c) c.draft = undefined
      }),
      regenerateDraft: async (conversationId, useClaude) => {
        const s = stateRef.current
        const conv = s.conversations.find(c => c.id === conversationId)
        if (!conv) return null
        let draft = ruleDraft(s, conv)
        let note: string | null = null
        if (useClaude) {
          const sample = await getClaude()
          if (sample) {
            setClaudeBusy(true)
            try {
              draft = await claudeDraft(sample, s, conv)
            } catch (e) {
              note = claudeErrorText(e) || null
            } finally {
              setClaudeBusy(false)
            }
          } else {
            note = 'Live Claude only works inside the claude.ai preview. The built-in demo reply was used.'
          }
        }
        update(d => {
          const c = d.conversations.find(x => x.id === conversationId)
          if (c) c.draft = draft
        })
        return note
      },
      receiveMessage: (conversationId, text) => {
        const flags = detectFlags(text)
        update(d => {
          const c = d.conversations.find(x => x.id === conversationId)
          if (!c) return
          c.messages.push({ id: uid('ms'), author: 'client', text, at: iso(Date.now()), flags: flags.length ? flags : undefined, status: 'delivered' })
          c.lastInboundAt = iso(Date.now())
          c.lastMessageAt = iso(Date.now())
          c.outboundSinceInbound = 0
          c.unread += 1
          c.draft = undefined
        })
        later(2200, () => aiProcess(conversationId))
      },
      simulateNewLead: channel => {
        const script = newLeadScript(stateRef.current, channel)
        update(d => {
          d.clients.unshift(script.client)
          d.episodes.unshift(script.episode)
          d.conversations.unshift(script.conversation)
          pushAudit(d, { actor: 'system', action: 'conversation.new', target: { type: 'conversation', id: script.conversation.id, label: script.client.name }, detail: `New ${script.conversation.channel} DM` })
        })
        later(2200, () => aiProcess(script.conversation.id))
        // the person replies with their number a little later, to show the full handoff
        script.followUps.forEach((f, i) => later(9000 + i * 9000, () => {
          const c = stateRef.current.conversations.find(x => x.id === script.conversation.id)
          if (!c || stateRef.current.ai.killSwitch && i > 0) return
          a.receiveMessage(script.conversation.id, f)
        }))
        return script.conversation.id
      },
      logCall: (taskId, outcome, det = {}) => update(d => {
        const t = d.tasks.find(x => x.id === taskId)
        if (!t) return
        const client = d.clients.find(c => c.id === t.clientId)!
        t.attempts.push({ at: iso(Date.now()), by: d.currentUserId, outcome, note: det.note })
        const ep = t.episodeId ? d.episodes.find(e => e.id === t.episodeId) : undefined
        if (outcome === 'booked' && det.start) {
          const proc = d.procedures.find(p => p.id === det.procedureId) ?? d.procedures[0]
          const practitioner = det.practitionerId ?? d.users.find(u => u.role === 'clinician')!.id
          const room = d.rooms.find(r => r.branchId === client.branchId) ?? d.rooms[0]
          const appt: Appointment = {
            id: uid('ap'), clientId: client.id, episodeId: ep?.id ?? '', type: 'consultation', procedureId: proc.id,
            practitionerId: practitioner, roomId: room.id, branchId: room.branchId, start: det.start,
            end: iso(ms(det.start) + 30 * MIN), status: 'confirmed', deposit: det.depositDueAt ? 'due' : 'none', reminders: { d2: false, d1: false },
            notes: det.note,
          }
          d.appointments.push(appt)
          if (det.depositDueAt && ep) d.payments.push({ id: uid('py'), clientId: client.id, episodeId: ep.id, kind: 'deposit', amount: Math.round(proc.price * proc.depositPct / 100), status: 'due', dueAt: det.depositDueAt })
          if (ep) doMoveStage(d, ep.id, 'booked', { reason: 'Booked on call' })
          t.status = 'done'
          pushAudit(d, { action: 'appointment.booked', target: { type: 'appointment', id: appt.id, label: client.name }, detail: `Consultation booked for ${new Date(det.start).toLocaleString()}` })
        } else if (outcome === 'no_answer') {
          const n = t.attempts.filter(x => x.outcome === 'no_answer').length
          if (n >= 3) {
            t.status = 'done'
            if (ep) doMoveStage(d, ep.id, 'nurture', { reason: 'No answer after 3 calls; WhatsApp follow-up sent' })
          } else {
            t.dueAt = fromNow(n === 1 ? 2 * HOUR : DAY)
            t.slaMinutes = undefined
            t.escalationLevel = 0
          }
        } else if (outcome === 'call_back') {
          t.dueAt = det.callbackAt ?? fromNow(3 * HOUR)
          t.type = 'callback'
          t.slaMinutes = undefined
        } else if (outcome === 'not_interested' || outcome === 'wrong_number') {
          t.status = 'done'
          if (ep) doMoveStage(d, ep.id, outcome === 'not_interested' ? 'lost' : 'nurture', { reason: outcome === 'not_interested' ? det.note || 'Not interested' : 'Wrong number' })
        } else if (outcome === 'thinking') {
          t.dueAt = fromNow(2 * DAY)
          t.type = 'follow_up'
          t.slaMinutes = undefined
        }
        pushAudit(d, { action: 'call.logged', target: { type: 'task', id: t.id, label: client.name }, detail: `Call outcome: ${outcome.replace('_', ' ')}` })
      }),
      assignTask: (taskId, userId) => update(d => {
        const t = d.tasks.find(x => x.id === taskId)
        if (!t) return
        const from = t.assignedTo
        t.assignedTo = userId
        pushAudit(d, { action: 'task.reassigned', target: { type: 'task', id: t.id, label: t.title }, detail: `${userName(d, from)} → ${userName(d, userId)}` })
        pushNotify(d, { userIds: [userId] }, { kind: 'lead', title: 'Task assigned to you', body: t.title, link: { page: 'tasks', id: t.id }, deadline: t.slaMinutes ? t.dueAt : undefined })
      }),
      completeTask: (taskId, note) => update(d => {
        const t = d.tasks.find(x => x.id === taskId)
        if (!t) return
        t.status = 'done'
        pushAudit(d, { action: 'task.done', target: { type: 'task', id: t.id, label: t.title }, detail: note ?? 'Marked done' })
      }),
      bookAppointment: input => {
        const id = uid('ap')
        update(d => {
          d.appointments.push({ ...input, id, status: input.status ?? 'unconfirmed', reminders: { d2: false, d1: false } })
          pushAudit(d, { action: 'appointment.booked', target: { type: 'appointment', id, label: d.clients.find(c => c.id === input.clientId)?.name }, detail: `${input.type} on ${new Date(input.start).toLocaleString()}` })
        })
        return id
      },
      setAppointmentStatus: (appointmentId, status, reason) => update(d => {
        const ap = d.appointments.find(x => x.id === appointmentId)
        if (!ap) return
        const from = ap.status
        ap.status = status
        const ep = d.episodes.find(e => e.id === ap.episodeId)
        if (status === 'completed' && ap.type === 'consultation' && ep && STAGES.indexOf(ep.stage) < STAGES.indexOf('consultation')) doMoveStage(d, ep.id, 'consultation', { reason: 'Consultation attended' })
        if (status === 'no_show') {
          const fd = onShift(d, 'frontdesk') ?? onShift(d, 'coordinator')
          if (fd) d.tasks.unshift({ id: uid('tk'), type: 'follow_up', title: `Rebook no-show: ${d.clients.find(c => c.id === ap.clientId)?.name}`, clientId: ap.clientId, episodeId: ap.episodeId, assignedTo: fd.id, createdAt: iso(Date.now()), dueAt: fromNow(2 * HOUR), escalationLevel: 0, status: 'open', attempts: [], priority: 'high' })
        }
        pushAudit(d, { action: 'appointment.status', target: { type: 'appointment', id: ap.id, label: d.clients.find(c => c.id === ap.clientId)?.name }, detail: `${from} → ${status}`, reason })
      }),
      setKillSwitch: (on, reason) => update(d => {
        d.ai.killSwitch = on
        d.ai.killSwitchBy = d.currentUserId
        d.ai.killSwitchAt = iso(Date.now())
        pushAudit(d, { action: on ? 'ai.killswitch_on' : 'ai.killswitch_off', target: { type: 'settings', id: 'ai', label: 'AI replies' }, detail: on ? 'All AI replies paused' : 'AI replies resumed', reason })
        pushNotify(d, { roles: ['owner', 'manager', 'coordinator'] }, { kind: 'ai', title: on ? 'AI replies paused for everyone' : 'AI replies resumed', body: `${userName(d, d.currentUserId)}: ${reason}`, link: { page: 'ai' } })
      }),
      setAiMode: (channel, mode, reason) => update(d => {
        const from = d.ai.mode[channel]
        d.ai.mode[channel] = mode
        pushAudit(d, { action: 'ai.mode', target: { type: 'settings', id: 'ai', label: `${channel} AI mode` }, detail: `${from} → ${mode}`, reason })
      }),
      addNote: (clientId, text, clinical) => update(d => {
        d.notes.unshift({ id: uid('no'), clientId, authorId: d.currentUserId, at: iso(Date.now()), text, clinical })
      }),
      resetDemo: () => {
        try {
          localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* ignore */
        }
        dispatch({ type: 'replace', state: seed() })
        a.toast('Demo data reset', 'success')
      },
    }
    void me
    return a
  }, [update, later])

  // SLA engine: escalate overdue lead calls to the manager, then the owner
  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current
      const now = Date.now()
      const due = s.tasks.filter(t => t.status === 'open' && t.slaMinutes && ((t.escalationLevel === 0 && now > ms(t.dueAt)) || (t.escalationLevel === 1 && now > ms(t.createdAt) + 60 * MIN)))
      if (!due.length) return
      update(d => {
        for (const x of due) {
          const t = d.tasks.find(y => y.id === x.id)!
          const client = d.clients.find(c => c.id === t.clientId)
          const level = (t.escalationLevel + 1) as 1 | 2
          t.escalationLevel = level
          const role: Role = level === 1 ? 'manager' : 'owner'
          d.notifications.unshift(...d.users.filter(u => u.role === role).map(u => ({ id: uid('nt'), at: iso(now), userId: u.id, kind: 'escalation' as const, title: `Escalated: ${client?.name ?? 'lead'} not called in time`, body: `${t.title}. Assigned to ${userName(d, t.assignedTo)}.`, link: { page: 'tasks' as PageId, id: t.id }, read: false })))
          d.audit.unshift({ id: uid('au'), at: iso(now), actor: 'system', action: 'sla.escalated', target: { type: 'task', id: t.id, label: client?.name }, detail: `Escalated to ${role}` })
        }
      })
    }, 5000)
    return () => clearInterval(t)
  }, [update])

  const me = state.users.find(u => u.id === state.currentUserId) ?? state.users[0]
  const value = useMemo<StoreValue>(() => ({
    state,
    me,
    can: (p: Permission) => canDo(me, p),
    route,
    toasts,
    dismissToast: (id: string) => setToasts(t => t.filter(x => x.id !== id)),
    actions,
    claudeBusy,
  }), [state, me, route, toasts, actions, claudeBusy])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export type { Message }
