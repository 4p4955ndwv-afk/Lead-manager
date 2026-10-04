// Admin settings that the shared Settings type does not model yet (security policy, API tokens, webhooks,
// data requests, consent defaults, invite tracking, removed people). They are stored on state.settings.ext so
// they persist with the rest of the demo; reads merge in defaults so older saved states keep working.
// Listed as a shared change request: these fields belong on Settings in src/lib/types.ts.
import type { DemoState, Role, Settings } from '../../lib/types'
import { DAY, HOUR, MIN, iso, ms } from '../../lib/time'

export type WebhookEvent = 'lead.created' | 'appointment.booked' | 'payment.paid'
export const WEBHOOK_EVENTS: { id: WebhookEvent; label: string; hint: string }[] = [
  { id: 'lead.created', label: 'lead.created', hint: 'A DM turned into a lead (a number was shared or they asked for ours)' },
  { id: 'appointment.booked', label: 'appointment.booked', hint: 'A consultation or session was booked or moved' },
  { id: 'payment.paid', label: 'payment.paid', hint: 'A deposit, instalment or balance was paid' },
]

export interface Webhook {
  id: string
  url: string
  events: WebhookEvent[]
  secretLast4: string
  enabled: boolean
  createdAt: string
  createdBy: string
  lastDeliveryAt?: string
  lastStatus?: 'ok' | 'failed'
}

export const TOKEN_SCOPES: { id: string; label: string }[] = [
  { id: 'read:leads', label: 'Read leads and clients' },
  { id: 'write:leads', label: 'Create leads (e.g. from a website form)' },
  { id: 'read:metrics', label: 'Read analytics' },
  { id: 'write:tasks', label: 'Create and update tasks' },
  { id: 'read:payments', label: 'Read payments' },
]

export interface ApiToken {
  id: string
  name: string
  prefix: string
  last4: string
  scopes: string[]
  createdAt: string
  createdBy: string
  expiresAt: string
  lastUsedAt?: string
}

export interface DataRequest {
  id: string
  clientId?: string
  personName: string
  kind: 'export' | 'erase'
  via: string
  receivedAt: string
  dueAt: string
  status: 'open' | 'done'
  doneAt?: string
  doneBy?: string
  note?: string
}

export interface RemovedUser { id: string; name: string; role: Role; removedAt: string }

export interface SettingsExt {
  security: { requireStrongSignIn: boolean; sessionTimeoutMin: number; lastSignOutAllAt?: string }
  webhooks: Webhook[]
  apiTokens: ApiToken[]
  dataRequests: DataRequest[]
  consentDefaults: { whatsappReminders: boolean; smsReminders: boolean; callRecordingNotice: boolean; askMarketingOnCall: boolean }
  /** userId -> when the latest invite email went out */
  invites: Record<string, string>
  removedUsers: RemovedUser[]
  pushTestedAt?: string
}

type WithExt = Settings & { ext?: Partial<SettingsExt> }

function defaults(base: number): SettingsExt {
  const ago = (m: number) => iso(base - m)
  return {
    security: { requireStrongSignIn: false, sessionTimeoutMin: 480 },
    webhooks: [
      { id: 'wh_1', url: 'https://hooks.northlight.example/crm', events: ['lead.created', 'appointment.booked'], secretLast4: '9f2c', enabled: true, createdAt: ago(21 * DAY), createdBy: 'u_owner', lastDeliveryAt: ago(42 * MIN), lastStatus: 'ok' },
      { id: 'wh_2', url: 'https://accounts.northlight.example/webhooks/payments', events: ['payment.paid'], secretLast4: 'a71e', enabled: true, createdAt: ago(18 * DAY), createdBy: 'u_fin', lastDeliveryAt: ago(5 * HOUR), lastStatus: 'ok' },
    ],
    apiTokens: [
      { id: 'tk_api_1', name: 'Website consultation form', prefix: 'lm_live_', last4: 'Q7xd', scopes: ['write:leads'], createdAt: ago(20 * DAY), createdBy: 'u_owner', expiresAt: iso(base + 70 * DAY), lastUsedAt: ago(2 * HOUR) },
    ],
    dataRequests: [
      { id: 'dr_1', clientId: 'cl_kai', personName: 'Kai Morgan', kind: 'erase', via: 'Instagram DM', receivedAt: ago(2 * DAY), dueAt: iso(base + 28 * DAY), status: 'open', note: 'Chose another clinic and asked us to delete their messages and number.' },
      { id: 'dr_2', clientId: 'cl_ella', personName: 'Ella Novak', kind: 'export', via: 'Email', receivedAt: ago(6 * DAY), dueAt: iso(base + 24 * DAY), status: 'open', note: 'Wants a copy of her treatment record and payments for her insurer.' },
      { id: 'dr_3', clientId: 'cl_marcus', personName: 'Marcus Lee', kind: 'export', via: 'Phone', receivedAt: ago(40 * DAY), dueAt: ago(10 * DAY), status: 'done', doneAt: ago(35 * DAY), doneBy: 'u_mgr' },
    ],
    consentDefaults: { whatsappReminders: true, smsReminders: true, callRecordingNotice: true, askMarketingOnCall: true },
    invites: { u_mkt: ago(4 * DAY) },
    removedUsers: [],
  }
}

/** Current admin settings, with defaults filled in. */
export function getExt(s: DemoState): SettingsExt {
  const base = defaults(ms(s.now) || Date.now())
  const e = (s.settings as WithExt).ext ?? {}
  return {
    ...base,
    ...e,
    security: { ...base.security, ...e.security },
    consentDefaults: { ...base.consentDefaults, ...e.consentDefaults },
    invites: { ...base.invites, ...e.invites },
  }
}

/** Mutate admin settings inside actions.update(draft => editExt(draft, ext => ...)). */
export function editExt(d: DemoState, fn: (e: SettingsExt) => void): void {
  const cur = structuredClone(getExt(d))
  fn(cur)
  ;(d.settings as WithExt).ext = cur
}

/** Random token-safe characters (demo only; the real API mints tokens server-side). */
export function randomChars(n: number): string {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  const buf = new Uint32Array(n)
  try {
    crypto.getRandomValues(buf)
  } catch {
    for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 1e9)
  }
  for (let i = 0; i < n; i++) out += abc[buf[i] % abc.length]
  return out
}

/** Copies text with the async clipboard API and falls back to a hidden textarea. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
