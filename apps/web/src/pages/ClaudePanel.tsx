import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store'
import { getClaude, claudeErrorText } from '../lib/claude'
import { ROLE_LABEL } from '../lib/types'
import { longDate, uid } from '../lib/time'
import { Button, Chip, Drawer, IconButton } from '../components/ui'
import { Icon } from '../components/icons'
import { buildSnapshot, firstName, flags, type Ctx } from './claude/snapshot'
import { demoAnswer } from './claude/answers'
import { Rich } from './claude/Rich'
import './claude.css'

const SUGGESTIONS = [
  'Which leads shared a number today but haven\'t been called?',
  'Summarise today for me',
  'How is TikTok doing compared with Instagram this week?',
  'Draft a follow-up message for Chloe Martin',
  'Which clients are due a session in the next 7 days?',
]

/** Partial text while streaming: drop a half-started list marker and close an open **bold** so no raw asterisks show. */
function streamingText(text: string): string {
  const t = text.replace(/\n\s*([-*•>]|\d+[.)])?\s*$/, '').replace(/(^|[^*])\*$/, '$1')
  return (t.match(/\*\*/g)?.length ?? 0) % 2 ? (/\*\*\s*$/.test(t) ? t.replace(/\*\*\s*$/, '') : t + '**') : t
}

/** Error codes that mean live Claude can't be used in this view at all, so the demo answer is shown instead. */
const UNAVAILABLE = new Set(['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'])

interface Turn {
  id: string
  role: 'user' | 'assistant'
  text: string
  status?: 'thinking' | 'streaming' | 'done' | 'stopped' | 'error'
  source?: 'live' | 'demo'
  note?: string
  truncated?: boolean
}

function instructions(c: Ctx, snapshot: string, question: string): string {
  const who = `${c.me.name} (${ROLE_LABEL[c.me.role]})`
  return `You are Claude, answering a question from ${who} at ${c.s.settings.orgName}, inside Lead Manager, the clinic's system for leads from Instagram and TikTok DMs, calls, appointments and treatment plans. In production you reach Lead Manager through its MCP server with ${firstName(c.me.name)}'s permissions; here the JSON below is a snapshot taken just now with exactly those permissions.

Rules:
- Use only the data below. If something isn't there, say you can't see it (it may be outside ${firstName(c.me.name)}'s access) instead of guessing.
- Never reveal or guess masked phone digits. Never invent clinical details, money, names or numbers.
- Lead with the answer in one bold line, then at most 6 short bullet points starting with "- ", then one line saying what to do first. No tables, no headings.
- Write client names in full exactly as they appear in the data.
- Today is ${longDate(new Date(c.now).toISOString())}; times are UK time.
- If asked to draft a message to a client: warm, plain, under 70 words, from the clinic, signed with the staff member's first name, no promises about results, and say which channel to send it on (Instagram and TikTok only allow replies within their windows; WhatsApp needs consent).

DATA (JSON):
${snapshot}

QUESTION: ${question}`
}

export default function ClaudePanel({ open, onClose, initialPrompt }: { open: boolean; onClose: () => void; initialPrompt?: string }) {
  const { state, me, can, actions } = useStore()
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<'checking' | 'live' | 'demo'>('checking')
  const ctxRef = useRef<Ctx>({ s: state, me, can, now: Date.now() })
  ctxRef.current = { s: state, me, can, now: Date.now() }
  const turnsRef = useRef(turns)
  turnsRef.current = turns
  const abortRef = useRef<AbortController | null>(null)
  const demoTimer = useRef<{ id: number; turn: string } | null>(null)
  const handledPrompt = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const busy = turns.some(t => t.status === 'thinking' || t.status === 'streaming')
  const f = flags(ctxRef.current)

  const patch = (id: string, p: Partial<Turn>) => setTurns(ts => ts.map(t => (t.id === id ? { ...t, ...p } : t)))

  useEffect(() => {
    if (!open) return
    let alive = true
    getClaude().then(fn => { if (alive) setMode(fn ? 'live' : 'demo') })
    const t = window.setTimeout(() => inputRef.current?.focus(), 60)
    return () => { alive = false; window.clearTimeout(t) }
  }, [open])

  useEffect(() => () => {
    abortRef.current?.abort()
    if (demoTimer.current) window.clearTimeout(demoTimer.current.id)
  }, [])

  useEffect(() => { if (open) endRef.current?.scrollIntoView({ block: 'end' }) }, [turns, open])

  // each person has their own login: answers written with one person's access (unmasked numbers, revenue) must not
  // stay on screen, or go to live Claude as history, after the demo switches to someone else
  useEffect(() => {
    abortRef.current?.abort()
    if (demoTimer.current) { window.clearTimeout(demoTimer.current.id); demoTimer.current = null }
    setTurns([])
    setInput('')
  }, [me.id])

  const stop = () => {
    abortRef.current?.abort()
    if (demoTimer.current) {
      window.clearTimeout(demoTimer.current.id)
      patch(demoTimer.current.turn, { status: 'stopped' })
      demoTimer.current = null
    }
  }

  const ask = async (raw: string) => {
    const question = raw.trim()
    if (!question) return
    if (turnsRef.current.some(t => t.status === 'thinking' || t.status === 'streaming')) stop()
    const aId = uid('cq')
    // previous finished exchanges become the conversation history for live Claude
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = []
    let pendingUser: string | null = null
    for (const t of turnsRef.current) {
      if (t.role === 'user') pendingUser = t.text
      else if (pendingUser && t.text && (t.status === 'done' || t.status === 'stopped')) { history.push({ role: 'user', content: pendingUser }, { role: 'assistant', content: t.text }); pendingUser = null }
      else pendingUser = null
    }
    setTurns(ts => [...ts, { id: uid('cq'), role: 'user', text: question }, { id: aId, role: 'assistant', text: '', status: 'thinking' }])
    setInput('')

    const ctx = { ...ctxRef.current, now: Date.now() }
    const sample = await getClaude()
    if (!sample) {
      setMode('demo')
      const id = window.setTimeout(() => {
        demoTimer.current = null
        patch(aId, { status: 'done', source: 'demo', text: demoAnswer({ ...ctxRef.current, now: Date.now() }, question) })
      }, 700)
      demoTimer.current = { id, turn: aId }
      return
    }
    setMode('live')
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      const res = await sample([...history.slice(-12), { role: 'user', content: instructions(ctx, buildSnapshot(ctx), question) }], {
        signal: ctrl.signal,
        cache: false,
        onText: u => patch(aId, { text: u.text, status: 'streaming' }),
      })
      patch(aId, { text: res.text.trim() || 'Claude didn’t return an answer. Try asking again.', status: 'done', source: 'live', truncated: res.truncated })
    } catch (e) {
      const code = (e as { code?: string })?.code ?? ''
      if (ctrl.signal.aborted || code === 'cancelled') patch(aId, { status: 'stopped', source: 'live' })
      else if (UNAVAILABLE.has(code)) {
        setMode('demo')
        patch(aId, { status: 'done', source: 'demo', note: claudeErrorText(e), text: demoAnswer({ ...ctxRef.current, now: Date.now() }, question) })
      } else patch(aId, { status: 'error', note: claudeErrorText(e) || 'Claude could not answer just now. Try again.' })
    } finally {
      if (abortRef.current === ctrl) abortRef.current = null
    }
  }

  // a page opened the panel with a question: send it once per opening
  useEffect(() => {
    if (!open) { handledPrompt.current = null; return }
    if (initialPrompt && handledPrompt.current !== initialPrompt) {
      handledPrompt.current = initialPrompt
      setInput(initialPrompt)
      void ask(initialPrompt)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPrompt])

  const retry = (assistantId: string) => {
    const i = turnsRef.current.findIndex(t => t.id === assistantId)
    const q = i > 0 ? turnsRef.current[i - 1] : undefined
    if (!q || q.role !== 'user') return
    setTurns(ts => ts.filter((_, k) => k !== i && k !== i - 1))
    void ask(q.text)
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\*\*/g, '').replace(/^> /gm, ''))
      actions.toast('Copied to the clipboard.', 'success')
    } catch {
      actions.toast('Copying isn’t allowed in this view. Select the text to copy it instead.', 'warn')
    }
  }

  const openClient = (id: string) => {
    actions.go('client', id)
    if (window.innerWidth <= 860) onClose()
  }

  const access = [f.phones ? 'phone numbers visible' : 'phone numbers masked', f.clinical ? 'clinical notes visible' : 'clinical notes hidden', f.payments || f.revenue ? 'money visible' : 'money hidden']

  return (
    <Drawer open={open} title="Ask Claude" onClose={onClose} width={480}
      footer={
        <div className="cp-foot">
          {turns.length > 0 && !busy && (
            <div className="cp-chips" role="list" aria-label="Suggested questions">
              {SUGGESTIONS.map(s => <button key={s} type="button" role="listitem" className="cp-chip" onClick={() => void ask(s)}>{s}</button>)}
            </div>
          )}
          <form className="cp-composer" onSubmit={e => { e.preventDefault(); if (!busy) void ask(input) }}>
            <label htmlFor="cp-input" className="sr-only">Ask Claude a question</label>
            <textarea id="cp-input" ref={inputRef} className="input cp-input" rows={1} value={input} placeholder="Ask about leads, calls, clients or the AI…"
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!busy) void ask(input) } }} />
            {busy
              ? <Button variant="secondary" icon="pause" onClick={stop}>Stop</Button>
              : <Button type="submit" variant="primary" icon="send" disabled={!input.trim()}>Ask</Button>}
          </form>
          <div className="cp-foot-meta">
            <span className="tiny faint">Enter to send · Shift+Enter for a new line</span>
            {turns.length > 0 && <button type="button" className="cp-clear" onClick={() => { stop(); setTurns([]); inputRef.current?.focus() }}>New conversation</button>}
          </div>
        </div>
      }>
      <div className="cp-body">
        <div className="cp-intro">
          <p className="small muted">In production, Claude reaches Lead Manager through its MCP server with your permissions. In this preview, answers come from live Claude on your claude.ai account when it’s available, otherwise from built-in demo answers.</p>
          <div className="row wrap" style={{ gap: 6 }}>
            {mode === 'live' ? <Chip tone="ok" icon="zap">Live Claude</Chip> : mode === 'demo' ? <Chip tone="neutral" icon="info">Demo answers</Chip> : <Chip>Checking…</Chip>}
            <span className="tiny muted">As {me.name} · {ROLE_LABEL[me.role]} · {access.join(', ')}</span>
          </div>
        </div>

        {turns.length === 0 ? (
          <div className="cp-start">
            <span className="eyebrow">Try asking</span>
            <ul className="cp-suggest">
              {SUGGESTIONS.map(s => (
                <li key={s}>
                  <button type="button" className="cp-suggest-btn" onClick={() => void ask(s)}>
                    <Icon name="sparkles" size={15} />
                    <span className="grow">{s}</span>
                    <Icon name="arrowRight" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ol className="cp-thread" aria-live="polite" aria-label="Conversation with Claude">
            {turns.map(t => t.role === 'user' ? (
              <li key={t.id} className="cp-msg cp-user"><div className="cp-bubble">{t.text}</div></li>
            ) : (
              <li key={t.id} className="cp-msg cp-assistant">
                <span className="cp-mark" aria-hidden="true"><Icon name="sparkles" size={14} /></span>
                <div className="cp-bubble">
                  {t.status === 'thinking' && <span className="cp-thinking"><span className="spinner" aria-hidden="true" />Thinking…</span>}
                  {t.text && <Rich text={t.status === 'streaming' ? streamingText(t.text) : t.text} clients={state.clients} onClient={openClient} />}
                  {t.status === 'streaming' && <span className="cp-caret" aria-hidden="true" />}
                  {t.status === 'error' && (
                    <div className="cp-error">
                      <span><Icon name="alert" size={14} /> {t.note}</span>
                      <Button size="sm" variant="secondary" icon="refresh" onClick={() => retry(t.id)}>Try again</Button>
                    </div>
                  )}
                  {(t.status === 'done' || t.status === 'stopped') && (
                    <div className="cp-meta">
                      <span className="tiny muted">
                        {t.status === 'stopped' ? (t.text ? 'Stopped · partial answer' : 'Stopped before an answer arrived')
                          : t.source === 'live' ? `Live Claude · answered with ${firstName(me.name)}’s permissions`
                            : 'Demo answer · live Claude isn’t available in this view'}
                        {t.truncated ? ' · cut short' : ''}
                      </span>
                      {t.text && <IconButton icon="copy" size="sm" label="Copy answer" onClick={() => void copy(t.text)} />}
                    </div>
                  )}
                  {t.note && t.status === 'done' && <p className="tiny faint">{t.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>
    </Drawer>
  )
}
