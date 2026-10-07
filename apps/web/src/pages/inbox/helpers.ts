// Inbox-only helpers: who can see which chat, how chats are grouped into tabs, and display labels.
import type { Conversation, DemoState, Message, User } from '../../lib/types'
import { can } from '../../lib/permissions'
import { maskPhone } from '../../lib/permissions'
import { HOUR, replyWindow } from '../../lib/time'
import type { Tone } from '../../components/ui'
import type { IconName } from '../../components/icons'

export type InboxTab = 'needs' | 'drafts' | 'ai' | 'all' | 'closing'
export type ChannelFilter = 'all' | 'instagram' | 'tiktok' | 'whatsapp'

export const TABS: { id: InboxTab; label: string }[] = [
  { id: 'needs', label: 'Needs a person' },
  { id: 'drafts', label: 'Drafts to approve' },
  { id: 'ai', label: 'AI handling' },
  { id: 'all', label: 'All' },
  { id: 'closing', label: 'Window closing' },
]

/**
 * People without chats.view_all only see chats assigned to them, chats with clients they own, and chats
 * with clients they have an open task for (e.g. a clinician asked to review a clinical question).
 */
export function canSeeConversation(s: DemoState, me: User, c: Conversation): boolean {
  if (can(me, 'chats.view_all')) return true
  if (!can(me, 'chats.view_assigned')) return false
  if (c.assignedTo === me.id) return true
  const client = s.clients.find(x => x.id === c.clientId)
  if (client?.ownerId === me.id) return true
  return s.tasks.some(t => t.status === 'open' && t.assignedTo === me.id && t.clientId === c.clientId)
}

export function visibleConversations(s: DemoState, me: User): Conversation[] {
  return s.conversations.filter(c => canSeeConversation(s, me, c))
}

const isCopilotReason = (r?: string) => !!r && /^co-pilot/i.test(r)

/** The chat needs a person for a reason other than simply having a co-pilot draft to approve. */
export function needsPerson(c: Conversation): boolean {
  return c.needsHuman && !(c.draft && isCopilotReason(c.needsHumanReason))
}

export function reasonLabel(c: Conversation): string | null {
  if (!needsPerson(c)) return null
  if (!c.needsHumanReason || isCopilotReason(c.needsHumanReason)) return 'Reply needed'
  return c.needsHumanReason
}

export function reasonTone(reason: string): Tone {
  if (/minor|complaint|kill switch/i.test(reason)) return 'danger'
  if (/clinical/i.test(reason)) return 'info'
  return 'warn'
}

export function reasonIcon(reason: string): IconName {
  if (/minor/i.test(reason)) return 'alert'
  if (/complaint/i.test(reason)) return 'flag'
  if (/clinical/i.test(reason)) return 'shield'
  if (/kill switch|paused/i.test(reason)) return 'pause'
  return 'hand'
}

export function windowClosingSoon(c: Conversation, now: number): boolean {
  const w = replyWindow(c, now)
  return w.open && w.msLeft <= 3 * HOUR
}

export function inTab(c: Conversation, tab: InboxTab, now: number): boolean {
  switch (tab) {
    case 'needs': return needsPerson(c)
    case 'drafts': return !!c.draft
    case 'ai': return c.handling === 'ai' && !needsPerson(c) && !c.draft
    case 'closing': return windowClosingSoon(c, now)
    case 'all': return true
  }
}

export function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return Date.parse(b.lastMessageAt) - Date.parse(a.lastMessageAt)
  })
}

export type Flag = NonNullable<Message['flags']>[number]

export const FLAG_META: Record<Flag, { label: string; tone: Tone; icon: IconName }> = {
  phone_detected: { label: 'Phone shared', tone: 'warn', icon: 'phone' },
  asked_number: { label: 'Asked for our number', tone: 'info', icon: 'phone' },
  asked_person: { label: 'Asked for a person', tone: 'warn', icon: 'hand' },
  clinical: { label: 'Clinical', tone: 'team', icon: 'shield' },
  minor: { label: 'Possible minor', tone: 'danger', icon: 'alert' },
  complaint: { label: 'Complaint', tone: 'danger', icon: 'flag' },
  opt_out: { label: 'Opt-out', tone: 'danger', icon: 'x' },
  price: { label: 'Price question', tone: 'neutral', icon: 'card' },
}

const PHONE_IN_TEXT = /\+?\d[\d\s().-]{7,}\d/g

/** Hides phone numbers inside message text for people who may not see them. */
export function maskPhonesInText(text: string, visible: boolean): string {
  if (visible) return text
  return text.replace(PHONE_IN_TEXT, m => ((m.match(/\d/g) || []).length >= 9 ? maskPhone(m.replace(/[^\d+]/g, ''), false) : m))
}

const LANGUAGES: Record<string, string> = { en: 'English', ar: 'Arabic', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese', ur: 'Urdu', pl: 'Polish', tr: 'Turkish' }
export const languageName = (code: string) => LANGUAGES[code] ?? code.toUpperCase()

export const firstName = (name: string) => name.replace(/^Dr\.? /, '').split(' ')[0]

/** Last message worth previewing in the list, with a short author prefix. */
export function snippetOf(s: DemoState, me: User, c: Conversation): { prefix: string; text: string } {
  for (let i = c.messages.length - 1; i >= 0; i--) {
    const m = c.messages[i]
    if (m.author === 'system') continue
    if (m.author === 'client') return { prefix: '', text: m.text }
    if (m.status === 'shadow') return { prefix: 'Shadow draft: ', text: m.text }
    if (m.author === 'ai') return { prefix: 'AI: ', text: m.text }
    if (m.userId === me.id) return { prefix: 'You: ', text: m.text }
    const u = s.users.find(x => x.id === m.userId)
    return { prefix: u ? `${firstName(u.name)}: ` : '', text: m.text }
  }
  const sys = c.messages[c.messages.length - 1]
  return { prefix: '', text: sys?.text ?? 'No messages yet' }
}

export interface SavedReply { id: string; title: string; text: string }

export const SAVED_REPLIES: SavedReply[] = [
  { id: 'consult', title: 'Offer a free consultation', text: 'Hi {first}, our consultations are free and take about 30 minutes. What\'s the best number for our coordinator to call you on to find a time that suits you?' },
  { id: 'price', title: 'Price is confirmed at consultation', text: 'Prices depend on the areas and the number of sessions, so your clinician confirms the exact figure at your free consultation. We also offer interest-free instalments.' },
  { id: 'clinical', title: 'A clinician will call you', text: 'That\'s a really good question for one of our clinicians, {first}. Could you share the best number to reach you? They usually call back the same day.' },
  { id: 'location', title: 'Address and parking', text: 'We\'re at our Marylebone clinic in London, a short walk from Baker Street, with free parking for clients. Opening hours are Monday to Saturday, 9am to 7pm.' },
  { id: 'deposit', title: 'Deposit to hold the slot', text: 'To hold your appointment we take a 20% deposit, fully refundable up to 48 hours before. I\'ll send you a secure payment link by WhatsApp now. Thanks, {me}' },
]

export function fillReply(text: string, clientName: string, myName: string): string {
  return text.replace(/\{first\}/g, firstName(clientName)).replace(/\{me\}/g, firstName(myName))
}
