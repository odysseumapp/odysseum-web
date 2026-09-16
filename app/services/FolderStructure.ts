import type { DocumentSummary, FolderSummary, Project } from '../models'

export const defaultFolders = ['Manuscript', 'Characters', 'Locations', 'Notes', 'Threads']
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
  return items.sort((a, b) => (ranks.get(a.key) ?? Infinity) - (ranks.get(b.key) ?? Infinity))
}

export function folderDocument(project: Project, folder: FolderSummary) {
  return project.documents.find(doc => doc.folder === folder.path
    && doc.path.split('/').at(-1)?.replace(/\.(md|markdown|txt)$/i, '').toLocaleLowerCase() === folder.name.toLocaleLowerCase())
}
