// Route #client shows the client directory; #client~<clientId> shows one person's record.
import { useStore } from '../lib/store'
import { Directory } from './client/Directory'
import { Record } from './client/Record'
import './client.css'

export default function ClientRecord() {
  const { route } = useStore()
  return route.id ? <Record key={route.id} clientId={route.id} /> : <Directory />
}
