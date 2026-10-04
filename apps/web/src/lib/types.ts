// Domain model for the Lead Manager front end.
// The same shapes will be served by the Cloudflare Workers API later; today they come from the demo seed.

export type ID = string
export type ISO = string // ISO-8601 timestamp

export type Role = 'owner' | 'manager' | 'coordinator' | 'frontdesk' | 'clinician' | 'finance' | 'marketing'

export type Channel = 'instagram' | 'tiktok' | 'whatsapp' | 'sms' | 'phone' | 'walkin' | 'referral'

/** Main path of the client journey, in order. */
export type Stage =
  | 'new' // DM received
  | 'qualifying' // AI qualifies
  | 'contact' // contact captured (handoff)
  | 'call' // call & confirm
  | 'booked' // appointment booked
  | 'consultation' // consultation attended
  | 'plan' // treatment plan proposed / accepted
  | 'treatment' // sessions in progress
  | 'aftercare' // complete & aftercare
  | 'alumni' // alumni & returns

/** Side exits that take an episode off the main path. */
export type Exit = 'nurture' | 'lost' | 'not_suitable' | 'dnc' | 'spam' | 'under18'

export type AiMode = 'shadow' | 'copilot' | 'autopilot'

export interface Branch { id: ID; name: string; city: string }
export interface Room { id: ID; name: string; branchId: ID }

export interface User {
  id: ID
  name: string
  role: Role
  branchIds: ID[]
  email: string
  phone: string
  color: string // avatar colour
  onShift: boolean
  twoFactor: 'passkey' | 'totp' | 'none'
  status: 'active' | 'invited' | 'suspended'
  lastActiveAt: ISO
  /** Per-person permission overrides on top of the role template. */
  overrides?: Partial<Record<Permission, boolean>>
}

export type Permission =
  | 'chats.view_all'
  | 'chats.view_assigned'
  | 'chats.reply'
  | 'clients.view_phone'
  | 'clients.edit'
  | 'clients.merge'
  | 'clients.erase'
  | 'pipeline.move'
  | 'pipeline.override'
  | 'appointments.manage'
  | 'clinical.view'
  | 'clinical.edit'
  | 'payments.view'
  | 'payments.take'
  | 'payments.refund'
  | 'ai.mode'
  | 'ai.killswitch'
  | 'playbook.propose'
  | 'playbook.approve'
  | 'playbook.clinical_signoff'
  | 'analytics.view'
  | 'analytics.revenue'
  | 'team.manage'
  | 'settings.manage'
  | 'audit.view'

export interface Consent {
  whatsapp: boolean
  sms: boolean
  marketing: boolean
  callRecording: boolean
  updatedAt: ISO
}

export interface Client {
  id: ID
  name: string
  handles: { instagram?: string; tiktok?: string }
  phone?: string // E.164
  email?: string
  language: string // e.g. 'en', 'ar', 'es'
  ageVerified: boolean
  dateOfBirth?: string
  tags: string[]
  consent: Consent
  doNotContact: boolean
  ownerId?: ID // coordinator who owns the relationship
  branchId: ID
  source: { channel: Channel; detail: string } // e.g. post or video that started it
  createdAt: ISO
  score: number // 0-100 lead score from the AI
  mergedFrom?: ID[]
}

export interface StageChange {
  at: ISO
  from?: Stage | Exit
  to: Stage | Exit
  by: ID | 'ai' | 'system'
  reason?: string // required for overrides
  override?: boolean
}

export interface Episode {
  id: ID
  clientId: ID
  number: number // 1, 2, 3 ... per client
  startedAt: ISO
  endedAt?: ISO
  stage: Stage
  exit?: Exit
  exitReason?: string
  history: StageChange[]
  interests: string[] // procedure ids mentioned
  value: number // expected or actual value
}

export type MessageAuthor = 'client' | 'ai' | 'human' | 'system'

export interface Message {
  id: ID
  author: MessageAuthor
  userId?: ID // for human messages
  text: string
  at: ISO
  flags?: Array<'phone_detected' | 'asked_number' | 'clinical' | 'minor' | 'complaint' | 'price' | 'opt_out'>
  humanAgentTag?: boolean // Instagram HUMAN_AGENT tag used (human only, up to 7 days)
  status?: 'sent' | 'delivered' | 'read' | 'failed' | 'shadow' // shadow = drafted only, never sent
}

export interface AiDraft {
  text: string
  confidence: number // 0-1
  intent: string
  reasons: string[] // why the AI chose this reply, guardrail notes
  createdAt: ISO
}

export interface Conversation {
  id: ID
  clientId: ID
  channel: Channel
  externalThreadId: string
  /** who is answering right now */
  handling: 'ai' | 'human' | 'paused'
  assignedTo?: ID
  intent: string
  needsHuman: boolean
  needsHumanReason?: string
  lastInboundAt: ISO
  lastMessageAt: ISO
  unread: number
  outboundSinceInbound: number // TikTok allows 10 per customer message
  messages: Message[]
  draft?: AiDraft
  pinned?: boolean
}

export type TaskType = 'call' | 'callback' | 'follow_up' | 'clinical_review' | 'payment' | 'review'
export type CallOutcome = 'booked' | 'no_answer' | 'call_back' | 'not_interested' | 'wrong_number' | 'thinking'

export interface CallAttempt { at: ISO; by: ID; outcome: CallOutcome; note?: string }

export interface Task {
  id: ID
  type: TaskType
  title: string
  clientId: ID
  episodeId?: ID
  assignedTo: ID
  createdAt: ISO
  dueAt: ISO
  slaMinutes?: number // e.g. 15 for a fresh lead
  escalationLevel: 0 | 1 | 2 // 0 = assignee, 1 = manager, 2 = owner
  status: 'open' | 'done' | 'cancelled'
  attempts: CallAttempt[]
  brief?: string // AI call brief
  priority: 'urgent' | 'high' | 'normal'
}

export type AppointmentType = 'consultation' | 'session' | 'follow_up'
export type AppointmentStatus = 'unconfirmed' | 'confirmed' | 'arrived' | 'completed' | 'no_show' | 'cancelled'

export interface Appointment {
  id: ID
  clientId: ID
  episodeId: ID
  type: AppointmentType
  procedureId?: ID
  sessionNo?: number
  practitionerId: ID
  roomId: ID
  branchId: ID
  start: ISO
  end: ISO
  status: AppointmentStatus
  deposit: 'none' | 'due' | 'paid'
  reminders: { d2: boolean; d1: boolean; confirmedVia?: Channel }
  notes?: string
}

export interface Procedure {
  id: ID
  name: string
  category: string
  sessions: number // default course length
  intervalWeeks: number
  durationMin: number
  price: number // per course
  priceFrom?: number // range shown to leads
  priceTo?: number
  depositPct: number
  minAge: number
  needsConsent: boolean
}

export interface Session {
  no: number
  status: 'done' | 'booked' | 'due' | 'skipped'
  date?: ISO
  appointmentId?: ID
  note?: string
}

export interface PlanItem {
  id: ID
  procedureId: ID
  sessionsTotal: number
  price: number
  addedAt: ISO // procedures can be added mid-course
  sessions: Session[]
}

export interface TreatmentPlan {
  id: ID
  episodeId: ID
  clientId: ID
  status: 'draft' | 'proposed' | 'accepted' | 'declined' | 'completed'
  items: PlanItem[]
  discount: number
  paymentPlan: { type: 'full' | 'instalments'; instalments?: number }
  consentSigned: boolean
  createdBy: ID
  createdAt: ISO
}

export interface Payment {
  id: ID
  clientId: ID
  episodeId: ID
  kind: 'deposit' | 'instalment' | 'balance' | 'refund'
  amount: number
  status: 'paid' | 'due' | 'overdue' | 'refunded'
  dueAt: ISO
  paidAt?: ISO
  method?: 'card_link' | 'card_in_clinic' | 'bank_transfer' | 'cash'
}

export interface Note {
  id: ID
  clientId: ID
  authorId: ID
  at: ISO
  text: string
  clinical: boolean // restricted to clinical.view
}

export interface Document {
  id: ID
  clientId: ID
  kind: 'consent_form' | 'photo' | 'quote' | 'invoice' | 'id_check'
  title: string
  at: ISO
  restricted: boolean // clinical photos etc.
  signed?: boolean
}

export interface AuditEntry {
  id: ID
  at: ISO
  actor: ID | 'ai' | 'system' | 'claude'
  action: string // e.g. 'stage.override', 'client.view_phone', 'ai.killswitch'
  target: { type: 'client' | 'episode' | 'conversation' | 'task' | 'appointment' | 'plan' | 'payment' | 'user' | 'settings' | 'playbook'; id: ID; label?: string }
  detail: string
  reason?: string
}

export type NotificationKind = 'lead' | 'escalation' | 'reminder' | 'ai' | 'system' | 'payment' | 'clinical'

export interface Notification {
  id: ID
  at: ISO
  userId: ID // recipient
  kind: NotificationKind
  title: string
  body: string
  link?: { page: PageId; id?: ID }
  read: boolean
  deadline?: ISO // SLA deadline shown as a countdown
}

export interface PlaybookSection { title: string; body: string }

export interface PlaybookVersion {
  id: ID
  version: string // 'v0', 'v1', 'v1.1'
  status: 'live' | 'pending' | 'draft' | 'retired'
  createdAt: ISO
  author: ID | 'claude'
  summary: string
  sections: PlaybookSection[]
  approvals: { manager?: { by: ID; at: ISO }; clinician?: { by: ID; at: ISO } }
  evalScore: number // 0-100 on the golden set
  violations: number // guardrail violations in evals
}

export interface Proposal {
  id: ID
  createdAt: ISO
  title: string
  evidence: string
  change: string
  impact: string
  status: 'open' | 'accepted' | 'rejected'
  decidedBy?: ID
}

export interface QaFinding {
  id: ID
  at: ISO
  conversationId: ID
  severity: 'info' | 'warn' | 'violation'
  rule: string
  excerpt: string
  resolved: boolean
}

export interface AiSettings {
  mode: Record<'instagram' | 'tiktok' | 'whatsapp', AiMode>
  killSwitch: boolean
  killSwitchBy?: ID
  killSwitchAt?: ISO
  confidenceThreshold: number // below this the AI hands to a human
  disclosure: string
  escalationText: string
  bannedPhrases: string[]
  businessHours: { start: string; end: string; days: number[] } // 0 = Sunday
  model: string
  effort: 'low' | 'medium' | 'high'
}

export interface SlaRule {
  id: ID
  event: string
  notify: Role[]
  channels: Array<'push' | 'whatsapp' | 'sms' | 'email'>
  escalateAfterMin: number[] // e.g. [15, 60] -> manager at 15, owner at 60
  enabled: boolean
}

export interface ChannelConnection {
  channel: 'instagram' | 'tiktok' | 'whatsapp' | 'sms' | 'email'
  status: 'connected' | 'pending' | 'error' | 'not_connected' | 'manual'
  account: string
  detail: string
  tokenExpiresAt?: ISO
}

export interface McpClient { id: ID; name: string; userId: ID; connectedAt: ISO; lastUsedAt: ISO; scopes: string[] }

export interface Settings {
  orgName: string
  currency: string // ISO code, e.g. 'USD'
  timezone: string
  channels: ChannelConnection[]
  slaRules: SlaRule[]
  retentionMonths: { chats: number; clinical: number; exports: number }
  mcpClients: McpClient[]
}

/** Daily metrics for analytics, one row per day (most recent last). */
export interface DailyMetric {
  date: string // YYYY-MM-DD
  dms: number
  aiReplies: number
  humanReplies: number
  qualified: number
  contacts: number
  booked: number
  attended: number
  treatments: number
  revenue: number
  medianFirstReplySec: number
  callSlaMetPct: number
  byChannel: { instagram: number; tiktok: number }
}

export type PageId =
  | 'today'
  | 'inbox'
  | 'pipeline'
  | 'client'
  | 'tasks'
  | 'calendar'
  | 'ai'
  | 'analytics'
  | 'team'
  | 'settings'

export interface DemoState {
  version: number
  now: ISO // simulated clock base; real time continues from here
  currentUserId: ID
  branches: Branch[]
  rooms: Room[]
  users: User[]
  procedures: Procedure[]
  clients: Client[]
  episodes: Episode[]
  conversations: Conversation[]
  tasks: Task[]
  appointments: Appointment[]
  plans: TreatmentPlan[]
  payments: Payment[]
  notes: Note[]
  documents: Document[]
  audit: AuditEntry[]
  notifications: Notification[]
  playbooks: PlaybookVersion[]
  proposals: Proposal[]
  qa: QaFinding[]
  ai: AiSettings
  settings: Settings
  metrics: DailyMetric[]
}

export const STAGES: Stage[] = ['new', 'qualifying', 'contact', 'call', 'booked', 'consultation', 'plan', 'treatment', 'aftercare', 'alumni']
export const EXITS: Exit[] = ['nurture', 'lost', 'not_suitable', 'dnc', 'spam', 'under18']

export const STAGE_LABEL: Record<Stage, string> = {
  new: 'DM received',
  qualifying: 'AI qualifying',
  contact: 'Contact captured',
  call: 'Call & confirm',
  booked: 'Appointment booked',
  consultation: 'Consultation',
  plan: 'Treatment plan',
  treatment: 'In treatment',
  aftercare: 'Aftercare',
  alumni: 'Alumni',
}

export const EXIT_LABEL: Record<Exit, string> = {
  nurture: 'Nurture',
  lost: 'Lost',
  not_suitable: 'Not suitable',
  dnc: 'Do not contact',
  spam: 'Spam',
  under18: 'Under 18',
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  manager: 'Manager',
  coordinator: 'Lead coordinator',
  frontdesk: 'Front desk',
  clinician: 'Clinician',
  finance: 'Finance',
  marketing: 'Marketing',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  phone: 'Phone',
  walkin: 'Walk-in',
  referral: 'Referral',
}
