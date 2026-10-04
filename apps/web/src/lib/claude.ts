// Optional live Claude for the demo. Inside a claude.ai artifact viewer the page can ask Claude on the
// viewer's own account (the `sample` capability). Anywhere else this resolves null and the app falls back
// to its built-in rule-based drafts. In production the reply engine calls the Claude API from a Worker.

export interface SampleResult { text: string; truncated: boolean }
export interface SampleError { code: string; message: string; text?: string }
export interface SampleOptions {
  onText?: (u: { text: string; delta: string }) => void
  signal?: AbortSignal
  modelTier?: 'default' | 'complex' | 'quick'
  cache?: boolean | { gcTime?: number; refresh?: boolean }
}
export type SampleInput = string | Array<{ role: 'user' | 'assistant'; content: string }>
export type SampleFn = ((input: SampleInput, opts?: SampleOptions) => Promise<SampleResult>) & {
  json?: <T = unknown>(input: SampleInput, opts?: SampleOptions) => Promise<T>
}

let cached: Promise<SampleFn | null> | null = null

/** Resolves the live Claude function, or null when this page is not running inside a Claude viewer. */
export function getClaude(): Promise<SampleFn | null> {
  if (cached) return cached
  const w = window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }
  if (!w.claude || typeof w.claude.use !== 'function') {
    cached = Promise.resolve(null)
    return cached
  }
  cached = w.claude.use('sample').then(fn => (typeof fn === 'function' ? (fn as SampleFn) : null)).catch(() => null)
  return cached
}

/** Viewer-facing message for a failed call. */
export function claudeErrorText(e: unknown): string {
  const code = (e as SampleError)?.code
  switch (code) {
    case 'cancelled':
      return ''
    case 'not_granted':
    case 'sampling_disabled':
    case 'not_declared':
    case 'capability_disabled':
    case 'capability_removed':
      return 'Live Claude is not available in this view, so the built-in demo reply was used.'
    case 'rate_limited':
      return 'Claude is busy for your account right now. Try again in a minute.'
    case 'session_expired':
      return 'Sign in to claude.ai again to use live Claude.'
    case 'refused':
      return 'Claude declined this request. Try rephrasing it.'
    default:
      return 'Claude could not answer just now. Try again.'
  }
}
