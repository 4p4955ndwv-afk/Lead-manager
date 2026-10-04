import { EmptyState, PageHeader, Tabs } from '../components/ui'
import type { IconName } from '../components/icons'
import { useStore } from '../lib/store'
import { Organisation } from './settings/Organisation'
import { Channels } from './settings/Channels'
import { Notifications } from './settings/Notifications'
import { PriceList } from './settings/PriceList'
import { Integrations } from './settings/Integrations'
import { Privacy } from './settings/Privacy'
import { MobileApp } from './settings/MobileApp'
import { getExt } from './settings/ext'
import './settings.css'

type Tab = 'organisation' | 'channels' | 'notifications' | 'prices' | 'integrations' | 'privacy' | 'mobile'

export default function Settings() {
  const { state, can, route, actions } = useStore()

  if (!can('settings.manage')) {
    return (
      <div className="page st-page">
        <PageHeader eyebrow="Admin" title="Settings" />
        <div className="card"><EmptyState icon="lock" title="Settings are for owners and managers" body="Ask an owner or manager to change channels, alerts, prices or integrations." /></div>
      </div>
    )
  }

  const channelIssues = state.settings.channels.filter(c => c.status === 'error' || c.status === 'pending').length
  const openRequests = getExt(state).dataRequests.filter(r => r.status === 'open').length
  const tabs: { id: Tab; label: string; icon: IconName; count?: number }[] = [
    { id: 'organisation', label: 'Organisation', icon: 'home' },
    { id: 'channels', label: 'Channels', icon: 'message', count: channelIssues || undefined },
    { id: 'notifications', label: 'Notifications & SLAs', icon: 'bell' },
    { id: 'prices', label: 'Price list', icon: 'card' },
    { id: 'integrations', label: 'Claude & integrations', icon: 'sparkles' },
    { id: 'privacy', label: 'Data & privacy', icon: 'shield', count: openRequests || undefined },
    { id: 'mobile', label: 'Mobile app', icon: 'smartphone' },
  ]
  // #settings~channels etc. open a tab
  const tab: Tab = tabs.find(t => t.id === route.id)?.id ?? 'organisation'
  const setTab = (t: Tab) => actions.go('settings', t === 'organisation' ? undefined : t)

  return (
    <div className="page st-page">
      <PageHeader eyebrow="Admin" title="Settings" subtitle={`How ${state.settings.orgName} is connected and configured. Every change is saved to the audit log.`} />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={tabs} />
      <div role="tabpanel" aria-label={tabs.find(t => t.id === tab)?.label}>
        {tab === 'organisation' && <Organisation />}
        {tab === 'channels' && <Channels />}
        {tab === 'notifications' && <Notifications />}
        {tab === 'prices' && <PriceList />}
        {tab === 'integrations' && <Integrations />}
        {tab === 'privacy' && <Privacy onOpenAudit={() => actions.go('team', 'activity')} />}
        {tab === 'mobile' && <MobileApp />}
      </div>
    </div>
  )
}
