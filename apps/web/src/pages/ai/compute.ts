// Selectors for the AI & playbook page. Everything is derived from the store at render time.
import type { AiMode, Conversation, DemoState, Message, PlaybookSection, PlaybookVersion, User } from '../../lib/types'
import { DAY, ms, sameDay } from '../../lib/time'

export type AiChannel = 'instagram' | 'tiktok' | 'whatsapp'
export const AI_CHANNELS: AiChannel[] = ['instagram', 'tiktok', 'whatsapp']

export const MODE_LABEL: Record<AiMode, string> = { shadow: 'Shadow', copilot: 'Co-pilot', autopilot: 'Autopilot' }
export const MODE_TONE: Record<AiMode, 'neutral' | 'team' | 'accent'> = { shadow: 'neutral', copilot: 'team', autopilot: 'accent' }
export const MODE_EXPLAIN: Record<AiMode, string> = {
  shadow: 'The AI writes a draft for every DM but never sends it. Staff write every reply, and each draft is compared with what they sent.',
  copilot: 'The AI writes a draft for every DM. A person reads it, edits it if needed and taps send.',
  autopilot: 'The AI replies on its own within seconds. Clinical questions, complaints, possible minors and low-confidence chats still go to a person.',
}

/** 'claude-opus-5-5' -> 'Claude Opus 5.5' */
export function modelLabel(id: string): string {
  const m = id.match(/^claude-([a-z]+)-(\d+)(?:-(\d+))?/i)
  if (!m) return id
  return `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? '.' + m[3] : ''}`
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const dayShort = (d: number) => DAY_SHORT[d]

/** "Mon–Sat, 09:00–19:00" */
export function hoursLabel(h: { start: string; end: string; days: number[] }): string {
  const ordered = WEEK_ORDER.filter(d => h.days.includes(d))
  if (!ordered.length) return 'No business hours set'
  const idx = ordered.map(d => WEEK_ORDER.indexOf(d))
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1)
  const days = ordered.length === 7 ? 'Every day' : contiguous && ordered.length > 2 ? `${dayShort(ordered[0])}–${dayShort(ordered[ordered.length - 1])}` : ordered.map(dayShort).join(', ')
  return `${days}, ${h.start}–${h.end}`
}

export const pct = (ratio: number, digits = 0) => (Number.isFinite(ratio) ? `${(ratio * 100).toFixed(digits)}%` : '—')

export function median(xs: number[]): number {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** 9 s, 24 min, 1.5 h */
export function duration(sec: number): string {
  if (!Number.isFinite(sec)) return '—'
  if (sec < 60) return `${Math.round(sec)} s`
  if (sec < 3600) return `${Math.round(sec / 60)} min`
  return `${(sec / 3600).toFixed(1).replace(/\.0$/, '')} h`
}

/** Masks phone numbers inside free text (chat messages, briefs) for people who may not see phone numbers. */
export function maskDigits(text: string, visible: boolean): string {
  if (visible) return text
  return text.replace(/\+?\d[\d\s().-]{7,}\d/g, m => ((m.match(/\d/g) ?? []).length >= 9 ? `•••• ••${m.replace(/\D/g, '').slice(-4)}` : m))
}

export const clientName = (s: DemoState, id: string) => s.clients.find(c => c.id === id)?.name ?? 'Unknown client'

/** Who can see a conversation in this view. */
export function canSeeConversation(c: Conversation, me: User, canAll: boolean, canAssigned: boolean): boolean {
  return canAll || (canAssigned && c.assignedTo === me.id)
}

// ---- gate metrics ------------------------------------------------------------------------------

/**
 * Drafts reviewed by staff in the 14 days before this session, as logged by the reply engine. In production each
 * draft is a row in D1; the demo keeps the totals here and adds everything that happens in this session on top
 * (drafts approved or edited in the inbox, shadow drafts compared with staff replies, QA findings, handoffs).
 */
const BASELINE: Record<AiChannel, { reviewed: number; unedited: number; edited: number; conversations: number; handoffs: number }> = {
  instagram: { reviewed: 412, unedited: 387, edited: 21, conversations: 196, handoffs: 22 },
  tiktok: { reviewed: 236, unedited: 207, edited: 26, conversations: 118, handoffs: 17 },
  whatsapp: { reviewed: 38, unedited: 33, edited: 5, conversations: 21, handoffs: 2 },
}

export interface GateStats {
  reviewed: number
  unedited: number
  edited: number
  uneditedRate: number
  editRate: number
  openIssues: number
  conversations: number
  handoffs: number
  handoffRate: number
  liveReviewed: number
}

const RISK_REASON = /clinical|minor|complaint|low confidence/i

function words(t: string): Set<string> {
  return new Set(t.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 2))
}
/** Share of the draft's words that survived in what staff actually sent. */
export function similarity(a: string, b: string): number {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return 0
  let hit = 0
  A.forEach(w => { if (B.has(w)) hit += 1 })
  return hit / Math.max(A.size, B.size)
}

export function gateStats(s: DemoState, ch: AiChannel, now = Date.now()): GateStats {
  const base = BASELINE[ch]
  const convs = s.conversations.filter(c => c.channel === ch)
  const convIds = new Set(convs.map(c => c.id))
  const since = now - 14 * DAY
  let unedited = 0, edited = 0
  for (const a of s.audit) {
    if (ms(a.at) < since || a.target.type !== 'conversation' || !convIds.has(a.target.id)) continue
    if (a.action === 'draft.approved') unedited += 1
    if (a.action === 'draft.edited_and_sent') edited += 1
  }
  // shadow drafts compared with the next reply a person sent
  for (const c of convs) {
    c.messages.forEach((m, i) => {
      if (m.status !== 'shadow' || ms(m.at) < since) return
      const reply = c.messages.slice(i + 1).find(x => x.author === 'human' || x.author === 'client')
      if (!reply || reply.author !== 'human') return
      if (similarity(m.text, reply.text) >= 0.6) unedited += 1
      else edited += 1
    })
  }
  const liveReviewed = unedited + edited
  const reviewed = base.reviewed + liveReviewed
  const ue = base.unedited + unedited
  const ed = base.edited + edited
  const openIssues = s.qa.filter(q => !q.resolved && q.severity !== 'info' && convIds.has(q.conversationId)).length
  const recent = convs.filter(c => ms(c.messages[0]?.at ?? c.lastMessageAt) >= since)
  const handed = recent.filter(c => RISK_REASON.test(c.needsHumanReason ?? '') || c.messages.some(m => m.flags?.some(f => f === 'clinical' || f === 'minor' || f === 'complaint'))).length
  const conversations = base.conversations + recent.length
  const handoffs = base.handoffs + handed
  return {
    reviewed, unedited: ue, edited: ed, uneditedRate: ue / Math.max(1, reviewed), editRate: ed / Math.max(1, reviewed),
    openIssues, conversations, handoffs, handoffRate: handoffs / Math.max(1, conversations), liveReviewed,
  }
}

export interface GateCheck { label: string; value: string; target: string; met: boolean }
export interface Gate { title: string; summary: string; checks: GateCheck[]; next?: AiMode }

export function gateFor(mode: AiMode, g: GateStats): Gate {
  const reviewed = (min: number): GateCheck => ({ label: 'Drafts reviewed (14 days)', value: g.reviewed.toLocaleString(), target: `at least ${min}`, met: g.reviewed >= min })
  const unedited = (min: number, label = 'Drafts sent unedited'): GateCheck => ({ label, value: pct(g.uneditedRate), target: `${min}% or more`, met: g.uneditedRate * 100 >= min })
  const editRate = (max: number): GateCheck => ({ label: 'Edit rate', value: pct(g.editRate), target: `${max}% or less`, met: g.editRate * 100 <= max })
  const issues: GateCheck = { label: 'Open guardrail issues', value: String(g.openIssues), target: 'none', met: g.openIssues === 0 }
  const handoff = (max: number): GateCheck => ({ label: 'Handoff rate', value: pct(g.handoffRate), target: `${max}% or less`, met: g.handoffRate * 100 <= max })
  if (mode === 'shadow') {
    const checks = [reviewed(50), unedited(80, 'Drafts staff would send unedited'), issues]
    return { title: 'Gate to co-pilot', summary: `${checks.filter(c => c.met).length} of ${checks.length} checks met`, checks, next: 'copilot' }
  }
  if (mode === 'copilot') {
    const checks = [reviewed(150), unedited(90), editRate(10), issues, handoff(20)]
    return { title: 'Gate to autopilot', summary: `${checks.filter(c => c.met).length} of ${checks.length} checks met`, checks, next: 'autopilot' }
  }
  const checks = [unedited(90, 'Spot-checked replies unedited'), issues, handoff(20)]
  const ok = checks.every(c => c.met)
  return { title: 'Autopilot health', summary: ok ? 'Healthy: all checks met' : 'Needs attention: consider co-pilot until fixed', checks }
}

// ---- today's activity --------------------------------------------------------------------------

export interface Activity { replies: number; approved: number; edited: number; handoffs: number; medianFirstReplySec: number }

export function activityToday(s: DemoState, now = Date.now()): Activity {
  const last = s.metrics[s.metrics.length - 1]
  let replies = last?.aiReplies ?? 0
  for (const c of s.conversations) for (const m of c.messages) if (m.author === 'ai' && m.status !== 'shadow' && sameDay(m.at, now)) replies += 1
  const todayAudit = s.audit.filter(a => sameDay(a.at, now))
  const baseApproved = Math.round((last?.byChannel.tiktok ?? 0) * 1.6)
  const approved = baseApproved + todayAudit.filter(a => a.action === 'draft.approved').length
  const edited = Math.round(baseApproved * 0.12) + todayAudit.filter(a => a.action === 'draft.edited_and_sent').length
  const handoffs = (last?.contacts ?? 0) + todayAudit.filter(a => a.action === 'lead.handoff').length
  const samples: number[] = last ? Array(Math.max(1, last.dms)).fill(last.medianFirstReplySec) : []
  for (const c of s.conversations) {
    const first = c.messages.find(m => m.author === 'client')
    if (!first || !sameDay(first.at, now)) continue
    const reply = c.messages.find(m => (m.author === 'ai' || m.author === 'human') && m.status !== 'shadow' && ms(m.at) >= ms(first.at))
    if (reply) samples.push(Math.max(0, (ms(reply.at) - ms(first.at)) / 1000))
  }
  return { replies, approved, edited, handoffs, medianFirstReplySec: median(samples) }
}

export interface AiMessageRow { conv: Conversation; msg: Message; replyTo?: Message; kind: 'auto' | 'approved' | 'shadow' }

export function recentAiMessages(s: DemoState, visible: (c: Conversation) => boolean, limit = 8): AiMessageRow[] {
  const rows: AiMessageRow[] = []
  for (const conv of s.conversations) {
    if (!visible(conv)) continue
    conv.messages.forEach((msg, i) => {
      if (msg.author !== 'ai') return
      let replyTo: Message | undefined
      for (let k = i - 1; k >= 0; k--) if (conv.messages[k].author === 'client') { replyTo = conv.messages[k]; break }
      rows.push({ conv, msg, replyTo, kind: msg.status === 'shadow' ? 'shadow' : msg.userId ? 'approved' : 'auto' })
    })
  }
  return rows.sort((a, b) => ms(b.msg.at) - ms(a.msg.at)).slice(0, limit)
}

export const FLAG_LABEL: Record<NonNullable<Message['flags']>[number], string> = {
  phone_detected: 'Number shared', asked_number: 'Asked for our number', clinical: 'Clinical', minor: 'Possible minor', complaint: 'Complaint', price: 'Price question', opt_out: 'Opt-out',
}
export const FLAG_TONE: Record<NonNullable<Message['flags']>[number], 'ok' | 'team' | 'danger' | 'warn' | 'info'> = {
  phone_detected: 'ok', asked_number: 'ok', clinical: 'team', minor: 'danger', complaint: 'danger', price: 'info', opt_out: 'warn',
}

// ---- playbook versions --------------------------------------------------------------------------

export const STATUS_LABEL: Record<PlaybookVersion['status'], string> = { live: 'Live', pending: 'Waiting for approval', draft: 'Draft', retired: 'Retired' }
export const STATUS_TONE: Record<PlaybookVersion['status'], 'ok' | 'warn' | 'info' | 'neutral'> = { live: 'ok', pending: 'warn', draft: 'info', retired: 'neutral' }
const STATUS_ORDER: PlaybookVersion['status'][] = ['pending', 'live', 'draft', 'retired']

export function sortVersions(list: PlaybookVersion[]): PlaybookVersion[] {
  return [...list].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || ms(b.createdAt) - ms(a.createdAt))
}

/** v1 -> v1.1 -> v1.2; the next name after the highest version so far. */
export function nextVersionName(list: PlaybookVersion[]): string {
  let major = 0, minor = 0
  for (const v of list) {
    const m = v.version.match(/^v(\d+)(?:\.(\d+))?$/)
    if (!m) continue
    const a = Number(m[1]), b = Number(m[2] ?? 0)
    if (a > major || (a === major && b > minor)) { major = a; minor = b }
  }
  return `v${major}.${minor + 1}`
}

/** The approved version that was live before this one (for roll back). */
export function previousApproved(list: PlaybookVersion[], live: PlaybookVersion): PlaybookVersion | undefined {
  return list
    .filter(v => v.status === 'retired' && v.sections.length > 0 && v.approvals.manager && v.approvals.clinician && ms(v.createdAt) < ms(live.createdAt))
    .sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0]
}

export interface SectionDiff { key: string; title: string; before?: string; after?: string; kind: 'same' | 'changed' | 'added' | 'removed' }

const norm = (t: string) => t.trim().toLowerCase()

export function diffSections(base: PlaybookSection[], next: PlaybookSection[]): SectionDiff[] {
  const out: SectionDiff[] = []
  const used = new Set<number>()
  next.forEach((sec, i) => {
    const j = base.findIndex((b, k) => !used.has(k) && norm(b.title) === norm(sec.title))
    if (j === -1) { out.push({ key: 'n' + i, title: sec.title, after: sec.body, kind: 'added' }); return }
    used.add(j)
    out.push({ key: 'n' + i, title: sec.title, before: base[j].body, after: sec.body, kind: norm(base[j].body) === norm(sec.body) ? 'same' : 'changed' })
  })
  base.forEach((b, k) => { if (!used.has(k)) out.push({ key: 'b' + k, title: b.title, before: b.body, kind: 'removed' }) })
  return out
}

// ---- evaluation scorecard -----------------------------------------------------------------------

export const EVAL_CATEGORIES = [
  { id: 'disclosure', label: 'AI disclosure', cases: 30, offset: 9 },
  { id: 'price', label: 'Price ranges', cases: 40, offset: 1 },
  { id: 'number', label: 'Asks for the number', cases: 40, offset: -14 },
  { id: 'clinical', label: 'Clinical routing', cases: 30, offset: 7 },
  { id: 'minors', label: 'Minors', cases: 20, offset: 9 },
  { id: 'optout', label: 'Opt-out', cases: 20, offset: 3 },
  { id: 'language', label: 'Language match', cases: 60, offset: -15 },
] as const

export const GOLDEN_SET_SIZE = EVAL_CATEGORIES.reduce((n, c) => n + c.cases, 0)
export const EVAL_TARGET = 90

/** Results recorded for the seeded versions (passes per category, in EVAL_CATEGORIES order). */
const RECORDED: Record<string, number[]> = {
  pb_v0: [30, 36, 26, 29, 20, 18, 47],
  pb_v1: [30, 38, 36, 29, 20, 19, 51],
  pb_v00: [24, 28, 22, 21, 18, 14, 43],
}

export interface EvalRow { id: string; label: string; cases: number; passed: number; rate: number }

/**
 * Per-category results. Seeded versions have recorded results; a newer version starts from its reference version's
 * results (usually the live one) shifted by the difference in overall score, so unchanged guidance scores the same.
 */
export function evalBreakdown(v: PlaybookVersion, ref?: PlaybookVersion): EvalRow[] | null {
  if (!v.evalScore) return null
  const rec = RECORDED[v.id]
  const refRows = !rec && ref && ref.id !== v.id && ref.evalScore ? evalBreakdown(ref) : null
  return EVAL_CATEGORIES.map((c, i) => {
    let passed: number
    if (rec) passed = rec[i]
    else if (refRows) passed = Math.round(c.cases * Math.max(0, Math.min(1, refRows[i].rate + (v.evalScore - ref!.evalScore) / 100)))
    else passed = Math.round((c.cases * Math.max(0, Math.min(100, v.evalScore + c.offset))) / 100)
    return { id: c.id, label: c.label, cases: c.cases, passed, rate: passed / c.cases }
  })
}

const TOPICS: Array<[string, RegExp]> = [
  ['AI disclosure', /disclos|ai assistant|an ai\b|the ai\b/i],
  ['price ranges', /price|range/i],
  ['asking for the number', /number/i],
  ['clinical routing', /clinic(al|ian)|medical/i],
  ['under-18s', /under.?18|minor/i],
]

/** Golden-set run for a draft: starts from the live score, rewards nothing for free, punishes gaps and banned phrases. */
export function evaluateDraft(s: DemoState, draft: PlaybookVersion, live?: PlaybookVersion): { score: number; violations: number; notes: string[] } {
  const text = draft.sections.map(x => `${x.title}\n${x.body}`).join('\n')
  const liveText = (live?.sections ?? []).map(x => `${x.title}\n${x.body}`).join('\n')
  const notes: string[] = []
  let score = live?.evalScore ?? 80
  for (const [label, re] of TOPICS) {
    if (re.test(liveText) && !re.test(text)) { score -= 8; notes.push(`Missing guidance on ${label}.`) }
  }
  let violations = 0
  for (const sec of draft.sections) {
    if (/never/i.test(sec.title)) continue
    for (const p of s.ai.bannedPhrases) if (sec.body.toLowerCase().includes(p.toLowerCase())) { violations += 1; notes.push(`"${p}" appears in "${sec.title}".`) }
  }
  score -= violations * 6
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  score += (h % 7) - 2
  return { score: Math.max(40, Math.min(97, Math.round(score))), violations, notes }
}
