import type { DocumentKind, DocumentSummary, FolderSummary, Project } from '../models'
import { folderDocumentPath, isFolderDocument, kindFor } from './FileNames'

export const defaultFolders = ['Manuscript', 'Characters', 'Locations', 'Threads', 'Notes']
/** Created with every project so a manuscript has somewhere to start. */
export const defaultSubfolders = ['Manuscript/Chapter 01']
export const isDefaultFolder = (path: string) => defaultFolders.some(name => name.toLocaleLowerCase() === path.toLocaleLowerCase())

/** The top-level folders whose name says what kind of documents they hold. */
const kindFolders = new Set(['manuscript', 'characters', 'locations', 'threads', 'notes', 'research', 'story notes'])
/** Default folders and everything inside them show what kind of content they hold; other folders stay plain. */
export function folderIcon(path: string) {
  const top = path.split('/')[0]?.toLowerCase() ?? ''
  return kindFolders.has(top) ? kindFolderIcons[kindFor(path)] : 'i-lucide-folder'
}
export const parentPath = (path: string) => path.split('/').slice(0, -1).join('/')
export const folderFor = (path: string, title = ''): FolderSummary => ({
  id: `folder:${path}`, path, name: path.split('/').at(-1) || title, parent: path === '' ? null : parentPath(path),
  pinnedView: null, itemOrder: [], gridFolder: null,
})

/** Also handles older browser mirrors and folders introduced by a pending document creation. */
export function completeFolders(folders: FolderSummary[] | undefined, documents: DocumentSummary[], title: string) {
  const result = new Map((folders ?? []).map(folder => [folder.path, { ...folder, itemOrder: [...folder.itemOrder], gridFolder: folder.gridFolder ?? null }]))
  const add = (path: string) => {
    if (!result.has(path)) result.set(path, folderFor(path, title))
    if (path) add(parentPath(path))
  }
  add('')
  for (const doc of documents) add(doc.folder)
  return [...result.values()]
}

export type FolderItem = { key: string; title: string; folder: FolderSummary; document?: never }
  | { key: string; title: string; document: DocumentSummary; folder?: never }

export function folderItems(project: Project, path: string): FolderItem[] {
  const folder = project.folders.find(item => item.path === path)
  const items: FolderItem[] = [
    ...project.folders.filter(item => item.parent === path).map(item => ({ key: `folder:${item.name}`, title: item.name, folder: item })),
    // A folder's own document is reached by opening the folder, not listed beside its contents.
    ...project.documents.filter(doc => doc.folder === path && !isFolderDocument(doc.path)).sort((a, b) => a.order - b.order).map(doc => ({ key: doc.id, title: doc.title, document: doc })),
  ]
  const ranks = new Map((folder?.itemOrder ?? []).map((key, index) => [key, index]))
  // Default folders keep their conventional order until the writer rearranges the root.
  const rank = (item: FolderItem) => {
    const explicit = ranks.get(item.key)
    if (explicit !== undefined) return explicit
    const preset = path === '' && item.folder ? defaultFolders.indexOf(item.folder.name) : -1
    return preset < 0 ? Infinity : ranks.size + preset
  }
  return items.sort((a, b) => (rank(a) - rank(b)) || 0)
}

/** Every document under a folder, depth first in the order the views show them. */
export function descendantDocuments(project: Project, path: string): DocumentSummary[] {
  return folderItems(project, path).flatMap(item => item.document ? [item.document] : descendantDocuments(project, item.folder.path))
}

export const kindOrder: DocumentKind[] = ['thread', 'character', 'location', 'scene', 'note']
export const kindLabels: Record<DocumentKind, string> = { thread: 'Thread', character: 'Character', location: 'Location', scene: 'Scene', note: 'Note' }
/** One document of a kind. */
export const kindIcons: Record<DocumentKind, string> = { thread: 'i-lucide-route', character: 'i-lucide-user-round', location: 'i-lucide-map-pin', scene: 'i-lucide-file-text', note: 'i-lucide-sticky-note' }
/** Many of them: what a folder holding that kind shows, at every depth. */
export const kindFolderIcons: Record<DocumentKind, string> = { thread: 'i-lucide-git-branch', character: 'i-lucide-users', location: 'i-lucide-map', scene: 'i-lucide-book-open', note: 'i-lucide-notebook-pen' }

/** Links are undirected: either side listing the other counts. */
export const linked = (a: DocumentSummary, b: DocumentSummary) => a.id !== b.id && (a.links.includes(b.id) || b.links.includes(a.id))
/** Every document linked to `id`, in tree order. */
export function linkedDocuments(project: Project, id: string) {
  const own = project.documents.find(doc => doc.id === id)?.links ?? []
  return descendantDocuments(project, '').filter(doc => doc.id !== id && (own.includes(doc.id) || doc.links.includes(id)))
}
/** Every document but `except`: threads first, then characters, locations, scenes and notes, each in tree order. */
export function documentChoices(project: Project, except?: string) {
  const ordered = descendantDocuments(project, '')
  return kindOrder.flatMap(kind => ordered.filter(doc => doc.kind === kind && doc.id !== except))
}
/** Whether `path` is `parent` or somewhere under it. */
export const insideFolder = (path: string, parent: string) => parent === '' || path === parent || path.startsWith(`${parent}/`)
/** The folder whose documents are the grid's columns: the chosen one, else Threads, else Manuscript, else any other folder. */
export function gridColumnFolder(project: Project, path: string) {
  const folder = project.folders.find(item => item.path === path)
  const chosen = folder?.gridFolder ? project.folders.find(item => item.id === folder.gridFolder) : undefined
  if (chosen) return chosen
  const topLevel = (name: string) => project.folders.find(item => item.parent === '' && item.name.toLocaleLowerCase() === name)
  return [topLevel('threads'), topLevel('manuscript'), ...project.folders.filter(item => item.parent === '')]
    .find(item => item && !insideFolder(path, item.path))
}

export function folderDocument(project: Project, folder: FolderSummary) {
  return folder.path ? project.documents.find(doc => doc.path === folderDocumentPath(folder.path)) : undefined
}
