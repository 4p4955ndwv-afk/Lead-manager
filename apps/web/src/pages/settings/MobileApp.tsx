import { Button, Card, Chip } from '../../components/ui'
import { Icon, type IconName } from '../../components/icons'
import { useStore } from '../../lib/store'
import { ROLE_LABEL } from '../../lib/types'
import { ago, iso } from '../../lib/time'
import { copyText, editExt, getExt } from './ext'

const APP_URL = 'https://app.northlight.example'

const STEPS: Array<{ id: string; title: string; icon: IconName; browser: string; steps: string[] }> = [
  {
    id: 'ios', title: 'iPhone and iPad', icon: 'smartphone', browser: 'Safari',
    steps: [
      `Open ${APP_URL} in Safari and sign in.`,
      'Tap the Share button (the square with an arrow) at the bottom of the screen.',
      'Scroll down and tap “Add to Home Screen”, then “Add”.',
      'Open Lead Manager from the new icon and tap “Allow” when it asks to send notifications.',
    ],
  },
  {
    id: 'android', title: 'Android', icon: 'smartphone', browser: 'Chrome',
    steps: [
      `Open ${APP_URL} in Chrome and sign in.`,
      'Tap the ⋮ menu in the top-right corner.',
      'Tap “Install app” (or “Add to Home screen” on older phones), then “Install”.',
      'Open Lead Manager from the app drawer and allow notifications.',
    ],
  },
]

const DISTRIBUTION = [
  {
    id: 'ios', title: 'iOS via Apple Business Manager', icon: 'smartphone' as IconName,
    what: 'A private “custom app” that only your staff can install from the App Store, with no public listing.',
    needs: [
      'An Apple Developer Program membership in the clinic’s name (needs a D-U-N-S number).',
      'An Apple Business Manager account for the clinic.',
      'A native wrapper build of Lead Manager, submitted for review as a custom app.',
      'Devices or Managed Apple IDs enrolled so the app can be assigned to staff.',
    ],
  },
  {
    id: 'android', title: 'Android via managed Google Play', icon: 'smartphone' as IconName,
    what: 'A private app published only to the clinic’s organisation in Google Play, pushed to work phones.',
    needs: [
      'A Google Play Console developer account.',
      'Managed Google Play, through Google Workspace or a device management (EMM) provider.',
      'An Android build of Lead Manager published as a private app to your organisation ID.',
      'Staff phones with a work profile so the app installs automatically.',
    ],
  },
]

export function MobileApp() {
  const { state, me, actions } = useStore()
  const ext = getExt(state)
  const pushRules = state.settings.slaRules.filter(r => r.enabled && r.channels.includes('push'))

  const testPush = () => {
    actions.notify({ userIds: [me.id] }, { kind: 'system', title: 'Test notification', body: 'Push notifications are working on this device. Lead alerts will arrive like this.', link: { page: 'settings', id: 'mobile' } })
    actions.update(d => editExt(d, e => { e.pushTestedAt = iso(Date.now()) }))
    actions.toast('Test notification sent to your devices. Check the bell or your phone.', 'success')
  }

  const copyUrl = async () => {
    const ok = await copyText(APP_URL)
    actions.toast(ok ? 'App address copied. Send it to staff in your team chat.' : 'Copy is blocked here. The address is ' + APP_URL, ok ? 'success' : 'warn')
  }

  const ask = () => window.dispatchEvent(new CustomEvent('lm:open-claude', { detail: { prompt: 'Draft a step-by-step checklist, with owners and rough timings, to distribute Lead Manager privately to staff phones through Apple Business Manager and managed Google Play.' } }))

  return (
    <div className="stack lg">
      <Card title="Install on staff phones" subtitle="Lead Manager installs from the browser like an app: its own icon, full screen and push notifications. Nothing to download from a store."
        actions={<Button size="sm" variant="secondary" icon="copy" onClick={copyUrl}>Copy app address</Button>}>
        <div className="st-install">
          {STEPS.map(s => (
            <section key={s.id} className="st-install-col" aria-label={s.title}>
              <div className="row" style={{ gap: 8 }}>
                <span className="st-list-icon"><Icon name={s.icon} size={16} /></span>
                <div className="stack" style={{ gap: 0 }}>
                  <h3>{s.title}</h3>
                  <span className="tiny muted">Use {s.browser}</span>
                </div>
              </div>
              <ol className="st-steps small">{s.steps.map(x => <li key={x}>{x}</li>)}</ol>
            </section>
          ))}
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Push notifications" subtitle="Sent to every device where someone has installed the app and allowed notifications.">
          <div className="stack lg">
            <ul className="st-push-list small">
              {pushRules.map(r => (
                <li key={r.id}><Icon name="bell" size={14} /><span className="grow">{r.event}</span><span className="tiny muted">{r.notify.map(n => ROLE_LABEL[n]).join(', ')}</span></li>
              ))}
            </ul>
            <div className="row wrap between">
              <span className="small muted">{ext.pushTestedAt ? `Last test ${ago(ext.pushTestedAt)}` : 'Not tested yet'}</span>
              <Button variant="primary" icon="bell" onClick={testPush}>Send me a test notification</Button>
            </div>
            <button type="button" className="st-link small" onClick={() => actions.go('settings', 'notifications')}>Change which events send a push</button>
          </div>
        </Card>

        <Card title="Private app distribution" subtitle="Optional. Puts Lead Manager in the managed app store on clinic-owned phones."
          actions={<Button size="sm" variant="subtle" icon="sparkles" onClick={ask}>Ask Claude for a plan</Button>}>
          <div className="stack lg">
            {DISTRIBUTION.map(d => (
              <section key={d.id} className="st-dist" aria-label={d.title}>
                <div className="row between wrap">
                  <h3>{d.title}</h3>
                  <Chip tone="neutral">Not set up yet</Chip>
                </div>
                <p className="small muted">{d.what}</p>
                <details className="st-allows">
                  <summary>What’s needed</summary>
                  <ul>{d.needs.map(n => <li key={n}>{n}</li>)}</ul>
                </details>
              </section>
            ))}
            <p className="tiny muted">Until then, the installed web app above works on every phone and gets the same notifications.</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
