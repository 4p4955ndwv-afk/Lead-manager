// Demo helper: lets a tester type as the client to watch the AI engine react (handoff, clinical routing, opt-out…).
import { useId, useState } from 'react'
import { useStore } from '../../lib/store'
import { Button } from '../../components/ui'
import { Icon } from '../../components/icons'

function dramaNumber(): string {
  // Ofcom drama range 07700 900000–900999: never a real person's number
  return `07700 900${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`
}

const PRESETS: { id: string; label: string; text: () => string }[] = [
  { id: 'phone', label: 'Shares a number', text: () => `Sure, my number is ${dramaNumber()}, after 6pm is best` },
  { id: 'asked', label: 'Asks for our number', text: () => 'Can I have your phone number? I\'d rather call' },
  { id: 'price', label: 'Asks the price', text: () => 'How much would that cost roughly?' },
  { id: 'clinical', label: 'Clinical question', text: () => 'Is it safe if I have eczema on that area?' },
  { id: 'complaint', label: 'Complains', text: () => 'I waited ages for a reply, really disappointed' },
  { id: 'stop', label: 'Says stop', text: () => 'stop' },
]

export function DemoClientReply({ convId, clientName }: { convId: string; clientName: string }) {
  const { actions } = useStore()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const id = useId()
  const first = clientName.split(' ')[0]

  const send = (t: string) => {
    const msg = t.trim()
    if (!msg) return
    actions.receiveMessage(convId, msg)
    setText('')
    actions.toast(`Sent as ${first}. The AI reacts in about 2 seconds.`, 'info')
  }

  return (
    <div className={`ib-demo ${open ? 'is-open' : ''}`}>
      <button type="button" className="ib-demo-toggle" aria-expanded={open} aria-controls={id + '-panel'} onClick={() => setOpen(o => !o)}>
        <span className="ib-demo-tag">Demo</span>
        <span className="grow">Reply as the client</span>
        <Icon name={open ? 'chevronDown' : 'chevronRight'} size={15} />
      </button>
      {open && (
        <div className="ib-demo-panel" id={id + '-panel'}>
          <p className="tiny muted">Pretend to be {first} to test the flow. Nothing is sent to a real person.</p>
          <div className="ib-demo-presets">
            {PRESETS.map(p => (
              <button key={p.id} type="button" className="ib-demo-chip" onClick={() => send(p.text())}>{p.label}</button>
            ))}
          </div>
          <form className="ib-demo-form" onSubmit={e => { e.preventDefault(); send(text) }}>
            <label htmlFor={id} className="sr-only">Message from {first}</label>
            <input id={id} className="input" value={text} onChange={e => setText(e.target.value)} placeholder={`Type what ${first} says…`} />
            <Button type="submit" size="sm" variant="secondary" icon="send" disabled={!text.trim()}>Send as {first}</Button>
          </form>
        </div>
      )}
    </div>
  )
}
