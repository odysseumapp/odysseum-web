
import type { DocumentKind } from '../models'

export function fileName(title: string) {
  let result = title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/^[ .-]+|[ .-]+$/g, '')
  if (!result) result = 'Untitled'
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i.test(result)) result = 'Scene-' + result
  return result
}

export function pathFor(title: string, folder: string, taken: Set<string>) {
  const stem = fileName(title)
  const dir = folder.trim().replace(/^\/+|\/+$/g, '')
  const make = (name: string) => dir ? `${dir}/${name}.md` : `${name}.md`
  let path = make(stem)
  for (let suffix = 2; taken.has(path.toLowerCase()); suffix++) path = make(`${stem}-${suffix}`)
  return path
}

export function projectSlugFor(title: string, taken: Set<string>) {
  const stem = fileName(title)
  let slug = stem
  for (let suffix = 2; taken.has(slug.toLowerCase()); suffix++) slug = `${stem}-${suffix}`
  return slug
}

export function kindFor(path: string): DocumentKind {
  const top = path.split('/')[0].toLowerCase()
  if (top === 'characters') return 'character'
  if (top === 'locations') return 'location'
  if (top === 'threads') return 'thread'
  if (top === 'notes' || top === 'research' || top === 'story notes') return 'note'
  if (top === 'styles') return 'style'
  return 'scene'
}

export const isStoryNote = (path: string) => kindFor(path) !== 'scene'

export const folderDocumentPath = (folder: string) => `${folder}/.${folder.split('/').at(-1)}.md`
export function isFolderDocument(path: string) {
  const parts = path.split('/')
  return parts.length >= 2 && parts[parts.length - 1] === `.${parts[parts.length - 2]}.md`
}
export const isScene = (path: string) => !isStoryNote(path) && !isFolderDocument(path)
