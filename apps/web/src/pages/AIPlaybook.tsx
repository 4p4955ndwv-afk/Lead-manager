import { useEffect, useRef } from 'react'
import { useStore } from '../lib/store'
import { Button, PageHeader, Tabs } from '../components/ui'
import { KillSwitch } from './ai/KillSwitch'
import { Overview } from './ai/Overview'
import { PlaybookTab } from './ai/Playbook'
import { Improve } from './ai/Improve'
import { Guardrails } from './ai/Guardrails'
import './ai.css'

type Tab = 'overview' | 'playbook' | 'improve' | 'guardrails'
const TABS: Tab[] = ['overview', 'playbook', 'improve', 'guardrails']
const TAB_LABEL: Record<Tab, string> = { overview: 'Overview', playbook: 'Playbook', improve: 'Proposals & QA', guardrails: 'Guardrails' }

export default function AIPlaybook() {
  const { state, route, actions } = useStore()
  // #ai~playbook opens a tab; #ai~<playbook id> opens that version
  const versionFocus = route.id && state.playbooks.some(p => p.id === route.id) ? route.id : undefined
  const tab: Tab = versionFocus ? 'playbook' : TABS.includes(route.id as Tab) ? (route.id as Tab) : 'overview'
  const setTab = (t: Tab) => actions.go('ai', t === 'overview' ? undefined : t)
  const tabsRef = useRef<HTMLDivElement>(null)
  // keep the active tab visible when the tab strip scrolls sideways on phones
  useEffect(() => {
    const strip = tabsRef.current?.querySelector<HTMLElement>('.tabs')
    const active = strip?.querySelector<HTMLElement>('.tab.is-active')
    if (!strip || !active) return
    const a = active.getBoundingClientRect(), b = strip.getBoundingClientRect()
    if (a.left < b.left || a.right > b.right) strip.scrollLeft += a.left - b.left - 16
  }, [tab])

  const pending = state.playbooks.filter(p => p.status === 'pending').length
  const toReview = state.proposals.filter(p => p.status === 'open').length + state.qa.filter(q => !q.resolved && q.severity !== 'info').length

  return (
    <div className="page ai-page">
      <PageHeader
        eyebrow="Claude · reply engine"
        title="AI & playbook"
        subtitle="How Claude answers DMs, what it is allowed to say, and every change waiting for approval."
        actions={<Button variant="secondary" icon="sparkles" onClick={() => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: 'How is the AI doing this week? Compare drafts sent unedited, handoffs and guardrail issues by channel, and tell me if any channel is ready to move up a mode.' } }))}>Ask Claude how the AI is doing</Button>}
      />
      <KillSwitch />
      <div ref={tabsRef}>
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: TAB_LABEL.overview, icon: 'zap' },
          { id: 'playbook', label: TAB_LABEL.playbook, icon: 'file', count: pending || undefined },
          { id: 'improve', label: TAB_LABEL.improve, icon: 'flag', count: toReview || undefined },
          { id: 'guardrails', label: TAB_LABEL.guardrails, icon: 'shield' },
        ]}
      />
      </div>
      <div role="tabpanel" aria-label={TAB_LABEL[tab]}>
        {tab === 'overview' && <Overview onTab={setTab} />}
        {tab === 'playbook' && <PlaybookTab focusId={versionFocus} />}
        {tab === 'improve' && <Improve />}
        {tab === 'guardrails' && <Guardrails />}
      </div>
    </div>
  )
}
