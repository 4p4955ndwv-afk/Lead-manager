import { useMemo, type ReactNode } from 'react'
import type { Client } from '../../lib/types'

const fold = (t: string) => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

interface Matcher { re: RegExp | null; ids: Map<string, string> }

/** Matches full client names (with or without accents) so they can become links. */
function buildMatcher(clients: Client[]): Matcher {
  const ids = new Map<string, string>()
  const alts = new Set<string>()
  for (const c of clients) {
    ids.set(fold(c.name), c.id)
    alts.add(escape(c.name))
    const plain = c.name.normalize('NFD').replace(/\p{Diacritic}/gu, '')
    if (plain !== c.name) alts.add(escape(plain))
  }
  const list = [...alts].sort((a, b) => b.length - a.length)
  return { re: list.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${list.join('|')})(?![\\p{L}\\p{N}])`, 'gu') : null, ids }
}

type Block = { kind: 'p'; lines: string[] } | { kind: 'h'; lines: string[] } | { kind: 'quote'; lines: string[] } | { kind: 'ul'; items: string[] } | { kind: 'ol'; items: string[] }

function parse(text: string): Block[] {
  const blocks: Block[] = []
  let cur: Block | null = null
  const flush = () => { if (cur) blocks.push(cur); cur = null }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) { flush(); continue }
    const ul = line.match(/^\s*[-*•]\s+(.*)$/)
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const h = line.match(/^#{1,4}\s+(.*)$/)
    const q = line.match(/^>\s?(.*)$/)
    if (ul) { if (cur?.kind !== 'ul') { flush(); cur = { kind: 'ul', items: [] } } (cur as { items: string[] }).items.push(ul[1]) }
    else if (ol) { if (cur?.kind !== 'ol') { flush(); cur = { kind: 'ol', items: [] } } (cur as { items: string[] }).items.push(ol[1]) }
    else if (h) { flush(); blocks.push({ kind: 'h', lines: [h[1]] }) }
    else if (q) { if (cur?.kind !== 'quote') { flush(); cur = { kind: 'quote', lines: [] } } (cur as { lines: string[] }).lines.push(q[1]) }
    else { if (cur?.kind !== 'p') { flush(); cur = { kind: 'p', lines: [] } } (cur as { lines: string[] }).lines.push(line) }
  }
  flush()
  return blocks
}

export function Rich({ text, clients, onClient }: { text: string; clients: Client[]; onClient: (id: string) => void }) {
  const m = useMemo(() => buildMatcher(clients), [clients])

  const names = (t: string, key: string): ReactNode[] => {
    if (!m.re) return [t]
    const out: ReactNode[] = []
    let last = 0
    let i = 0
    for (const hit of t.matchAll(m.re)) {
      const at = hit.index ?? 0
      if (at > last) out.push(t.slice(last, at))
      const id = m.ids.get(fold(hit[0]))
      out.push(id ? <button key={`${key}-${i++}`} type="button" className="cp-client" onClick={() => onClient(id)} title={`Open ${hit[0]}'s record`}>{hit[0]}</button> : hit[0])
      last = at + hit[0].length
    }
    if (last < t.length) out.push(t.slice(last))
    return out
  }
  const inline = (t: string, key: string): ReactNode[] =>
    t.split(/(\*\*[^*]+\*\*)/g).flatMap((seg, i): ReactNode[] => {
      if (/^\*\*[^*]+\*\*$/.test(seg)) return [<strong key={`${key}-b${i}`}>{names(seg.slice(2, -2), `${key}-b${i}`)}</strong>]
      return names(seg.replace(/(^|\s)\*(\S[^*]*\S)\*(?=\s|$)/g, '$1$2').replace(/`([^`]+)`/g, '$1'), `${key}-t${i}`)
    })
  const lines = (ls: string[], key: string) => ls.flatMap((l, i) => (i ? [<br key={`${key}-br${i}`} />, ...inline(l, `${key}-${i}`)] : inline(l, `${key}-${i}`)))

  return (
    <div className="cp-rich">
      {parse(text).map((b, i) => {
        const k = 'b' + i
        if (b.kind === 'ul') return <ul key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ul>
        if (b.kind === 'ol') return <ol key={k}>{b.items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ol>
        if (b.kind === 'h') return <p key={k} className="cp-h">{inline(b.lines[0], k)}</p>
        if (b.kind === 'quote') return <blockquote key={k}>{lines(b.lines, k)}</blockquote>
        return <p key={k}>{lines(b.lines, k)}</p>
      })}
    </div>
  )
}
