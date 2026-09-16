import type { DocumentSummary, FolderSummary, Project } from '../models'

export const defaultFolders = ['Manuscript', 'Characters', 'Locations', 'Threads', 'Notes']
/** Created with every project so a manuscript has somewhere to start. */
export const defaultSubfolders = ['Manuscript/Chapter 01']
export const isDefaultFolder = (path: string) => defaultFolders.some(name => name.toLocaleLowerCase() === path.toLocaleLowerCase())

const folderIcons: Record<string, [top: string, nested: string]> = {
  manuscript: ['i-lucide-book-open', 'i-lucide-book-text'],
  characters: ['i-lucide-user-round', 'i-lucide-users'],
  locations: ['i-lucide-map', 'i-lucide-map-pin'],
  threads: ['i-lucide-git-branch', 'i-lucide-route'],
  notes: ['i-lucide-notebook-pen', 'i-lucide-sticky-note'],
}
/** Default folders and everything inside them show what kind of content they hold; other folders stay plain. */
export function folderIcon(path: string) {
  const [top = '', ...rest] = path.split('/')
  const icons = folderIcons[top.toLowerCase()]
  return icons ? icons[rest.length ? 1 : 0] : 'i-lucide-folder'
}
export const parentPath = (path: string) => path.split('/').slice(0, -1).join('/')
export const folderFor = (path: string, title = ''): FolderSummary => ({
  id: `folder:${path}`, path, name: path.split('/').at(-1) || title, parent: path === '' ? null : parentPath(path),
  pinnedView: null, itemOrder: [], positions: {},
})

/** Also handles older browser mirrors and folders introduced by a pending document creation. */
export function completeFolders(folders: FolderSummary[] | undefined, documents: DocumentSummary[], title: string) {
  const result = new Map((folders ?? []).map(folder => [folder.path, { ...folder, itemOrder: [...folder.itemOrder], positions: { ...folder.positions } }]))
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
    ...project.documents.filter(doc => doc.folder === path).sort((a, b) => a.order - b.order).map(doc => ({ key: doc.id, title: doc.title, document: doc })),
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

export function folderDocument(project: Project, folder: FolderSummary) {
  return project.documents.find(doc => doc.folder === folder.path
    && doc.path.split('/').at(-1)?.replace(/\.(md|markdown|txt)$/i, '').toLocaleLowerCase() === folder.name.toLocaleLowerCase())
}
