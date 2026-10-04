// The demo's reply engine. Production runs this logic in a Worker that calls the Claude API with the
// approved playbook; here a rule-based engine stands in, and live Claude is used when the viewer asks for it.
import type { AiDraft, Conversation, DemoState, Message } from './types'
import type { SampleFn } from './claude'

const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/
const ASKED_NUMBER_RE = /\b(your (phone|number|contact)|contact number|call me|can i call|phone number|whats ?app number|number to call)\b/i
const PRICE_RE = /\b(price|cost|how much|fees?|rate|charges?|expensive|cheap|deposit)\b/i
const CLINICAL_RE = /\b(pregnan\w*|side effects?|allerg\w*|medication|medicine|infection|diabetes|blood thinners?|safe for me|scar\w*|pain(ful)?|eczema|keloid|breastfeeding)\b/i
const MINOR_RE = /\b(i'?m|i am|im)\s*(1[0-7])\b|\b(1[0-7])\s*(yo|years? old)\b|\bin (year|grade) \d+\b|\bmy (mum|mom|parents?) (says|said|will)\b/i
const COMPLAINT_RE = /\b(complain\w*|refund|terrible|awful|scam|worst|angry|disappointed|rude)\b/i
const OPTOUT_RE = /\b(stop messaging|unsubscribe|don'?t (message|contact) me|leave me alone|stop)\b/i
const BOOK_RE = /\b(book|appointment|slot|available|availability|when can|consultation|visit)\b/i
const WHERE_RE = /\b(where|location|address|branch|parking|near)\b/i

export type Flag = NonNullable<Message['flags']>[number]

export function detectFlags(text: string): Flag[] {
  const f: Flag[] = []
  if (PHONE_RE.test(text) && (text.match(/\d/g) || []).length >= 9) f.push('phone_detected')
  if (ASKED_NUMBER_RE.test(text)) f.push('asked_number')
  if (PRICE_RE.test(text)) f.push('price')
  if (CLINICAL_RE.test(text)) f.push('clinical')
  if (MINOR_RE.test(text)) f.push('minor')
  if (COMPLAINT_RE.test(text)) f.push('complaint')
  if (OPTOUT_RE.test(text) && text.trim().split(/\s+/).length <= 6) f.push('opt_out')
  return f
}

export function extractPhone(text: string): string | undefined {
  const m = text.match(PHONE_RE)
  if (!m) return undefined
  let d = m[1].replace(/[^\d+]/g, '')
  if (!d.startsWith('+')) d = d.startsWith('0') ? '+44' + d.slice(1) : '+' + d
  return d.length >= 10 ? d : undefined
}

function lastClientMessage(c: Conversation): Message | undefined {
  for (let i = c.messages.length - 1; i >= 0; i--) if (c.messages[i].author === 'client') return c.messages[i]
  return undefined
}

function hasAiSpoken(c: Conversation): boolean {
  return c.messages.some(m => m.author === 'ai' && m.status !== 'shadow')
}

/** Rule-based draft used by the demo when live Claude isn't requested. */
export function ruleDraft(state: DemoState, c: Conversation): AiDraft {
  const msg = lastClientMessage(c)
  const text = msg?.text ?? ''
  const flags = detectFlags(text)
  const client = state.clients.find(x => x.id === c.clientId)
  const first = client?.name.split(' ')[0] ?? 'there'
  const reasons: string[] = []
  const intro = hasAiSpoken(c) ? '' : `${state.ai.disclosure} `
  if (!hasAiSpoken(c)) reasons.push('First AI reply in this chat, so the AI disclosure is included.')

  const procedure = state.procedures.find(p => text.toLowerCase().includes(p.name.toLowerCase().split(' ')[0].toLowerCase())) ?? state.procedures[0]

  if (flags.includes('opt_out')) {
    return { text: `Understood, ${first}. We won't message you again. If you ever want to talk, just send us a message here.`, confidence: 0.95, intent: 'opt_out', reasons: [...reasons, 'Opt-out detected: marks the person do-not-contact and stops all follow-ups.'], createdAt: new Date().toISOString() }
  }
  if (flags.includes('minor')) {
    return { text: `${intro}Thanks for reaching out, ${first}. Our treatments are only available from age 18, so we can't book an appointment for you. A member of our team will be in touch if you have any other questions.`, confidence: 0.9, intent: 'under18', reasons: [...reasons, 'Possible minor: booking is blocked and a person is alerted.'], createdAt: new Date().toISOString() }
  }
  if (flags.includes('clinical')) {
    return { text: `${intro}That's an important question, ${first}, and it needs one of our clinicians to answer it properly. Could you share the best number to reach you? A clinician can call you, usually the same day.`, confidence: 0.55, intent: 'clinical', reasons: [...reasons, 'Clinical question: the AI does not give medical advice and routes this to a clinician.', 'Confidence is below the handoff threshold, so a person reviews this chat.'], createdAt: new Date().toISOString() }
  }
  if (flags.includes('complaint')) {
    return { text: `${intro}I'm sorry to hear that, ${first}. I've passed this to our team lead, who will contact you personally today.`, confidence: 0.5, intent: 'complaint', reasons: [...reasons, 'Complaint: escalated to a manager; the AI stops replying in this chat.'], createdAt: new Date().toISOString() }
  }
  if (flags.includes('phone_detected')) {
    return { text: `Thank you, ${first}! I've passed your number to our coordinator, who will call you shortly to find a time that suits you and talk you through the next steps.`, confidence: 0.96, intent: 'contact_shared', reasons: ['Phone number detected: lead created and assigned with a 15-minute call deadline.'], createdAt: new Date().toISOString() }
  }
  if (flags.includes('asked_number')) {
    return { text: `${intro}Of course! You can reach us on +44 20 7946 0321 (Mon–Sat, 9am–7pm). Or share your number and our coordinator will call you at a time that suits you.`, confidence: 0.9, intent: 'asked_number', reasons: [...reasons, 'They asked for our number: the approved public number is given and a lead is created to expect their call.'], createdAt: new Date().toISOString() }
  }
  if (flags.includes('price')) {
    const range = procedure.priceFrom && procedure.priceTo ? `between ${fmt(state, procedure.priceFrom)} and ${fmt(state, procedure.priceTo)}` : `from ${fmt(state, procedure.price)}`
    return { text: `${intro}Great question! ${procedure.name} is usually ${range}, depending on what you need. The exact price is confirmed at a free consultation. Would you like one of our coordinators to call you to find a time? If so, just drop your number here.`, confidence: 0.88, intent: 'price', reasons: [...reasons, `Price range taken from the approved price list (${procedure.name}).`, 'Steers toward a call, as the playbook recommends after a price question.'], createdAt: new Date().toISOString() }
  }
  if (flags.length === 0 && BOOK_RE.test(text)) {
    return { text: `${intro}We'd love to see you! Consultations are free and take about 30 minutes. What's the best number for our coordinator to call you on to find a time?`, confidence: 0.9, intent: 'booking', reasons: [...reasons, 'Booking intent: asks for a phone number, which converted best in past chats.'], createdAt: new Date().toISOString() }
  }
  if (WHERE_RE.test(text)) {
    const b = state.branches[0]
    return { text: `${intro}We're at our ${b.name} clinic in ${b.city}, with free parking. Would you like to book a free consultation? Our coordinator can call you to find a time.`, confidence: 0.86, intent: 'location', reasons: [...reasons, 'Location question answered from the approved location facts.'], createdAt: new Date().toISOString() }
  }
  return { text: `${intro}Hi ${first}, thanks for your message! Which treatment are you interested in, and roughly when would you like to start? I can share prices and get you booked in for a free consultation.`, confidence: 0.8, intent: 'qualify', reasons: [...reasons, 'Opening qualifying question from the playbook.'], createdAt: new Date().toISOString() }
}

function fmt(state: DemoState, n: number) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: state.settings.currency, maximumFractionDigits: 0 }).format(n)
  } catch {
    return String(n)
  }
}

/** Builds the prompt the production reply engine would send, and asks live Claude for a draft. */
export async function claudeDraft(sample: SampleFn, state: DemoState, c: Conversation, signal?: AbortSignal): Promise<AiDraft> {
  const live = state.playbooks.find(p => p.status === 'live')
  const client = state.clients.find(x => x.id === c.clientId)
  const prices = state.procedures.map(p => `- ${p.name}: ${p.priceFrom && p.priceTo ? `${fmt(state, p.priceFrom)}–${fmt(state, p.priceTo)}` : fmt(state, p.price)}, ${p.sessions} session(s), min age ${p.minAge}`).join('\n')
  const thread = c.messages.filter(m => m.status !== 'shadow').slice(-14).map(m => `${m.author === 'client' ? 'CLIENT' : m.author === 'system' ? 'SYSTEM' : 'CLINIC'}: ${m.text}`).join('\n')
  const prompt = `You are the instant-reply assistant for ${state.settings.orgName}, replying to a ${c.channel} DM.
Follow the clinic's approved playbook and rules exactly.

PLAYBOOK (${live?.version ?? 'v0'}):
${(live?.sections ?? []).map(s => `## ${s.title}\n${s.body}`).join('\n\n')}

APPROVED PRICE LIST (only quote these ranges):
${prices}

HARD RULES:
- If you have not replied in this chat before, start with: "${state.ai.disclosure}"
- Never give medical advice or judge suitability; route clinical questions to a clinician and ask for a phone number.
- Never promise results. Never name prescription-only medicines. Never book anyone under 18.
- Never pretend to be a named staff member. Never ask for card details.
- Goal: answer briefly and warmly, then ask for their phone number so a coordinator can call.
- Banned phrases: ${state.ai.bannedPhrases.join(', ')}
- Reply in the client's language (${client?.language ?? 'en'}). Keep it under 60 words. Plain text, no markdown.

CONVERSATION SO FAR:
${thread}

Reply with only a JSON object: {"reply": string, "intent": string, "confidence": number between 0 and 1, "handoff": boolean, "reasons": [short strings explaining your choices]}`
  if (sample.json) {
    const out = await sample.json<{ reply?: string; intent?: string; confidence?: number; handoff?: boolean; reasons?: string[] }>(prompt, { signal, cache: false })
    return {
      text: String(out?.reply ?? '').trim() || ruleDraft(state, c).text,
      intent: String(out?.intent ?? 'reply'),
      confidence: Math.max(0, Math.min(1, Number(out?.confidence ?? 0.8))),
      reasons: ['Written by live Claude from the approved playbook.', ...(Array.isArray(out?.reasons) ? out!.reasons!.map(String).slice(0, 4) : [])],
      createdAt: new Date().toISOString(),
    }
  }
  const res = await sample(prompt, { signal, cache: false })
  return { text: res.text.trim(), intent: 'reply', confidence: 0.8, reasons: ['Written by live Claude from the approved playbook.'], createdAt: new Date().toISOString() }
}

/** Short call brief for the coordinator, written from the chat (rule-based stand-in for Claude). */
export function callBrief(state: DemoState, clientId: string): string {
  const client = state.clients.find(c => c.id === clientId)
  const convs = state.conversations.filter(c => c.clientId === clientId)
  const text = convs.flatMap(c => c.messages.filter(m => m.author === 'client').map(m => m.text)).join(' ')
  const ep = state.episodes.filter(e => e.clientId === clientId).sort((a, b) => b.number - a.number)[0]
  const interests = (ep?.interests ?? []).map(id => state.procedures.find(p => p.id === id)?.name).filter(Boolean)
  const bits: string[] = []
  if (interests.length) bits.push(`Interested in ${interests.join(' and ')}.`)
  if (PRICE_RE.test(text)) bits.push('Asked about price; was given the approved range.')
  if (/weekend|saturday|sunday/i.test(text)) bits.push('Prefers weekend appointments.')
  if (/evening|after work|after 6/i.test(text)) bits.push('Prefers evenings.')
  if (CLINICAL_RE.test(text)) bits.push('Raised a clinical question: offer a clinician call, give no advice.')
  if (ep && ep.number > 1) bits.push(`Returning client (episode ${ep.number}).`)
  bits.push(`Language: ${client?.language === 'en' ? 'English' : client?.language ?? 'English'}.`)
  bits.push('Goal: agree a consultation date and when the deposit is due.')
  return bits.join(' ')
}
