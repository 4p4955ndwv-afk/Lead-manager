import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './lib/store'
import { Shell } from './components/Shell'
import Today from './pages/Today'
import Inbox from './pages/Inbox'
import Pipeline from './pages/Pipeline'
import ClientRecord from './pages/ClientRecord'
import Tasks from './pages/Tasks'
import Calendar from './pages/Calendar'
import AIPlaybook from './pages/AIPlaybook'
import Analytics from './pages/Analytics'
import Team from './pages/Team'
import Settings from './pages/Settings'
import ClaudePanel from './pages/ClaudePanel'

function Router() {
  const { route } = useStore()
  switch (route.page) {
    case 'inbox': return <Inbox />
    case 'pipeline': return <Pipeline />
    case 'client': return <ClientRecord />
    case 'tasks': return <Tasks />
    case 'calendar': return <Calendar />
    case 'ai': return <AIPlaybook />
    case 'analytics': return <Analytics />
    case 'team': return <Team />
    case 'settings': return <Settings />
    default: return <Today />
  }
}

export function App() {
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [claudePrompt, setClaudePrompt] = useState<string | undefined>()
  // Any page can open the Claude panel with: window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt } }))
  useEffect(() => {
    const h = (e: Event) => {
      setClaudePrompt((e as CustomEvent<{ prompt?: string }>).detail?.prompt)
      setClaudeOpen(true)
    }
    window.addEventListener('lm:open-claude', h)
    return () => window.removeEventListener('lm:open-claude', h)
  }, [])
  return (
    <StoreProvider>
      <Shell onOpenClaude={() => { setClaudePrompt(undefined); setClaudeOpen(true) }}>
        <Router />
      </Shell>
      <ClaudePanel open={claudeOpen} initialPrompt={claudePrompt} onClose={() => setClaudeOpen(false)} />
    </StoreProvider>
  )
}
