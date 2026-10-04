import type { DocumentKind } from '../models'

/** The file name the server would make from a title. Only used for documents made on this device until the server answers. */
export function fileName(title: string) {
  let result = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/^[ .-]+|[ .-]+$/g, '')
  if (!result) result = 'Untitled'
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(result)) result = 'Scene-' + result
  return result
}

/** The kind of a document in a top-level folder with that name. The server decides the real kind; this is only for items
 *  made on this device until the server answers. */
export function kindForTopFolder(name: string | undefined): DocumentKind {
  const top = (name ?? '').toLowerCase()
  if (top === 'characters') return 'character'
  if (top === 'locations') return 'location'
  if (top === 'threads') return 'thread'
  if (top === 'notes' || top === 'research' || top === 'story notes') return 'note'
  if (top === 'styles') return 'style'
  return 'scene'
}
