// Demo data for a fictional clinic. Every name, handle and number here is invented; UK numbers use the
// Ofcom drama ranges (07700 900xxx, 020 7946 0xxx) so none belongs to a real person.
import type {
  Appointment, AuditEntry, Channel, Client, Conversation, DailyMetric, DemoState, Document, Episode, Message, Note,
  Notification, Payment, PlaybookVersion, Procedure, Proposal, QaFinding, Stage, Task, TreatmentPlan, User,
} from './types'
import { STAGES } from './types'
import { DAY, HOUR, MIN, iso, startOfDay, uid } from './time'

export const SEED_VERSION = 4

// deterministic pseudo-random so the demo looks the same on every reset
function rng(seedNum: number) {
  let a = seedNum >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const now = () => Date.now()
const agoM = (m: number) => iso(now() - m * MIN)
const agoD = (d: number, h = 0) => iso(now() - d * DAY - h * HOUR)
/** Today at hh:mm plus `dayOffset` days. */
const at = (dayOffset: number, hh: number, mm = 0) => iso(startOfDay(now()) + dayOffset * DAY + hh * HOUR + mm * MIN)

const consent = (wa = true, sms = true, marketing = false) => ({ whatsapp: wa, sms, marketing, callRecording: false, updatedAt: agoD(3) })

export const USERS: User[] = [
  { id: 'u_owner', name: 'Amira Haddad', role: 'owner', branchIds: ['b1', 'b2'], email: 'amira@northlight.example', phone: '+447700900101', color: '#0b7a71', onShift: true, twoFactor: 'passkey', status: 'active', lastActiveAt: agoM(3) },
  { id: 'u_mgr', name: 'Daniel Osei', role: 'manager', branchIds: ['b1', 'b2'], email: 'daniel@northlight.example', phone: '+447700900102', color: '#3a5796', onShift: true, twoFactor: 'passkey', status: 'active', lastActiveAt: agoM(12) },
  { id: 'u_co1', name: 'Priya Nair', role: 'coordinator', branchIds: ['b1'], email: 'priya@northlight.example', phone: '+447700900103', color: '#a35a06', onShift: true, twoFactor: 'totp', status: 'active', lastActiveAt: agoM(1) },
  { id: 'u_co2', name: 'Tom Becker', role: 'coordinator', branchIds: ['b1', 'b2'], email: 'tom@northlight.example', phone: '+447700900104', color: '#7a4fb5', onShift: false, twoFactor: 'totp', status: 'active', lastActiveAt: agoD(0, 9) },
  { id: 'u_fd', name: 'Lucia Romero', role: 'frontdesk', branchIds: ['b1'], email: 'lucia@northlight.example', phone: '+447700900105', color: '#b02a6f', onShift: true, twoFactor: 'totp', status: 'active', lastActiveAt: agoM(25) },
  { id: 'u_cl1', name: 'Dr Hannah Clarke', role: 'clinician', branchIds: ['b1'], email: 'hannah@northlight.example', phone: '+447700900106', color: '#1d7438', onShift: true, twoFactor: 'passkey', status: 'active', lastActiveAt: agoM(40) },
  { id: 'u_cl2', name: 'Dr Sami Rahman', role: 'clinician', branchIds: ['b1', 'b2'], email: 'sami@northlight.example', phone: '+447700900107', color: '#5b6b1d', onShift: false, twoFactor: 'passkey', status: 'active', lastActiveAt: agoD(1) },
  { id: 'u_fin', name: 'Grace Li', role: 'finance', branchIds: ['b1', 'b2'], email: 'grace@northlight.example', phone: '+447700900108', color: '#8a3b12', onShift: true, twoFactor: 'totp', status: 'active', lastActiveAt: agoD(0, 3) },
  { id: 'u_mkt', name: 'Jordan Ellis', role: 'marketing', branchIds: ['b1', 'b2'], email: 'jordan@northlight.example', phone: '+447700900109', color: '#1f6f9a', onShift: true, twoFactor: 'none', status: 'invited', lastActiveAt: agoD(4) },
]

export const PROCEDURES: Procedure[] = [
  { id: 'p_lhr', name: 'Laser hair removal', category: 'Laser', sessions: 6, intervalWeeks: 6, durationMin: 45, price: 900, priceFrom: 600, priceTo: 1400, depositPct: 20, minAge: 18, needsConsent: true },
  { id: 'p_prp', name: 'PRP scalp therapy', category: 'Hair', sessions: 4, intervalWeeks: 4, durationMin: 60, price: 1200, priceFrom: 900, priceTo: 1500, depositPct: 20, minAge: 18, needsConsent: true },
  { id: 'p_fue', name: 'Hair transplant (FUE)', category: 'Hair', sessions: 1, intervalWeeks: 0, durationMin: 480, price: 4500, priceFrom: 3500, priceTo: 6500, depositPct: 10, minAge: 21, needsConsent: true },
  { id: 'p_peel', name: 'Chemical peel course', category: 'Skin', sessions: 3, intervalWeeks: 3, durationMin: 45, price: 450, priceFrom: 300, priceTo: 600, depositPct: 20, minAge: 18, needsConsent: true },
  { id: 'p_awt', name: 'Anti-wrinkle treatment', category: 'Injectables', sessions: 1, intervalWeeks: 0, durationMin: 30, price: 250, priceFrom: 180, priceTo: 350, depositPct: 0, minAge: 18, needsConsent: true },
  { id: 'p_sb', name: 'Skin booster course', category: 'Skin', sessions: 3, intervalWeeks: 4, durationMin: 45, price: 750, priceFrom: 600, priceTo: 900, depositPct: 20, minAge: 18, needsConsent: true },
]

// --- building blocks --------------------------------------------------------------------------

type Line = [MessageAuthorShort, string, number] // author, text, minutes ago
type MessageAuthorShort = 'c' | 'a' | 'h' | 's' | 'shadow'

function thread(lines: Line[], humanId = 'u_co1'): Message[] {
  return lines.map(([who, text, m]) => ({
    id: uid('ms'),
    author: who === 'c' ? 'client' : who === 'a' || who === 'shadow' ? 'ai' : who === 'h' ? 'human' : 'system',
    userId: who === 'h' ? humanId : undefined,
    text,
    at: agoM(m),
    status: who === 'shadow' ? 'shadow' : who === 'c' ? 'delivered' : 'read',
    flags: who === 'c' ? flagsFor(text) : undefined,
  }))
}

function flagsFor(text: string): Message['flags'] {
  const f: NonNullable<Message['flags']> = []
  if ((text.match(/\d/g) || []).length >= 9) f.push('phone_detected')
  if (/your number|contact number|call me/i.test(text)) f.push('asked_number')
  if (/price|cost|how much/i.test(text)) f.push('price')
  if (/pregnan|allerg|medication|side effect|eczema|keloid/i.test(text)) f.push('clinical')
  if (/i'?m 1[0-7]\b|i am 1[0-7]\b/i.test(text)) f.push('minor')
  return f.length ? f : undefined
}

interface Spec {
  id: string
  name: string
  channel: Channel
  handle: string
  phone?: string
  language?: string
  stage: Stage
  exit?: Episode['exit']
  exitReason?: string
  interests: string[]
  createdDaysAgo: number
  owner?: string
  branch?: string
  tags?: string[]
  score: number
  source: string
  lines?: Line[]
  handling?: Conversation['handling']
  needsHuman?: string
  draft?: string
  value?: number
  previousEpisode?: boolean
}

const SPECS: Spec[] = [
  {
    id: 'cl_maya', name: 'Maya Thompson', channel: 'instagram', handle: 'maya.t.glow', stage: 'qualifying', interests: ['p_lhr'], createdDaysAgo: 0, score: 64,
    source: 'Reel: "6 sessions, smooth for good"', lines: [
      ['c', 'Hiii saw your reel about laser 😍 do you do underarms and legs together?', 14],
      ['a', 'Hi! I\'m the Northlight assistant, an AI, and a person can join any time. Yes, underarms and full legs can be done together in one visit. Most people need about 6 sessions. Roughly when were you hoping to start?', 13],
      ['c', 'Maybe next month? how much would that be', 6],
    ], draft: 'Great question! Underarms and full legs together are usually between £600 and £1,400 for a 6-session course, depending on the areas. The exact price is confirmed at a free consultation. Would you like our coordinator to call you to find a time? If so, just drop your number here.',
  },
  {
    id: 'cl_omar', name: 'Omar Siddiqui', channel: 'tiktok', handle: 'omar.fades', stage: 'contact', interests: ['p_fue', 'p_prp'], createdDaysAgo: 0, score: 82, phone: '+447700900482', owner: 'u_co1',
    source: 'TikTok: "Hairline restoration journey, month 9"', lines: [
      ['c', 'yo do u guys do hair transplants', 48],
      ['a', 'Hi! I\'m Northlight\'s AI assistant (a person can step in any time). Yes, we do FUE hair transplants and PRP scalp therapy. Are you thinking about your hairline, the crown, or both?', 47],
      ['c', 'hairline mostly, its been going back for like 2 years', 40],
      ['a', 'Thanks for sharing that. Our clinicians look at the hairline and donor area at a free consultation and recommend the best option. Would you like a coordinator to call you to set that up?', 39],
      ['c', 'yeah go on its 07700 900482, after 6 is best', 9],
      ['s', 'Lead created. Priya Nair has 15 minutes to call.', 9],
      ['a', 'Thanks Omar! I\'ve passed your number to our coordinator, who will call you after 6pm to find a time that suits you.', 9],
    ],
  },
  {
    id: 'cl_sofia', name: 'Sofía Herrera', channel: 'instagram', handle: 'sofiaherrera_', language: 'es', stage: 'contact', interests: ['p_peel'], createdDaysAgo: 0, score: 71, phone: '+447700900517', owner: 'u_co1',
    source: 'Story reply: "Glow week offer"', lines: [
      ['c', 'Hola! Hacéis peelings químicos? Cuánto cuesta?', 75],
      ['a', '¡Hola! Soy el asistente de Northlight, una IA; una persona puede intervenir cuando quieras. Sí, hacemos peelings químicos. Un curso de 3 sesiones suele costar entre £300 y £600. ¿Quieres que una coordinadora te llame para reservar una consulta gratuita?', 74],
      ['c', 'Sí, mi número es 07700 900517', 33],
      ['s', 'Lead created. Priya Nair has 15 minutes to call.', 33],
      ['a', '¡Gracias, Sofía! Nuestra coordinadora te llamará en breve.', 33],
    ],
  },
  {
    id: 'cl_jade', name: 'Jade Okafor', channel: 'instagram', handle: 'jadeokafor', stage: 'qualifying', interests: ['p_lhr'], createdDaysAgo: 0, score: 40,
    source: 'Comment on post: "Laser FAQ"', handling: 'ai', needsHuman: 'Clinical question', lines: [
      ['c', 'Hi, is laser ok if I\'m pregnant? I\'m 5 months', 22],
      ['a', 'Hi! I\'m the Northlight assistant, an AI. That\'s an important question and it needs one of our clinicians to answer it properly. Could you share the best number to reach you? A clinician can call you, usually the same day.', 21],
    ],
  },
  {
    id: 'cl_lena', name: 'Lena Fischer', channel: 'tiktok', handle: 'lenafischer.skin', stage: 'new', interests: ['p_sb'], createdDaysAgo: 0, score: 35,
    source: 'TikTok: "Skin booster before/after explained"', lines: [
      ['c', 'what do skin boosters actually do?', 3],
    ], draft: 'Hi! I\'m Northlight\'s AI assistant, and a person can join any time. Skin boosters are a course of treatments that hydrate the skin from within for a fresher look. A course is usually 3 sessions, four weeks apart. Would you like prices or a free consultation?',
  },
  {
    id: 'cl_ryan', name: 'Ryan Walsh', channel: 'instagram', handle: 'ryanwalsh_', stage: 'call', interests: ['p_prp'], createdDaysAgo: 1, score: 74, phone: '+447700900233', owner: 'u_co2',
    source: 'Reel: "PRP explained in 30 seconds"', lines: [
      ['c', 'How many PRP sessions do people normally need?', 60 * 26],
      ['a', 'Hi! I\'m the Northlight assistant (an AI; a person can join any time). Most people have a course of 4 sessions, four weeks apart. Would you like our coordinator to call you about a free consultation?', 60 * 26 - 1],
      ['c', 'Sure 07700 900233', 60 * 25],
      ['s', 'Lead created. Tom Becker has 15 minutes to call.', 60 * 25],
    ],
  },
  {
    id: 'cl_aisha', name: 'Aisha Rahman', channel: 'instagram', handle: 'aisha.rhmn', language: 'ar', stage: 'booked', interests: ['p_lhr', 'p_sb'], createdDaysAgo: 3, score: 88, phone: '+447700900344', owner: 'u_co1',
    source: 'Reel: "6 sessions, smooth for good"', value: 1650, lines: [
      ['c', 'مرحبا، هل تقدمون إزالة الشعر بالليزر للوجه؟', 60 * 75],
      ['a', 'مرحباً! أنا مساعد نورثلايت، وهو ذكاء اصطناعي، ويمكن لأحد موظفينا الانضمام في أي وقت. نعم، نقدم إزالة الشعر بالليزر للوجه. هل تودين أن تتصل بك منسقتنا لحجز استشارة مجانية؟', 60 * 75 - 1],
      ['c', 'نعم رقمي 07700 900344', 60 * 74],
      ['s', 'Lead created. Priya Nair has 15 minutes to call.', 60 * 74],
      ['h', 'Hi Aisha, lovely speaking to you just now. Your consultation is confirmed for Thursday at 11:00. See you then!', 60 * 73],
      ['c', 'شكراً جزيلاً ❤️', 60 * 72],
    ],
  },
  {
    id: 'cl_ben', name: 'Ben Carter', channel: 'tiktok', handle: 'bencarter.fit', stage: 'booked', interests: ['p_fue'], createdDaysAgo: 5, score: 79, phone: '+447700900455', owner: 'u_co1',
    source: 'TikTok: "FUE day in the clinic"', value: 4500, lines: [
      ['c', 'how long is recovery after FUE', 60 * 24 * 5],
      ['a', 'Hi! I\'m Northlight\'s AI assistant. Recovery varies from person to person, and our clinicians explain it fully at a free consultation. Would you like a coordinator to call you to book one?', 60 * 24 * 5 - 2],
      ['c', 'ok 07700900455', 60 * 24 * 5 - 30],
      ['s', 'Lead created. Priya Nair has 15 minutes to call.', 60 * 24 * 5 - 30],
    ],
  },
  {
    id: 'cl_chloe', name: 'Chloe Martin', channel: 'instagram', handle: 'chloemartin.mua', stage: 'plan', interests: ['p_peel', 'p_sb'], createdDaysAgo: 9, score: 85, phone: '+447700900566', owner: 'u_co1', value: 1200,
    source: 'Story reply: "Glow week offer"', lines: [
      ['c', 'Is the glow week offer still on?', 60 * 24 * 9],
      ['a', 'Hi Chloe! I\'m the Northlight assistant, an AI. The glow week offer has ended, but consultations are always free. Would you like our coordinator to call you?', 60 * 24 * 9 - 1],
      ['c', 'yes please, 07700 900566', 60 * 24 * 9 - 20],
    ],
  },
  {
    id: 'cl_noah', name: 'Noah Bennett', channel: 'instagram', handle: 'noah.bennett', stage: 'treatment', interests: ['p_prp', 'p_fue'], createdDaysAgo: 70, score: 92, phone: '+447700900677', owner: 'u_co2', value: 5700,
    source: 'Reel: "PRP explained in 30 seconds"', lines: [
      ['c', 'Just confirming my session next week is still on?', 60 * 20],
      ['h', 'Hi Noah, yes! Session 3 of PRP is booked for next Tuesday at 10:00 with Dr Clarke. See you then.', 60 * 19],
      ['c', 'Perfect, thanks!', 60 * 19 - 4],
    ], handling: 'human',
  },
  {
    id: 'cl_ella', name: 'Ella Novak', channel: 'tiktok', handle: 'ellanovak', stage: 'treatment', interests: ['p_lhr'], createdDaysAgo: 120, score: 90, phone: '+447700900788', owner: 'u_co1', value: 900,
    source: 'TikTok: "Laser myths busted"',
  },
  {
    id: 'cl_marcus', name: 'Marcus Lee', channel: 'instagram', handle: 'marcuslee.ldn', stage: 'aftercare', interests: ['p_fue'], createdDaysAgo: 160, score: 95, phone: '+447700900899', owner: 'u_co2', value: 4800,
    source: 'Reel: "FUE day in the clinic"',
  },
  {
    id: 'cl_hana', name: 'Hana Sato', channel: 'instagram', handle: 'hana.sato', stage: 'qualifying', interests: ['p_lhr', 'p_peel'], createdDaysAgo: 0, score: 77, phone: '+447700900911', owner: 'u_co1', previousEpisode: true,
    source: 'Returning client: DM to main account', lines: [
      ['c', 'Hi again! I did laser with you 2 years ago, I\'d like to do a peel course now 🙂', 31],
      ['a', 'Welcome back, Hana! Lovely to hear from you again. A chemical peel course is usually 3 sessions, three weeks apart, between £300 and £600. Shall I ask Priya, who looked after you last time, to give you a call?', 30],
    ],
  },
  {
    id: 'cl_zara', name: 'Zara Ahmed', channel: 'tiktok', handle: 'zaraahmed_', stage: 'qualifying', exit: 'nurture', exitReason: 'Wants to start after the summer', interests: ['p_lhr'], createdDaysAgo: 14, score: 52,
    source: 'TikTok: "Laser myths busted"', lines: [
      ['c', 'love this but i\'ll wait until after summer to start', 60 * 24 * 14],
      ['a', 'That makes sense! Laser works best when you can avoid strong sun between sessions. Shall I message you in September with availability?', 60 * 24 * 14 - 1],
      ['c', 'yes please x', 60 * 24 * 14 - 10],
    ],
  },
  {
    id: 'cl_kai', name: 'Kai Morgan', channel: 'instagram', handle: 'kaimorgan', stage: 'call', exit: 'lost', exitReason: 'Chose a clinic closer to home', interests: ['p_awt'], createdDaysAgo: 21, score: 30, phone: '+447700900922',
    source: 'Comment on post: "Anti-wrinkle FAQ"',
  },
  {
    id: 'cl_lily', name: 'Lily Evans', channel: 'tiktok', handle: 'lily.e2009', stage: 'qualifying', exit: 'under18', exitReason: 'Said she is 16', interests: ['p_lhr'], createdDaysAgo: 2, score: 5,
    source: 'TikTok: "Laser myths busted"', needsHuman: 'Possible minor', lines: [
      ['c', 'how much for laser? i\'m 16 btw', 60 * 50],
      ['a', 'Hi! I\'m Northlight\'s AI assistant. Thanks for reaching out. Our treatments are only available from age 18, so we can\'t book an appointment for you. A member of our team will be in touch if you have any other questions.', 60 * 50 - 1],
    ],
  },
  {
    id: 'cl_victor', name: 'Victor Dubois', channel: 'instagram', handle: 'victordubois', language: 'fr', stage: 'qualifying', interests: ['p_awt'], createdDaysAgo: 0, score: 48,
    source: 'Reel: "Anti-wrinkle in 30 minutes"', handling: 'ai', lines: [
      ['c', 'Bonjour, vous êtes où exactement ?', 120],
      ['shadow', 'Bonjour ! Je suis l\'assistant de Northlight, une IA. Nous sommes à Marylebone, Londres, avec parking gratuit. Voulez-vous réserver une consultation gratuite ?', 119],
      ['h', 'Bonjour Victor ! Nous sommes à Marylebone (Londres), parking gratuit. Une consultation gratuite vous intéresse ?', 100],
      ['c', 'Oui pourquoi pas', 95],
    ],
  },
]

// --- seed -------------------------------------------------------------------------------------

export function seed(): DemoState {
  const r = rng(42)
  const clients: Client[] = []
  const episodes: Episode[] = []
  const conversations: Conversation[] = []
  const tasks: Task[] = []
  const appointments: Appointment[] = []
  const plans: TreatmentPlan[] = []
  const payments: Payment[] = []
  const notes: Note[] = []
  const documents: Document[] = []
  const audit: AuditEntry[] = []
  const notifications: Notification[] = []

  for (const s of SPECS) {
    const created = s.createdDaysAgo === 0 ? agoM((s.lines?.[0]?.[2] ?? 30) + 1) : agoD(s.createdDaysAgo)
    clients.push({
      id: s.id, name: s.name, handles: s.channel === 'tiktok' ? { tiktok: '@' + s.handle } : { instagram: '@' + s.handle }, phone: s.phone,
      email: s.stage === 'treatment' || s.stage === 'aftercare' ? `${s.handle.replace(/[^a-z]/gi, '')}@example.com` : undefined,
      language: s.language ?? 'en', ageVerified: STAGES.indexOf(s.stage) >= STAGES.indexOf('consultation'), tags: s.tags ?? [],
      consent: consent(true, true, s.stage === 'alumni' || s.stage === 'aftercare'), doNotContact: false, ownerId: s.owner, branchId: s.branch ?? 'b1',
      source: { channel: s.channel, detail: s.source }, createdAt: created, score: s.score,
    })
    let epNo = 1
    if (s.previousEpisode) {
      episodes.push({
        id: s.id.replace('cl_', 'ep_') + '_1', clientId: s.id, number: 1, startedAt: agoD(760), endedAt: agoD(540), stage: 'alumni', interests: ['p_lhr'], value: 900,
        history: STAGES.map((st, i) => ({ at: agoD(760 - i * 22), to: st, by: i < 2 ? 'ai' : 'u_co1' })),
      })
      epNo = 2
    }
    const path = STAGES.slice(0, STAGES.indexOf(s.stage) + 1)
    const span = Math.max(s.createdDaysAgo, 0.02)
    const ep: Episode = {
      id: s.id.replace('cl_', 'ep_') + (epNo > 1 ? '_2' : ''), clientId: s.id, number: epNo, startedAt: created, stage: s.stage, exit: s.exit, exitReason: s.exitReason,
      interests: s.interests, value: s.value ?? PROCEDURES.find(p => p.id === s.interests[0])!.price,
      history: path.map((st, i) => ({ at: iso(Date.parse(created) + (i / Math.max(path.length, 1)) * span * DAY), from: i ? path[i - 1] : undefined, to: st, by: i < 2 ? 'ai' : st === 'contact' ? 'ai' : s.owner ?? 'u_co1' })),
    }
    if (s.exit) ep.history.push({ at: agoD(Math.max(0, s.createdDaysAgo - 1)), from: s.stage, to: s.exit, by: s.exit === 'under18' ? 'ai' : s.owner ?? 'u_co1', reason: s.exitReason })
    episodes.push(ep)

    if (s.lines) {
      const msgs = thread(s.lines, s.owner ?? 'u_co1')
      const lastIn = [...msgs].reverse().find(m => m.author === 'client')
      const lastOutIdx = msgs.length - 1 - [...msgs].reverse().findIndex(m => m.author === 'client')
      const conv: Conversation = {
        id: s.id.replace('cl_', 'cv_'), clientId: s.id, channel: s.channel, externalThreadId: `${s.channel}-${s.handle}`, handling: s.handling ?? 'ai',
        assignedTo: s.handling === 'human' ? s.owner : undefined, intent: s.stage === 'contact' ? 'contact_shared' : 'qualify',
        needsHuman: !!s.needsHuman || !!s.draft, needsHumanReason: s.needsHuman ?? (s.draft ? 'Co-pilot: draft ready' : undefined),
        lastInboundAt: lastIn?.at ?? created, lastMessageAt: msgs[msgs.length - 1].at, unread: msgs[msgs.length - 1].author === 'client' ? 1 : 0,
        outboundSinceInbound: msgs.slice(lastOutIdx + 1).filter(m => m.author === 'ai' || m.author === 'human').length, messages: msgs,
      }
      if (s.draft) conv.draft = { text: s.draft, confidence: 0.86, intent: 'price', reasons: ['Price range taken from the approved price list.', 'Steers toward a call, as the playbook recommends after a price question.'], createdAt: agoM(5) }
      conversations.push(conv)
    }
  }

  // background clients so lists and the board look like a real month
  const FIRST = ['Amelia', 'Leo', 'Isla', 'Yusuf', 'Freya', 'Mateo', 'Ava', 'Rohan', 'Nina', 'Ethan', 'Layla', 'Oscar', 'Sienna', 'Adam', 'Ruby', 'Ibrahim', 'Poppy', 'Luca', 'Zainab', 'Harvey', 'Mila', 'Dev', 'Eva', 'Samir', 'Holly', 'Theo']
  const LAST = ['Clarke', 'Patel', 'Murphy', 'Khan', 'Wright', 'Silva', 'Brown', 'Mehta', 'Kowalski', 'Hughes', 'Farouk', 'Reid', 'Costa', 'Ali', 'Turner', 'Malik', 'Green', 'Rossi', 'Bakr', 'Shaw', 'Ivanova', 'Shah', 'Lund', 'Haddad', 'Price', 'Grant']
  const STAGE_POOL: Array<[Stage, Episode['exit']?]> = [
    ['new'], ['qualifying'], ['qualifying'], ['qualifying', 'nurture'], ['contact'], ['call'], ['call'], ['call', 'lost'], ['booked'], ['booked'], ['consultation'], ['consultation', 'not_suitable'],
    ['plan'], ['plan'], ['treatment'], ['treatment'], ['treatment'], ['aftercare'], ['aftercare'], ['alumni'], ['alumni'], ['qualifying', 'spam'], ['booked'], ['plan', 'lost'], ['treatment'], ['contact'],
  ]
  const LOST_REASONS = ['Price too high', 'Chose a clinic closer to home', 'Went quiet after the call', 'Booked elsewhere']
  const SOURCES = ['Reel: "6 sessions, smooth for good"', 'TikTok: "Laser myths busted"', 'TikTok: "FUE day in the clinic"', 'Story reply: "Glow week offer"', 'Reel: "PRP explained in 30 seconds"', 'Comment on post: "Laser FAQ"']
  FIRST.forEach((fn, i) => {
    const [stage, exit] = STAGE_POOL[i % STAGE_POOL.length]
    const id = `cl_f${i + 1}`
    const channel: Channel = r() < 0.6 ? 'instagram' : 'tiktok'
    const handle = `${fn}.${LAST[i]}`.toLowerCase()
    const daysAgo = Math.round(1 + STAGES.indexOf(stage) * 9 + r() * 12)
    const proc = PROCEDURES[Math.floor(r() * PROCEDURES.length)]
    const owner = r() < 0.6 ? 'u_co1' : 'u_co2'
    const hasPhone = STAGES.indexOf(stage) >= STAGES.indexOf('contact')
    const created = agoD(daysAgo, Math.round(r() * 8))
    clients.push({
      id, name: `${fn} ${LAST[i]}`, handles: channel === 'tiktok' ? { tiktok: '@' + handle } : { instagram: '@' + handle }, phone: hasPhone ? `+447700900${String(300 + i * 7).padStart(3, '0')}` : undefined,
      language: i % 9 === 4 ? 'ar' : i % 11 === 6 ? 'es' : 'en', ageVerified: STAGES.indexOf(stage) >= STAGES.indexOf('consultation'), tags: i % 5 === 0 ? ['VIP'] : i % 7 === 0 ? ['Referral'] : [],
      consent: consent(hasPhone, hasPhone, stage === 'alumni'), doNotContact: false, ownerId: hasPhone ? owner : undefined, branchId: i % 4 === 3 ? 'b2' : 'b1',
      source: { channel, detail: SOURCES[i % SOURCES.length] }, createdAt: created, score: Math.round(30 + r() * 65),
    })
    const path = STAGES.slice(0, STAGES.indexOf(stage) + 1)
    const ep: Episode = {
      id: `ep_f${i + 1}`, clientId: id, number: 1, startedAt: created, stage, exit, exitReason: exit === 'lost' ? LOST_REASONS[i % LOST_REASONS.length] : exit === 'nurture' ? 'Not ready yet' : exit === 'not_suitable' ? 'Clinician advised against treatment' : exit === 'spam' ? 'Spam account' : undefined,
      interests: [proc.id], value: proc.price,
      history: path.map((st, k) => ({ at: iso(Date.parse(created) + (k / path.length) * daysAgo * DAY), from: k ? path[k - 1] : undefined, to: st, by: k < 3 ? 'ai' : owner })),
    }
    if (exit) ep.history.push({ at: agoD(Math.max(0, daysAgo - 2)), from: stage, to: exit, by: exit === 'spam' ? 'ai' : owner, reason: ep.exitReason })
    if (stage === 'alumni') ep.endedAt = ep.history[ep.history.length - 1].at
    episodes.push(ep)
    if (stage === 'treatment' || stage === 'aftercare' || stage === 'alumni') {
      const done = stage === 'treatment' ? Math.max(1, Math.floor(proc.sessions / 2)) : proc.sessions
      plans.push({ id: `pl_f${i + 1}`, episodeId: ep.id, clientId: id, status: stage === 'treatment' ? 'accepted' : 'completed', discount: 0, paymentPlan: { type: 'full' }, consentSigned: true, createdBy: 'u_cl1', createdAt: agoD(daysAgo - 3),
        items: [{ id: `pi_f${i + 1}`, procedureId: proc.id, sessionsTotal: proc.sessions, price: proc.price, addedAt: agoD(daysAgo - 3), sessions: Array.from({ length: proc.sessions }, (_, k) => ({ no: k + 1, status: k < done ? 'done' as const : 'due' as const, date: k < done ? agoD(Math.max(1, daysAgo - 5 - k * proc.intervalWeeks * 7)) : undefined })) }] })
      payments.push({ id: `py_f${i + 1}`, clientId: id, episodeId: ep.id, kind: 'balance', amount: proc.price, status: 'paid', dueAt: agoD(daysAgo - 3), paidAt: agoD(daysAgo - 3), method: 'card_link' })
    }
  })

  // tasks: fresh leads waiting for a call, one overdue and escalated
  const brief = (txt: string) => txt
  tasks.push(
    { id: 'tk_omar', type: 'call', title: 'Call Omar Siddiqui to book a consultation', clientId: 'cl_omar', episodeId: 'ep_omar', assignedTo: 'u_co1', createdAt: agoM(9), dueAt: iso(now() + 6 * MIN), slaMinutes: 15, escalationLevel: 0, status: 'open', attempts: [], priority: 'urgent', brief: brief('Interested in Hair transplant (FUE) and PRP scalp therapy. Hairline receding for about 2 years. Prefers calls after 6pm. Goal: agree a consultation date and when the deposit is due.') },
    { id: 'tk_sofia', type: 'call', title: 'Call Sofía Herrera to book a consultation', clientId: 'cl_sofia', episodeId: 'ep_sofia', assignedTo: 'u_co1', createdAt: agoM(33), dueAt: agoM(18), slaMinutes: 15, escalationLevel: 1, status: 'open', attempts: [], priority: 'urgent', brief: brief('Interested in a chemical peel course. Asked about price and was given the £300–£600 range. Speaks Spanish; a Spanish-speaking colleague is a plus. Goal: agree a consultation date and when the deposit is due.') },
    { id: 'tk_ryan', type: 'callback', title: 'Call Ryan Walsh back (asked for Thursday morning)', clientId: 'cl_ryan', episodeId: 'ep_ryan', assignedTo: 'u_co2', createdAt: agoD(1), dueAt: at(1, 10, 0), escalationLevel: 0, status: 'open', attempts: [{ at: agoD(1, -1), by: 'u_co2', outcome: 'no_answer' }, { at: agoD(0, 20), by: 'u_co2', outcome: 'call_back', note: 'Busy at work, call Thursday morning' }], priority: 'normal', brief: 'Interested in PRP scalp therapy (4 sessions). Asked how many sessions are typical. Goal: book a free consultation.' },
    { id: 'tk_jade', type: 'clinical_review', title: 'Clinical question from Jade Okafor (pregnancy)', clientId: 'cl_jade', episodeId: 'ep_jade', assignedTo: 'u_cl1', createdAt: agoM(21), dueAt: iso(now() + 3 * HOUR), escalationLevel: 0, status: 'open', attempts: [], priority: 'high', brief: 'Asked whether laser is safe at 5 months pregnant. The AI gave no advice and asked for a number for a clinician call.' },
    { id: 'tk_chloe', type: 'follow_up', title: 'Follow up on Chloe Martin\'s treatment plan', clientId: 'cl_chloe', episodeId: 'ep_chloe', assignedTo: 'u_co1', createdAt: agoD(2), dueAt: at(0, 16, 30), escalationLevel: 0, status: 'open', attempts: [], priority: 'normal', brief: 'Plan proposed: chemical peel course + skin booster course (£1,200 total). Said she would think about instalments.' },
    { id: 'tk_noah_pay', type: 'payment', title: 'Instalment 2 overdue: Noah Bennett', clientId: 'cl_noah', episodeId: 'ep_noah', assignedTo: 'u_fin', createdAt: agoD(3), dueAt: agoD(1), escalationLevel: 0, status: 'open', attempts: [], priority: 'high' },
    { id: 'tk_marcus', type: 'review', title: 'Ask Marcus Lee for a review (6-month follow-up done)', clientId: 'cl_marcus', episodeId: 'ep_marcus', assignedTo: 'u_co2', createdAt: agoD(1), dueAt: at(2, 12, 0), escalationLevel: 0, status: 'open', attempts: [], priority: 'normal' },
  )

  // past lead calls, so the call history and leaderboard have real attempts behind them
  episodes.forEach((ep, k) => {
    const client = clients.find(c => c.id === ep.clientId)
    if (!client?.phone || STAGES.indexOf(ep.stage) < STAGES.indexOf('booked') || ep.number > 1 && ep.stage === 'qualifying') return
    const contact = ep.history.find(h => h.to === 'contact')
    if (!contact) return
    const by = client.ownerId ?? 'u_co1'
    const start = Date.parse(contact.at)
    const late = k % 6 === 0
    const attempts: Task['attempts'] = []
    if (k % 4 === 1) attempts.push({ at: iso(start + (late ? 34 : 9) * MIN), by, outcome: 'no_answer' })
    attempts.push({ at: iso(start + (attempts.length ? 130 : late ? 41 : 6 + (k % 8)) * MIN), by, outcome: 'booked', note: 'Consultation booked; deposit by link within 24 h' })
    tasks.push({ id: `tk_past_${ep.id}`, type: 'call', title: `Call ${client.name} to book a consultation`, clientId: client.id, episodeId: ep.id, assignedTo: by, createdAt: contact.at, dueAt: iso(start + 15 * MIN), slaMinutes: 15, escalationLevel: late ? 1 : 0, status: 'done', attempts, priority: 'urgent' })
  })

  // appointments around this week
  const appt = (id: string, clientId: string, type: Appointment['type'], day: number, hh: number, mm: number, dur: number, practitionerId: string, roomId: string, status: Appointment['status'], extra: Partial<Appointment> = {}): Appointment => ({
    id, clientId, episodeId: (clientId.replace('cl_', 'ep_')) + (clientId === 'cl_hana' ? '_2' : ''), type, practitionerId, roomId, branchId: 'b1', start: at(day, hh, mm), end: iso(Date.parse(at(day, hh, mm)) + dur * MIN), status,
    deposit: 'none', reminders: { d2: day >= 2 ? false : true, d1: day >= 1 ? day === 1 : true, confirmedVia: status === 'confirmed' ? 'whatsapp' : undefined }, ...extra,
  })
  appointments.push(
    appt('ap_ella5', 'cl_ella', 'session', 0, 9, 30, 45, 'u_cl1', 'r3', 'completed', { procedureId: 'p_lhr', sessionNo: 5 }),
    appt('ap_noah2', 'cl_noah', 'session', 0, 11, 0, 60, 'u_cl1', 'r1', 'arrived', { procedureId: 'p_prp', sessionNo: 2 }),
    appt('ap_chloe', 'cl_chloe', 'follow_up', 0, 14, 0, 30, 'u_cl2', 'r2', 'confirmed', { notes: 'Go through the plan and payment options' }),
    appt('ap_walkin', 'cl_marcus', 'follow_up', 0, 16, 0, 30, 'u_cl2', 'r1', 'unconfirmed', { notes: '6-month FUE review' }),
    appt('ap_aisha', 'cl_aisha', 'consultation', 2, 11, 0, 30, 'u_cl1', 'r1', 'confirmed', { procedureId: 'p_lhr', deposit: 'paid' }),
    appt('ap_ben', 'cl_ben', 'consultation', 1, 15, 30, 45, 'u_cl2', 'r2', 'unconfirmed', { procedureId: 'p_fue', deposit: 'due' }),
    appt('ap_noah3', 'cl_noah', 'session', 5, 10, 0, 60, 'u_cl1', 'r1', 'confirmed', { procedureId: 'p_prp', sessionNo: 3 }),
    appt('ap_ella6', 'cl_ella', 'session', 9, 9, 30, 45, 'u_cl1', 'r3', 'confirmed', { procedureId: 'p_lhr', sessionNo: 6 }),
    appt('ap_kai', 'cl_kai', 'consultation', -3, 13, 0, 30, 'u_cl2', 'r2', 'no_show', { procedureId: 'p_awt' }),
  )

  // treatment plans
  const sess = (n: number, done: number, booked: number[] = [], start = 60, intervalDays = 28): PlanItem['sessions'] =>
    Array.from({ length: n }, (_, i) => ({ no: i + 1, status: i < done ? 'done' : booked.includes(i + 1) ? 'booked' : 'due', date: i < done ? agoD(start - i * intervalDays) : undefined }))
  type PlanItem = TreatmentPlan['items'][number]
  plans.push(
    { id: 'pl_noah', episodeId: 'ep_noah', clientId: 'cl_noah', status: 'accepted', discount: 300, paymentPlan: { type: 'instalments', instalments: 3 }, consentSigned: true, createdBy: 'u_cl1', createdAt: agoD(62),
      items: [
        { id: 'pi_noah1', procedureId: 'p_prp', sessionsTotal: 4, price: 1200, addedAt: agoD(62), sessions: [{ no: 1, status: 'done', date: agoD(28) }, { no: 2, status: 'booked', appointmentId: 'ap_noah2' }, { no: 3, status: 'booked', appointmentId: 'ap_noah3' }, { no: 4, status: 'due' }] },
        { id: 'pi_noah2', procedureId: 'p_fue', sessionsTotal: 1, price: 4500, addedAt: agoD(20), sessions: sess(1, 0) },
      ] },
    { id: 'pl_ella', episodeId: 'ep_ella', clientId: 'cl_ella', status: 'accepted', discount: 0, paymentPlan: { type: 'full' }, consentSigned: true, createdBy: 'u_cl1', createdAt: agoD(118),
      items: [{ id: 'pi_ella1', procedureId: 'p_lhr', sessionsTotal: 6, price: 900, addedAt: agoD(118), sessions: [...sess(5, 5, [], 112, 25).slice(0, 4), { no: 5, status: 'done', date: at(0, 9, 30) }, { no: 6, status: 'booked', appointmentId: 'ap_ella6' }] }] },
    { id: 'pl_chloe', episodeId: 'ep_chloe', clientId: 'cl_chloe', status: 'proposed', discount: 0, paymentPlan: { type: 'instalments', instalments: 2 }, consentSigned: false, createdBy: 'u_cl2', createdAt: agoD(2),
      items: [
        { id: 'pi_chloe1', procedureId: 'p_peel', sessionsTotal: 3, price: 450, addedAt: agoD(2), sessions: sess(3, 0) },
        { id: 'pi_chloe2', procedureId: 'p_sb', sessionsTotal: 3, price: 750, addedAt: agoD(2), sessions: sess(3, 0) },
      ] },
    { id: 'pl_marcus', episodeId: 'ep_marcus', clientId: 'cl_marcus', status: 'completed', discount: 0, paymentPlan: { type: 'full' }, consentSigned: true, createdBy: 'u_cl2', createdAt: agoD(158),
      items: [{ id: 'pi_marcus1', procedureId: 'p_fue', sessionsTotal: 1, price: 4800, addedAt: agoD(158), sessions: [{ no: 1, status: 'done', date: agoD(150) }] }] },
    { id: 'pl_hana1', episodeId: 'ep_hana_1', clientId: 'cl_hana', status: 'completed', discount: 0, paymentPlan: { type: 'full' }, consentSigned: true, createdBy: 'u_cl1', createdAt: agoD(740),
      items: [{ id: 'pi_hana1', procedureId: 'p_lhr', sessionsTotal: 6, price: 900, addedAt: agoD(740), sessions: sess(6, 6, [], 730, 30) }] },
  )

  payments.push(
    { id: 'py_noah1', clientId: 'cl_noah', episodeId: 'ep_noah', kind: 'instalment', amount: 1800, status: 'paid', dueAt: agoD(60), paidAt: agoD(60), method: 'card_link' },
    { id: 'py_noah2', clientId: 'cl_noah', episodeId: 'ep_noah', kind: 'instalment', amount: 1800, status: 'overdue', dueAt: agoD(1) },
    { id: 'py_noah3', clientId: 'cl_noah', episodeId: 'ep_noah', kind: 'instalment', amount: 1800, status: 'due', dueAt: iso(now() + 29 * DAY) },
    { id: 'py_ella', clientId: 'cl_ella', episodeId: 'ep_ella', kind: 'balance', amount: 900, status: 'paid', dueAt: agoD(118), paidAt: agoD(118), method: 'card_in_clinic' },
    { id: 'py_aisha', clientId: 'cl_aisha', episodeId: 'ep_aisha', kind: 'deposit', amount: 180, status: 'paid', dueAt: agoD(2), paidAt: agoD(2), method: 'card_link' },
    { id: 'py_ben', clientId: 'cl_ben', episodeId: 'ep_ben', kind: 'deposit', amount: 450, status: 'due', dueAt: iso(now() + 20 * HOUR) },
    { id: 'py_marcus', clientId: 'cl_marcus', episodeId: 'ep_marcus', kind: 'balance', amount: 4800, status: 'paid', dueAt: agoD(152), paidAt: agoD(152), method: 'bank_transfer' },
  )

  notes.push(
    { id: 'no_1', clientId: 'cl_noah', authorId: 'u_cl1', at: agoD(28), text: 'Good response to the first PRP session; early density improvement at the crown. Proceed with session 2 as planned.', clinical: true },
    { id: 'no_2', clientId: 'cl_noah', authorId: 'u_co2', at: agoD(20), text: 'Added FUE to the plan after his review; he asked to spread payments, set up 3 instalments.', clinical: false },
    { id: 'no_3', clientId: 'cl_ella', authorId: 'u_cl1', at: agoM(200), text: 'Session 5 done at setting 3. Mild redness, resolved in clinic. Book session 6 in 6 weeks.', clinical: true },
    { id: 'no_4', clientId: 'cl_chloe', authorId: 'u_co1', at: agoD(2), text: 'Likes the plan; wants to check instalments with her partner. Call Thursday afternoon.', clinical: false },
    { id: 'no_5', clientId: 'cl_hana', authorId: 'u_co1', at: agoD(560), text: 'Very happy with laser results; said she would come back for skin treatments.', clinical: false },
  )

  documents.push(
    { id: 'dc_1', clientId: 'cl_noah', kind: 'consent_form', title: 'Consent: PRP scalp therapy v3', at: agoD(62), restricted: false, signed: true },
    { id: 'dc_2', clientId: 'cl_noah', kind: 'consent_form', title: 'Consent: Hair transplant (FUE) v2', at: agoD(19), restricted: false, signed: true },
    { id: 'dc_3', clientId: 'cl_noah', kind: 'photo', title: 'Crown, baseline (4 photos)', at: agoD(62), restricted: true },
    { id: 'dc_4', clientId: 'cl_noah', kind: 'photo', title: 'Crown, after session 1 (4 photos)', at: agoD(28), restricted: true },
    { id: 'dc_5', clientId: 'cl_ella', kind: 'consent_form', title: 'Consent: Laser hair removal v4', at: agoD(118), restricted: false, signed: true },
    { id: 'dc_6', clientId: 'cl_chloe', kind: 'quote', title: 'Quote Q-1042: peel + skin booster', at: agoD(2), restricted: false },
    { id: 'dc_7', clientId: 'cl_marcus', kind: 'photo', title: 'Hairline, 6 months (6 photos)', at: agoD(1), restricted: true },
    { id: 'dc_8', clientId: 'cl_aisha', kind: 'id_check', title: 'ID check due at consultation', at: agoD(2), restricted: false },
  )

  audit.push(
    { id: 'au_1', at: agoM(9), actor: 'ai', action: 'lead.handoff', target: { type: 'client', id: 'cl_omar', label: 'Omar Siddiqui' }, detail: 'Phone detected; call task created (15 min SLA)' },
    { id: 'au_2', at: agoM(18), actor: 'system', action: 'sla.escalated', target: { type: 'task', id: 'tk_sofia', label: 'Sofía Herrera' }, detail: 'Escalated to manager' },
    { id: 'au_3', at: agoM(33), actor: 'ai', action: 'lead.handoff', target: { type: 'client', id: 'cl_sofia', label: 'Sofía Herrera' }, detail: 'Phone detected; call task created (15 min SLA)' },
    { id: 'au_4', at: agoD(0, 5), actor: 'u_mgr', action: 'stage.override', target: { type: 'episode', id: 'ep_kai', label: 'Kai Morgan' }, detail: 'call → lost', reason: 'Chose a clinic closer to home' },
    { id: 'au_5', at: agoD(1), actor: 'u_owner', action: 'ai.mode', target: { type: 'settings', id: 'ai', label: 'instagram AI mode' }, detail: 'copilot → autopilot', reason: 'Co-pilot gate passed: 94% of drafts sent unedited over 14 days' },
    { id: 'au_6', at: agoD(1, 2), actor: 'u_co1', action: 'client.view_phone', target: { type: 'client', id: 'cl_aisha', label: 'Aisha Rahman' }, detail: 'Viewed phone number' },
    { id: 'au_7', at: agoD(2), actor: 'u_cl1', action: 'playbook.clinical_signoff', target: { type: 'playbook', id: 'pb_v0', label: 'Playbook v0' }, detail: 'Clinical sign-off given' },
    { id: 'au_8', at: agoD(3), actor: 'claude', action: 'playbook.proposal', target: { type: 'playbook', id: 'pb_v1', label: 'Playbook v1' }, detail: 'Drafted v1 from 3,214 historical conversations' },
  )

  const note = (userId: string, n: Omit<Notification, 'id' | 'userId'>) => notifications.push({ ...n, id: uid('nt'), userId })
  for (const u of ['u_co1']) {
    note(u, { at: agoM(9), kind: 'lead', title: 'New lead · Omar Siddiqui shared a number', body: 'Interested in FUE and PRP. Prefers calls after 6pm.', link: { page: 'tasks', id: 'tk_omar' }, read: false, deadline: iso(now() + 6 * MIN) })
    note(u, { at: agoM(33), kind: 'lead', title: 'New lead · Sofía Herrera shared a number', body: 'Chemical peel course. Speaks Spanish.', link: { page: 'tasks', id: 'tk_sofia' }, read: false, deadline: agoM(18) })
    note(u, { at: agoM(240), kind: 'reminder', title: 'Chloe Martin: follow up on her plan today', body: 'She wanted to check instalments with her partner.', link: { page: 'client', id: 'cl_chloe' }, read: true })
  }
  for (const u of ['u_mgr']) {
    note(u, { at: agoM(18), kind: 'escalation', title: 'Escalated: Sofía Herrera not called in time', body: 'Call task assigned to Priya Nair is 3 min past its 15-minute deadline.', link: { page: 'tasks', id: 'tk_sofia' }, read: false })
    note(u, { at: agoD(0, 3), kind: 'ai', title: 'Nightly QA: 1 possible guardrail issue', body: 'One AI reply mentioned "permanent results". Review in AI & playbook.', link: { page: 'ai' }, read: false })
  }
  for (const u of ['u_owner']) {
    note(u, { at: agoD(0, 1), kind: 'ai', title: 'Daily brief is ready', body: '23 DMs yesterday, 7 numbers shared, 4 consultations booked. One SLA miss.', link: { page: 'today' }, read: false })
    note(u, { at: agoD(0, 4), kind: 'system', title: 'Instagram token expires in 52 days', body: 'Renew from Settings → Channels before it lapses.', link: { page: 'settings' }, read: true })
    note(u, { at: agoD(3), kind: 'ai', title: 'Playbook v1 is waiting for clinical sign-off', body: 'Claude drafted it from 3,214 past conversations.', link: { page: 'ai' }, read: false })
  }
  note('u_cl1', { at: agoM(21), kind: 'clinical', title: 'Clinical question · Jade Okafor', body: 'Is laser ok if I\'m pregnant? I\'m 5 months', link: { page: 'inbox', id: 'cv_jade' }, read: false })
  note('u_fin', { at: agoD(1), kind: 'payment', title: 'Instalment overdue · Noah Bennett', body: '£1,800 was due yesterday.', link: { page: 'client', id: 'cl_noah' }, read: false })

  const playbooks: PlaybookVersion[] = [
    {
      id: 'pb_v0', version: 'v0', status: 'live', createdAt: agoD(30), author: 'u_mgr', evalScore: 86, violations: 0,
      summary: 'Minimal safe playbook for shadow and co-pilot mode, written from current FAQs and call scripts.',
      approvals: { manager: { by: 'u_mgr', at: agoD(29) }, clinician: { by: 'u_cl1', at: agoD(28) } },
      sections: [
        { title: 'Tone', body: 'Warm, brief and plain. Mirror the client\'s language and level of formality. One emoji at most, only if they used one.' },
        { title: 'Opening', body: 'Introduce yourself as the clinic\'s AI assistant and say a person can join at any time. Answer their question first, then ask one qualifying question.' },
        { title: 'Qualifying', body: 'Find out which treatment, which area, and roughly when they want to start. Do not ask more than one question per message.' },
        { title: 'Prices', body: 'Only quote ranges from the approved price list. Say the exact price is confirmed at a free consultation. Then offer a call.' },
        { title: 'Asking for the number', body: 'After the second message, or straight after a price question, invite them to share their number so a coordinator can call. If they ask for ours, give the public number and invite theirs.' },
        { title: 'Never', body: 'Never give medical advice or judge suitability. Never promise results. Never name prescription-only medicines. Never book under-18s. Never pretend to be a named person. Never ask for card details.' },
      ],
    },
    {
      id: 'pb_v1', version: 'v1', status: 'pending', createdAt: agoD(3), author: 'claude', evalScore: 93, violations: 0,
      summary: 'Drafted by Claude from 3,214 past conversations (1,108 converted). Asks for the number earlier and handles price objections the way top performers did.',
      approvals: { manager: { by: 'u_mgr', at: agoD(2) } },
      sections: [
        { title: 'What converts (evidence)', body: 'Chats where the number was requested within the first 3 messages converted at 41% vs 19% later. Replies under 2 minutes converted 2.3× better than replies after an hour. Price questions answered with a range plus a consultation offer converted at 38%; answers without a range at 12%.' },
        { title: 'Opening', body: 'Disclose the AI, answer the question in one sentence, then ask one question about timing ("Roughly when were you hoping to start?"). Timing questions outperformed treatment-detail questions.' },
        { title: 'Price objections', body: 'When someone says it is expensive: acknowledge, mention instalments are available, offer the free consultation. Do not discount in DMs (discount offers converted worse and lowered plan value).' },
        { title: 'Asking for the number', body: 'Ask by the third message: "What\'s the best number for our coordinator to call you on?" If they hesitate, offer a time window instead ("Would after 6pm suit you?").' },
        { title: 'Returning clients', body: 'Recognise returning clients by handle, welcome them back by name and offer the coordinator who looked after them before.' },
        { title: 'Never', body: 'Same hard rules as v0, plus: never use "permanent", "guaranteed" or "pain-free" (all flagged in past chats).' },
      ],
    },
    {
      id: 'pb_v00', version: 'v0-draft', status: 'retired', createdAt: agoD(36), author: 'u_mgr', evalScore: 71, violations: 3,
      summary: 'First draft before compliance review; replaced by v0.', approvals: {}, sections: [],
    },
  ]

  const proposals: Proposal[] = [
    { id: 'pr_1', createdAt: agoD(1), title: 'Offer an evening call window when people hesitate to share a number', evidence: 'In the last 7 days, 11 of 14 people who hesitated shared a number after being offered "after 6pm"; 2 of 9 did without it.', change: 'Add to "Asking for the number": offer a time window before asking again.', impact: '+3 to +5 numbers shared per week (estimate)', status: 'open' },
    { id: 'pr_2', createdAt: agoD(1), title: 'Answer TikTok "how long does it take" questions with session counts', evidence: '27 TikTok DMs asked about duration; replies that gave a session count got a reply back 72% of the time vs 45%.', change: 'Add a short line per procedure with typical session count and interval.', impact: 'Higher reply rate on TikTok', status: 'open' },
    { id: 'pr_3', createdAt: agoD(8), title: 'Stop using "no downtime" for chemical peels', evidence: 'Nightly QA flagged the phrase twice; clinician confirmed it is not accurate for medium-depth peels.', change: 'Add "no downtime" to banned phrases.', impact: 'Compliance', status: 'accepted', decidedBy: 'u_cl1' },
  ]

  const qa: QaFinding[] = [
    { id: 'qa_1', at: agoD(0, 3), conversationId: 'cv_maya', severity: 'warn', rule: 'Banned phrase: "permanent"', excerpt: '…laser gives long-lasting, near permanent results…', resolved: false },
    { id: 'qa_2', at: agoD(0, 3), conversationId: 'cv_omar', severity: 'info', rule: 'Disclosure present', excerpt: 'Hi! I\'m Northlight\'s AI assistant (a person can step in any time).', resolved: true },
    { id: 'qa_3', at: agoD(1, 3), conversationId: 'cv_lily', severity: 'info', rule: 'Minor handled correctly', excerpt: 'Our treatments are only available from age 18…', resolved: true },
    { id: 'qa_4', at: agoD(2, 3), conversationId: 'cv_jade', severity: 'info', rule: 'Clinical question routed to clinician', excerpt: 'That\'s an important question and it needs one of our clinicians…', resolved: true },
  ]

  // 60 days of metrics with a gentle upward trend after autopilot went live 14 days ago
  const metrics: DailyMetric[] = []
  for (let i = 59; i >= 0; i--) {
    const d = new Date(startOfDay(now()) - i * DAY)
    const wk = d.getDay() === 0 || d.getDay() === 6 ? 1.25 : 1
    const trend = 1 + (59 - i) * 0.006
    const dms = Math.round((18 + r() * 9) * wk * trend)
    const auto = i < 14
    const qualified = Math.round(dms * (0.55 + r() * 0.1))
    const contacts = Math.round(dms * (auto ? 0.31 + r() * 0.06 : 0.22 + r() * 0.06))
    const booked = Math.round(contacts * (0.55 + r() * 0.15))
    const attended = Math.round(booked * (0.78 + r() * 0.1))
    const treatments = Math.round(attended * (0.45 + r() * 0.15))
    const ig = Math.round(dms * (0.58 + r() * 0.1))
    metrics.push({
      date: d.toISOString().slice(0, 10), dms, aiReplies: auto ? Math.round(dms * 2.6) : Math.round(dms * 0.4), humanReplies: auto ? Math.round(dms * 0.5) : Math.round(dms * 2.1),
      qualified, contacts, booked, attended, treatments, revenue: Math.round(treatments * (850 + r() * 900)),
      medianFirstReplySec: auto ? Math.round(6 + r() * 6) : Math.round(600 + r() * 2400), callSlaMetPct: Math.round(auto ? 88 + r() * 10 : 70 + r() * 15), byChannel: { instagram: ig, tiktok: dms - ig },
    })
  }

  return {
    version: SEED_VERSION,
    now: iso(now()),
    currentUserId: 'u_owner',
    branches: [{ id: 'b1', name: 'Marylebone', city: 'London' }, { id: 'b2', name: 'Spinningfields', city: 'Manchester' }],
    rooms: [{ id: 'r1', name: 'Room 1', branchId: 'b1' }, { id: 'r2', name: 'Room 2', branchId: 'b1' }, { id: 'r3', name: 'Laser suite', branchId: 'b1' }, { id: 'r4', name: 'Room A', branchId: 'b2' }],
    users: structuredClone(USERS),
    procedures: structuredClone(PROCEDURES),
    clients, episodes, conversations, tasks, appointments, plans, payments, notes, documents, audit, notifications, playbooks, proposals, qa,
    ai: {
      mode: { instagram: 'autopilot', tiktok: 'copilot', whatsapp: 'copilot' },
      killSwitch: false,
      confidenceThreshold: 0.7,
      disclosure: 'Hi! I\'m the Northlight assistant, an AI, and a person can join any time.',
      escalationText: 'Type "person" at any time and a member of our team will take over.',
      bannedPhrases: ['permanent', 'guaranteed', 'pain-free', 'no downtime', 'Botox', 'miracle', 'risk-free'],
      businessHours: { start: '09:00', end: '19:00', days: [1, 2, 3, 4, 5, 6] },
      model: 'claude-opus-5-5',
      effort: 'low',
    },
    settings: {
      orgName: 'Northlight Clinic',
      currency: 'GBP',
      timezone: 'Europe/London',
      channels: [
        { channel: 'instagram', status: 'connected', account: '@northlight.clinic', detail: 'Instagram API with Instagram Login · Advanced Access granted', tokenExpiresAt: iso(now() + 52 * DAY) },
        { channel: 'tiktok', status: 'pending', account: '@northlight.clinic', detail: 'Business Messaging API application under review. Co-pilot drafts are copied into TikTok by staff until approved.' },
        { channel: 'whatsapp', status: 'connected', account: '+44 20 7946 0321', detail: 'Cloud API · 6 approved templates · used for reminders only' },
        { channel: 'sms', status: 'connected', account: 'Two-way number', detail: 'Reminder fallback when WhatsApp is not consented' },
        { channel: 'email', status: 'connected', account: 'hello@northlight.example', detail: 'Domain authenticated (SPF, DKIM, DMARC)' },
      ],
      slaRules: [
        { id: 'sla_1', event: 'Phone number shared in a DM', notify: ['coordinator'], channels: ['push', 'whatsapp'], escalateAfterMin: [15, 60], enabled: true },
        { id: 'sla_2', event: 'Asked for our number', notify: ['coordinator'], channels: ['push'], escalateAfterMin: [240], enabled: true },
        { id: 'sla_3', event: 'Clinical question in a DM', notify: ['clinician'], channels: ['push'], escalateAfterMin: [240, 480], enabled: true },
        { id: 'sla_4', event: 'Complaint or possible minor', notify: ['manager'], channels: ['push', 'sms'], escalateAfterMin: [10], enabled: true },
        { id: 'sla_5', event: 'Appointment unconfirmed by 6pm the day before', notify: ['frontdesk'], channels: ['push'], escalateAfterMin: [60], enabled: true },
        { id: 'sla_6', event: 'Deposit unpaid 24 h before appointment', notify: ['coordinator', 'finance'], channels: ['push'], escalateAfterMin: [120], enabled: true },
        { id: 'sla_7', event: 'Instalment overdue', notify: ['finance'], channels: ['push', 'email'], escalateAfterMin: [1440], enabled: true },
      ],
      retentionMonths: { chats: 24, clinical: 96, exports: 3 },
      mcpClients: [
        { id: 'mc_1', name: 'Claude (claude.ai)', userId: 'u_owner', connectedAt: agoD(6), lastUsedAt: agoM(50), scopes: ['read:leads', 'read:metrics', 'write:tasks'] },
        { id: 'mc_2', name: 'Claude (claude.ai)', userId: 'u_mgr', connectedAt: agoD(4), lastUsedAt: agoD(0, 6), scopes: ['read:leads', 'read:metrics'] },
      ],
    },
    metrics,
  }
}

// --- simulated new DMs ------------------------------------------------------------------------

const NEW_LEADS: Array<{ name: string; handle: string; channel: Channel; language: string; interest: string; source: string; first: string; followUps: string[] }> = [
  { name: 'Grace Whitfield', handle: 'gracewhitfield', channel: 'instagram', language: 'en', interest: 'p_lhr', source: 'Reel: "6 sessions, smooth for good"', first: 'Hi! Saw your reel 😍 how much is laser for full legs?', followUps: ['Weekends are best for me. You can call me on 07700 900482'] },
  { name: 'Tariq Hussain', handle: 'tariq.h', channel: 'tiktok', language: 'en', interest: 'p_fue', source: 'TikTok: "Hairline restoration journey, month 9"', first: 'do u do hair transplants? my hairline is going back lol', followUps: ['roughly how much does it cost', 'ok cool my number is 07700 900517, after 6pm is best'] },
  { name: 'Elena Petrova', handle: 'elena.petrova', channel: 'instagram', language: 'en', interest: 'p_peel', source: 'Story reply: "Glow week offer"', first: 'Hello, where is your clinic? I\'m interested in a chemical peel', followUps: ['Can you give me your number? I\'d rather call'] },
  { name: 'Mia Johansson', handle: 'mia.johansson', channel: 'tiktok', language: 'en', interest: 'p_sb', source: 'TikTok: "Skin booster before/after explained"', first: 'can i book a consultation for skin boosters this week?', followUps: ['07700 900633 thanks!'] },
]

let leadCursor = 0

export function newLeadScript(state: DemoState, channel?: Channel) {
  const pool = channel ? NEW_LEADS.filter(l => l.channel === channel) : NEW_LEADS
  const pick = pool[leadCursor++ % pool.length]
  const suffix = Math.floor(Math.random() * 90 + 10)
  const id = uid('cl')
  const t = iso(Date.now())
  const client: Client = {
    id, name: pick.name, handles: pick.channel === 'tiktok' ? { tiktok: `@${pick.handle}${suffix}` } : { instagram: `@${pick.handle}${suffix}` },
    language: pick.language, ageVerified: false, tags: [], consent: { whatsapp: false, sms: false, marketing: false, callRecording: false, updatedAt: t },
    doNotContact: false, branchId: state.branches[0].id, source: { channel: pick.channel, detail: pick.source }, createdAt: t, score: 50,
  }
  const episode: Episode = { id: uid('ep'), clientId: id, number: 1, startedAt: t, stage: 'new', interests: [pick.interest], value: state.procedures.find(p => p.id === pick.interest)?.price ?? 0, history: [{ at: t, to: 'new', by: 'ai' }] }
  const conversation: Conversation = {
    id: uid('cv'), clientId: id, channel: pick.channel, externalThreadId: `${pick.channel}-${pick.handle}${suffix}`, handling: 'ai', intent: 'new', needsHuman: false,
    lastInboundAt: t, lastMessageAt: t, unread: 1, outboundSinceInbound: 0,
    messages: [{ id: uid('ms'), author: 'client', text: pick.first, at: t, status: 'delivered', flags: flagsFor(pick.first) }],
  }
  return { client, episode, conversation, followUps: pick.followUps }
}
