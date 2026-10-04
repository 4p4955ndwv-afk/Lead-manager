// Saves a generated file. Inside a claude.ai preview the page cannot download directly, so it asks the
// viewer through the `downloads` capability; everywhere else it falls back to a normal browser download.

type DownloadsNs = { save: (req: { filename: string; data: string | Blob }) => Promise<unknown> }

let ns: Promise<DownloadsNs | null> | null = null
function getDownloads(): Promise<DownloadsNs | null> {
  if (ns) return ns
  const w = window as unknown as { claude?: { use?: (name: string) => Promise<unknown> } }
  ns = w.claude && typeof w.claude.use === 'function'
    ? w.claude.use('downloads').then(x => (x && typeof (x as DownloadsNs).save === 'function' ? (x as DownloadsNs) : null)).catch(() => null)
    : Promise.resolve(null)
  return ns
}

export type SaveOutcome = 'saved' | 'declined' | 'unavailable'

export async function saveFile(filename: string, data: string, mime = 'text/plain'): Promise<SaveOutcome> {
  const d = await getDownloads()
  if (d) {
    try {
      await d.save({ filename, data })
      return 'saved'
    } catch (e) {
      const code = (e as { code?: string })?.code
      return code === 'declined' ? 'declined' : 'unavailable'
    }
  }
  try {
    const url = URL.createObjectURL(new Blob([data], { type: mime }))
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return 'saved'
  } catch {
    return 'unavailable'
  }
}
